# backend —— AI寻物宝后端

Node.js + Express，模块化结构（routes / controllers / services），数据保存在 `database/lost_items.json`，上传图片保存在 `backend/uploads/`（通过 `/uploads` 静态访问）。

## 启动

```bash
npm run dev     # 开发模式（node --watch 热重载），端口 3001
npm start       # 生产模式
```

## AI 图片识别（AIService）

上传失物时会自动调用 AI 识别，生成标签存入 `item.aiTags`。

### 提供商
- `mock`（默认）：离线模拟识别，对图片哈希取种子，同一张图结果稳定，模拟 700~1300ms
- `zhipu`：智谱 GLM-4.6V-Flash 真实视觉模型（免费）
- `openai`：预留骨架

### 智谱 GLM-4.6V-Flash 接入
- 独立服务：`src/services/glmVisionService.js`，导出 `analyzeLostItemImage(image)`，支持图片路径 / Base64 / dataURL / Buffer
- 配置（仅后端环境变量，前端永不接触）：复制 `backend/.env.example` 为 `backend/.env`：
  ```bash
  AI_PROVIDER=zhipu
  ZHIPU_API_KEY=你的Key
  ```
- 固定 Prompt，要求模型严格输出 JSON：`{ category, color, shape, material, features, text, confidence }`；代码内做 JSON 容错解析（容忍 ```json 围栏）
- 异常处理：网络/超时/401/429/5xx 均返回友好错误；`AI_FALLBACK_TO_MOCK=true`（默认）时自动降级 mock，发布流程不中断
- 状态查看：`GET /api/ai/status`
- 结构：`src/services/ai/`（ai.service.js + providers/mock、openai）+ `src/services/glmVisionService.js`
## 接口

统一响应格式：`{ code, data, message }`，业务错误时 code=1。

### 1. POST /api/upload —— 发布失物（自动 AI 识别）

请求体（JSON）：
| 字段 | 必填 | 说明 |
| --- | --- | --- |
| image | 是 | 图片 dataURL（`data:image/jpeg;base64,...`），前端已压缩 |
| place | 是 | 拾取地点（地点A，私有） |
| description | 是 | 物品描述 |
| type | 否 | 物品类型（证件/电子产品/文具/衣物/水杯/钥匙/其他） |
| color | 否 | 颜色（留空时使用 AI 识别结果） |
| pickerId / pickerName | 否 | 拾取人标识/昵称（Demo 阶段直接传） |

响应：`data.item` 含保存的失物（含地点A），`data.aiTags` 为 AI 识别标签。

```bash
curl -X POST http://localhost:3001/api/upload -H "Content-Type: application/json" -d "{\"image\":\"data:image/png;base64,...\",\"place\":\"图书馆二楼\",\"description\":\"黑色蓝牙耳机\"}"
```

### 2. GET /api/lost-items —— 公开失物列表

查询参数（均可选）：`type`、`status`（OPEN/CLAIMING/RESOLVED/CLOSED）、`keyword`（可匹配 aiTags 标签）。

```bash
curl "http://localhost:3001/api/lost-items"
```

> 返回项**不包含 place（地点A）**，也不包含认领详情；包含 AI 标签 `aiTags`。

### 3. POST /api/claim —— 申请认领

```bash
curl -X POST http://localhost:3001/api/claim -H "Content-Type: application/json" -d "{\"itemId\":\"...\",\"claimantName\":\"李四\",\"note\":\"这是我的耳机\"}"
```

### 3.1 POST /api/claims/:claimId/approve —— 拾取人通过认领

通过后申请变为 APPROVED、物品变为 RESOLVED，并从公开列表消失（其余待审核申请自动关闭）。

```bash
curl -X POST http://localhost:3001/api/claims/<claimId>/approve
```

### 3.2 POST /api/claims/:claimId/reject —— 拾取人拒绝认领

拒绝后申请变为 REJECTED，若没有其他活跃申请，物品回到待认领(OPEN)。

```bash
curl -X POST http://localhost:3001/api/claims/<claimId>/reject

### 3.3 GET /api/admin/pending-claims —— 管理员待审核列表

返回所有含「待审核」认领的物品（含地点A，管理员可见），配合 approve / reject 完成审核。

```bash
curl http://localhost:3001/api/admin/pending-claims
```
```

### 4. GET /api/my-items?userId=xxx —— 用户相关记录

```bash
curl "http://localhost:3001/api/my-items?userId=u1"
```

返回：
- `pickedItems`：该用户发布的失物（含地点A，本人可见）
- `claimedItems`：该用户认领的失物（默认不含地点A，认领通过后才展示）

## 🔐 账号与认证

- `POST /api/auth/register`：注册（username / password / confirmPassword）
- `POST /api/auth/login`：登录，返回 `{ token, user }`
- `POST /api/auth/logout`：登出
- `GET /api/auth/me`：当前用户（需登录）
- 受保护接口需在请求头携带 `Authorization: Bearer <token>`
- 认领审核权限：拾取人本人 或 管理员

## 🧬 图片去重与访问日志

- 图片内容哈希：上传时计算 SHA-256 存入 `imageHash`，相同图片（OPEN/CLAIMING 状态）再次上传返回 409
- 访问日志：所有 `/api` 请求与页面访问写入 `database/access_logs.json`（保留最近 1000 条）；管理员查看 `GET /api/admin/logs`

## 目录结构

```
backend/
├── package.json
└── src/
    ├── index.js                     # 入口：中间件、静态资源、路由挂载
    ├── db.js                        # database/lost_items.json 读写（串行队列）
    ├── routes/                      # 路由定义
    ├── controllers/                 # 参数校验 + 响应封装
    ├── services/                    # 业务逻辑 + AI 识别
    │   └── ai/                      # AIService（mock / openai provider）
    ├── middleware/                  # 错误处理
    └── utils/                       # response / 图片保存
```