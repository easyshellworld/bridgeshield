FROM node:20-alpine AS builder
WORKDIR /app

# 安装 OpenSSL 库（Prisma 需要）
RUN apk add --no-cache openssl

# 复制 package.json 和锁文件用于缓存
COPY package*.json ./
COPY prisma ./prisma/

# 安装所有依赖（包括 dev 依赖，用于构建）
RUN npm ci

# 复制源代码和数据
COPY src ./src
COPY data ./data
COPY tsconfig.json ./

# 生成 Prisma 客户端
RUN npx prisma generate

# 构建应用
RUN npm run build

# 创建初始数据库并运行种子（在构建阶段）
ENV DATABASE_URL="file:/app/data/dev.db"
RUN mkdir -p /app/data && npx prisma db push --accept-data-loss && npx prisma db seed

# 生产阶段
FROM node:20-alpine
WORKDIR /app

# 安装 OpenSSL 库（Prisma 需要）
RUN apk add --no-cache openssl

# 只复制 package.json 用于生产依赖安装
COPY package*.json ./

# 安装生产依赖
RUN npm ci --omit=dev

# 从构建阶段复制必要的文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/data ./data

# 在生产阶段重新生成 Prisma 客户端，确保正确的平台和路径
RUN npx prisma generate

# 设置环境变量
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/dev.db"
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 启动命令：直接启动应用（数据库已在构建阶段初始化）
CMD ["node", "dist/app.js"]