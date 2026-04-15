FROM node:20-alpine AS builder
WORKDIR /app

# 安装 OpenSSL 库（Prisma 需要）
RUN apk add --no-cache openssl

# 复制 package.json 和锁文件用于缓存
COPY package*.json ./
COPY prisma ./prisma/

# 安装所有依赖（包括 dev 依赖，用于构建）
RUN npm ci

# 复制源代码
COPY . .

# 生成 Prisma 客户端
RUN npx prisma generate

# 构建应用
RUN npm run build

# 创建初始数据库并运行种子（在构建阶段）
RUN mkdir -p /app/data && npx prisma db push --accept-data-loss && npx prisma db seed

# 生产阶段
FROM node:20-alpine
WORKDIR /app

# 安装 OpenSSL 库（Prisma 需要）
RUN apk add --no-cache openssl

# 安装生产依赖（包括 @prisma/client）
COPY package*.json ./
RUN npm ci --only=production

# 从构建阶段复制必要的文件
# 1. 复制构建的应用程序
COPY --from=builder /app/dist ./dist
# 2. 复制 Prisma schema 文件
COPY --from=builder /app/prisma ./prisma
# 3. 在生产阶段重新生成 Prisma 客户端，确保正确的平台和路径
RUN npx prisma generate

# 创建数据目录用于 SQLite 数据库
RUN mkdir -p /app/data

# 设置环境变量
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/dev.db"
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 启动命令：直接启动应用（数据库已在构建阶段初始化）
CMD ["node", "dist/app.js"]