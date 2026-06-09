# Gymflow 系統網址與登入資訊

## 網址

| 服務 | 網址 |
|------|------|
| **Member Portal（會員端）** | https://dv3vkkn6m5tr2.cloudfront.net |
| **Admin Portal（管理/教練端）** | https://d3h5wal582eh13.cloudfront.net |
| **API Gateway** | https://qg9vkjbzhf.execute-api.ap-northeast-1.amazonaws.com |
| **Cognito Hosted UI** | https://gymflow-auth.auth.ap-northeast-1.amazoncognito.com |

---

## QR Code

### Member Portal

```
https://dv3vkkn6m5tr2.cloudfront.net
```

![Member Portal QR](https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://dv3vkkn6m5tr2.cloudfront.net)

### Admin Portal

```
https://d3h5wal582eh13.cloudfront.net
```

![Admin Portal QR](https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://d3h5wal582eh13.cloudfront.net)

---

## 登入方式

### Member Portal（會員端）

| 方式 | 說明 |
|------|------|
| Google 登入 | 任何 Google 帳號皆可，首次登入自動建立會員資料 |
| LINE 登入 | 須先用 Google 登入，至「個人資料」頁完成 LINE 帳號綁定後才可使用 |

### Admin Portal（管理端）

| 方式 | 說明 |
|------|------|
| Google 登入 | 僅限已加入 Cognito `admin` group 的 Google 帳號 |

> **新管理員設定流程：**
> 1. 至 Admin Portal 用 Google 帳號登入一次（Cognito 會建立 `Google_<id>` 用戶）
> 2. 執行以下指令將帳號加入 admin group：
> ```bash
> aws cognito-idp admin-add-user-to-group \
>   --user-pool-id ap-northeast-1_MFrLXG4E6 \
>   --username "Google_<googleId>" \
>   --group-name admin
> ```
> 3. 登出後重新登入（新 token 才包含 group 資訊）

---

## AWS 資源

| 資源 | 值 |
|------|-----|
| Region | `ap-northeast-1`（東京） |
| Cognito User Pool ID | `ap-northeast-1_MFrLXG4E6` |
| Cognito Client ID（Member Portal） | `1lavucbgsrt5ipkg2a3dss4om6` |
| Cognito Client ID（Admin Portal） | `2dv70m8clceqk70ak01jf0ckk8` |
| LINE Channel ID | `2010350151` |
| DynamoDB Table | `gym-membership` |
| CloudFormation Stack | `GymMembershipStack` |
| AWS Account | `461340168702` |
| Member Portal CloudFront ID | `EQVMQPFM6A4AS` |
| Admin Portal CloudFront ID | `E2X3MS7RJAUZ3T` |

---

## 主要功能入口

### Member Portal

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 儀表板 | `/dashboard` | 會員狀態 |
| 我的點數 | `/points` | QR Code + 點數餘額 + 異動記錄 |
| 兌換獎勵 | `/rewards` | 獎勵目錄 + 兌換 + 我的兌換記錄 |
| 個人資料 | `/profile` | 更新資料、管理 LINE 帳號綁定 |

### Admin Portal

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 會員列表 | `/members` | 查詢、建立會員 |
| 會員詳情 | `/members/:id` | 編輯資料、發點數、查看點數記錄 |
| 掃描發點 | `/scan` | 掃描會員 QR → 跳至會員頁面 |
| 獎勵商品 | `/rewards` | 建立、上下架、刪除獎勵商品 |
| 兌換記錄 | `/redemptions` | 查看所有兌換、撤銷並補回點數 |
