FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files for caching
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built application and Prisma files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# 关键修复：复制 Prisma 客户端
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 创建数据目录
RUN mkdir -p /app/data

# 设置默认环境变量（可在 Dokploy 中覆盖）
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/dev.db"
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 演示版启动命令：初始化数据库并启动应用
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx prisma db seed && node dist/app.js"]