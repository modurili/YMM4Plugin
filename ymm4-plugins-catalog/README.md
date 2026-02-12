# YMM4 Plugin Catalog

ゆっくりMovieMaker4（YMM4）のプラグインを一覧で検索・閲覧できるカタログサイトです。

## 🌐 サイトURL

GitHub Pagesで公開後、以下のURLでアクセスできます:
`https://<あなたのGitHubユーザー名>.github.io/ymm4-plugins-catalog/`

## ✨ 機能

- 📦 YMM4プラグインの一覧表示
- 🔍 リアルタイム検索
- 🏷️ カテゴリフィルタリング（映像エフェクト、音声合成、ユーティリティなど）
- 📊 ソート機能（スター数、更新日、名前）
- 📋 プラグイン詳細表示（モーダル）
- 🔗 ダウンロードリンク・GitHubリポジトリリンク
- 🤖 GitHub Actionsによる自動プラグイン収集（毎日更新）
- 📱 レスポンシブデザイン（モバイル対応）

## 🚀 セットアップ方法

### 1. リポジトリの作成

1. このフォルダの内容をGitHubの新しいリポジトリにプッシュします
2. リポジトリ名は `ymm4-plugins-catalog` がおすすめです

### 2. GitHub Pagesの有効化

1. リポジトリの **Settings** → **Pages** を開く
2. **Source** を `GitHub Actions` に設定  
3. mainブランチにプッシュすると自動的にデプロイされます

### 3. 自動収集の動作確認

1. リポジトリの **Actions** タブを開く
2. **Collect YMM4 Plugins** ワークフローを選択
3. **Run workflow** ボタンで手動実行してテスト
4. 正常に完了すると `data/plugins.json` が自動更新されます

## 📂 プロジェクト構成

```
ymm4-plugins-catalog/
├── index.html              # メインページ
├── style.css               # スタイルシート
├── app.js                  # アプリケーションロジック
├── data/
│   ├── plugins.json        # プラグインデータ（自動更新）
│   └── plugins-manual.json # 手動追加データ
├── scripts/
│   └── collect.js          # 自動収集スクリプト
└── .github/workflows/
    ├── collect-plugins.yml # 自動収集ワークフロー
    └── deploy.yml          # GitHub Pagesデプロイ
```

## ➕ プラグインを手動で追加する方法

`data/plugins-manual.json` を編集して、以下の形式でプラグインを追加できます:

```json
{
  "plugins": [
    {
      "id": "example-plugin",
      "name": "プラグイン名",
      "description": "説明文",
      "author": "作者名",
      "authorUrl": "https://example.com",
      "repoUrl": "",
      "downloadUrl": "https://example.com/download",
      "category": "video-effect",
      "tags": ["タグ1", "タグ2"],
      "stars": 0,
      "lastUpdated": "2026-01-01T00:00:00Z",
      "latestVersion": "v1.0.0",
      "license": ""
    }
  ]
}
```

## 📝 カテゴリ一覧

| カテゴリID | 表示名 |
|-----------|--------|
| `video-effect` | 映像エフェクト |
| `audio-effect` | 音声エフェクト |
| `voice-synthesis` | 音声合成 |
| `shape` | 図形 |
| `text` | テキスト |
| `video-output` | 動画出力 |
| `utility` | ユーティリティ |
| `other` | その他 |
