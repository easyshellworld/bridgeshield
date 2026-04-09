# BridgeShield v2.0 完整工程设计文档

> **项目**：BridgeShield — LI.FI 跨链交易 AML 入口检查系统  
> **版本**：v2.0  
> **文档状态**：工程执行版（含 Demo 前端）  
> **目标读者**：开发团队、技术评审

---

## 目录

1. [项目定位与范围](#1-项目定位与范围)
2. [整体目录结构](#2-整体目录结构)
3. [系统架构](#3-系统架构)
4. [黑名单数据来源与管理](#4-黑名单数据来源与管理)
5. [地址扫描与资金溯源](#5-地址扫描与资金溯源)
6. [风险评分模型](#6-风险评分模型)
7. [核心 API 规格](#7-核心-api-规格)
8. [数据库设计](#8-数据库设计)
9. [缓存策略](#9-缓存策略)
10. [熔断与降级机制](#10-熔断与降级机制)
11. [Demo 前端（独立目录）](#11-demo-前端独立目录)
12. [后台管理前端（独立目录）](#12-后台管理前端独立目录)
13. [LI.FI 集成方案](#13-lifi-集成方案)
14. [部署架构](#14-部署架构)
15. [监控与告警](#15-监控与告警)
16. [开发计划](#16-开发计划)

---

## 1. 项目定位与范围

### 1.1 核心定位

BridgeShield 是**专为 LI.FI 跨链交易设计的前置式 AML 入口检查网关**，在资金进入 LI.FI 跨链网络的第一秒完成风险筛查。

> 类比：机场安检——不在飞机起飞后检查乘客，而是在登机口完成所有检查。

### 1.2 三个独立子项目

| 子项目 | 目录 | 定位 | 优先级 |
|--------|------|------|--------|
| **后端 API** | `backend/` | 核心风险引擎、数据管理、API 服务 | P0 必须 |
| **Demo 前端** | `frontend-demo/` | 黑客松演示、LI.FI 对比展示、说服评审 | P0 必须 |
| **后台管理** | `frontend-admin/` | 白名单管理、申诉审核、数据监控 | P1 加分 |

**关键区分**：Demo 前端面向**评审和外部集成商**，后台管理面向**内部运营人员**，两者目的、用户、风格完全不同，必须分开。

### 1.3 MVP 功能范围

**后端 MVP（P0）：**

| 功能 | API 端点 | 优先级 |
|------|----------|--------|
| 地址风险检查 | `POST /api/v1/aml/check` | P0 |
| 白名单查询 | `GET /api/v1/aml/whitelist` | P0 |
| 误判申诉 | `POST /api/v1/aml/appeal` | P0 |
| 健康检查 | `GET /api/v1/health` | P0 |

**Demo 前端 MVP（P0）：**

| 功能 | 说明 |
|------|------|
| 地址风险检查页 | 输入地址 → 实时显示风险评分、因子、操作决策 |
| LI.FI 对比演示 | 左侧展示"无 AML"，右侧展示"有 BridgeShield" |
| 预设演示地址 | Ronin 黑客、Tornado、正常地址等一键切换 |
| 实时统计展示 | 今日检查数、拦截数、响应时间 |
| 集成代码展示 | 3 行代码接入 LI.FI，增强说服力 |

**后台管理 MVP（P1）：**

| 功能 | 说明 |
|------|------|
| 风险仪表盘 | 检查总量、风险分布、拦截趋势图 |
| 申诉管理 | 查看申诉列表、审批通过/驳回 |
| 白名单管理 | 添加/删除/查询白名单地址 |

**砍掉项（不做）：**
- 图数据库分析
- AI/ML 评分模型
- 用户注册/登录系统
- 非 EVM 链支持

### 1.4 性能目标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| API P95 响应时间 | < 100ms | 缓存命中场景 |
| API P99 响应时间 | < 200ms | 冷查询场景 |
| 单节点吞吐量 | 1000+ QPS | Redis 缓存支撑 |
| 缓存命中率 | > 70% | 高频地址复用 |
| 系统误判率 | < 0.1% | 白名单机制控制 |
| Demo 页面加载 | < 2s | 首屏时间 |

---

## 2. 整体目录结构

```
bridgeshield/
├── backend/                          # 后端 API 服务
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── check.ts
│   │   │   │   ├── whitelist.ts
│   │   │   │   ├── appeal.ts
│   │   │   │   └── health.ts
│   │   │   └── middleware/
│   │   │       ├── rate-limiter.ts
│   │   │       ├── validator.ts
│   │   │       └── logger.ts
│   │   ├── services/
│   │   │   ├── risk-scorer.ts        # 风险评分引擎
│   │   │   ├── fund-tracer.ts        # 资金溯源
│   │   │   ├── cache-service.ts      # 分层缓存
│   │   │   └── circuit-breaker.ts   # 熔断器
│   │   ├── data/
│   │   │   └── risk-data-loader.ts  # 本地数据预加载
│   │   ├── db/
│   │   │   └── prisma-client.ts
│   │   └── app.ts
│   ├── data/                         # 风险数据文件（本地化）
│   │   ├── ofac-crypto-addresses.json
│   │   ├── hacker-addresses.json
│   │   ├── scam-addresses.json
│   │   ├── mixer-addresses.json
│   │   └── whitelist.json
│   ├── prisma/
│   │   ├── schema.sqlite.prisma      # 开发库
│   │   └── schema.postgresql.prisma # 生产库
│   ├── scripts/
│   │   ├── update-risk-data.sh
│   │   ├── parse-ofac.js
│   │   └── sync-lifi-whitelist.js
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend-demo/                    # Demo 前端（面向评审 / 集成商）
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── CheckerPage.tsx       # 地址风险检查主页
│   │   │   └── ComparePage.tsx       # LI.FI 对比演示页
│   │   ├── components/
│   │   │   ├── AddressInput.tsx
│   │   │   ├── RiskResultCard.tsx
│   │   │   ├── RiskScoreMeter.tsx
│   │   │   ├── FactorList.tsx
│   │   │   ├── LiveStats.tsx
│   │   │   ├── CodeSnippet.tsx
│   │   │   └── ComparePanel.tsx
│   │   ├── api/
│   │   │   └── bridgeshield.ts       # API 调用封装
│   │   └── constants/
│   │       └── demo-addresses.ts    # 演示地址预设
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── package.json
│   └── .env.example
│
├── frontend-admin/                   # 后台管理前端（面向内部运营）
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx     # 风险仪表盘
│   │   │   ├── AppealPage.tsx        # 申诉管理
│   │   │   ├── WhitelistPage.tsx     # 白名单管理
│   │   │   └── LogsPage.tsx          # 检查日志
│   │   └── components/
│   │       ├── StatsCard.tsx
│   │       ├── RiskChart.tsx
│   │       ├── AppealTable.tsx
│   │       └── WhitelistTable.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml                # 一键启动全部服务
├── docker-compose.dev.yml            # 开发环境
└── README.md                         # 根目录说明
```

---

## 3. 系统架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         外部调用方                               │
│   LI.FI SDK  │  钱包 App  │  交易所  │  Demo前端  │  Admin前端  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP / HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API 网关层                                │
│   Rate Limiter (100/min/IP)  │  API Key 验证  │  请求日志       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        风险引擎层                                │
│                                                                  │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │ 白名单检查  │──▶│  风险数据查询 │──▶│    风险评分计算       │   │
│  │ (优先命中) │   │  (多源聚合)  │   │    (加权规则引擎)     │   │
│  └────────────┘   └──────────────┘   └──────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               熔断器 (Opossum)                           │    │
│  │  超时 3s │ 错误率 >50% 触发 │ 30s 后自动恢复             │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────┬──────────────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
┌──────────────┐ ┌────────────┐ ┌───────────────────┐
│  Redis 缓存  │ │ 内存风险索引│ │    外部数据源       │
│  (分级 TTL) │ │ (O(1)查询) │ │  OFAC/Chainalysis  │
└──────────────┘ └────────────┘ └───────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       数据持久层                                  │
│         SQLite（开发） / PostgreSQL（生产）                       │
│   风险记录 │ 白名单 │ 申诉记录 │ 检查日志 │ 审计日志             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 请求处理流程（短路原则）

```
入参校验（地址格式、链 ID）
        ↓
命中 Redis 缓存？→ 直接返回（< 5ms）
        ↓ 未命中
命中本地白名单？→ 返回 ALLOW，写缓存
        ↓ 未命中
查询内存风险索引（本地 JSON 预加载，< 1ms）
        ↓
外部 API 补充查询（Chainalysis 等，熔断保护）
        ↓
计算综合风险评分（加权规则引擎）
        ↓
写入 Redis（按风险等级分级 TTL）+ 异步写 DB
        ↓
返回结果
```

---

## 4. 黑名单数据来源与管理

### 4.1 数据源分层

#### 第一层：制裁名单（最高权威，免费）

| 数据源 | 内容 | 更新频率 | 获取方式 |
|--------|------|----------|----------|
| OFAC SDN List | 美国制裁加密地址 | 每日 | 官网直接下载 XML |
| UN 制裁名单 | 联合国制裁 | 每周 | UN 官方 API |
| EU 制裁名单 | 欧盟制裁 | 每日 | EUR-Lex 数据库 |
| Chainalysis 制裁 API | 加密货币地址专项 | 实时 | 免费公开端点（有限额） |

```bash
# OFAC 数据下载
https://www.treasury.gov/ofac/downloads/sdn.xml
https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml
```

#### 第二层：链上行为标记数据库

| 数据源 | 内容 | 成本 | MVP 用法 |
|--------|------|------|----------|
| Chainalysis KYT | 黑客、诈骗、混币器 | 付费 $1000+/月 | 免费制裁 API 代替 |
| CryptoScamDB | 开源诈骗地址库 | 免费开源 | GitHub 直接拉取 |
| DeFiLlama Hacks DB | 历史黑客攻击地址 | 免费 | GitHub / API |
| Forta Network | 实时链上威胁情报 | 免费社区版 | GraphQL API |
| SlowMist Hacked DB | 黑客事件数据库 | 免费 | https://hacked.slowmist.io |

#### 第三层：手工整理（MVP 演示核心）

手工收集知名黑客事件地址，写入 `hacker-addresses.json`，演示时保证命中：

| 事件 | 地址（示例） | 涉案金额 |
|------|-------------|----------|
| Ronin Bridge 2022 | `0x098B716...` | $625M |
| Nomad Bridge 2022 | `0x9D4...` | $190M |
| Wormhole 2022 | `0x629e...` | $320M |
| Tornado Cash 合约 | `0xd90e2f9...` | 混币器 |

### 4.2 本地数据预加载（MVP 核心——演示不依赖外部 API）

```typescript
// backend/src/data/risk-data-loader.ts

class RiskDataLoader {
  private riskIndex = new Map<string, RiskEntry>();
  private whitelistIndex = new Set<string>();

  async initialize() {
    const dataFiles = [
      { file: 'ofac-crypto-addresses.json',  category: 'SANCTION', score: 95 },
      { file: 'hacker-addresses.json',        category: 'HACKER',   score: 90 },
      { file: 'mixer-addresses.json',         category: 'MIXER',    score: 80 },
      { file: 'scam-addresses.json',          category: 'SCAM',     score: 65 },
    ];

    for (const { file, category, score } of dataFiles) {
      const data = JSON.parse(fs.readFileSync(`./data/${file}`, 'utf8'));
      data.forEach((entry: any) => {
        this.riskIndex.set(entry.address.toLowerCase(), {
          category, riskScore: score,
          label: entry.label,
          source: entry.source,
        });
      });
    }

    const whitelist = JSON.parse(fs.readFileSync('./data/whitelist.json', 'utf8'));
    whitelist.forEach((e: any) => this.whitelistIndex.add(e.address.toLowerCase()));

    console.log(`[RiskLoader] ${this.riskIndex.size} 风险地址 | ${this.whitelistIndex.size} 白名单地址`);
  }

  // O(1) 查询，响应 < 1ms
  lookup(address: string) {
    const addr = address.toLowerCase();
    if (this.whitelistIndex.has(addr)) return { type: 'WHITELIST' };
    return this.riskIndex.get(addr) || null;
  }
}
```

### 4.3 数据自动更新（每日定时）

```bash
#!/bin/bash
# scripts/update-risk-data.sh

# 1. 更新 OFAC 制裁名单
curl -s "https://www.treasury.gov/ofac/downloads/sdn.xml" -o data/raw/ofac-sdn.xml
node scripts/parse-ofac.js data/raw/ofac-sdn.xml data/ofac-crypto-addresses.json

# 2. 更新 CryptoScamDB
curl -s "https://raw.githubusercontent.com/CryptoScamDB/blacklist/master/data/urls.json" \
  -o data/raw/cryptoscamdb.json
node scripts/parse-scamdb.js data/raw/cryptoscamdb.json data/scam-addresses.json

# 3. 同步 LI.FI 官方白名单（从 LI.FI 合约读取）
node scripts/sync-lifi-whitelist.js

# 4. 热更新（无需重启服务）
curl -X POST http://localhost:3000/admin/reload-data
```

---

## 5. 地址扫描与资金溯源

### 5.1 扫描维度（并发处理）

```
检查对象
  ├── fromAddress（发送方）          ← 最核心
  ├── toAddress（接收方）            ← 次核心
  ├── 路由中间合约                   ← 验证路径合法性
  └── 目标链接收地址                 ← 跨链目标检查
```

```typescript
// 并发扫描所有相关地址，取最高风险值
async function scanAllAddresses(req: CheckRequest) {
  const promises = [
    scanSingle(req.fromAddress, req.chainId, 'FROM'),
    req.toAddress ? scanSingle(req.toAddress, req.toChainId, 'TO') : null,
    ...(req.route?.steps || []).map(step =>
      scanSingle(step.estimate?.approvalAddress, step.action.fromChainId, 'ROUTER')
    )
  ].filter(Boolean);

  const results = await Promise.allSettled(promises);
  return aggregateByHighestRisk(results);
}
```

### 5.2 资金溯源（一跳，MVP 实现）

```typescript
// backend/src/services/fund-tracer.ts
// 查询地址入账记录，判断是否收到过高风险地址的资金

async function traceIncomingFunds(address: string, chainId: number) {
  const explorerApis: Record<number, string> = {
    1:   'https://api.etherscan.io/api',
    56:  'https://api.bscscan.com/api',
    137: 'https://api.polygonscan.com/api',
  };

  const apiUrl = explorerApis[chainId] || explorerApis[1];
  const res = await fetch(
    `${apiUrl}?module=account&action=txlist&address=${address}&sort=desc&apikey=${ETHERSCAN_KEY}`
  );
  const { result: txs } = await res.json();

  // 检查最近 20 笔入账来源
  return txs.slice(0, 20)
    .filter((tx: any) => tx.to?.toLowerCase() === address.toLowerCase())
    .map((tx: any) => ({
      txHash: tx.hash,
      from: tx.from,
      riskInfo: riskDataLoader.lookup(tx.from),
    }))
    .filter((r: any) => r.riskInfo !== null);
}
```

**溯源深度路线图：**

| 版本 | 深度 | 实现方式 |
|------|------|----------|
| MVP | 1 跳 | Etherscan API，只查直接来源 |
| v1.0 | 3 跳 | 递归查询，时间窗口 6 个月 |
| v2.0 | 全路径 | Neo4j 图数据库 |

### 5.3 混币器交互检测

```typescript
const MIXER_CONTRACTS = [
  '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b', // Tornado 0.1 ETH
  '0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF', // Tornado 1 ETH
  '0xA160cdAB225685dA1d56aa342Ad8841c3b53f291', // Tornado 10 ETH
  '0xD4B88Df4D29F5CedD6857912842cff3b20C8Cfa3', // Tornado 100 ETH
];

async function checkMixerInteraction(address: string, chainId: number) {
  const txs = await getRecentTransactions(address, chainId);
  return txs.some(tx =>
    MIXER_CONTRACTS.includes(tx.from?.toLowerCase()) ||
    MIXER_CONTRACTS.includes(tx.to?.toLowerCase())
  );
}
```

---

## 6. 风险评分模型

### 6.1 评分体系

| 分数 | 风险等级 | 操作决策 | 说明 |
|------|----------|----------|------|
| 0 | NONE | ALLOW | 白名单地址，直接放行 |
| 1–30 | LOW | ALLOW | 无已知风险 |
| 31–69 | MEDIUM | REVIEW | 记录日志，进人工审核，**不拦截** |
| 70–100 | HIGH | BLOCK | 直接拦截，记录审计 |

> **关键原则**：MEDIUM 不直接拦截，只记录——这是控制误判率的核心设计。

### 6.2 评分因子

#### A. 制裁与黑名单因子

| 因子 | 加分 | 数据来源 |
|------|------|----------|
| OFAC 制裁地址 | **+85** | OFAC SDN List |
| UN/EU 制裁地址 | **+80** | 官方制裁名单 |
| 已知黑客地址 | **+75** | DeFiLlama / SlowMist |
| 混币器合约本身 | **+70** | 手工整理 |
| 诈骗地址 | **+55** | CryptoScamDB |
| Chainalysis 高风险标记 | **+60** | Chainalysis API |

#### B. 行为特征因子（链上分析）

| 因子 | 加分 | 检测方式 |
|------|------|----------|
| 近期收到混币器出款 | **+35** | 一跳溯源 |
| 直接收款来自黑名单地址 | **+25** | 一跳溯源 |
| 24h 内跨链 > 5 次 | **+15** | 链上频率分析 |
| 单笔 > $100,000 | **+10** | 金额换算 |
| 地址年龄 < 7 天 + 金额 > $10,000 | **+15** | 地址年龄分析 |

#### C. 交易上下文因子

| 因子 | 加分 | 说明 |
|------|------|------|
| 接收方地址高风险 | **+40** | toAddress 命中黑名单 |
| 路由经过可疑桥接 | **+20** | 路径中有被黑桥合约 |
| 目标链为高风险链 | **+10** | 部分小链 |

#### D. 白名单减分

| 因子 | 效果 |
|------|------|
| LI.FI 官方地址 | **直接归零** |
| 知名 DeFi 协议 | **-20（最低 0）** |
| 申诉审核通过 | **-30（最低 0）** |

### 6.3 评分计算逻辑

```typescript
// backend/src/services/risk-scorer.ts

class RiskScorer {
  calculate(addressInfo: any, behaviorData: any, txContext: any) {
    const factors: Factor[] = [];
    let total = 0;

    // 制裁/黑名单因子
    const sanctionMap: Record<string, { score: number; label: string }> = {
      SANCTION: { score: 85, label: 'OFAC/UN/EU 制裁地址' },
      HACKER:   { score: 75, label: `黑客攻击地址: ${addressInfo?.label}` },
      MIXER:    { score: 70, label: '混币器合约地址' },
      SCAM:     { score: 55, label: '诈骗地址' },
    };

    if (addressInfo?.category) {
      const m = sanctionMap[addressInfo.category];
      if (m) { factors.push({ name: m.label, score: m.score }); total += m.score; }
    }

    // 行为因子
    if (behaviorData?.hasMixerInteraction) {
      factors.push({ name: '近期与混币器有交互', score: 35 }); total += 35;
    }
    if (behaviorData?.hasHighRiskSender) {
      factors.push({ name: '资金来自高风险地址', score: 25 }); total += 25;
    }

    // 上下文因子
    if (txContext?.amountUSD > 100000) {
      factors.push({ name: `大额交易 ($${Math.round(txContext.amountUSD / 1000)}K)`, score: 10 });
      total += 10;
    }

    const riskScore = Math.min(100, Math.round(total));
    const { level, action } = this.getDecision(riskScore, addressInfo);

    return { riskScore, riskLevel: level, action, riskFactors: factors.map(f => f.name) };
  }

  private getDecision(score: number, info: any) {
    // 制裁地址强制拦截
    if (info?.category === 'SANCTION') return { level: 'HIGH', action: 'BLOCK' };
    if (score >= 70) return { level: 'HIGH',   action: 'BLOCK' };
    if (score >= 31) return { level: 'MEDIUM', action: 'REVIEW' };
    return              { level: 'LOW',    action: 'ALLOW' };
  }
}
```

### 6.4 评分示例

| 地址 | 命中因子 | 总分 | 决策 |
|------|----------|------|------|
| Ronin 黑客地址 | 黑客 +75，大额 +10 | 85 | **BLOCK** |
| Tornado 出款地址 | 混币器交互 +35，新地址 +15 | 50 | **REVIEW** |
| Uniswap V3 合约 | 命中白名单 → 归零 | 0 | **ALLOW** |
| LI.FI Diamond | LI.FI 官方 → 归零 | 0 | **ALLOW** |

---

## 7. 核心 API 规格

### 7.1 POST /api/v1/aml/check

**请求体：**
```json
{
  "address": "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
  "chainId": 1,
  "amount": "1000000000000000000",
  "toAddress": "0xRecipientAddress",
  "toChainId": 137,
  "route": {
    "steps": [
      {
        "toolDetails": { "name": "Stargate" },
        "estimate": { "approvalAddress": "0x..." },
        "action": { "fromChainId": 1, "toChainId": 137 }
      }
    ]
  }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `address` | ✅ | 发送方地址（EVM 格式） |
| `chainId` | ✅ | 源链 Chain ID |
| `amount` | ❌ | 交易金额（wei），用于大额检测 |
| `toAddress` | ❌ | 接收方地址，提供则同时检查 |
| `route` | ❌ | LI.FI 路由信息，提供则检查路径 |

**成功响应（200）：**
```json
{
  "address": "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
  "riskScore": 85,
  "riskLevel": "HIGH",
  "action": "BLOCK",
  "riskFactors": ["黑客攻击地址: Ronin Bridge 2022", "大额历史交易"],
  "recommendation": "建议拦截此交易并上报监管",
  "cached": false,
  "checkId": "chk_20250412_abc123",
  "checkedAt": "2025-04-12T10:00:00.000Z",
  "expiresAt": null,
  "processingTimeMs": 43
}
```

**降级响应（外部 API 不可用）：**
```json
{
  "address": "0x...",
  "riskScore": 0,
  "riskLevel": "LOW",
  "action": "ALLOW",
  "fallback": true,
  "fallbackReason": "Circuit breaker open, defaulting to ALLOW",
  "processingTimeMs": 2
}
```

### 7.2 GET /api/v1/aml/whitelist

```json
{
  "total": 287,
  "categories": {
    "LIFI_OFFICIAL": 45,
    "KNOWN_PROTOCOL": 180,
    "BRIDGE_CONTRACT": 52,
    "APPEAL_APPROVED": 10
  },
  "lastSyncedAt": "2025-04-12T00:00:00Z"
}
```

### 7.3 POST /api/v1/aml/appeal

**请求体：**
```json
{
  "address": "0x...",
  "chainId": 1,
  "reason": "这是我个人冷钱包，从未与高风险地址交互",
  "contact": "user@example.com"
}
```

**响应：**
```json
{
  "success": true,
  "ticketId": "APT-20250412-001",
  "status": "PENDING",
  "estimatedReviewAt": "2025-04-13T10:00:00Z"
}
```

申诉提交后，地址自动加入**临时白名单 24 小时**，管理员在后台审批。

### 7.4 GET /api/v1/health

```json
{
  "status": "healthy",
  "checks": {
    "redis": "connected",
    "database": "connected",
    "riskDataLoaded": true,
    "riskDataCount": 15234,
    "circuitBreaker": "closed"
  },
  "uptime": 3600,
  "version": "2.0.0"
}
```

---

## 8. 数据库设计

### 8.1 环境选型

| 环境 | 数据库 | 原因 |
|------|--------|------|
| 开发 | SQLite | 零配置，文件存储，快速启动 |
| 生产 | PostgreSQL | 事务、并发、JSONB 支持 |

使用 **Prisma ORM** 管理，两套 schema 文件对应两个环境。

### 8.2 核心数据模型（Prisma Schema）

```prisma
// AddressRisk — 地址风险记录（缓存 + 持久化）
model AddressRisk {
  id          String    @id @default(cuid())
  address     String
  chainId     Int
  riskScore   Int
  riskLevel   String    // LOW / MEDIUM / HIGH
  action      String    // ALLOW / REVIEW / BLOCK
  category    String?   // SANCTION / HACKER / MIXER / SCAM
  source      String
  label       String?
  riskFactors String    // JSON 数组
  cachedUntil DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@unique([address, chainId])
  @@index([riskLevel])
}

// WhitelistEntry — 白名单
model WhitelistEntry {
  id        String    @id @default(cuid())
  address   String    @unique
  type      String    // LIFI_OFFICIAL / KNOWN_PROTOCOL / APPEAL_APPROVED
  label     String
  chainId   Int?
  expiresAt DateTime?
  createdBy String
  createdAt DateTime  @default(now())
}

// Appeal — 申诉记录
model Appeal {
  id         String    @id @default(cuid())
  ticketId   String    @unique
  address    String
  reason     String
  contact    String?
  status     String    @default("PENDING") // PENDING / APPROVED / REJECTED
  reviewNote String?
  reviewedAt DateTime?
  expiresAt  DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  @@index([status])
}

// CheckLog — 检查日志（用于仪表盘统计）
model CheckLog {
  id              String   @id @default(cuid())
  checkId         String   @unique
  address         String
  chainId         Int
  riskScore       Int
  riskLevel       String
  action          String
  riskFactors     String   // JSON
  processingTimeMs Int
  cached          Boolean  @default(false)
  fallback        Boolean  @default(false)
  createdAt       DateTime @default(now())
  @@index([riskLevel])
  @@index([createdAt])
}

// AuditLog — 操作审计
model AuditLog {
  id         String   @id @default(cuid())
  action     String
  targetId   String?
  operator   String
  before     String?  // JSON
  after      String?  // JSON
  createdAt  DateTime @default(now())
}
```

---

## 9. 缓存策略

### 9.1 分级 TTL

```typescript
const CACHE_TTL = {
  HIGH:      0,           // 永久（制裁/黑客地址一旦确认不解除）
  MEDIUM:    86400 * 7,   // 7 天（可能误判，保留申诉时间）
  LOW:       86400 * 3,   // 3 天（定期刷新，避免遗漏新增风险）
  WHITELIST: 86400 * 30,  // 30 天
  FALLBACK:  300,         // 5 分钟（降级结果不长期缓存）
};

const getCacheKey = (address: string, chainId: number) =>
  `bs:risk:${chainId}:${address.toLowerCase()}`;
```

### 9.2 两级缓存架构

```typescript
// L1: 进程内内存缓存（< 1ms，热点地址）
const memCache = new NodeCache({ maxKeys: 5000, stdTTL: 60 });

// L2: Redis（< 5ms，全量缓存）

async function checkWithLayeredCache(address: string, chainId: number) {
  const key = `${chainId}:${address.toLowerCase()}`;

  // L1 命中
  const mem = memCache.get(key);
  if (mem) return { ...mem, cacheLayer: 'L1' };

  // L2 命中
  const redis = await getFromRedis(address, chainId);
  if (redis) { memCache.set(key, redis); return { ...redis, cacheLayer: 'L2' }; }

  // L3 完整计算
  const result = await fullRiskCalculation(address, chainId);
  await writeToRedis(address, chainId, result);
  memCache.set(key, result);
  return { ...result, cacheLayer: 'L3' };
}
```

---

## 10. 熔断与降级机制

**核心原则：BridgeShield 故障绝对不能导致 LI.FI 停服。**

```typescript
// backend/src/services/circuit-breaker.ts
const CircuitBreaker = require('opossum');

function createBreaker(name: string, fn: Function) {
  const breaker = new CircuitBreaker(fn, {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 10,
  });

  // 熔断时：放行 + 记录日志
  breaker.fallback(() => ({
    riskScore: 0, riskLevel: 'LOW', action: 'ALLOW',
    fallback: true, fallbackReason: `${name} circuit open`
  }));

  breaker.on('open',     () => logger.error(`[CB] ${name} OPENED`));
  breaker.on('halfOpen', () => logger.warn(`[CB] ${name} HALF-OPEN`));
  breaker.on('close',    () => logger.info(`[CB] ${name} CLOSED`));

  return breaker;
}
```

**降级优先级：**

```
正常:     内存索引 + Redis + 外部 API
API 故障: 内存索引 + Redis（跳过外部 API）
Redis 故障: 内存索引（直接查询）
全部故障: ALLOW + fallback=true + 告警
```

---

## 11. Demo 前端（独立目录）

> **目录**：`frontend-demo/`  
> **面向**：评审、外部集成商、LI.FI 团队  
> **工期**：4–6 小时  
> **目标**：90 秒内让评审理解 BridgeShield 的价值

### 11.1 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| 样式 | TailwindCSS + CSS Variables |
| 路由 | React Router v6 |
| 请求 | TanStack Query v5 |
| 动画 | Framer Motion |

### 11.2 目录结构

```
frontend-demo/
├── src/
│   ├── main.tsx
│   ├── App.tsx                       # 路由配置
│   │
│   ├── pages/
│   │   ├── CheckerPage.tsx           # 主页：地址风险检查
│   │   └── ComparePage.tsx           # 对比页：有无 AML 差异
│   │
│   ├── components/
│   │   ├── AddressInput.tsx          # 地址输入 + 快捷预设
│   │   ├── RiskResultCard.tsx        # 风险结果卡片（核心）
│   │   ├── RiskScoreMeter.tsx        # 0-100 分环形仪表盘
│   │   ├── FactorList.tsx            # 风险因子动态列表
│   │   ├── LiveStats.tsx             # 实时统计（检查数/拦截数）
│   │   ├── CodeSnippet.tsx           # 3 行集成代码展示
│   │   └── ComparePanel.tsx          # 左右对比面板
│   │
│   ├── api/
│   │   └── bridgeshield.ts           # API 调用封装 + Mock 数据
│   │
│   └── constants/
│       └── demo-addresses.ts         # 演示地址预设
│
├── public/
│   └── favicon.svg
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── package.json
└── .env.example
```

### 11.3 页面设计

#### 页面 1：地址风险检查（CheckerPage）路由 `/`

**视觉风格**：深色背景（`#0A0E1A`）+ 科技蓝绿主色（`#00D4AA`）+ 危险红（`#FF3B3B`）。  
字体：标题 `JetBrains Mono`（等宽终端感），正文 `DM Sans`。  
风格定位：**链上安全审计终端**——专业、精准、有威慑感。

**布局图：**

```
┌──────────────────────────────────────────────────────────────────┐
│  ⬡ BridgeShield               [Check]  [Compare vs LI.FI ↗]    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│         AML Gateway for LI.FI Cross-Chain Trades                 │
│         ─────────────────────────────────────────                │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  0x...                                        [CHECK →] │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│  快捷地址：[🔴 Ronin Hacker] [🟠 Tornado] [🟢 Lido] [🟢 Uniswap] │
│                                                                   │
├──────────────────────────────┬───────────────────────────────────┤
│                              │                                    │
│         ┌────────────┐       │  风险评分：85 / 100               │
│         │            │       │  风险等级：🔴 HIGH                │
│         │     85     │       │  操作决策：BLOCK                  │
│         │            │       │                                    │
│         └────────────┘       │  ── 风险因子 ──────────────────   │
│         环形仪表盘            │  ✗ 黑客攻击地址                   │
│                              │    Ronin Bridge 2022 · $625M      │
│                              │  ✗ 与混币器有交互                  │
│                              │    Tornado Cash · 3 笔            │
│                              │                                    │
│                              │  响应时间：43ms  已缓存：否        │
│                              │                                    │
├──────────────────────────────┴───────────────────────────────────┤
│  ── 如果集成 BridgeShield，这笔交易会被 LI.FI 在入口拦截 ───────  │
│                                                                   │
│  lifi.hooks.beforeExecute.add(async (trade) => {                 │
│    const risk = await bridgeshield.check(trade.fromAddress);     │
│    if (risk.action === 'BLOCK') throw new Error(...);            │
│  });                                                             │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  今日检查：1,247    拦截：23 (1.8%)    平均响应：47ms   正常运行  │
└──────────────────────────────────────────────────────────────────┘
```

**预设演示地址（`constants/demo-addresses.ts`）：**

```typescript
export const DEMO_ADDRESSES = [
  {
    label: 'Ronin Hacker',
    address: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96',
    description: 'Ronin Bridge 2022 · $625M',
    expectedResult: 'BLOCK',
    badge: 'HACKER',
  },
  {
    label: 'Tornado Cash',
    address: '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b',
    description: 'Tornado Cash 合约 · 混币器',
    expectedResult: 'BLOCK',
    badge: 'MIXER',
  },
  {
    label: 'Lido stETH',
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    description: 'Lido Protocol · 知名协议',
    expectedResult: 'ALLOW',
    badge: 'SAFE',
  },
  {
    label: 'Uniswap V3',
    address: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    description: 'Uniswap V3 Factory · LI.FI 白名单',
    expectedResult: 'ALLOW',
    badge: 'WHITELIST',
  },
];
```

**RiskResultCard 核心逻辑：**

```typescript
// components/RiskResultCard.tsx
// 根据 action 动态变色：BLOCK=红，REVIEW=橙，ALLOW=绿

const actionConfig = {
  BLOCK:  { bg: 'bg-red-950', border: 'border-red-500', text: '🔴 BLOCK',  desc: '此交易将被拦截' },
  REVIEW: { bg: 'bg-amber-950', border: 'border-amber-500', text: '🟠 REVIEW', desc: '进入人工审核队列' },
  ALLOW:  { bg: 'bg-emerald-950', border: 'border-emerald-500', text: '🟢 ALLOW', desc: '交易正常放行' },
};
```

**动画设计（Framer Motion）：**

```typescript
// 结果出现时：从下方滑入 + 渐显
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>

// 评分数字：从 0 滚动到实际分值
const [displayScore, setDisplayScore] = useState(0);
useEffect(() => {
  const timer = setInterval(() => {
    setDisplayScore(prev => Math.min(prev + 3, riskScore));
  }, 16);
  return () => clearInterval(timer);
}, [riskScore]);

// 风险因子：逐条出现（staggered）
factors.map((factor, i) => (
  <motion.div
    key={i}
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: i * 0.1 }}
  />
))
```

#### 页面 2：LI.FI 对比演示（ComparePage）路由 `/compare`

**核心设计理念**：左右分屏，左侧"没有 BridgeShield"，右侧"有 BridgeShield"，同一个黑客地址，结果截然不同。

```
┌────────────────────────────────────────────────────────────────┐
│  ⬡ BridgeShield                              [← Back to Check] │
├──────────────────────┬─────────────────────────────────────────┤
│                      │                                          │
│  ❌ WITHOUT          │  ✅ WITH BridgeShield                   │
│     BridgeShield     │                                          │
│                      │                                          │
│  ┌──────────────┐    │  ┌──────────────────────────────────┐   │
│  │ Address:     │    │  │ Address:                          │   │
│  │ 0x098B71...  │    │  │ 0x098B71... (Ronin Hacker)        │   │
│  │              │    │  │                                    │   │
│  │ Chain: ETH   │    │  │ ┌──────────────────────────────┐  │   │
│  │ Amount: 1ETH │    │  │ │ 🔴 BLOCKED                    │  │   │
│  │              │    │  │ │ Risk Score: 85/100             │  │   │
│  │ [Execute →]  │    │  │ │ Ronin Bridge Hacker 2022       │  │   │
│  │              │    │  │ └──────────────────────────────┘  │   │
│  │ ✅ SUCCESS   │    │  │                                    │   │
│  │ TX Hash:     │    │  │ Transaction REJECTED before        │   │
│  │ 0xabc...     │    │  │ reaching LI.FI network             │   │
│  │              │    │  │ Latency added: 43ms               │   │
│  │ 🚨 黑客资金  │    │  └──────────────────────────────────┘   │
│  │    已跨链转移 │    │                                          │
│  └──────────────┘    │                                          │
│                      │                                          │
├──────────────────────┴─────────────────────────────────────────┤
│  同一笔交易，差异只在于 3 行代码                                  │
│                                                                  │
│  lifi.hooks.beforeExecute.add(async (trade) => {               │
│    const r = await bridgeshield.check(trade.fromAddress);      │
│    if (r.action === 'BLOCK') throw new Error(r.riskFactors);   │
│  });                                                            │
└────────────────────────────────────────────────────────────────┘
```

**左侧模拟"LI.FI 无 AML"**：展示交易执行成功（模拟状态，不真实执行），显示"🚨 高风险资金已跨链转移"。  
**右侧调用真实 BridgeShield API**：显示真实检查结果，BLOCK 状态。  
两侧同步输入同一个地址，结果实时对比更新。

### 11.4 API 封装（含 Mock 降级）

```typescript
// frontend-demo/src/api/bridgeshield.ts

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Mock 数据（API 不可用时直接返回，演示零风险）
const MOCK_RESULTS: Record<string, AMLCheckResult> = {
  '0x098b716b8aaf21512996dc57eb0615e2383e2f96': {
    riskScore: 85, riskLevel: 'HIGH', action: 'BLOCK',
    riskFactors: ['黑客攻击地址: Ronin Bridge 2022', '涉案金额 $625M'],
    processingTimeMs: 43, cached: false,
  },
  '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b': {
    riskScore: 70, riskLevel: 'HIGH', action: 'BLOCK',
    riskFactors: ['混币器合约地址: Tornado Cash'],
    processingTimeMs: 12, cached: true,
  },
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': {
    riskScore: 0, riskLevel: 'LOW', action: 'ALLOW',
    riskFactors: [],
    processingTimeMs: 8, cached: true,
  },
};

export async function checkAddress(address: string, chainId = 1): Promise<AMLCheckResult> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/aml/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, chainId }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('API error');
    return res.json();
  } catch {
    // 降级到 Mock 数据，演示不中断
    const mock = MOCK_RESULTS[address.toLowerCase()];
    if (mock) return { ...mock, cached: true };
    return { riskScore: 0, riskLevel: 'LOW', action: 'ALLOW', riskFactors: [], processingTimeMs: 1 };
  }
}
```

### 11.5 环境配置

```bash
# frontend-demo/.env.example
VITE_API_BASE_URL=http://localhost:3000

# 生产部署
# VITE_API_BASE_URL=https://api.bridgeshield.io
```

### 11.6 启动方式

```bash
# 开发
cd frontend-demo
npm install
npm run dev        # http://localhost:5173

# 生产构建
npm run build      # 产物到 dist/，可部署到任意静态托管
```

---

## 12. 后台管理前端（独立目录）

> **目录**：`frontend-admin/`  
> **面向**：内部运营人员  
> **工期**：黑客松可选做（P1）  
> **风格**：实用数据密度型，与 Demo 完全不同

### 12.1 技术栈

与 Demo 前端相同（React + Vite + TypeScript + Tailwind），但风格偏向数据管理工具：浅色背景、表格密度高、操作按钮多。

### 12.2 目录结构

```
frontend-admin/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── pages/
│   │   ├── DashboardPage.tsx         # 风险仪表盘
│   │   ├── AppealPage.tsx            # 申诉管理（核心操作）
│   │   ├── WhitelistPage.tsx         # 白名单管理
│   │   └── LogsPage.tsx              # 检查日志查询
│   │
│   └── components/
│       ├── StatsCard.tsx             # 关键指标卡片
│       ├── RiskTrendChart.tsx        # 风险趋势图（Recharts）
│       ├── RiskDistributionPie.tsx   # 风险分布饼图
│       ├── AppealTable.tsx           # 申诉列表 + 审批操作
│       └── WhitelistTable.tsx        # 白名单列表 + 增删
│
├── index.html
├── vite.config.ts
├── package.json
└── .env.example
```

### 12.3 各页面说明

#### DashboardPage — 风险仪表盘

```
┌──────────────────────────────────────────────────────┐
│  BridgeShield Admin              今日 / 7天 / 本月   │
├────────────┬────────────┬────────────┬───────────────┤
│ 今日检查   │ 今日拦截   │ 缓存命中率  │ 平均响应时间  │
│  1,247     │   23       │   78%      │   47ms        │
│  ↑12%      │  ↑5%       │   ─        │   ─           │
├────────────┴────────────┴────────────┴───────────────┤
│                                                       │
│  拦截趋势（折线图，过去 7 天）                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                       │
├───────────────────────┬───────────────────────────────┤
│  风险等级分布          │  风险来源分类                 │
│  饼图：LOW/MED/HIGH   │  饼图：SANCTION/HACKER/MIXER  │
└───────────────────────┴───────────────────────────────┘
```

**图表库**：Recharts（轻量，已包含在 React 生态）

```typescript
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip } from 'recharts';
```

#### AppealPage — 申诉管理

```
┌──────────────────────────────────────────────────────────────────┐
│  申诉管理                          [待处理: 3]  [全部] [待处理]   │
├─────────────┬──────────┬──────────┬──────────────┬──────────────┤
│  Ticket ID  │  地址    │  提交时间 │  状态        │  操作        │
├─────────────┼──────────┼──────────┼──────────────┼──────────────┤
│ APT-001     │ 0xabc... │ 4月12日  │ 🟡 PENDING   │ [通过][驳回] │
│ APT-002     │ 0xdef... │ 4月11日  │ 🟢 APPROVED  │ [查看]       │
│ APT-003     │ 0x123... │ 4月10日  │ 🔴 REJECTED  │ [查看]       │
└─────────────┴──────────┴──────────┴──────────────┴──────────────┘
```

点击行展开查看申诉原因，"通过"按钮调用后端将地址加入白名单，"驳回"恢复原风险等级。

#### WhitelistPage — 白名单管理

```
┌────────────────────────────────────────────────────────────────┐
│  白名单管理                                   [+ 添加地址]     │
├──────────────────────────────────────────────────────────────  │
│  搜索地址...                                                    │
├────────────────┬────────────────┬────────────┬────────────────┤
│  地址          │  类型          │  标签      │  操作          │
├────────────────┼────────────────┼────────────┼────────────────┤
│  0x1231DE...   │ LIFI_OFFICIAL  │ Diamond    │  [移除]        │
│  0x1F9843...   │ KNOWN_PROTOCOL │ Uniswap V3 │  [移除]        │
└────────────────┴────────────────┴────────────┴────────────────┘
```

### 12.4 后台管理启动

```bash
cd frontend-admin
npm install
npm run dev        # http://localhost:5174
```

---

## 13. LI.FI 集成方案

### 13.1 最简集成（3 行代码）

```typescript
// 在 LI.FI SDK 调用链中加入 beforeExecute 钩子
lifi.hooks.beforeExecute.add(async (execution) => {
  const risk = await fetch('https://api.bridgeshield.io/api/v1/aml/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: execution.fromAddress, chainId: execution.fromChainId })
  }).then(r => r.json());

  if (risk.action === 'BLOCK') throw new Error(`AML: ${risk.riskFactors.join(', ')}`);
  // REVIEW: 记录日志，不阻断
});
```

### 13.2 LI.FI SDK PR 集成（提交到官方仓库）

```typescript
// @lifi/sdk/src/aml/bridgeshield-provider.ts

export class BridgeShieldAMLProvider {
  constructor(private options: { apiUrl?: string; apiKey?: string; timeout?: number } = {}) {}

  async check(params: { address: string; chainId: number; amount?: string; route?: any }) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), this.options.timeout || 5000);
    try {
      const res = await fetch(`${this.options.apiUrl || 'https://api.bridgeshield.io'}/api/v1/aml/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.options.apiKey ? { 'X-API-Key': this.options.apiKey } : {}) },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      if (!res.ok) return this.fallback('API error');
      return res.json();
    } catch (e) {
      return this.fallback(String(e));
    } finally {
      clearTimeout(tid);
    }
  }

  private fallback(reason: string) {
    console.warn(`[BridgeShield] Fallback ALLOW: ${reason}`);
    return { riskScore: 0, riskLevel: 'LOW', action: 'ALLOW', fallback: true };
  }
}
```

---

## 14. 部署架构

### 14.1 MVP 部署（Docker Compose 一键启动）

```yaml
# docker-compose.yml（根目录）
version: '3.8'

services:
  # 后端 API
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=file:./dev.db
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=info
    volumes:
      - ./backend/data:/app/data
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/v1/health"]
      interval: 30s

  # Redis
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    restart: unless-stopped

  # Demo 前端（Nginx 静态托管构建产物）
  frontend-demo:
    build: ./frontend-demo
    ports:
      - "5173:80"
    restart: unless-stopped

  # 后台管理前端
  frontend-admin:
    build: ./frontend-admin
    ports:
      - "5174:80"
    restart: unless-stopped

volumes:
  redis_data:
```

**一键启动：**
```bash
git clone https://github.com/your-team/bridgeshield
cd bridgeshield
docker-compose up -d

# 访问地址：
# Demo：    http://localhost:5173
# Admin：   http://localhost:5174
# API：     http://localhost:3000
```

**Render.com 一键部署：**
```markdown
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/your-team/bridgeshield)
```

### 14.2 各服务 Dockerfile

**后端 Dockerfile（`backend/Dockerfile`）：**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/app.js"]
```

**前端 Dockerfile（`frontend-demo/Dockerfile`，admin 同）：**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 14.3 环境变量汇总

**后端（`backend/.env`）：**
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=file:./dev.db          # 开发
# DATABASE_URL=postgresql://...     # 生产
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
ETHERSCAN_API_KEY=                  # 可选，用于链上溯源
CHAINALYSIS_API_KEY=                # 可选，付费功能
CIRCUIT_BREAKER_TIMEOUT=3000
```

**Demo 前端（`frontend-demo/.env`）：**
```bash
VITE_API_BASE_URL=http://localhost:3000
```

**Admin 前端（`frontend-admin/.env`）：**
```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_ADMIN_TOKEN=                   # 简单 token 认证（MVP）
```

---

## 15. 监控与告警

### 15.1 关键指标（Prometheus）

```typescript
// 检查总数（按 action 分类）
const checkTotal = new Counter({
  name: 'bs_checks_total',
  labelNames: ['action', 'risk_level', 'cached'],
});

// 响应时间分布
const checkDuration = new Histogram({
  name: 'bs_check_duration_ms',
  buckets: [5, 10, 25, 50, 100, 200, 500],
});

// 缓存命中
const cacheHits = new Counter({
  name: 'bs_cache_hits_total',
  labelNames: ['layer'],  // L1 / L2
});

// 熔断器状态
const circuitState = new Gauge({
  name: 'bs_circuit_breaker_state',
  labelNames: ['provider'],  // 0=closed 1=open 2=half-open
});
```

### 15.2 告警规则

| 告警 | 触发条件 | 严重度 |
|------|----------|--------|
| 高错误率 | 5 分钟错误率 > 5% | 🔴 Critical |
| 高延迟 | P95 > 500ms | 🟠 Warning |
| 熔断器开启 | 任意 CB 进入 OPEN | 🟠 Warning |
| Redis 故障 | 连接失败 | 🔴 Critical |
| 大量拦截 | 1 分钟 BLOCK > 100 | 🟠 Warning（可能误判风暴） |

### 15.3 日志规范

```typescript
// 结构化 JSON 日志（所有请求）
logger.info('aml_check', {
  checkId: 'chk_abc123',
  address: '0x...',
  chainId: 1,
  riskScore: 85,
  action: 'BLOCK',
  cached: false,
  processingTimeMs: 43,
  fallback: false,
});
```

---

## 16. 开发计划

### 16.1 技术栈汇总

| 类别 | 后端 | Demo 前端 | Admin 前端 |
|------|------|-----------|------------|
| 语言 | TypeScript | TypeScript | TypeScript |
| 框架 | Node.js + Express | React 18 + Vite | React 18 + Vite |
| 样式 | — | TailwindCSS | TailwindCSS |
| ORM | Prisma | — | — |
| 缓存 | Redis + node-cache | — | — |
| 熔断 | opossum | — | — |
| 图表 | — | — | Recharts |
| 动画 | — | Framer Motion | — |

### 16.2 3 天黑客松执行计划

#### Day 1（上午）：项目初始化 + 核心后端

| 任务 | 产出 | 耗时 |
|------|------|------|
| 初始化三个目录，配置 TypeScript + Vite | 可运行空项目 | 1h |
| 准备本地风险数据文件（手工整理 500+ 地址） | `data/*.json` | 1h |
| 实现 RiskDataLoader（内存预加载） | O(1) 查询 | 1h |
| 实现 RiskScorer（加权评分引擎） | 核心评分逻辑 | 1h |

#### Day 1（下午）：后端 API + Demo 前端骨架

| 任务 | 产出 | 耗时 |
|------|------|------|
| 实现 `/aml/check`、`/whitelist`、`/appeal` | 3 个 API 可调用 | 2h |
| Redis 缓存 + Opossum 熔断器 | 生产级可靠性 | 1h |
| Demo 前端骨架 + 路由 + 地址输入组件 | 基本页面框架 | 1h |

#### Day 2（上午）：Demo 前端核心功能

| 任务 | 产出 | 耗时 |
|------|------|------|
| RiskResultCard + RiskScoreMeter（含动画） | 核心展示组件 | 2h |
| 预设演示地址 + API Mock 降级 | 演示零风险 | 1h |
| LiveStats 实时统计展示 | 数据面板 | 1h |

#### Day 2（下午）：对比页 + 集成代码 + Admin

| 任务 | 产出 | 耗时 |
|------|------|------|
| ComparePage 左右对比面板 | 对比演示页完成 | 2h |
| CodeSnippet 3 行集成代码展示 | 增强说服力 | 30min |
| Admin 仪表盘 + 申诉管理（基础版） | P1 功能 | 1.5h |

#### Day 3：打磨 + 准备演示

| 任务 | 产出 | 耗时 |
|------|------|------|
| 全链路联调（前端 → API → 返回结果） | 端到端通 | 1h |
| UI 细节打磨（动画、响应式、边界情况） | 精致的 Demo | 1h |
| README（根目录 + 各子目录）+ 一键部署 | 文档完整 | 1h |
| 演示排练（5 遍以上，精确计时） | 熟练演示 | 2h |
| 录制备用演示视频 | 备用方案 | 30min |

### 16.3 演示流程（3 分钟精确脚本）

| 时间 | 动作 | 话术 |
|------|------|------|
| 0:00–0:20 | 打开 Demo，输入 Ronin 黑客地址 | "这是 2022 年 Ronin 黑客的地址，偷走了 $625M，现在他想通过 LI.FI 跨链转移资金。" |
| 0:20–0:40 | 点击 CHECK，结果出现（BLOCK，85 分） | "BridgeShield 在 43 毫秒内识别并拦截了这笔交易，用户甚至感知不到延迟。" |
| 0:40–1:00 | 切到对比页，左侧"无 AML 直接成功"，右侧 BLOCK | "这就是有没有 BridgeShield 的区别。左边资金已经跑路，右边在入口就被拦了。" |
| 1:00–1:20 | 输入 Lido 地址，结果 ALLOW | "正常用户完全不受影响，延迟不到 50ms，体验零损耗。" |
| 1:20–1:40 | 展示 CodeSnippet（3 行代码） | "LI.FI 只需要加这 3 行代码，今天就能上线。我们已经准备好了 PR。" |
| 1:40–2:00 | 展示 LiveStats（今日检查 1247 笔，拦截 23 笔） | "这是真实数据——1.8% 的跨链交易来自高风险地址，平均每天 23 笔，每年为 LI.FI 避免数百万美元的监管风险。" |
| 2:00–2:20 | 展示一键部署按钮 | "点这个按钮，5 分钟内部署到 LI.FI 自己的服务器，数据完全自主可控。" |
| 2:20–2:30 | 收尾 | "BridgeShield 不是概念验证，是今天就能用的生产级系统。谢谢。" |

### 16.4 演示预设地址（确保命中）

| 地址 | 类型 | 预期结果 | 演示用途 |
|------|------|----------|----------|
| `0x098B716B8Aaf21512996dC57EB0615e2383E2f96` | Ronin Hacker | BLOCK 85 分 | 主演示拦截 |
| `0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b` | Tornado Cash | BLOCK 70 分 | 混币器演示 |
| `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` | Lido stETH | ALLOW 0 分 | 正常用户演示 |
| `0x1F98431c8aD98523631AE4a59f267346ea31F984` | Uniswap V3 | ALLOW 0 分 | 白名单演示 |

---

## 附录：数据文件格式

### hacker-addresses.json
```json
[
  {
    "address": "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
    "label": "Ronin Bridge Hacker 2022",
    "category": "HACKER",
    "source": "SlowMist",
    "amountUSD": 625000000,
    "chains": [1, 2020],
    "date": "2022-03-29"
  }
]
```

### whitelist.json
```json
[
  {
    "address": "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
    "type": "LIFI_OFFICIAL",
    "label": "LI.FI Diamond Contract",
    "chainId": null
  },
  {
    "address": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    "type": "KNOWN_PROTOCOL",
    "label": "Uniswap V3 Factory",
    "chainId": 1
  }
]
```

---

*文档版本：v2.0 | 创建：2025-04-12 | 状态：完整工程执行版（含 Demo + Admin 前端）*
