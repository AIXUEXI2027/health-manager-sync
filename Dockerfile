# 健康管家同步后端 —— 零依赖 Node 服务
# 仅依赖 Node.js 内置模块，镜像极小、构建极快。
FROM node:18-alpine

WORKDIR /app

# 复制单文件服务（无需 npm install）
COPY sync-server.js ./

# 数据目录：运行时用卷挂载以持久化密文
RUN mkdir -p /app/sync-data

ENV PORT=8080
ENV SYNC_DATA_DIR=/app/sync-data

EXPOSE 8080

# 健康检查交给平台（GET /health）；如需进程守护由平台 restartPolicy 负责
CMD ["node", "sync-server.js"]
