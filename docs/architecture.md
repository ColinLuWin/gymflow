# Gymflow — 系統架構文件

> 最後更新：2026-06-10（Phase 3.7 完成）

---

## 系統概覽

Gymflow 是一套健身房會員管理系統，採用 **AWS 全無伺服器（Serverless）架構**。  
提供兩個入口：**Member Portal**（會員自助）與 **Admin Portal**（管理員/教練後台）。

### 已上線功能

| 功能 | 狀態 |
|---|---|
| Google 登入（會員端 + 管理端） | ✅ |
| LINE 登入（會員端，需先綁定） | ✅ |
| LINE 帳號綁定（個人資料頁） | ✅ |
| 個人資料查詢與更新 | ✅ |
| 點數發放、查詢、兌換、撤銷 | ✅ |
| 獎勵商品管理（建立 / 上下架 / 刪除） | ✅ |
| 兌換 QR Code 出示與核銷 | ✅ |
| 管理員建立 / 編輯 / 停權 / 刪除會員 | ✅ |
| QR Code 掃描跳轉（會員點數 QR + 兌換核銷 QR） | ✅ |
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

  ┌──────────────────────────────────────────┐
  │  Cognito User Pool                       │
  │  ap-northeast-1_MFrLXG4E6               │
  │  Identity Providers: Google OIDC / LINE OIDC │
  │  Groups: admin / trainer / member        │
  │  Hosted UI (PKCE / authorizationCodeGrant)│
  └──────────────────────────────────────────┘
```

---

## AWS 資源清單

| 服務 | 資源名稱 / ID | 用途 |
|---|---|---|
| Region | ap-northeast-1（東京） | 靠近台灣用戶，低延遲 |
| CloudFormation | GymMembershipStack | 所有資源統一管理 |
| DynamoDB | `gym-membership` | 主資料庫（PAY_PER_REQUEST） |
| Cognito User Pool | `ap-northeast-1_MFrLXG4E6` | 身份驗證、JWT 發行 |
| Cognito Client (Member) | `1lavucbgsrt5ipkg2a3dss4om6` | Member Portal PKCE（Google + LINE） |
| Cognito Client (Admin) | `2dv70m8clceqk70ak01jf0ckk8` | Admin Portal PKCE（Google only） |
| API Gateway HTTP API | `qg9vkjbzhf.execute-api` | HTTP 路由入口 |
| Lambda | `gym-auth-handler` | Token Refresh / LINE 帳號綁定（timeout: 15s） |
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
| auth-handler | ReadWrite（PROFILE 更新） | InitiateAuth（refresh）, AdminLinkProviderForUser（LINE 綁定） |
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
| `MEMBER#<sub>` | `REDEMPTION#<epochMs>-<uuid>` | 兌換記錄 | rewardId, pointsCost, status（active/used/cancelled）, usedAt |
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

### Google 登入（PKCE）

```
1. 前端生成 code_verifier（32 bytes random）→ SHA-256 → code_challenge
2. 跳轉 Cognito Hosted UI：
     /oauth2/authorize?identity_provider=Google&response_type=code
       &code_challenge=<S256>&code_challenge_method=S256&...
3. Cognito → Google OAuth 授權頁
4. 用戶同意 → Google 回呼 Cognito → Cognito 回呼前端 /callback?code=<code>
5. 前端 POST /oauth2/token { grant_type=authorization_code, code, code_verifier }
6. 取得 id_token + access_token + refresh_token，存於 localStorage
7. PostConfirmation Lambda trigger：首次登入自動加入 member group、寫 DynamoDB PROFILE
```

### LINE 帳號綁定（已登入後）

```
1. 個人資料頁 → 按「綁定 LINE」→ 前端生成 CSRF state（UUID）存 sessionStorage
2. 跳轉 LINE OAuth：https://access.line.me/oauth2/v2.1/authorize?scope=openid profile&state=<uuid>
3. 用戶同意 → LINE 回呼前端 /link-callback?code=<code>&state=<uuid>
4. 前端驗證 state（防 CSRF）→ POST /auth/link/line { code, redirectUri }（帶 Bearer token）
5. Lambda 向 LINE API 換 id_token → 取出 LINE sub
6. AdminLinkProviderForUserCommand 連結 LINE 身份至 Cognito 用戶
7. 更新 DynamoDB PROFILE.lineUserId
```

### LINE 登入（已綁定後）

```
與 Google 登入相同，改傳 identity_provider=LINE
```

### 管理員建立會員

```
POST /admin/members → Cognito AdminCreateUser（系統生成臨時密碼、寄 email）
  → 加入 member group → 寫 PROFILE
（會員不再自助註冊）
```

### Token 使用

```
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
| POST | `/auth/refresh` | 刷新 tokens（REFRESH_TOKEN_AUTH） |

> 登入流程改由 Cognito Hosted UI 處理（PKCE），前端直接與 Cognito `/oauth2/token` 溝通，不經過本系統 API。

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

### 受保護路由（需 JWT，auth-handler）

| Method | Path | 說明 |
|---|---|---|
| POST | `/auth/link/line` | 綁定 LINE 帳號（需登入） |

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
| GET | `/admin/members/:id/redemptions/:rid` | 查詢單筆兌換 | admin |
| POST | `/admin/members/:id/redemptions/:rid/use` | 核銷兌換（QR 掃描確認） | admin |
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
| Admin Google 帳號 | 用 Google 聯合登入的管理者須手動執行 `admin-add-user-to-group` 加入 admin group（Cognito username 格式：`Google_<googleId>`） |
| LINE 登入前置 | 用戶必須先登入後透過「個人資料 → 綁定 LINE」完成綁定，才能用 LINE 登入 |
| Admin Portal | 管理端只開放 Google 登入，不支援 LINE |
| auth Lambda timeout | 15 秒（LINE 綁定需呼叫 LINE API + Cognito + DynamoDB，3 秒不夠） |
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
