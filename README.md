# ここメモ (KokoMemo)

場所を簡単に登録・ナビゲーションできるPWAアプリ

## 概要

「ここメモ」は、「今いる場所」「よく行く場所」「今度行く場所」などを、名前とメモを添えて簡単に登録・編集できるPWAアプリです。登録した場所の「ナビ開始」ボタンをタップするだけでGoogle Mapが開き、即座にナビゲーションを開始できます。

### ターゲットユーザー

スマホ操作が苦手なシルバー世代向けに、シンプルで分かりやすいUIを採用しています。

## 機能

- 現在地をワンタップで登録
- 住所・建物名で場所を検索
- 登録した場所へのナビゲーション開始
- カテゴリ（タブ）による場所の分類
- カレンダーで過去の登録を確認
- カスタムカテゴリの作成（最大5つ）

## 技術スタック

- **フロントエンド**: React 19 + TypeScript
- **ビルドツール**: Vite
- **スタイリング**: Tailwind CSS v4
- **状態管理**: localStorage
- **PWA**: vite-plugin-pwa
- **外部API**: Google Maps Platform

## セットアップ

### 前提条件

- Node.js 20以上
- npm

### インストール

```bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

### 環境変数

`.env.example`をコピーして`.env`を作成し、Google Maps APIキーを設定してください。

```bash
cp .env.example .env
```

必要なGoogle Maps Platform API:
- Maps JavaScript API
- Places API
- Geocoding API

### ビルド

```bash
npm run build
```

### プレビュー

```bash
npm run preview
```

## デプロイ

GitHub Pagesへの自動デプロイは、mainブランチへのpush時にGitHub Actionsで実行されます。

### GitHub Secretsの設定

以下のシークレットを設定してください:
- `VITE_GOOGLE_MAPS_API_KEY`: Google Maps APIキー

## ディレクトリ構成

```
src/
├── components/       # 再利用可能なコンポーネント
│   ├── layout/       # レイアウトコンポーネント
│   └── ui/           # UIコンポーネント
├── contexts/         # Reactコンテキスト
├── hooks/            # カスタムフック
├── lib/              # ユーティリティ関数
├── pages/            # ページコンポーネント
└── types/            # TypeScript型定義
```

## ライセンス

MIT
