# MarketMind AI

[English](README.md) | 日本語

マーケター向けのフォーカスグループ・シミュレーターです。ターゲット市場と製品アイデアを
入力すると、MarketMind AI が Gemini を使って現実味のある 10 人の仮想消費者ペルソナを集め、
一人ひとりに質問へ回答させ、その結果をまとめたエグゼクティブレポートをストリーミング表示し、
さらに任意のペルソナと 1 対 1 でインタビューできます。

制作: Haruto Iriyama / React・TypeScript・Vite・Tailwind CSS・Express・Supabase

## 動作の流れ

1. **フォーカスグループを設定する。** 年齢層・性別・生活習慣・居住地・所得水準を指定します。
   空欄にした項目は*多様/ランダム*として扱われ、その軸について 10 人のばらつきを最大化するよう
   モデルに指示します。続けて製品の内容と、回答してほしい質問を記述します。
2. **ペルソナを生成する。** 構造化出力の呼び出し 1 回(`gemini-3.1-flash-lite`)で、
   10 人分のペルソナが JSON で返ります。氏名、属性、背景、質問への直接の回答、
   自由記述のフィードバック、キーワード、そして固定のルーブリックに基づく感情スコアが含まれ、
   スコアは実行のたびに比較可能です。
3. **レポートを読む。** 2 回目の呼び出し(`gemini-2.5-flash`)が、全体の熱量・繰り返し現れる
   テーマ・反対意見・推奨アクションをまとめた戦略サマリーを、ペルソナカードが埋まっていく
   そばからトークン単位で Insights タブにストリーミングします。
4. **チャートで掘り下げる。** スコアの分布、ペルソナごとのスコア、頻出テーマを可視化します。
5. **ペルソナにインタビューする。** Chat タブはペルソナごとの会話履歴を保持し、そのペルソナの
   プロフィールと元のフィードバックに基づいて、キャラクターを保ったまま回答します。

**A/B テスト。** 価格・機能構成・キャッチコピーなどを変えたバリアントを最大 2 つ追加すると、
同じ 10 人がそれぞれのバリアントを独立に採点します。結果画面ではバリアントごとの平均・中央値・
購入見込み層・拒否層を表示し、優勢なバリアント(または「差が小さく判定不能」)を提示し、
どのペルソナが評価を変えたかをチャートで示します。

**アカウントと実行履歴の保存。** メールアドレスとパスワードでサインインします(Supabase Auth)。
完了した実行は入力内容・ペルソナ・レポート・インタビュー記録までアカウントに保存され、
Saved Simulations タブから再び開けます。

**パネルの再利用。** 任意の結果に登場した 10 人を名前付きパネルとして保存し、後日同じパネルに
別の質問をぶつけられます。再生成されるのは回答だけで、人物像は固定されるため、毎回新しい
ランダム集団を作るノイズなしに、質問をまたいだ比較ができます。

**エクスポートと共有。** 実行結果を Markdown(インタビュー記録を含む完全版)、CSV
(1 行 1 ペルソナ、バリアントごとに列のセット)、PDF(ブラウザの印刷ダイアログ経由)で
ダウンロードできます。実行ごとに公開の読み取り専用共有リンクをオン/オフでき、共有ページには
インタビュー記録は一切含まれません。

## アーキテクチャ

ブラウザが Gemini やデータベースと直接やり取りすることはありません。小さな Express サーバー
(`server/`)が機密情報を保持し、リクエストごとにユーザーの Supabase アクセストークンを検証して、
以下の API を提供します。

| エンドポイント | 役割 |
|---|---|
| `POST /api/simulate` | ペルソナを生成(新規または保存済みパネル)し、レポートを NDJSON でストリーミング。完了した実行は保存される |
| `GET/DELETE /api/runs[/:id]` | 保存済み実行の一覧・取得・削除 |
| `POST/DELETE /api/runs/:id/share` | 公開共有リンクのオン/オフ |
| `GET /api/share/:shareId` | 共有された実行の公開読み取り専用ビュー(サインイン不要) |
| `POST /api/chat` | インタビューの 1 ターン。ペルソナと会話履歴はブラウザからの申告ではなく保存済みの実行から読み込む |
| `GET/POST/DELETE /api/panels` | 保存済みペルソナパネル |

**セキュリティモデル**

- Gemini の API キーと Supabase の service-role キーはサーバー上にのみ存在します。
- ブラウザが読み込むのは Supabase の **auth** モジュールと公開 anon キーだけです。全テーブルで
  行レベルセキュリティを有効にし、`anon` と `authenticated` ロールからテーブル権限を剥奪して
  いるため、anon キーではいかなるデータも読み書きできません。クエリはすべてサーバー側で実行され、
  サインイン中のユーザーにスコープが限定されます。
- 利用回数の制限はユーザー単位とサービス全体の両方で `usage_events` テーブルに基づいて適用され、
  再起動をまたいでも、サーバーが複数インスタンスでも機能します。さらに IP 単位の制限が
  API 全体を保護します。
- リクエストは検証とサイズ制限を行い、CSV エクスポートでは表計算ソフトの数式インジェクションを
  無害化しています。

スキーマは [`supabase/migrations`](supabase/migrations) にあります。

## ディレクトリ構成

```
server/
├── index.ts                   Express API: 認証、バリデーション、利用制限、
│                              ルーティング。アプリの配信も担当(開発時は Vite、本番は dist/)
├── db.ts                      Supabase へのクエリ(service role、ユーザー単位にスコープ)
└── gemini.ts                  プロンプト、構造化出力スキーマ、パネル再利用、
                               レポートのストリーミング、キャラクターを保ったチャット
supabase/
├── config.toml                ローカル Supabase スタックの設定
└── migrations/                データベーススキーマ
src/
├── App.tsx                    認証ゲートとワークスペース(タブ、実行状態)
├── main.tsx                   /share/:id を公開共有ページにルーティング
├── components/
│   ├── AuthScreen.tsx         サインイン / アカウント作成
│   ├── CustomerForm.tsx       設定フォーム(新規ペルソナ or 保存パネル、A/B バリアント)
│   ├── InsightsViewer.tsx     ペルソナカード、チャートタブ、ストリーミングレポート
│   ├── RunActions.tsx         パネル保存、エクスポート(MD/CSV/PDF)、共有リンク
│   ├── PrintReport.tsx        PDF 出力用の印刷専用ドキュメント
│   ├── SentimentCharts.tsx    recharts による可視化(遅延ロード)
│   ├── VariantSummary.tsx     A/B 比較タイル
│   ├── PersonaChat.tsx        1 対 1 インタビュー
│   ├── HistoryPanel.tsx       保存済みシミュレーションとパネル
│   └── SharePage.tsx          公開読み取り専用ビュー
└── lib/
    ├── api.ts                 API サーバー用のブラウザクライアント
    ├── supabase.ts            ブラウザ側の認証クライアント
    ├── exporters.ts           Markdown / CSV エクスポート
    ├── personas.ts            ペルソナ共通ヘルパー
    ├── types.ts               ブラウザとサーバーで共有する型
    ├── variants.ts            バリアント別スコアと統計(共有)
    └── utils.ts
```

## ローカルでの実行

Node.js 18 以上、[Docker Desktop](https://www.docker.com/products/docker-desktop/)
(ローカルの Supabase スタック用)、および
[Google AI Studio](https://aistudio.google.com/app/apikey) で取得した Gemini API キーが必要です。

```bash
npm install
npx supabase start     # Postgres と Auth をローカル起動し、マイグレーションを適用
npx supabase status    # ローカルの URL、anon キー、service_role キーを表示
```

`.env.example` を `.env` にコピーし、`GEMINI_API_KEY`、`VITE_SUPABASE_URL`、
`VITE_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` を設定します。続いて:

```bash
npm run dev
```

を実行し、<http://localhost:3000> を開きます。ローカルでは新規アカウントは自動的に確認済みに
なり、アプリが送信するメールは Mailpit(<http://127.0.0.1:54324>)で確認できます。
`npm run lint` で型チェックを実行します。

## 本番環境

1. [supabase.com](https://supabase.com) でプロジェクトを作成し、スキーマを適用します
   (`npx supabase link` のあと `npx supabase db push` を実行するか、マイグレーション SQL を
   ダッシュボードの SQL エディタに貼り付けます)。
2. **Authentication → URL Configuration** で Site URL をデプロイ先のドメインに設定します
   (確認メールで使用されます)。
3. ビルドして起動します:

```bash
npm run build   # クライアントは dist/、サーバーは build/server.js に出力
npm start       # $PORT(既定 3000)でアプリと API を配信
```

`VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` はビルド時に設定されている必要があります
(クライアントにコンパイルされて埋め込まれます)。`GEMINI_API_KEY` と
`SUPABASE_SERVICE_ROLE_KEY` はサーバーの実行時環境に設定します — 決してコミットしないでください。
リバースプロキシ(Cloud Run、Render、Railway、Nginx など)の背後で動かす場合は
`TRUST_PROXY=1` を設定し、IP 単位の制限が実際のクライアント IP を見るようにします。

開発者向けでない方に向けた手順は [SETUP_GUIDE.md](SETUP_GUIDE.md) にあります。
