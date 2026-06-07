# 系統架構師視角：Gymflow 的建構過程與思考

> 這份文件是給你的學習筆記。  
> 每一個決策背後都有取捨，每一個取捨都是下一個問題的起點。  
> 從這個系統學到的，不是「怎麼做」，而是「為什麼這樣做，而不是那樣做」。

---

## 第一章：為什麼選 Serverless？

### 問題的起點

設計一個健身房管理系統，第一個問題不是「用哪個框架」，而是：

**這個系統的流量模式是什麼？**

健身房的流量特徵：
- 尖峰在早上 7–9 點、晚上 6–9 點
- 離峰（例如週二早上 10 點）接近零流量
- 不需要 24/7 高吞吐量

這個特徵讓「傳統伺服器」顯得浪費：你付了 24 小時的錢，但真正有人用只有 6–8 小時。

### Serverless 的核心主張

Serverless 不是「沒有伺服器」，而是「你不需要管伺服器」。背後的邏輯是：

```
你按使用量付費（請求次數 × 執行時間）
沒有請求 → 不付錢
流量突然來 → AWS 自動擴展
```

對健身房這種**低流量、間歇性負載**的系統，Serverless 的優勢是：
1. 成本幾乎為零（AWS Lambda 每月前 100 萬次免費）
2. 不需要管理 OS、安全補丁、伺服器健康度
3. 天生具備水平擴展能力

### 代價是什麼？

Serverless 不是萬靈丹。它的缺點：

| 缺點 | 說明 |
|---|---|
| Cold Start | Lambda 在閒置後第一次被呼叫需要啟動時間（約 200–800ms） |
| 執行時間上限 | Lambda 最長 15 分鐘，不適合長時間運算 |
| 除錯困難 | 無法 SSH 進去看，依賴 CloudWatch Logs |
| 狀態管理 | Lambda 是無狀態的，WebSocket / 長連線需要額外設計 |
| Vendor Lock-in | 深度綁定 AWS，遷移成本高 |

**我們接受了這些代價**，因為系統目前的規模和流量特性讓這些缺點影響很小。

---

## 第二章：DynamoDB 的選擇與 Single-Table Design

### 為什麼不用 RDS（關聯式資料庫）？

關聯式資料庫（PostgreSQL/MySQL）是大多數開發者的第一直覺。它很直覺，有 JOIN，有 ACID。

但 Serverless 架構下，RDS 有一個致命問題：

**RDS 需要持久的連線，但 Lambda 是短暫的。**

每次 Lambda 執行都需要建立新連線。在高並發下，你會很快打爆 RDS 的連線上限（通常幾百個）。解法是 RDS Proxy，但這又增加成本和複雜度。

DynamoDB 是 HTTP-based，沒有連線的概念，天生適合 Lambda。

### DynamoDB 的核心特性

DynamoDB 是 Key-Value + Document 資料庫，它的設計哲學是：

**用存取模式（Access Pattern）驅動資料模型設計，而不是先設計正規化的 schema。**

這和關聯式資料庫的思維完全相反：
- SQL：先設計表格、正規化，再想查詢
- DynamoDB：先列出所有查詢，再設計 PK/SK

### 為什麼用 Single-Table Design？

傳統的做法是每種資料一張表：`members`、`memberships`、`checkins`、`points`…

Single-Table Design 把所有資料放在同一張表，用 PK + SK 的組合區分資料類型。

**好處**：
- 一次查詢就能拿到所有相關資料（不需要 JOIN）
- 例如取一個會員的點數餘額 + 最近交易記錄，只需要 Query PK = `MEMBER#<id>` AND SK begins_with `POINTS_`
- 有利於 Lambda 的效能（減少往返次數）

**壞處**：
- Schema 不直覺，newcomer 很難看懂
- 查詢靈活性低（只能按 PK + SK 查，複雜查詢需要 GSI 或 Scan）
- 資料建模錯誤很難事後修改

### 我們的設計決策

```
PK = 主要資料擁有者（MEMBER#<id>, REWARD#<id>）
SK = 資料類型 + 時間戳（PROFILE, POINTS_TXN#2026-01-01T...）
```

時間戳放在 SK 的好處：DynamoDB 的 Query 在 SK 上是字典序排序，所以 `begins_with(SK, 'POINTS_TXN#') + ScanIndexForward: false` 自然就是「最新的點數記錄先回來」。

---

## 第三章：Cognito — 認證即服務

### 為什麼不自己寫 JWT？

很多開發者第一次會想自己管 JWT：用 `jsonwebtoken`、自己存 secret、自己驗簽章。

**這條路的問題**：
- Secret rotation 複雜
- Token revocation 需要自建 blacklist
- 安全漏洞需要自己 patch
- PKCE、MFA、社交登入…每個都要自己實作

Cognito 提供的：
- JWT 發行和驗簽（RS256，公鑰在 JWKS endpoint）
- Email 驗證碼流程
- 密碼策略（複雜度、長度）
- 帳號停用（AdminDisableUser）
- 群組管理（admin / trainer / member）
- Token Refresh

**我們的做法**：Cognito 負責 Authentication（你是誰），Lambda 內部做 Authorization（你能做什麼）。

```typescript
// API Gateway 驗證 JWT 有效性 → 自動
// Lambda 驗證你有沒有 admin 權限 → 手動
function isAdmin(event): boolean {
  const groups = getClaims(event)?.['cognito:groups'];
  return parseGroups(groups).includes('admin');
}
```

### 一個踩到的坑

Cognito groups 在 API Gateway HTTP API 中被序列化成字串 `[admin member]`，而不是 JSON array。

這是 AWS 的一個已知行為（不算 bug，但確實不直覺）。解法是自己 parse：

```typescript
function parseGroups(groups: string | string[]): string[] {
  if (Array.isArray(groups)) return groups;
  return groups.replace(/^\[|\]$/g, '').split(' ').filter(Boolean);
}
```

**教訓**：永遠不要假設平台傳過來的資料格式。在 Lambda 裡加 `console.log` 看原始 event，再寫 parse logic。

---

## 第四章：API Gateway — 為什麼選 HTTP API 而不是 REST API？

AWS API Gateway 有兩種：REST API 和 HTTP API。

| | REST API | HTTP API |
|---|---|---|
| 成本 | 較高（~$3.5/M requests） | 較低（~$1/M requests） |
| 功能 | 功能完整（WAF 整合、API Keys、Usage Plans） | 功能精簡 |
| JWT 授權 | 需要自建 Lambda Authorizer | 原生支援 JWT Authorizer |
| 延遲 | 較高 | 較低 |

我們的系統不需要 API Keys 或 Usage Plans，JWT 授權 HTTP API 原生支援，所以選 HTTP API。

### CORS 的陷阱

CORS preflight 是瀏覽器在正式請求前，先發送 `OPTIONS` 請求確認伺服器接受跨域請求。

**問題**：OPTIONS 請求不帶 Authorization header → JWT Authorizer 會攔截 → 回傳 401 → 前端看到 CORS 錯誤。

**解法**：OPTIONS route 獨立定義，不附加 JWT Authorizer，由 Lambda 自己回傳 CORS headers。

```typescript
// 錯誤做法：全部路由都帶 authorizer
api.addRoutes({ path: '/members/{proxy+}', authorizer: jwtAuthorizer }); // OPTIONS 也被攔截

// 正確做法：OPTIONS 單獨
api.addRoutes({ path: '/members/{proxy+}', methods: [HttpMethod.OPTIONS] }); // 無 authorizer
api.addRoutes({ path: '/members/{proxy+}', methods: [GET, POST, PUT, DELETE], authorizer: jwtAuthorizer });
```

這個坑花了不少時間 debug，因為錯誤訊息是「CORS error」，根本沒提到 JWT Authorizer 攔截了 OPTIONS。

---

## 第五章：Infrastructure as Code — CDK 的選擇

### 為什麼要 IaC？

不用 IaC，就是用 AWS Console 手動建資源。問題是：
- 下次換帳號或換 Region，你要從頭記得所有設定
- 沒有版本控制，誰改了什麼不知道
- 災難恢復（DR）無從重建

### 為什麼選 CDK，而不是 Terraform / CloudFormation YAML？

| | CloudFormation YAML | Terraform | CDK |
|---|---|---|---|
| 語言 | YAML（無型別） | HCL（專有語言） | TypeScript / Python / Java 等 |
| IDE 支援 | 弱 | 中 | 強（自動補全、型別檢查） |
| 抽象能力 | 弱（大量重複） | 中 | 強（可以寫 for loop、Class） |
| AWS 整合 | 原生 | 好 | 最好（底層就是 CloudFormation） |
| 學習曲線 | 低 | 中 | 中（需要懂 CDK 的 Construct 概念） |

CDK 讓你用 TypeScript 寫基礎設施，有 IDE 補全、型別錯誤提示，底層幫你生成 CloudFormation template。

**最重要的好處**：CDK Constructs。一行程式碼就能建立一個安全的 S3 + CloudFront 組合：

```typescript
const memberDistribution = new cloudfront.Distribution(this, 'MemberDistribution', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(memberBucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
  errorResponses: [{ httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' }],
});
```

如果用 CloudFormation YAML，同樣的東西需要 100+ 行，且容易出錯。

---

## 第六章：點數系統的設計 — 原子操作與一致性

### 問題

會員兌換獎勵時，需要同時做三件事：
1. 扣點數餘額
2. 新增兌換記錄
3. 扣庫存（如果有限量）

如果這三件事不是原子操作，會發生什麼？

**場景**：扣點成功 → 系統崩潰 → 兌換記錄沒寫 → 會員點數少了但沒拿到獎品

### 解法：DynamoDB TransactWrite

DynamoDB 的 `TransactWriteCommand` 支援最多 25 個操作，全成功或全失敗（All-or-Nothing）。

```typescript
await dynamo.send(new TransactWriteCommand({
  TransactItems: [
    { Update: { /* 扣點數餘額，條件：balance >= cost */ } },
    { Put:    { /* 寫兌換記錄 */ } },
    { Put:    { /* 寫點數異動記錄 */ } },
    { Update: { /* 扣庫存，條件：stock > 0 */ } },  // 僅限有限量商品
  ],
}));
```

`ConditionExpression: 'balance >= :cost'` 確保點數不足時整個 transaction 回滾，不會出現負餘額。

### 樂觀鎖（Optimistic Locking）

這個設計本質上是樂觀鎖：
- 讀取當前餘額
- 在 Transaction 內用 Condition 確保餘額充足
- 如果同時有兩個兌換請求，第一個成功，第二個因為 Condition 失敗而回滾

在高並發下（例如搶限量商品），這是正確且高效的做法，不需要悲觀鎖（如 SELECT FOR UPDATE）。

---

## 第七章：已接受的妥協與風險

### 妥協 1：Scan 操作

`listMembers` 和 `listRewards` 使用 DynamoDB `Scan`，全表掃描後過濾。

**問題**：資料量大時，Scan 很慢且貴（讀取 RCU 按掃描的資料量計費，不是回傳的資料量）。

**為什麼現在接受**：系統剛起步，會員數和獎勵數量極少，影響可以忽略。

**未來解法**：
- 用 GSI（Global Secondary Index）支援直接 Query
- 或維護一個 `MEMBERS_LIST` 的 aggregation item

### 妥協 2：Lambda 是單一大型 Handler

auth / member / admin 各一個 Lambda，裡面用 if-else 做路由，隨著 API 增加，handler 會越來越長。

**問題**：
- 部署時整個 Lambda 都要重新打包，即使只改了一個 route
- 難以獨立測試單一功能
- Cold Start 時需要載入整個模組

**未來解法**：
- 拆成更細的 Lambda（每個 route 一個）
- 或引入 API Gateway Resource-based routing + 多個 Lambda
- 或改用 Express on Lambda（lambda-web-adapter pattern）

### 妥協 3：CORS 設定過寬

目前 CORS `Access-Control-Allow-Origin: *` 允許所有來源。

**問題**：任何網站都可以向我們的 API 發請求（帶 JWT 的情況下）。

**未來解法**：限制 origin 為 CloudFront domain：
```typescript
'Access-Control-Allow-Origin': 'https://dv3vkkn6m5tr2.cloudfront.net'
```

### 妥協 4：沒有 WAF

目前 CloudFront 前面沒有 WAF（Web Application Firewall）。

**風險**：
- 沒有 Rate Limiting，可能被暴力破解
- 沒有 SQL Injection / XSS 規則（DynamoDB 不怕 SQL injection，但前端仍需注意 XSS）
- 沒有 Bot 保護

**未來解法**：AWS WAF 整合 CloudFront，設定 Rate-based rules。

### 妥協 5：刪除會員只刪 PROFILE，不刪所有資料

`deleteMember` 只刪 DynamoDB 的 `PROFILE` 記錄和 Cognito 帳號，點數記錄、兌換記錄等都還在。

**問題**：資料孤兒（orphan records）。

**未來解法**：
- Soft delete（加 `deletedAt` 欄位）而非真正刪除
- 或非同步清理（Delete member → 觸發 cleanup Lambda）

---

## 第八章：可觀測性 — 你看不到的問題等於沒有問題

這是目前最薄弱的地方。系統現在只有 Lambda 的 `console.log`，沒有：

- 結構化日誌（每個 request 都有 trace ID）
- 指標（成功率、延遲 p50/p95/p99）
- 告警（Lambda 錯誤率超過 1% 就通知）
- Distributed Tracing（一個請求如何流過 API GW → Lambda → DynamoDB）

### 為什麼可觀測性重要？

**沒有可觀測性，你只能在用戶抱怨時才知道系統壞了。**

有了可觀測性，你在用戶感知之前就能發現：
- 某個 Lambda 的 p95 延遲從 50ms 跳到 800ms
- DynamoDB `ConditionalCheckFailedException` 增加（代表兌換衝突增加）
- 某個 region 的 CloudFront 錯誤率上升

### Phase 6 的計畫

```
CloudWatch Logs → Structured JSON 格式
CloudWatch Metrics → Dashboard（Lambda duration, error rate, API GW 4xx/5xx）
CloudWatch Alarms → 超過閾值 → SNS → Email / Slack
X-Ray Tracing → Lambda → DynamoDB 的每個呼叫都有 trace
```

---

## 第九章：高流量下會發生什麼？

這個系統目前的瓶頸在哪裡？

### 現在能承受多少？

Lambda 預設並發限制：帳號等級 1,000 concurrent executions（可申請提高）。  
DynamoDB PAY_PER_REQUEST：理論上無上限（AWS 內部有 burst limit，但對小系統足夠）。

**實際瓶頸**：`listMembers` 的 Scan。即使並發很高，如果每個請求都 Scan 全表，DynamoDB 的讀取延遲會明顯增加。

### 10x 流量

假設現在有 100 concurrent requests，10x 是 1,000。

Lambda 自動 scale，沒問題。  
DynamoDB Scan 的延遲會增加，但因為每次 Scan 的 Limit 有設上限（100），影響有限。

### 100x 流量

10,000 concurrent requests。

Lambda 可能達到帳號 concurrent limit，需要申請提升。  
DynamoDB Scan 變成明顯瓶頸，`listMembers` 可能超過 1 秒。

**這個時候需要**：
- 把 `listMembers` 改為 Query（GSI + `SK = 'PROFILE'`）
- 或加 ElastiCache/DynamoDB Accelerator（DAX）做查詢快取

### 1000x 流量（每秒萬級請求）

這已超出健身房系統的現實需求，但從架構學習的角度：

- Lambda Cold Start 變成問題 → 需要 Provisioned Concurrency
- DynamoDB 熱點分區問題（大量請求集中在同一個 PK）→ 需要分區設計
- CloudFront 快取 API 結果（靜態數據如獎勵目錄）

---

## 第十章：未來可以加強的地方（優先順序）

### 優先順序 1：可觀測性（Phase 6）

**不做就是在裸奔**。上線後第一件事應該是補 metrics + alarm。

### 優先順序 2：CORS 收緊 + WAF

安全問題，越早做越好。

### 優先順序 3：廢棄 Scan，改用 GSI + Query

資料量超過 1,000 筆時就應該做。

### 優先順序 4：通知系統（Phase 5）

DynamoDB Streams + SQS + SES 的組合：
- 會員方案到期前 3 天發 Email
- 兌換成功後確認通知
- 教練可以批量發點數通知

### 優先順序 5：自訂網域 + HTTPS 憑證

目前 CloudFront URL 是 AWS 生成的醜 URL。加 Route 53 + ACM 可以用 `gymflow.com`。

### 優先順序 6：Soft Delete

目前 `deleteMember` 是硬刪除。改為 Soft Delete 可以：
- 保留審計記錄
- 支援「還原會員」功能
- 滿足可能的法規要求（個資保留期限）

---

## 總結：架構師的思維框架

學習這個系統最重要的不是記住哪個 AWS 服務怎麼用，而是：

### 1. 先問流量模式，再選技術

健身房系統 → 間歇性低流量 → Serverless 合適  
交易系統、遊戲 → 持續高並發 → 可能需要 EC2/ECS

### 2. 用存取模式設計資料模型

先問：**我需要做哪些查詢？** 再設計 PK/SK/GSI。  
不要先建 schema，再想怎麼查。

### 3. 一致性邊界要明確

哪些操作必須原子？用 TransactWrite。  
哪些可以最終一致？用普通 Update。

### 4. 成本 vs 複雜度的取捨要說清楚

每個妥協都要明說。「現在接受 Scan，因為資料量小」是合理決策，不是技術債。  
隱藏決策才是技術債。

### 5. 可觀測性不是可選的

你不知道系統壞在哪裡，代表你沒辦法修。  
Observability = 讓系統可以被診斷的能力。

---

> 這份文件會隨著系統發展持續更新。  
> 每一次做了新決策、每一次踩了新坑，都應該記錄在這裡。
