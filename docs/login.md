# Gymflow 系統網址與登入資訊

## 網址

| 服務 | 網址 |
|------|------|
| **Member Portal（會員端）** | https://dv3vkkn6m5tr2.cloudfront.net |
| **Admin Portal（管理/教練端）** | https://d3h5wal582eh13.cloudfront.net |
| **API Gateway** | https://qg9vkjbzhf.execute-api.ap-northeast-1.amazonaws.com |

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

## 測試帳號

### 管理員 / 教練帳號（Admin Portal 登入）

| 欄位 | 值 |
|------|-----|
| Email | `test@example.com` |
| 密碼 | `Test1234` |
| 群組 | `admin` + `member` |
| 備註 | 可存取所有管理功能、發點數、管理獎勵 |

### 會員帳號（Member Portal 登入）

| 欄位 | 值 |
|------|-----|
| Email | `colinlu.win@gmail.com` |
| 密碼 | `Test1123` |
| 群組 | `member` |
| 備註 | 一般會員，可查看點數、兌換獎勵 |

> **注意：** 若忘記密碼，可透過 Cognito Console 重設，或在登入頁使用「忘記密碼」功能。

---

## AWS 資源

| 資源 | 值 |
|------|-----|
| Region | `ap-northeast-1`（東京） |
| Cognito User Pool ID | `ap-northeast-1_MFrLXG4E6` |
| Cognito Client ID | `1lavucbgsrt5ipkg2a3dss4om6` |
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

### Admin Portal

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 會員列表 | `/members` | 查詢、建立會員 |
| 會員詳情 | `/members/:id` | 編輯資料、發點數、查看點數記錄 |
| 掃描發點 | `/scan` | 掃描會員 QR → 跳至會員頁面 |
| 獎勵商品 | `/rewards` | 建立、上下架、刪除獎勵商品 |
| 兌換記錄 | `/redemptions` | 查看所有兌換、撤銷並補回點數 |
