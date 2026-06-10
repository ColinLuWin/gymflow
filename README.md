# Gymflow

健身房會員管理系統，AWS 全無伺服器架構。提供會員端與管理者端兩個網頁介面。

## 功能概覽

**會員端 (`apps/member-portal`)**
- Google / LINE 社交登入（PKCE）
- LINE 帳號綁定（個人資料頁）
- 點數查詢、兌換獎勵
- 出示兌換 QR Code 供工作人員核銷
- 查詢會員方案與到期日（規劃中）
- 課程預約與取消（規劃中）

**管理者端 (`apps/admin-portal`)**
- Google 登入（PKCE）
- 會員管理（新增、停權、復權）
- 點數發放、獎勵商品管理、兌換記錄
- QR Code 掃描（會員點數 QR + 兌換核銷 QR）
- 課程與教練管理（規劃中）
- 到期提醒通知（規劃中）

## 技術架構

```
Browser
    │
[CloudFront] ── [S3]          (Phase 3)
    │
[API Gateway HTTP API]
    ├── /auth/*   → Lambda (auth)
    ├── /members/* → Lambda (member)   JWT protected
    └── /admin/*  → Lambda (admin)     JWT protected   (Phase 4)
          │
    ┌─────┴──────┐
 [DynamoDB]  [Cognito]
```

| 層級 | 技術 |
|---|---|
| Frontend | Vue 3 + Vite + Pinia + Tailwind CSS |
| API | AWS API Gateway HTTP API |
| Backend | AWS Lambda (Node.js 20, TypeScript) |
| Auth | AWS Cognito（PKCE + Google / LINE 社交登入） |
| Database | AWS DynamoDB (Single-Table) |
| CDN | AWS CloudFront + S3 |
| IaC | AWS CDK (TypeScript) |
| Region | ap-northeast-1 (Tokyo) |

## Monorepo 結構

```
gymflow/
├── apps/
│   ├── member-portal/     # 會員端網頁
│   └── admin-portal/      # 管理者端網頁
├── services/
│   ├── auth/              # Lambda — token refresh / LINE 帳號綁定
│   ├── member/            # Lambda — 會員資料 CRUD
│   └── admin/             # Lambda — 管理端 API
├── infra/                 # AWS CDK stack
├── packages/
│   └── shared-types/      # 前後端共用 TypeScript 型別
└── docs/
    └── process.md         # 架構說明、開發 Phase、資源清單
```

## 開始開發

### 前置需求

- Node.js 20+
- AWS CLI（已設定好 credentials）
- AWS CDK CLI：`npm install -g aws-cdk`

### 安裝依賴

```bash
cd infra && npm install
```

### 部署 Infrastructure

```bash
cd infra
npx cdk diff      # 確認變更
npx cdk deploy    # 部署至 AWS
```

### 執行測試

```bash
cd infra && npm test
```

## 文件

- [開發流程 & 架構說明](docs/process.md)
