# Gym Membership System — Development Process

## Overview

健身房會員管理系統，AWS 全無伺服器架構。
提供會員端（查詢、預約、報到）與管理端（會員管理、報表、通知）功能。

---

## Architecture

```
Browser
    │
    │ HTTPS
    ▼
[CloudFront] ── [S3] (Vue frontend)        ← Phase 3
    │
[WAF]                                       ← Phase 3
    │
[API Gateway HTTP API]
    │
    ├─ /auth/*  ──────────→ Lambda (auth-handler)
    │  (public)
    │
    └─ /members/*  ───────→ Lambda (member-handler)
    └─ /admin/*  ─────────→ Lambda (admin-handler)    ← Phase 4
    └─ /classes/*  ───────→ Lambda (class-handler)    ← Phase 4
       (JWT protected)
            │
    ┌───────┴──────────┐
    ▼                  ▼
[DynamoDB]         [Cognito]
(main DB)          (auth / JWT)
    │
    ▼ Streams                                          ← Phase 5
[SQS] → Lambda (notifications)
    │
   [SES] (email)
    │
[EventBridge Scheduler] (daily expiry scan)            ← Phase 5
```

---

## AWS Resources

| Resource | Name / ID |
|---|---|
| Region | ap-northeast-1 (Tokyo) |
| Account | 461340168702 |
| API Gateway | https://qg9vkjbzhf.execute-api.ap-northeast-1.amazonaws.com |
| DynamoDB Table | gym-membership |
| Cognito User Pool | ap-northeast-1_MFrLXG4E6 |
| Cognito Client ID | 1lavucbgsrt5ipkg2a3dss4om6 |
| CloudFormation Stack | GymMembershipStack |

---

## DynamoDB Schema (Single-Table)

| PK | SK | 用途 |
|---|---|---|
| `MEMBER#<id>` | `PROFILE` | 會員基本資料 |
| `MEMBER#<id>` | `MEMBERSHIP#<id>` | 方案（到期日、類型）|
| `MEMBER#<id>` | `CHECKIN#<timestamp>` | 報到記錄 |
| `MEMBER#<id>` | `BOOKING#<classId>#<ts>` | 預約記錄 |
| `CLASS#<id>` | `META` | 課程資訊 |
| `CLASS#<id>` | `SLOT#<date>#<time>` | 時段 + 剩餘名額 |
| `TRAINER#<id>` | `PROFILE` | 教練資料 |
| `PAYMENT#<id>` | `META` | 繳費記錄 |

**GSI**
- `status-expiry-index` — PK: membershipStatus, SK: expiryDate（查詢到期會員）
- `checkin-date-index` — PK: locationId, SK: checkinAt（報到統計）

---

## Cognito Groups

| Group | 說明 |
|---|---|
| `admin` | 管理者，可存取所有功能 |
| `trainer` | 教練，可管理課程與報到 |
| `member` | 一般會員 |

---

## Development Phases

### Phase 1 — Foundation ✅
- [x] CDK 專案初始化
- [x] DynamoDB table + GSI
- [x] Cognito User Pool + groups
- [x] API Gateway HTTP API + JWT authorizer
- [x] Lambda skeleton (auth / member)
- [x] 部署驗證：API 回應正常

### Phase 2 — Backend API ✅
**Auth**
- [x] `POST /auth/register` — 建立 Cognito 帳號，寫入 DynamoDB PROFILE
- [x] `POST /auth/login` — 取得 idToken / accessToken / refreshToken
- [x] `POST /auth/confirm` — 驗證 email（ConfirmSignUp）
- [x] `POST /auth/refresh` — 刷新 token（REFRESH_TOKEN_AUTH）

**Member (會員端，JWT 保護)**
- [x] `GET /members/me` — 查詢自己的資料
- [x] `PUT /members/me` — 更新個人資料（name / phone）
- [x] `GET /members/me/membership` — 查詢會員方案狀態（分頁）
- [x] `GET /members/me/checkins` — 查詢報到記錄（分頁，cursor-based）

**Admin (管理端，JWT 保護 + admin group 驗證)**
- [x] `GET /admin/members` — 列出所有會員（Scan + 分頁）
- [x] `GET /admin/members/:id` — 查詢單一會員
- [x] `POST /admin/members` — 新增會員（AdminCreateUser + PROFILE）
- [x] `PUT /admin/members/:id` — 更新會員（name / phone）
- [x] `PUT /admin/members/:id/suspend` — 停權（DynamoDB + Cognito disable）
- [x] `PUT /admin/members/:id/activate` — 復權（DynamoDB + Cognito enable）

> **注意**：API Gateway HTTP API 將 Cognito JWT 的 `cognito:groups` 陣列序列化為 `[group1 group2]`（空格分隔、有中括號），需在 Lambda 內手動解析。

### Phase 3 — Frontend ⬜
- [ ] Vue 3 + Vite 專案初始化
- [ ] S3 bucket 建立
- [ ] CloudFront distribution
- [ ] WAF rules（rate limit + managed rules）
- [ ] Route53 domain（選配）
- [ ] ACM 憑證
- [ ] 登入 / 註冊頁面
- [ ] 會員儀表板
- [ ] 管理後台

### Phase 4 — Core Features ⬜
**課程與預約**
- [ ] `POST /classes` — 建立課程
- [ ] `GET /classes` — 課程列表
- [ ] `POST /classes/:id/slots` — 建立時段
- [ ] `POST /classes/:id/slots/:slotId/book` — 預約（樂觀鎖防超賣）
- [ ] `DELETE /classes/:id/slots/:slotId/book` — 取消預約

**報到 (Check-in)**
- [ ] `POST /checkins` — 報到（idempotent，防重複）
- [ ] `GET /admin/checkins` — 管理端報到統計

**教練**
- [ ] `GET /trainers` — 教練列表
- [ ] `POST /admin/trainers` — 新增教練

### Phase 5 — Notifications & Automation ⬜
- [ ] DynamoDB Streams → Lambda trigger
- [ ] SQS queue 建立
- [ ] SES email 設定（到期提醒、預約確認）
- [ ] EventBridge Scheduler（每日掃描到期會員）

### Phase 6 — Observability ⬜
- [ ] CloudWatch dashboards
- [ ] Lambda error rate alarm
- [ ] API Gateway 4xx/5xx alarm
- [ ] X-Ray tracing

---

## File Structure

```
gymflow/
├── apps/
│   ├── member-portal/          # 會員端網頁
│   └── admin-portal/           # 管理者端網頁
├── services/
│   ├── auth/                   # Lambda — 認證 (register/login/confirm/refresh)
│   ├── member/                 # Lambda — 會員資料 CRUD
│   ├── admin/                  # Lambda — 管理端 API
│   └── package.json            # 共用 AWS SDK 依賴
├── infra/
│   ├── bin/
│   │   └── gym-membership.ts   # CDK entry point
│   ├── lib/
│   │   └── gym-membership-stack.ts # CDK stack
│   └── test/
├── packages/
│   └── shared-types/           # 前後端共用 TypeScript 型別
├── docs/
│   └── process.md              # This file
└── CLAUDE.md
```

---

## Commit Log

| Date | Phase | 內容 |
|---|---|---|
| 2026-06-06 | Phase 1 | 初始化 CDK 專案，部署 DynamoDB / Cognito / API Gateway / Lambda 骨架 |
| 2026-06-06 | Phase 2 | 實作 Auth / Member / Admin Lambda handler，端對端測試通過 |
