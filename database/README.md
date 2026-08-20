# database/

使用 JSON 文件模拟数据库，便于 Demo 阶段快速迭代。

- db.json —— 唯一数据源，当前包含三个集合：
  - users：用户
  - items：失物
  - claims：认领申请

后续可平滑迁移到 SQLite + Prisma，届时字段结构以 Prisma schema 为准。