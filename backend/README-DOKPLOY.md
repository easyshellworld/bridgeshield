# BridgeShield Backend - Dokploy 部署指南

## 修复的问题

### 1. Prisma客户端初始化错误 (@prisma/client did not initialize yet)
**原因**: Docker镜像中缺少OpenSSL库，Prisma客户端需要它来生成引擎文件。

**修复**:
- 在Dockerfile的构建阶段和生产阶段都添加: `RUN apk add --no-cache openssl`
- 在构建阶段生成Prisma客户端: `RUN npx prisma generate`
- 在生产阶段重新生成以确保正确的平台: `RUN npx prisma generate`

### 2. 风险数据文件加载失败 (Failed to load risk data files)
**原因**: Dockerfile没有复制`data/`目录到容器中。

**修复**:
- 在构建阶段复制: `COPY data ./data`
- 在生产阶段从构建阶段复制: `COPY --from=builder /app/data ./data`

### 3. 数据库初始化环境变量缺失
**原因**: 在构建阶段运行`prisma db push`时没有设置`DATABASE_URL`环境变量。

**修复**:
- 在构建阶段添加: `ENV DATABASE_URL="file:/app/data/dev.db"`

## Dockerfile 最终版本

```dockerfile
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
```

## 环境变量配置

在Dokploy中需要设置以下环境变量:

### 必需的环境变量
```
DEMO_API_KEY=bridgeshield-demo-key      # API密钥（前后端需一致）
DATABASE_URL="file:/app/data/dev.db"    # SQLite数据库路径
NODE_ENV=production                     # 环境模式
PORT=3000                               # 服务端口
```

### 可选的环境变量
```
ADMIN_INIT_USERNAME=admin              # 初始管理员用户名
ADMIN_INIT_PASSWORD=admin123           # 初始管理员密码
JWT_SECRET=your-jwt-secret-here        # JWT签名密钥
LOG_LEVEL=info                         # 日志级别
API_VERSION=v1                         # API版本
```

## 验证步骤

### 1. 构建验证
```bash
docker build -t bridgeshield-backend .
```

### 2. 运行验证
```bash
docker run -d --name bridgeshield-test \
  -p 3001:3000 \
  -e DEMO_API_KEY=bridgeshield-demo-key \
  bridgeshield-backend
```

### 3. 健康检查
```bash
curl http://localhost:3001/api/v1/health
```
**预期输出**:
```json
{
  "status": "healthy",
  "services": {
    "database": { "healthy": true, "status": "connected" },
    "riskData": { "healthy": true, "status": "loaded", "riskDataCount": 49, "whitelistCount": 25 }
  }
}
```

### 4. API功能验证
```bash
curl -X POST http://localhost:3001/api/v1/aml/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: bridgeshield-demo-key" \
  -d '{"address":"0x1234567890abcdef1234567890abcdef12345678","chainId":1}'
```

## 前端配置

两个前端应用已配置为使用Netlify部署，并设置了正确的代理规则:

### 1. Netlify 配置 (`netlify.toml`)
```toml
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/api/*"
  to = "https://bridgeshield.x404.online/api/:splat"
  status = 200
  force = true
```

### 2. 环境变量
前端环境变量已更新:
```
VITE_API_BASE_URL=/api
VITE_API_KEY=bridgeshield-demo-key
```

## 数据库说明

- 使用SQLite数据库，文件位于容器内的 `/app/data/dev.db`
- 数据库schema和初始数据已在构建阶段通过`prisma db push`和`prisma db seed`创建
- 数据文件会持久化在容器中，重启容器不会丢失数据

## 故障排除

### 1. API返回 "Valid API key is required"
- 确保设置了 `DEMO_API_KEY` 环境变量
- 确保API请求头包含: `X-API-Key: bridgeshield-demo-key`

### 2. 应用启动时出现 "Failed to load risk data files"
- 确保Dockerfile正确复制了`data/`目录
- 检查容器内是否存在 `/app/data/` 目录及其中的JSON文件

### 3. Prisma相关错误
- 确保OpenSSL已安装: `apk add --no-cache openssl`
- 确保在构建阶段和生产阶段都运行了 `npx prisma generate`

## 部署到Dokploy

1. 在Dokploy中创建新应用
2. 选择"Docker"作为部署类型
3. 设置容器端口: `3000`
4. 添加上述环境变量
5. 部署并验证健康检查端点

## 支持的联系方式

如遇到问题，请检查:
- Docker构建日志
- 容器启动日志
- 健康检查端点响应
- API端点返回的错误信息