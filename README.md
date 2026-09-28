# 健康管家 · 同步后端（端到端加密）

零依赖 Node.js 服务，作为「哑存储」仅保存加密后的密文（salt / iv / data）与时间戳，
**无法解密**任何用户健康数据。配套前端为「健康管家」（隐私优先的 AI 个人健康管理系统）。

## 特性
- 端到端加密：密钥由客户端密码经 PBKDF2(10 万次) + AES-GCM 派生，密码从不上传。
- 零依赖：仅用 Node.js 内置模块，无需 `npm install`。
- 多设备共用：同一「同步 ID + 密码」即可跨手机/电脑共享一套数据。

## 部署
- **Railway**：仓库根含 `railway.json`，直接一键部署（Dockerfile 构建）。
- **Render**：仓库根含 `render.yaml`，直接一键部署（免费 Web 服务，自动 HTTPS）。
- **Docker**：`docker compose up -d --build`。

## 接口
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查，返回 `{"ok":true}` |
| GET | `/sync/:id` | 拉取密文，不存在返回 404 |
| PUT | `/sync/:id` | 上传密文（body 为 `{salt,iv,data}`） |

环境变量：`PORT`（默认 8080）、`SYNC_DATA_DIR`（密文存储目录，默认 `./sync-data`）。
