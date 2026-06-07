# Gymflow — 系統架構文件

> 最後更新：2026-06-07（Phase 3.5 完成）

---

## 系統概覽

Gymflow 是一套健身房會員管理系統，採用 **AWS 全無伺服器（Serverless）架構**。  
提供兩個入口：**Member Portal**（會員自助）與 **Admin Portal**（管理員/教練後台）。

### 已上線功能

| 功能 | 狀態 |
|---|---|
| 會員註冊 / 登入 / Email 確認 | ✅ |
| 個人資料查詢與更新 | ✅ |
| 點數發放、查詢、兌換、撤銷 | ✅ |
| 獎勵商品管理（建立 / 上下架 / 刪除） | ✅ |
| 管理員建立 / 編輯 / 停權 / 刪除會員 | ✅ |
| QR Code 掃描跳轉 | ✅ |
| 課程預約 / 報到 / 到期通知 | 🔲 Phase 4–5 |

---

## 架構圖

```
瀏覽器 (Member / Admin Portal)
        │
        │ HTTPS
        ▼
  ┌─────────────┐   ┌─────────────┐
  │  CloudFront │   │  CloudFront │
  │ (Member CF) │   │ (Admin CF)  │
  └──────┬──────┘   └──────┬──────┘
         │ OAC              │ OAC
         ▼                  ▼
  ┌─────────────┐   ┌─────────────┐
  │   S3 Bucket │   │   S3 Bucket │
  │ (member SPA)│   │ (admin SPA) │
  └─────────────┘   └─────────────┘

        │ API 呼叫 (HTTPS + JWT)
        ▼
  ┌──────────────────────────┐
  │   API Gateway HTTP API   │
  │  qg9vkjbzhf.execute-api  │
  └──────────────────────────┘
         │
         ├─ /auth/{proxy+}   ──────────→ Lambda: gym-auth-handler
         │  (公開，無授權)
         │
         ├─ /members/{proxy+} ─────────→ Lambda: gym-member-handler
         │  (JWT 保護)                         │
         │                                     └── DynamoDB: gym-membership
         │
         └─ /admin/{proxy+}  ──────────→ Lambda: gym-admin-handler
            (JWT 保護 + group 驗證)             │
                                               ├── DynamoDB: gym-membership
                                               └── Cognito: AdminCreateUser 等

  ┌──────────────────────────┐
  │  Cognito User Pool       │
  │  ap-northeast-1_MFrLXG4E6│
  │  Groups: admin / trainer / member │
  └──────────────────────────┘
```

---

## AWS 資源清單

| 服務 | 資源名稱 / ID | 用途 |
|---|---|---|
| Region | ap-northeast-1（東京） | 靠近台灣用戶，低延遲 |
| CloudFormation | GymMembershipStack | 所有資源統一管理 |
| DynamoDB | `gym-membership` | 主資料庫（PAY_PER_REQUEST） |
| Cognito User Pool | `ap-northeast-1_MFrLXG4E6` | 身份驗證、JWT 發行 |
| Cognito Client | `1lavucbgsrt5ipkg2a3dss4om6` | SPA 使用（無 secret） |
| API Gateway HTTP API | `qg9vkjbzhf.execute-api` | HTTP 路由入口 |
| Lambda | `gym-auth-handler` | 註冊 / 登入 / 確認 / Refresh |
| Lambda | `gym-member-handler` | 會員自助 API |
| Lambda | `gym-admin-handler` | 管理員 / 教練 API |
| S3 Bucket | `gymmembershipstack-memberportalbucket*` | Member Portal 靜態資源 |
| S3 Bucket | `gymmembershipstack-adminportalbucket*` | Admin Portal 靜態資源 |
| CloudFront | `EQVMQPFM6A4AS` | Member Portal CDN |
| CloudFront | `E2X3MS7RJAUZ3T` | Admin Portal CDN |

---

## 前端架構

### 技術棧

- **Vue 3 + Vite + TypeScript**
- **Tailwind CSS**（utility-first 樣式）
- **Pinia**（auth store）
- **Vue Router**（client-side routing）

### 部署方式

```
本機 build (vite build)
    ↓
GitHub Actions CI/CD
    ↓ aws s3 sync
S3 Bucket (Block Public Access，只允許 CloudFront 存取)
    ↑ OAC (Origin Access Control)
CloudFront Distribution
    → HTTP 301 升級至 HTTPS
    → 404/403 → /index.html（SPA routing）
    → Cache Policy: CACHING_DISABLED（開發期方便測試）
```

### SPA 路由處理

CloudFront 設定 `errorResponses`：403 和 404 都回傳 `index.html` + HTTP 200。  
這讓 Vue Router 的 `history mode` 可以正確運作（直接訪問 `/rewards` 不會 404）。

---

## 後端架構

### API Gateway HTTP API

- 採用 **HTTP API**（非 REST API），成本更低、延遲更短
- JWT Authorizer 驗證 Cognito idToken，自動注入 claims 到 `requestContext.authorizer.jwt.claims`
- **CORS 陷阱**：OPTIONS preflight 不能帶 JWT Authorizer，需獨立 route 並由 Lambda 回傳 CORS headers

```typescript
// OPTIONS 單獨 route，不帶 authorizer
api.addRoutes({ path: '/members/{proxy+}', methods: [HttpMethod.OPTIONS], integration: ... });

// GET/POST/PUT/DELETE 帶 authorizer
api.addRoutes({ path: '/members/{proxy+}', methods: [...], authorizer: jwtAuthorizer, ... });
```

### Lambda 設計

三個 Lambda（auth / member / admin），每個都是**單一 handler + 內部路由**（依 `method + path` 分派）。

**優點**：簡單、部署快、無需 Express/框架  
**缺點**：隨功能增加，handler 會變大；目前仍在可接受範圍

### IAM 最小權限

| Lambda | DynamoDB | Cognito |
|---|---|---|
| auth-handler | ReadWrite | SignUp, ConfirmSignUp, InitiateAuth, AdminAddUserToGroup |
| member-handler | ReadWrite | 無（只讀 JWT claims） |
| admin-handler | ReadWrite | AdminCreateUser, AdminDeleteUser, AdminDisableUser, AdminEnableUser, AdminAddUserToGroup |

### 角色控制（Authorization）

API Gateway 驗證 JWT 有效性（Authentication），**角色控制在 Lambda 內部**：

```typescript
function isAdmin(event): boolean {
  const groups = getClaims(event)?.['cognito:groups'];
  // API Gateway HTTP API 將 groups 序列化為 "[admin member]"（空格分隔）
  return parseGroups(groups).includes('admin');
}
```

> **已知問題**：Cognito groups 在 API Gateway HTTP API 中被序列化為 `[group1 group2]` 字串，需手動 parse。

---

## 資料模型（DynamoDB Single-Table Design）

### 表格設計

| PK | SK | 資料類型 | 說明 |
|---|---|---|---|
| `MEMBER#<sub>` | `PROFILE` | 會員基本資料 | email, name, phone, status |
| `MEMBER#<sub>` | `MEMBERSHIP#<id>` | 方案 | 到期日、方案類型 |
| `MEMBER#<sub>` | `CHECKIN#<isoTimestamp>` | 報到記錄 | 時間戳 |
| `MEMBER#<sub>` | `POINTS_BALANCE` | 點數餘額 | balance（原子更新） |
| `MEMBER#<sub>` | `POINTS_TXN#<isoTimestamp>` | 點數異動 | type: award/redeem/refund, delta |
| `MEMBER#<sub>` | `REDEMPTION#<epochMs>-<uuid>` | 兌換記錄 | rewardId, pointsCost, status |
| `REWARD#<id>` | `META` | 獎勵商品 | name, pointsCost, stock, isActive |

### GSI

| Index | PK | SK | 用途 |
|---|---|---|---|
| `status-expiry-index` | `membershipStatus` | `expiryDate` | 查詢即將到期會員 |
| `checkin-date-index` | `locationId` | `checkinAt` | 報到統計（Phase 4） |

### 原子操作（TransactWrite）

點數異動和兌換均使用 DynamoDB TransactWrite，確保：
- 扣點 + 寫入兌換記錄 = 原子操作，不會出現扣了點但沒記錄的情況
- 有限庫存商品：扣庫存 + 扣點 + 寫記錄 = 同一 transaction（最多 25 個 TransactItems）

---

## 認證流程

```
會員自助註冊：
  POST /auth/register → Cognito SignUp → 加入 member group → 寫 PROFILE
  → Email 驗證碼
  POST /auth/confirm → Cognito ConfirmSignUp
  POST /auth/login → Cognito InitiateAuth → 回傳 idToken + accessToken + refreshToken

管理員建立會員：
  POST /admin/members → Cognito AdminCreateUser（系統生成臨時密碼、寄 email）
  → 加入 member group → 寫 PROFILE

Token 使用：
  API 呼叫帶 Authorization: Bearer <idToken>
  API Gateway 驗證簽章 + audience
  Lambda 從 requestContext 取 claims（sub, cognito:groups）

Token Refresh：
  POST /auth/refresh { refreshToken } → 回傳新 idToken + accessToken
```

---

## API 路由一覽

### 公開路由（無需 JWT）

| Method | Path | 說明 |
|---|---|---|
| POST | `/auth/register` | 會員自助註冊 |
| POST | `/auth/confirm` | 確認 Email |
| POST | `/auth/login` | 登入，取得 tokens |
| POST | `/auth/refresh` | 刷新 tokens |

### 會員路由（需 JWT，member group）

| Method | Path | 說明 |
|---|---|---|
| GET | `/members/me` | 查詢個人資料 |
| PUT | `/members/me` | 更新個人資料 |
| GET | `/members/me/membership` | 查詢方案狀態 |
| GET | `/members/me/checkins` | 查詢報到記錄（分頁） |
| GET | `/members/me/qr` | 取得 memberId（前端生成 QR） |
| GET | `/members/me/points` | 點數餘額 + 異動記錄 |
| GET | `/members/rewards` | 瀏覽可兌換獎勵 |
| POST | `/members/me/redemptions` | 兌換獎勵 |
| GET | `/members/me/redemptions` | 查詢兌換記錄 |

### 管理員路由（需 JWT，admin group；部分 trainer 可用）

| Method | Path | 說明 | 權限 |
|---|---|---|---|
| GET | `/admin/members` | 列出所有會員 | admin |
| POST | `/admin/members` | 新增會員 | admin |
| GET | `/admin/members/:id` | 查詢單一會員 | admin |
| PUT | `/admin/members/:id` | 更新會員資料 | admin |
| PUT | `/admin/members/:id/suspend` | 停權 | admin |
| PUT | `/admin/members/:id/activate` | 復權 | admin |
| DELETE | `/admin/members/:id` | 刪除會員 | admin |
| POST | `/admin/members/:id/points` | 發點數 | admin + trainer |
| GET | `/admin/members/:id/points` | 查點數 | admin + trainer |
| GET | `/admin/rewards` | 獎勵列表 | admin |
| POST | `/admin/rewards` | 建立獎勵 | admin |
| PUT | `/admin/rewards/:id` | 更新獎勵 | admin |
| DELETE | `/admin/rewards/:id` | 刪除獎勵 | admin |
| GET | `/admin/redemptions` | 所有兌換記錄 | admin |
| POST | `/admin/members/:id/redemptions/:rid/cancel` | 撤銷兌換（補點） | admin |

---

## Infrastructure as Code（CDK）

所有 AWS 資源均透過 **AWS CDK v2（TypeScript）** 定義，位於 `infra/lib/gym-membership-stack.ts`。

```
infra/
├── bin/gym-membership.ts    # CDK App entry point
└── lib/gym-membership-stack.ts  # 單一 Stack，包含所有資源
```

部署指令：
```bash
cd infra && cdk deploy
```

---

## CI/CD

GitHub Actions 監聽 `apps/**` 路徑的 push：
1. 安裝 Node.js 依賴
2. `vite build`
3. `aws s3 sync dist/ s3://<bucket>`
4. `aws cloudfront create-invalidation`（清除 CDN 快取）

Lambda 與 CDK stack 尚未接入 CI/CD，目前手動 `cdk deploy`。

---

## 已知行為與限制

| 項目 | 說明 |
|---|---|
| CORS OPTIONS | OPTIONS preflight 不可帶 JWT Authorizer；由 Lambda 自行回應 200 + CORS headers |
| Cognito groups 格式 | API Gateway HTTP API 將 groups 序列化為 `[group1 group2]` 字串，需手動 parse |
| Cognito 驗證信 | 預設寄件人 `no-reply@verificationemail.com`，可能進垃圾信件匣 |
| Admin 自助註冊 | 管理員帳號不開放自助註冊，需由管理員透過 AdminCreateUser 建立 |
| CloudFront Cache | 目前 CACHING_DISABLED（方便開發），正式上線前應設定適當 Cache Policy |
| listMembers Scan | 會員列表使用 DynamoDB Scan + FilterExpression，資料量大時效能下降（Phase 4 前需優化） |
| listRewards Scan | 獎勵列表同上 |

---

## 下一步（Phase 4–6）

| Phase | 主題 | 核心工作 |
|---|---|---|
| 4 | 課程與預約 | 課程 CRUD、時段管理、樂觀鎖防超賣、報到 |
| 5 | 通知與自動化 | DynamoDB Streams → SQS → SES、EventBridge Scheduler（到期提醒） |
| 6 | 可觀測性 | CloudWatch Dashboard、Lambda/API GW 告警、X-Ray Tracing |
