# BridgeShield 开发日志

---

## 2026-04-09 — v2.0.0 初始构建

### 概述
从零完成 BridgeShield 全栈项目的初始构建，包含后端 API、Demo 前端、Admin 后台管理三个子项目。

### 变更内容

**Backend API (`backend/`)**
- 搭建 Express + TypeScript + Prisma + SQLite 项目框架
- 实现 4 个核心 API：`/aml/check`、`/aml/whitelist`、`/aml/appeal`、`/health`
- 实现风险评分引擎（加权规则：SANCTION +85, HACKER +75, MIXER +70, SCAM +55）
- 实现内存缓存服务（node-cache，分级 TTL，无 Redis）
- 实现 Opossum 熔断器（超时 3s，错误率 50% 触发，30s 恢复）
- 实现本地风险数据预加载（Map/Set, O(1) 查询）
- 准备 5 个 JSON 数据文件（OFAC、黑客、混币器、诈骗、白名单共 30+ 条记录）
- 添加 express-rate-limit 限流、helmet 安全头、CORS、winston 结构化日志
- 修复：check 路由 DB 日志写入改为非阻塞（`.catch()`），避免 DB 故障影响 API 响应
- 修复：熔断器每请求使用唯一名称，解决闭包复用 bug

**Frontend Demo (`frontend-demo/`)**
- 搭建 React 18 + Vite + TypeScript + TailwindCSS v3 项目
- 实现 CheckerPage（地址风险检查主页）和 ComparePage（LI.FI 对比演示页）
- 实现 7 个组件：AddressInput、RiskResultCard、RiskScoreMeter（SVG 环形仪表盘）、FactorList、LiveStats、CodeSnippet、ComparePanel
- 集成 Framer Motion 动画（评分滚动、因子逐条出现、页面切换）
- 集成 TanStack Query + API Mock 降级（后端不可用时自动使用本地数据）
- 暗色赛博安全主题（#0A0E1A 背景、#00D4AA 主色、#FF3B3B 危险色）

**Frontend Admin (`frontend-admin/`)**
- 搭建 React 18 + Vite + TypeScript + TailwindCSS 项目
- 实现 4 个页面：DashboardPage（仪表盘）、AppealPage（申诉管理）、WhitelistPage（白名单管理）、LogsPage（检查日志）
- 集成 Recharts 图表（折线图、饼图）
- 浅色专业管理风格（与 Demo 完全不同）
- 全部页面配备 Mock 数据降级

**测试 (`backend/tests/`)**
- 67 个测试用例，全部通过
- 单元测试：validator (25)、risk-scorer (9)、cache-service (8)、risk-data-loader (9)
- 集成测试：API 端点 (16)，使用 supertest 对 Express app 进行请求级验证

**基础设施**
- docker-compose.yml + docker-compose.dev.yml（无 Redis）
- 各子项目 Dockerfile
- README.md

### 构建验证
| 子项目 | `npm run build` | `npm test` |
|--------|-----------------|------------|
| Backend | ✅ 通过 | ✅ 67/67 |
| Frontend Demo | ✅ 通过 | — |
| Frontend Admin | ✅ 通过 | — |

---

## 2026-04-09 — v2.0.1 真实数据 + 前后端联动修复

### 概述
替换虚假数据为真实 OFAC/黑客地址，修复前后端 API 合约不匹配问题，实现完整联动。

### 变更内容

**数据库 — 真实风险数据替换**
- `ofac-crypto-addresses.json`：5→18 条，100% 真实 OFAC 制裁地址（Lazarus Group、Tornado Cash、Roman Semenov）
- `hacker-addresses.json`：7→13 条，100% 已确认黑客事件（Ronin、Nomad、Wormhole、Harmony、Wintermute、Euler）
- `mixer-addresses.json`：8→12 条，100% 真实 Tornado Cash 池合约
- `scam-addresses.json`：6→8 条，~75% 真实 + 开发测试地址
- `whitelist.json`：10→25 条，100% 已验证合约（LI.FI、Uniswap、Aave、Lido、Compound、Curve 等）

**Backend — Admin API 路由 (`src/api/routes/admin.ts`)**
- 新增 `GET /admin/dashboard/stats` — 今日检查统计（检查数、拦截数、缓存命中率、趋势）
- 新增 `GET /admin/dashboard/risk-trend` — 7 日风险趋势（按天分组）
- 新增 `GET /admin/dashboard/risk-distribution` — 风险等级 + 来源分布
- 新增 `GET /admin/appeals` — 申诉列表
- 新增 `POST /admin/appeal/:id/approve` — 审批申诉（创建永久白名单）
- 新增 `POST /admin/appeal/:id/reject` — 拒绝申诉
- 新增 `GET /admin/whitelist` — 管理白名单列表（DB 条目）
- 新增 `POST /admin/whitelist` — 添加白名单
- 新增 `DELETE /admin/whitelist/:id` — 删除白名单
- 新增 `GET /admin/logs` — 检查日志（含字段转换 decision→action）

**Backend — DB 初始化流程**
- 新增 `prisma/seed.ts`：种子脚本（8 条 CheckLog + 4 条 Appeal + 5 条 WhitelistEntry）
- `npm run dev` 自动执行 `prisma db push`，确保表结构就绪
- 新增 `npm run db:seed`、`npm run db:reset` 脚本

**Backend — Appeal 路由修复**
- `chainId` 改为可选参数，默认值 1（修复前端不传 chainId 的 400 错误）
- `validateAppealInput` 验证器同步更新

**Frontend Demo — API 客户端修复 (`src/api/bridgeshield.ts`)**
- 新增 `transformCheckResult()` 转换层：`decision→action`、`factors.details→riskFactors`、`cacheHit→cached`
- 改为 API-first 模式（先调真实 API，失败才降级 Mock）
- 修复 Mock 查找大小写不敏感
- `submitAppeal` 添加 `chainId: 1`
- `getStats` 适配 health 端点返回的数据结构
- `getWhitelist` 适配后端 `{ total, categories }` 响应格式

**Frontend Admin — API 客户端修复 (`src/api/admin-api.ts`)**
- 白名单端点从 `/api/v1/aml/whitelist` 改为 `/api/v1/admin/whitelist`

### 修复的联动问题
| 问题 | 状态 |
|------|------|
| Demo 前端 `action` vs `decision` 字段不匹配 | ✅ 已修复 |
| Demo 前端 `riskFactors` vs `factors` 字段不匹配 | ✅ 已修复 |
| Demo 前端 `cached` vs `cacheHit` 字段不匹配 | ✅ 已修复 |
| Demo 前端 submitAppeal 缺少 chainId | ✅ 已修复 |
| Demo 前端 getStats 找不到 stats 字段 | ✅ 已修复 |
| Admin 前端 7 个端点后端不存在 | ✅ 已实现 |
| Admin 前端白名单端点路径错误 | ✅ 已修复 |
| 新 clone 无数据库表 | ✅ dev 自动 push |
| 空数据库无种子数据 | ✅ seed 脚本 |

### 构建验证
| 子项目 | `npm run build` | `npm test` |
|--------|-----------------|------------|
| Backend | ✅ 通过 | ✅ 86/86 |
| Frontend Demo | ✅ 通过 | — |
| Frontend Admin | ✅ 通过 | — |
