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
- [x] `DELETE /admin/members/:id` — 刪除會員（DynamoDB + Cognito AdminDeleteUser）

> **注意**：API Gateway HTTP API 將 Cognito JWT 的 `cognito:groups` 陣列序列化為 `[group1 group2]`（空格分隔、有中括號），需在 Lambda 內手動解析。

### Phase 3 — Frontend ✅
- [x] Vue 3 + Vite 專案初始化（member-portal / admin-portal）
- [x] S3 bucket 建立（各自獨立，Block Public Access）
- [x] CloudFront distribution（OAC，SPA 404→index.html）
- [x] GitHub Actions CI/CD（push apps/** → build → S3 sync → invalidate）
- [x] 會員端：登入、註冊、email 確認、個人資料、會員方案、報到記錄
- [x] 管理端：登入、會員列表、會員詳情、新增 / 編輯 / 停權 / 復權 / 刪除

**已部署 URL**

| 入口 | URL |
|---|---|
| Member Portal | https://dv3vkkn6m5tr2.cloudfront.net |
| Admin Portal | https://d3h5wal582eh13.cloudfront.net |

**CloudFront / S3 Resource IDs**

| Resource | ID |
|---|---|
| Member Bucket | gymmembershipstack-memberportalbucket95c316ec-ew8zcm6erm8c |
| Member Distribution | EQVMQPFM6A4AS |
| Admin Bucket | gymmembershipstack-adminportalbucket11b7abcd-3hrfvsc10jld |
| Admin Distribution | E2X3MS7RJAUZ3T |

**已知行為**

- Cognito 預設寄件人（`no-reply@verificationemail.com`）可能進垃圾信件匣；確認碼頁面已顯示提示。
- CORS preflight（OPTIONS）不可帶 JWT authorizer；protected routes 需拆出獨立 OPTIONS route。
- 管理端帳號不開放自助註冊，需由管理員透過 AdminCreateUser 建立。

### Phase 3.5 — Points & Rewards ✅
**DynamoDB Items 新增**
- `MEMBER#<id>` / `POINTS_BALANCE` — 點數餘額（原子更新）
- `MEMBER#<id>` / `POINTS_TXN#<isoTimestamp>` — 點數異動記錄（award / redeem / refund）
- `REWARD#<id>` / `META` — 獎勵商品（name、pointsCost、stock、isActive）
- `MEMBER#<id>` / `REDEMPTION#<epochMs>-<uuid>` — 兌換記錄（URL-safe ID，可排序）

**Admin / Trainer 端（JWT 保護）**
- [x] `POST /admin/members/:id/points` — 發點數（admin + trainer 皆可）
- [x] `GET /admin/members/:id/points` — 查餘額 + 異動歷程（admin + trainer 皆可）
- [x] `GET /admin/rewards` — 獎勵商品列表
- [x] `POST /admin/rewards` — 建立獎勵商品（stock: -1 = 無限）
- [x] `PUT /admin/rewards/:id` — 更新獎勵商品
- [x] `DELETE /admin/rewards/:id` — 刪除獎勵商品
- [x] `GET /admin/redemptions` — 所有兌換記錄
- [x] `POST /admin/members/:id/redemptions/:redemptionId/cancel` — 撤銷兌換（補回點數）

**會員端（JWT 保護）**
- [x] `GET /members/me/qr` — 取得自己的 memberId（前端生成 QR）
- [x] `GET /members/me/points` — 點數餘額 + 異動歷程
- [x] `GET /members/rewards` — 瀏覽獎勵目錄（僅顯示 isActive=true）
- [x] `POST /members/me/redemptions` — 兌換（TransactWrite：扣點 + 寫記錄，原子操作）
- [x] `GET /members/me/redemptions` — 查看自己的兌換記錄

**已知行為**
- 點數餘額不足時兌換會回傳 400（TransactionCanceledException 處理）
- 庫存有限商品（stock ≥ 0）兌換時同 transaction 原子扣庫存
- Trainer group 只能存取 /points 相關端點，其餘 admin routes 仍限 admin group

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
| 2026-06-07 | Phase 3 | 實作 Member / Admin Portal（Vue 3），部署 S3 + CloudFront，GitHub Actions CI/CD |
| 2026-06-07 | Fix | 修正 CORS preflight 被 JWT authorizer 攔截（OPTIONS route 需獨立、不帶 authorizer） |
| 2026-06-07 | Fix | 修正 CORS preflight 被 API Gateway corsPreflight 設定回 404（改由 Lambda 自行回應） |
| 2026-06-07 | Feat | Admin Portal 新增刪除會員功能（DELETE /admin/members/:id） |
| 2026-06-07 | Feat | Phase 3.5：點數與獎勵兌換系統（發點、商品目錄、TransactWrite 兌換、撤銷補點） |
