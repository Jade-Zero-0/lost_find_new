# 🔍 AI寻物宝 · 校园智能失物招领平台

面向**创新创业竞赛**的完整网页 Demo：拾取者上传失物照片 → **AI 自动识别生成标签** → 失主在大厅浏览、申请认领 → 拾取者审核通过后，失主获得**地点A**（存放位置），物品自动从公共列表消失。

## ✨ 核心流程

```
用户A（拾取者）                    用户B（失主）
   │                                  │
   ├─ 发布失物（图片+存放地点*+Tips+描述）│
   ├─ 保存图片 → 自动调用 AI 识别      │
   │                                  ├─ 浏览失物大厅（看到 📍地点Tips）
   │                                  ├─ 申请认领（状态→认领中）
   ├─ 查看认领申请 → 审核通过 ─────────┤
   │   （状态→已认领）                  ├─ 获得存放地点+详细地点
   │                                  ├─ 前往领取 → 确认「我已领取」
   └─ 状态→已归还，从公共列表消失 ─────┘
```

## 🔐 账号与权限

- 支持**注册**（用户名 + 自定义密码 + 确认密码）与**登录**（用户名 + 密码）
- 演示账号（登录页可一键填入 userA / userB；**管理员不提供一键填入**，需手动输入密码）：

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| userA | 123456 | 普通用户（拾取者） |
| userB | 123456 | 普通用户（失主） |
| admin | 见 `backend/.env` 的 `ADMIN_INIT_PASSWORD` | 管理员（审核中心 / 查看日志） |

- 后端首次启动时若用户表为空，会自动创建以上账号（管理员密码来自 `ADMIN_INIT_PASSWORD`，默认 `admin123`，公网部署务必修改）
- 已存在的管理员改密码：`node scripts\set-admin-password.mjs <新密码>`（无需删库）
- 发布失物、申请认领、我的页面、认领审核均需登录
- 认领审核权限：拾取人本人 或 管理员

## 🧬 进阶功能

- **图片内容哈希去重**：上传时计算图片 SHA-256，相同图片不可重复发布（返回 409 提示）
- **网页访问信息记录**（稳妥的文件日志方案）：后端自动记录所有 /api 请求与前端页面访问到 `database/access_logs.json`（保留最近 1000 条），管理员可通过 `GET /api/admin/logs` 查看
- **多模型 AI 链路**：智谱 GLM-4.6V-Flash（只尝试 1 次）→ 超时/失败切换备用模型 GLM-4.6V → 限流时直接提示、不静默降级 mock

## 🛠 技术栈

| 端 | 技术 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS 4（自研 hash 路由，零额外依赖） |
| 后端 | Node.js + Express（ESM，模块化 routes / controllers / services） |
| 数据库 | JSON 文件模拟：`database/lost_items.json` |
| AI | AIService：mock 离线模拟 / 智谱 GLM-4.6V-Flash + GLM-4.6V 备用（Provider 可扩展） |

## 📁 目录结构

```
├── package.json            # npm workspaces + 一键启动
├── database/
│   ├── lost_items.json     # 失物数据（含认领记录）
│   ├── users.json          # 账号（scrypt 加盐）
│   └── sessions.json       # 登录会话
├── backend/                # Node.js + Express
│   ├── uploads/            # 上传图片 + 种子图片
│   ├── .env.example        # AI Key 等环境变量模板（复制为 .env 使用）
│   └── src/
│       ├── index.js        # 入口
│       ├── db.js           # JSON 读写（串行队列）
│       ├── routes/ · controllers/ · services/
│       ├── services/ai/    # AIService（ai.service / providers / ai-errors / vision-utils）
│       ├── services/glmVisionService.js      # 智谱 GLM-4.6V-Flash（默认只尝试 1 次）
│       ├── services/deepseekVisionService.js # DeepSeek V4（预留：官方 API 纯文本）
│       └── utils/ · middleware/
├── docs/DEPLOY.md          # 生产部署指南
└── frontend/               # React + TS + Tailwind
    ├── .env.example        # 构建环境变量模板（VITE_API_BASE_URL 等）
    └── src/
        ├── pages/          # 首页 / 失物大厅 / 发布 / 我的 / 登录
        ├── components/     # 卡片 / 加载 / 空状态 / Toast / 布局
        └── lib/            # api / router / user / image / format
```

## 🚀 快速开始

环境要求：Node.js >= 18.17（推荐 20+），npm >= 9。

```bash
# 1. 首次：安装依赖（仅需一次）
npm install

# 2. 启动前后端（后端 3001，前端 5173）
npm run dev
```

- 前端页面：http://localhost:5173
- 后端健康检查：http://localhost:3001/api/health

> 顶部导航右侧可切换**当前身份**：用户A·拾取者 / 用户B·失主 / **管理员**（管理员可在「我的 → 审核中心」审核任意认领申请）。

## 🌍 生产部署

完整部署指南见 [docs/DEPLOY.md](docs/DEPLOY.md)（前端构建、后端启动、Nginx/PM2/systemd、环境变量清单）。
本地电脑临时公网分享（无需服务器、安全稳定版）见 [docs/DEPLOY-TUNNEL.md](docs/DEPLOY-TUNNEL.md)。

```bash
# 1. 构建前端（读 frontend/.env 的 VITE_API_BASE_URL）
npm run build

# 2. 配置 backend/.env（GLM_API_KEY 必填，HOST=0.0.0.0 允许公网访问）

# 3. 启动生产服务（Express 自动托管 frontend/dist + /api + /uploads）
npm run start
```

- 前端 API 地址：`VITE_API_BASE_URL` 环境变量（默认同源，无写死 localhost）
- 后端监听：`HOST=0.0.0.0`（默认）；上传目录 `UPLOAD_DIR`、图片上限 `MAX_UPLOAD_MB`、CORS 来源 `CORS_ORIGIN` 均可配置

## 🎬 演示脚本（5 分钟）

**第一步 · 用户A 发布（AI 识别）**
1. 身份保持「用户A · 拾取者」
2. 进入「发布失物」，上传图片；必填「当前失物存放地点」（如“宿管站103室”）；可填地点Tips（公开，如“图书馆附近”）、详细地点（私有）、其他描述/信息B（私有）
3. 点「提交发布」→ “正在上传图片…” → “正在AI分析…” → “分析完成”，自动生成标签
4. 页面显示发布成功 + AI 标签

**第二步 · 用户B 浏览并认领**
1. 右上角切换身份为「用户B · 失主」
2. 进入「失物大厅」→ 看到新物品（图片/类型/颜色/📍地点Tips/状态，**看不到存放地点与详细地点**）
3. 点「申请认领」→ 物品状态变为「认领中」

**第三步 · 审核通过（用户A 或 管理员）**
1. 切回「用户A · 拾取者」→「我的」→「我的发布」，该物品状态显示「认领中」
2. 找到「认领申请」→ 点「通过」→ 状态变为「已认领」

**第四步 · 用户B 获得地点并确认领取**
1. 切回「用户B · 失主」→「我的」→「我的认领」
2. 显示 📍 当前存放地点 + 📌 详细地点
3. 点「我已领取到失物」→ 确认 → 状态变为「已归还」

**第五步 · 物品消失**
1. 回到「失物大厅」刷新 → 该物品已从公共列表消失；用户A 与 用户B 都能在「我的」看到最终状态「已归还」

## 🔌 API 一览

统一响应：`{ code, data, message }`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /api/upload | 发布失物（需登录；image dataURL + place[存放地点,必填] + description + locationTips[公开] + detailLocation[私有] + informationB[私有]…；保存图片并创建记录 `aiStatus=processing`，自动后台 AI 分析；相同图片 409 去重；AI 失败不中断，物品仍保存） |
| GET | /api/items/:id | 物品详情（按身份返回：普通用户=公开字段；发布者=全部；认领已通过的申请者=公开+存放地点+详细地点） |
| GET | /api/lost-items | 公开列表（仅公开字段；不含已归还/已下架） |
| POST | /api/claim | 申请认领（需登录，`{ itemId, note }`；状态→认领中） |
| POST | /api/claims/:claimId/approve | 拾取人/管理员通过认领（状态→已认领，记录 claimantId/claimApprovedAt） |
| POST | /api/claims/:claimId/reject | 拾取人拒绝认领（物品回到待认领） |
| POST | /api/items/:id/confirm-return | 认领通过的申请者确认已领取（状态→已归还；非申请者 403） |
| GET | /api/admin/pending-claims | 管理员查看所有待审核认领 |
| GET | /api/my-items | 我的记录（需登录）：pickedItems（发布者视图，含私有字段）/ claimedItems（认领通过后含存放地点+详细地点） |
| GET | /api/health | 健康检查 |
| POST | /api/auth/register | 注册（username + password + confirmPassword） |
| POST | /api/auth/login | 登录，返回 token + user |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/me | 当前用户（需登录） |
| GET | /api/admin/logs | 管理员查看访问/操作日志 |
| GET | /api/ai/status | 当前 AI 配置：provider / 调用链 / 两模型是否已配置 Key / 是否兜底 mock |

> 失物记录字段（私有信息只在后端按权限返回，公开接口绝不泄露）：`place`（当前存放地点，私有、新发布必填）、`locationTips`（地点Tips，公开）、`detailLocation`（详细地点，私有）、`informationB`（其他描述/验证信息，私有）、`aiStatus/aiError/category/shape/material/features/aiConfidence`（AI 结果，AI 详细结果仅发布者可见）、`claimantId/claimRequestedAt/claimApprovedAt/claimedAt/returnedAt`（认领闭环时间戳）。
> 状态机：待认领(OPEN) → 认领中(CLAIMING) → 已认领(CLAIMED) → 已归还(RESOLVED)；认领被拒可回到待认领。

## 🧪 测试数据

`database/lost_items.json` 内置 5 条演示失物（图片在 `backend/uploads/seed-*.svg`）：
- 3 条待认领（校园卡 / 蓝牙耳机 / 保温杯）
- 1 条认领中（雨伞，用户B 的待审核申请）
- 1 条已归还（笔记本，用户B 已通过 → 演示“从公共列表消失”）

重置数据：将 `database/lost_items.json` 恢复为 `{ "items": [] }` 或重新运行种子脚本。

## 🤖 AI 识别（AIService）

上传失物时后端自动调用 AI 识别，生成标签存入 `item.aiTags`。

**调用链（AI_PROVIDER=zhipu 时）**

```
智谱 GLM-4.6V-Flash（第一优先，只尝试 1 次）
        │ 超时/失败
        ▼
智谱 GLM-4.6V（备用高性能模型，只尝试 1 次）
        │
        ├─ 成功 → 返回备用模型识别标签
        ├─ 限流(429) → 直接返回「AI 识别请求过于频繁，请稍后重试」，绝不降级 mock
        └─ 其他失败 → AI_FALLBACK_TO_MOCK=true 时用 mock 兜底，演示不中断
```

> ⚠️ **DeepSeek V4 不能用于识图**：据 DeepSeek 官方文档，`deepseek-v4-flash` / `deepseek-v4-pro` 通过官方 API 是**纯文本模型**，不支持图片输入（会返回 HTTP 400 `InvalidParameter: image_url`）。因此本项目不再把 DeepSeek 作为视觉备用模型，代码仅保留（`deepseekVisionService.js`）待其开放识图后启用。

**环境变量（backend/.env，复制自 .env.example）**

| 变量 | 说明 |
| --- | --- |
| AI_PROVIDER | `mock`（离线模拟）/ `zhipu`（真实视觉模型，默认）/ `auto` |
| GLM_API_KEY | **必填**。智谱开放平台 Key（仅后端读取 `process.env.GLM_API_KEY`，前端永不接触、日志绝不打印）；旧变量 `ZHIPU_API_KEY` 仍兼容 |
| GLM_MODEL / GLM_BASE_URL | 智谱主模型与端点，默认 `glm-4.6v-flash` |
| GLM_FALLBACK_MODEL | 备用视觉模型，默认 `glm-4.6v`（高性能版，非免费） |
| GLM_MAX_RETRIES / GLM_RETRY_DELAY_MS | 主模型重试次数（默认 0=只尝试 1 次；设为 1=429 退避重试共 2 次）与间隔（默认 2000ms） |
| GLM_TIMEOUT_MS / AI_TIMEOUT_MS | 单次请求超时，默认 8000ms（避免等待过久） |
| AI_FALLBACK_TO_MOCK | 整条链失败且非限流时是否 mock 兜底（默认 false=禁用 mock；限流永不兜底） |

**标签字段**：`type`（类别）、`color`、`shape`、`material`（材质）、`feature`（外观特征）、`text`（可识别文字）、`confidence`（置信度）、`provider`、`model`

**代码结构（方便替换其他视觉模型）**

```
backend/src/services/
├── ai/
│   ├── ai.service.js            # 统一入口 + 调用链编排（zhipu → zhipu-fallback → mock/错误）
│   ├── ai-errors.js             # 统一错误码（限流/鉴权/网络/解析…）
│   ├── vision-utils.js          # 共享：固定 Prompt / 图片解析 / JSON 提取 / 字段规范化
│   └── providers/               # Provider 注册制（mock / openai 骨架）
├── glmVisionService.js          # 智谱 GLM-4.6V-Flash（analyzeLostItemImage，支持备用模型参数）
└── deepseekVisionService.js     # DeepSeek V4（预留：官方 API 纯文本，暂不支持识图）
```

接入新视觉模型：新建 `xxxVisionService.js`（实现 `analyzeLostItemImage`），在 `ai.service.js` 的 `PROVIDERS` 与 `CHAINS` 中注册即可。

## ❓ 常见问题

- **前端提示“加载失败”**：确认后端已启动（`npm run dev` 或后端单跑 `npm run dev:backend`）
- **日志出现“zhipu 识别失败，已降级到 mock”**：智谱免费模型触发限流(429)等原因导致识别失败，demo 自动用 mock 兜底保证演示不中断；已实现主/备用模型切换（GLM-4.6V-Flash → GLM-4.6V），可错峰重试
- **提示“AI 识别请求过于频繁，请稍后重试”**：智谱主模型与备用模型均被限流。此时**不会**静默生成 mock 标签，稍后重试或更换 API Key 即可
- **端口占用**：后端 3001、前端 5173，被占用时修改 `backend/src/index.js` 的 PORT 或 vite 配置
- **npm 11 漏装 scheduler（历史问题）**：若 `npm run dev` 报 `Could not resolve "scheduler"`，执行 `npm install scheduler@0.27.0`；若 `npm install` 报 `Invalid Version`，删除 `node_modules` 与 `package-lock.json` 后重装
- **BOM 报错**：源码文件请保持 UTF-8 无 BOM

## 📌 规划（后续可选）

- 管理后台（物品上下架、认领仲裁）
- SQLite + Prisma 替换 JSON 存储
- 账号体系（学号登录）替换 Demo 身份切换
- 图片识别结果缓存（相同图片直接读缓存，节省 API 费用）