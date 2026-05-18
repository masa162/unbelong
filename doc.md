# tokyo86img ドキュメント

## 概要

tokyo86プロジェクトの画像CDN・管理システム。Cloudflare Workers / Pages / D1 / Imagesで構成。

---

## コンポーネント

| コンポーネント | URL | 役割 |
|---|---|---|
| tokyo86-api (Worker) | https://tokyo86-api.belong2jazz.workers.dev | バックエンドAPI |
| tokyo86-admin (Pages) | https://tokyo86-admin.belong2jazz.workers.dev | 管理UI |
| tokyo86-img-cdn (Worker) | https://img.tokyo86.com | 画像配信 |
| tokyo86comic (Pages) | https://tokyo86.com | コミックフロント |
| tokyo86illust (Pages) | https://illust.tokyo86.com | イラストフロント |

## Cloudflareアカウント

| 用途 | Email | Account ID |
|---|---|---|
| このプロジェクト | belong2jazz@gmail.com | `c677241d7d66ff80103bab9f142128ab` |
| アダルト別プロジェクト（yuichi） | info@takayamalog.com | `512387a50678415712a91baa79f7a162` |

---

## データベース

- **D1名**: `tokyo86-db`
- **D1 ID**: `0614fe1a-8e77-4c8b-9a87-33584de86905`
- **Cloudflare Images Account Hash**: `wdR9enbrkaPsEgUtgFORrw`

### 主要テーブル
- `works` — 作品マスター
- `episodes` — コミックエピソード
- `illustrations` — イラスト
- `image_batches` — 画像バッチ（purpose列でcdn/toon管理）
- `images` — 画像メタデータ

---

## APIエンドポイント

- `GET/POST /api/works` — 作品管理
- `GET/POST /api/episodes` — エピソード管理
- `GET/POST /api/illustrations` — イラスト管理
- `GET/POST /api/batches` — バッチ管理
- `POST /api/batches/:batchId/upload` — バッチ画像アップロード（チャンク5枚単位）
- `POST /api/batches/:batchId/finalize` — バッチ完了通知（stkに1記事として記録）
- `GET /api/batches/:batchId/markdown` — Markdown生成
- `POST /api/upload` — 単品アップロード
- `GET/DELETE /api/images` — 画像一覧・削除

---

## デプロイ

```bash
# API — ルートから実行すること（@tokyo86/sharedの依存解決のため）
npm run deploy:api

# 管理画面・フロントはGitHub push → Cloudflare Pages自動デプロイ
```

**注意**: `apps/api`ディレクトリから直接`wrangler deploy`するとモノレポの依存解決に失敗する。必ずルートから`npm run deploy:api`を使う。

---

## 画像URL構造

- 単品: `img.tokyo86.com/{random-6-char}.webp`
- バッチ: `img.tokyo86.com/{batch_id}/{seq-3-digit}.webp`

バッチIDは6文字ランダム英数字（推測不能設計）。

---

## バッチ（箱）機能

- **cdn**: CDN専用（フィード非表示）
- **toon**: webtoon公開用（tokyo86.comのフィードに表示）

アップロード完了後、stkに自動記録される（Service Binding経由）。

---

## stk連携（2026-05-16追加、2026-05-17改善）

バッチアップロード完了時にstkのナレッジベースへURL一覧を自動保存。**1バッチ=1記事**。

- **仕組み**: フロントでチャンク完了後 → `POST /api/batches/:batchId/finalize` → Service Binding → unified-mcp → D1(stuck-db)
- **エンドポイント**: `POST /api/articles`（unified-mcp-serverに追加）
- **Binding設定**: `wrangler.toml` の `[[services]]` に `STK = unified-mcp`
- **認証**: `STK_API_KEY` secret（wrangler secret put で設定済み）

Worker間の直接fetchは `error code: 1042` で失敗するため、Service Bindingが必須。

### チャンクアップロード
- フロント側で5枚ずつに分割してアップロード（Pixel 8aの5MB写真対応）
- Cloudflare Workersの100MBリクエスト制限・30秒タイムアウト対策
- 全チャンク完了後にfinalizeを1回呼ぶことでstkへの重複記録を防止

### Cloudflare Images バリアント
- `public` — 配信用（AVIF最適化）
- `original` — 元画像DL用（管理画面のDLボタンから使用）

---

## 環境変数・Secrets

| 変数 | 設定場所 | 内容 |
|---|---|---|
| `CLOUDFLARE_IMAGES_API_TOKEN` | wrangler secret | CF Images APIトークン |
| `STK_API_KEY` | wrangler secret | unified-mcp認証キー |
| `STK_API_URL` | wrangler.toml vars | unified-mcp URL |
| `CLOUDFLARE_ACCOUNT_ID` | wrangler.toml vars | CFアカウントID |

---

## プロジェクト変遷

- 2025-10: `unbelong`として初回リリース
- 2026-04-05: tokyo86.comドメインへリブランド
- 2026-04-12: Cloudflareリソース名を`tokyo86`に統一（unbelong-api/db/img-cdn廃止）
- 2026-04-14: バッチ編集機能追加（後からcdn/toon切り替え可能に）
- 2026-05-16: stk連携追加（バッチアップ→stk自動記録）、Worker環境統合（production廃止）
- 2026-05-17: チャンクアップロード（5枚単位）、finalizeエンドポイント追加（1バッチ=1stk記事）、originalバリアント追加、管理画面にDLボタン・ページネーション追加
