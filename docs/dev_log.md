# BridgeShield 开发日志

---

## 2026-04-11 — v0.0.5 Earn API + Composer + 行为分析

### 概述
新增 Earn API 代理路由、AML-gated Composer 报价路由，以及 C 端钱包行为分析与异常检测功能。

### 变更内容

**Backend — 新增 Earn 代理路由 (`src/api/routes/earn.ts`)**
- `GET /api/v1/earn/vaults` — 代理 vault 发现（从 Earn Data API）
- `GET /api/v1/earn/vault/:network/:address` — 代理单个 vault 详情
- `GET /api/v1/earn/portfolio/:wallet` — 代理钱包组合持仓

**Backend — 新增 Composer 路由 (`src/api/routes/composer.ts`)**
- `GET /api/v1/composer/quote` — AML 风控门控的 LI.FI Composer 报价
- 支持 `BLOCK`/`REVIEW`/`ALLOW` 三种决策
- 需要 `COMPOSER_API_KEY` 环境变量

**Backend — 新增行为分析路由 (`src/api/routes/behavior.ts`)**
- `GET /api/v1/behavior/profile/:wallet` — C 端钱包行为画像
- 返回异常信号（velocity、chain novelty、amount spikes、decision drift）

**Backend — 行为分析服务 (`src/services/behavior-analyzer.ts`)**
- 4 类异常检测：
  - **Velocity Anomaly** — 24h/7d 检查频率异常
  - **Chain Novelty** — 跨链新颖性（链历史不足）
  - **Amount Spike** — 大额转账异常（vs 历史均值）
  - **Decision Drift** — 决策漂移（REVIEW/ALLOW 比例变化）
- `analyzeAddressBehavior()` — 综合分析函数

**Backend — 验证中间件增强 (`src/api/middleware/validator.ts`)**
- 新增 vault/portfolio 数据验证规则
- 新增 `validateEarnVaultsQuery`、`validateEarnPortfolioParams` 等验证器
- 完善 `validateCheckBody`、`validateCheckChainId` 等现有验证器

**Frontend Demo — Earn 集成流程页 (`src/pages/EarnFlowPage.tsx`)**
- 905 行完整实现
- 展示 LI.FI Earn 产品的 AML 风控集成流程
- 支持 vault 发现、详情查询、组合展示

**Frontend Demo — API 客户端 (`src/api/bridgeshield.ts`)**
- 重构 351 行 API 调用逻辑
- 新增 Earn 相关 API 封装
- 改进错误处理和 fallback 策略

**Frontend Demo — 风险结果卡片 (`src/components/RiskResultCard.tsx`)**
- 新增 `cached` 字段展示（缓存命中标识）

**Frontend Demo — 类型定义 (`src/types/index.ts`)**
- 新增 136 行类型定义
- 覆盖 Earn、Composer、Behavior 相关数据结构

**Backend — app.ts 增强**
- 新增环境变量加载逻辑
- 路由注册扩展

**Backend — 环境变量新增 (`.env.example`)**
```
EARN_DATA_API_BASE_URL=https://earn.li.fi
COMPOSER_API_BASE_URL=https://li.quest
COMPOSER_API_KEY=
BEHAVIOR_THRESHOLD_MEDIUM=30
BEHAVIOR_THRESHOLD_HIGH=60
BEHAVIOR_MAX_CHECKS_24H=20
BEHAVIOR_MAX_CHECKS_7D=80
...
```

**测试 (`backend/tests/unit/behavior-analyzer.test.ts`)**
- 新增 107 行行为分析单元测试
- 覆盖 velocity、chain novelty、amount spike、decision drift 四类异常

**测试 (`backend/tests/unit/validator.test.ts`)**
- 新增 vault/portfolio 验证器测试用例

**测试 (`backend/tests/integration/api.test.ts`)**
- 新增 API 集成测试 113 行

### 新增 API 端点
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/earn/vaults` | 代理 vault 发现 |
| GET | `/api/v1/earn/vault/:network/:address` | 代理 vault 详情 |
| GET | `/api/v1/earn/portfolio/:wallet` | 代理钱包持仓 |
| GET | `/api/v1/composer/quote` | AML-gated Composer 报价 |
| GET | `/api/v1/behavior/profile/:wallet` | 钱包行为画像 |

### 构建验证
| 子项目 | `npm run build` | `npm test` |
|--------|-----------------|------------|
| Backend | ✅ 通过 | ✅ 104/104 |
| Frontend Demo | ✅ 通过 | — |
| Frontend Admin | ✅ 通过 | — |

---

## 2026-04-10 — v0.0.4 新增 @bridgeshield/sdk 包

### 概述
新增官方 SDK 包，方便外部应用集成 BridgeShield AML API。

### 变更内容

**packages/sdk/ — 新增 SDK 包**
- `BridgeShieldClient` 类：封装所有 API 调用
- `checkAddress()` — 地址风险检查
- `submitAppeal()` — 提交申诉
- `getAppealStatus()` — 查询申诉状态
- `getWhitelistSummary()` — 白名单摘要
- `healthCheck()` — 健康检查

**SDK 类型定义 (`packages/sdk/src/types.ts`)**
- 完整 TypeScript 类型定义
- 错误类层次结构：`BridgeShieldError` → `ApiError`、`NetworkError`、`ValidationError`
- 所有请求/响应类型

**SDK 测试 (`packages/sdk/__tests__/client.test.ts`)**
- 21 个单元测试用例
- 覆盖所有 API 方法
- 覆盖错误处理路径

**SDK 文档 (`packages/sdk/README.md`)**
- 完整使用文档
- API 参考
- 错误处理指南
- 代码示例

### 构建验证
| 子项目 | `npm run build` | `npm test` |
|--------|-----------------|------------|
| SDK | ✅ 通过 | ✅ 21/21 |

---

## 2026-04-10 — v0.0.3 前后端分级错误处理

### 概述
实现分级错误处理策略：4xx 客户端错误直接抛出，5xx/网络错误降级到 mock 数据，防止错误被静默隐藏。

### 变更内容

**Frontend Demo — API 客户端 (`frontend-demo/src/api/bridgeshield.ts`)**
- `checkAddress`：4xx 错误直接抛出，5xx/网络错误 fallback 到 mock
- `submitAppeal`：错误时返回 `{ success: false, error }` 而非伪装成功
- fallback 时附带明确提示信息

**Frontend Admin — API 客户端 (`frontend-admin/src/api/admin-api.ts`)**
- `apiFetch`：4xx 错误抛出（console.error），5xx/网络错误返回 mock 数据（console.warn）
- 所有 Admin 页面支持错误状态展示

### 错误处理策略
| 错误类型 | Demo 前端 | Admin 前端 |
|----------|-----------|------------|
| 4xx (输入错误) | 直接抛出 | 抛出 + console.error |
| 5xx (服务器错误) | Fallback + 提示 | Mock 数据 + console.warn |
| 网络/超时错误 | Fallback + 提示 | Mock 数据 + console.warn |

### 构建验证
| 子项目 | `npm run build` | `npm test` |
|--------|-----------------|------------|
| Frontend Demo | ✅ 通过 | — |
| Frontend Admin | ✅ 通过 | — |

---

## 2026-04-10 — v0.0.2 修复申诉流转与后台管理问题

### 概述
修复申诉审批链路的 500 错误和脏状态问题，补齐后台管理端未完成的交互点。

### 变更内容

**Backend — Admin 路由 (`src/api/routes/admin.ts`)**
- 新增 `parseRiskFactors()` 函数：统一解析 `factors.details`、`factors` 数组、`riskType` 等多种响应结构
- 修复 `GET /admin/appeals` 返回格式：`notes` → `reviewNote`，添加 `reviewedAt`
- 修复 `POST /admin/appeal/:id/approve`：使用事务防止重复创建白名单，将 `APPEAL_TEMPORARY` 升级为 `APPEAL_APPROVED`
- 修复 `POST /admin/appeal/:id/reject`：使用事务删除临时白名单，清理缓存
- 添加 404/409 错误处理（申诉不存在/已审批）

**Backend — Appeal 路由 (`src/api/routes/appeal.ts`)**
- 新增创建申诉前的重复检查：防止重复待处理申诉、清理已过期临时白名单
- 将"创建申诉 + 创建临时白名单 + 写审计日志"放入同一事务
- 修复 Prisma 错误处理：使用 `PrismaClientKnownRequestError` 的 `P2002` 码

**Frontend Admin — API 客户端 (`src/api/admin-api.ts`)**
- 新增 `normalizeAppeal()` 和 `normalizeWhitelistEntry()` 归一化函数
- `getAppeals()`、`getWhitelist()` 返回归一化后的数据
- `rejectAppeal()` 支持发送 `notes` 参数

**Frontend Admin — AppealTable (`src/components/AppealTable.tsx`)**
- 修复 React key 警告：使用 `<Fragment key={id}>` 替代空 `<>`
- 审批/拒绝成功后同时失效 `appeals`、`whitelist`、`logs` 三类查询
- 添加空状态提示和错误信息展示

**Frontend Admin — WhitelistTable (`src/components/WhitelistTable.tsx`)**
- 新增 `APPEAL_TEMPORARY` 状态的橙色样式
- 添加空状态提示和错误信息展示

**Frontend Admin — LogsPage (`src/pages/LogsPage.tsx`)**
- 实现日期和风险等级筛选功能（`useMemo` 优化）
- 新增"风险因子"列，正确展示 `riskFactors`
- 添加空状态提示和错误信息展示

**Frontend Admin — WhitelistPage (`src/pages/WhitelistPage.tsx`)**
- 新增白名单新增表单（地址、类型、Chain ID、标签）
- 接入 `addToWhitelist` API，新增成功后自动刷新列表
- 添加错误状态展示

**Frontend Admin — Types (`src/types/index.ts`)**
- `WhitelistEntry.type` 新增 `APPEAL_TEMPORARY` 类型

**测试 (`backend/tests/integration/api.test.ts`)**
- 新增 `createUniqueAddress()` 辅助函数避免测试地址冲突
- 新增 `POST /api/v1/admin/appeal/:id/approve` 测试
- 新增 `POST /api/v1/admin/appeal/:id/reject` 测试

### 修复的问题
| 问题 | 状态 |
|------|------|
| 申诉批准时 500 错误（唯一约束冲突） | ✅ 已修复 |
| 申诉状态部分更新（脏状态） | ✅ 已修复 |
| 申诉拒绝后临时白名单未清理 | ✅ 已修复 |
| 审批备注字段不匹配（notes vs reviewNote） | ✅ 已修复 |
| 白名单页 Add Address 按钮无效 | ✅ 已修复 |
| 日志页筛选功能无效 | ✅ 已修复 |
| 风险因子信息丢失 | ✅ 已修复 |

### 构建验证
| 子项目 | `npm run build` | `npm test` |
|--------|-----------------|------------|
| Backend | ✅ 通过 | ✅ 88/88 |
| Frontend Admin | ✅ 通过 | — |

---

## 2026-04-09 — v0.0.1 真实数据 + 前后端联动修复

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

---

## 2026-04-09 — v0.0.0 初始构建

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
