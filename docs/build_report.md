# BridgeShield v0.0 — 构建与测试报告

> 生成时间：2026-04-09  
> 项目版本：v0.0.0  
> 构建状态：✅ 全部通过

---

## 1. 项目构建概览

| 子项目 | 状态 | 构建命令 | 产物 |
|--------|------|----------|------|
| **Backend API** | ✅ 通过 | `npm run build` (tsc) | `dist/` |
| **Frontend Demo** | ✅ 通过 | `tsc -b && vite build` | `dist/` (335 KB JS, 12 KB CSS) |
| **Frontend Admin** | ✅ 通过 | `tsc -b && vite build` | `dist/` (638 KB JS, 13 KB CSS) |

## 2. 文件统计

| 类别 | 文件数 |
|------|--------|
| Backend 源码 (TypeScript) | 13 |
| Frontend Demo 源码 (TSX/TS) | 14 |
| Frontend Admin 源码 (TSX/TS) | 13 |
| 测试文件 | 6 |
| 风险数据文件 (JSON) | 5 |
| 配置文件 (Docker, Prisma, Vite, TS等) | 15+ |
| **总源码文件** | **46** |

## 3. 技术栈

| 层 | 技术 |
|----|------|
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma + SQLite (开发) |
| 缓存 | node-cache (内存缓存, 无 Redis) |
| 熔断 | opossum |
| Demo 前端 | React 18 + Vite + TailwindCSS + Framer Motion |
| Admin 前端 | React 18 + Vite + TailwindCSS + Recharts |
| 测试 | Vitest + Supertest |
| 容器化 | Docker + Docker Compose |

## 4. 测试报告

### 测试执行结果

```
 ✓ tests/unit/risk-scorer.test.ts      (9 tests)
 ✓ tests/unit/validator.test.ts        (25 tests)
 ✓ tests/integration/api.test.ts       (16 tests)
 ✓ tests/unit/risk-data-loader.test.ts (9 tests)
 ✓ tests/unit/cache-service.test.ts    (8 tests)

 Test Files  5 passed (5)
      Tests  67 passed (67)
   Duration  5.82s
```

### 测试覆盖范围

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| **validator.test.ts** | 25 | 地址格式校验、Chain ID 校验、风险检查输入校验、申诉输入校验 |
| **risk-scorer.test.ts** | 9 | HACKER/MIXER/SCAM/SANCTION 评分、行为因子、上下文因子、分数上限 |
| **cache-service.test.ts** | 8 | 缓存读写、删除、清空、Chain ID 隔离、地址大小写不敏感、统计 |
| **risk-data-loader.test.ts** | 9 | 数据初始化、风险地址查找、白名单检测、统计数据、大小写不敏感 |
| **api.test.ts (集成)** | 16 | 健康检查、风险检查(BLOCK/ALLOW/缓存命中)、白名单查询、申诉提交、输入校验(400)、404处理 |

### 关键测试用例

| 测试场景 | 预期 | 结果 |
|----------|------|------|
| Ronin 黑客地址检查 | BLOCK, score ≥ 70 | ✅ |
| Uniswap V3 白名单地址 | ALLOW, score = 0 | ✅ |
| 未知干净地址 | ALLOW, score = 0 | ✅ |
| 无效地址格式 | 400 Validation Error | ✅ |
| 缺少必填字段 | 400 Validation Error | ✅ |
| 缓存命中（二次查询） | cacheHit = true | ✅ |
| 申诉提交 | 201, ticketId 以 APT- 开头 | ✅ |
| 健康检查 | status = healthy, redis = disabled | ✅ |

## 5. API 端点验证

| 端点 | 方法 | 状态 |
|------|------|------|
| `/api/v1/health` | GET | ✅ 200 |
| `/api/v1/aml/check` | POST | ✅ 200 |
| `/api/v1/aml/whitelist` | GET | ✅ 200 |
| `/api/v1/aml/appeal` | POST | ✅ 201 |

## 6. 风险数据统计

| 数据文件 | 记录数 | 说明 |
|----------|--------|------|
| ofac-crypto-addresses.json | 5 | OFAC 制裁地址 |
| hacker-addresses.json | 7 | 已知黑客地址 (Ronin, Nomad, Wormhole 等) |
| mixer-addresses.json | 4 | 混币器合约 (Tornado Cash) |
| scam-addresses.json | 4+ | 诈骗地址 |
| whitelist.json | 10 | 白名单 (LI.FI, Uniswap, Lido, Aave 等) |

## 7. 设计决策说明

| 决策 | 原因 |
|------|------|
| **无 Redis** | MVP 阶段不需要分布式缓存，node-cache 内存缓存足够 |
| **SQLite** | 开发环境零配置，Prisma 支持无缝切换 PostgreSQL |
| **异步日志写入** | check 路由的 DB 日志写入改为非阻塞，避免 DB 故障影响 API 响应 |
| **每请求唯一熔断器名** | 修复了复用同一闭包的 bug，确保每次请求使用正确的查询函数 |

## 8. 已知限制

- 前端测试未包含（Demo 和 Admin 为展示型应用，依赖视觉验证）
- 资金溯源 (fund-tracer) 为 MVP 简化版
- 外部 API (Etherscan, Chainalysis) 未集成（MVP 使用本地数据）
