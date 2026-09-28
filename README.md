# 健康管家 · 同步后端（端到端加密）

零依赖 Node 服务，作为「哑存储」仅保存加密后的密文（salt / iv / data）与时间戳，
**无法解密**任何用户健康数据。配套前端为「健康管家」（隐私优先的 AI 个人健康管理系统）。

## 特性
- 端到端加密：密钥由客户端密码经 PBKDF2(10 万次) + AES-GCM 派生，密码从不上传。
- 多设备共用：同一「同步 ID + 密码」即可跨手机/电脑共享一套数据。

## 两种后端形态（同一份逻辑，隐私保证完全一致）
1. 长运行服务 `sync-server.js`：用于 **Docker / Railway / Render**（用本地文件系统存密文）。
2. Serverless 函数 `api/`：用于 **Vercel**（用 Vercel KV 键值库存密文）。

## 部署
- **Vercel（★ 推荐，无需信用卡）**：仓库含 `api/`、`vercel.json`、带 `@vercel/kv` 的 `package.json`。
  从 GitHub 一键导入；在 Vercel 控制台创建并关联一个 KV 数据库，部署即得 `https://xxx.vercel.app`。
- **Docker**：`docker compose up -d --build`（用 sync-server.js + 本地文件存储）。
- **Render / Railway**：仓库含 `render.yaml` / `railway.json` 可一键部署（注：免费套餐也需绑定信用卡）。

## 接口（两种形态路径一致，前端无需改动）
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查，返回 `{"ok":true}` |
| GET | `/sync/:id` | 拉取密文，不存在返回 404 |
| PUT | `/sync/:id` | 上传密文（body 为 `{salt,iv,data}`） |

环境变量（仅 sync-server.js 用到）：`PORT`（默认 8080）、`SYNC_DATA_DIR`（密文存储目录，默认 `./sync-data`）。
