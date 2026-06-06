# infra

AWS CDK stack for Gymflow — 定義所有 AWS 資源。

## 包含資源

- **DynamoDB** — Single-Table 設計，含 GSI
- **Cognito** — User Pool，含 admin / trainer / member 群組
- **API Gateway** — HTTP API，JWT 授權
- **Lambda** — 連結至 `../services/` 的 handler

## 常用指令

```bash
npm run build    # 編譯 TypeScript
npm run watch    # 監聽變更並自動編譯
npm test         # 執行 Jest 測試

npx cdk diff     # 比較已部署與本地的差異
npx cdk deploy   # 部署至 AWS
npx cdk synth    # 輸出 CloudFormation template
```
