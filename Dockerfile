# ---------- 构建阶段：编译 better-sqlite3 原生模块 ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# 1. 替换 Debian 源为阿里云，加速 apt 下载
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# 只把依赖清单拷进来：这一层的缓存键 = package.json / package-lock.json 的内容
# 所以「只改业务代码」不会触发重新 npm ci；版本号放 VERSION 文件，发版也不动这两个文件
COPY package.json package-lock.json* ./

# 2. 替换 npm 源为淘宝源，加速 node 模块下载
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry "$NPM_REGISTRY" && \
    npm config set fetch-retries 5 && \
    npm config set fetch-timeout 120000 && \
    if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund --prefer-offline; \
    else \
      npm install --omit=dev --no-audit --no-fund --prefer-offline; \
    fi

# ---------- 运行阶段 ----------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

WORKDIR /app

# 数据目录 + 运行时需要的工具（gosu 用于降权）
RUN apt-get update && \
    apt-get install -y --no-install-recommends gosu tini && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /app/data/uploads && \
    chown -R node:node /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json VERSION server.js appsettings*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

# 入口脚本：以 root 启动 → 修正数据目录属主 → 降权到 node 运行
COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
