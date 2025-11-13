# デプロイ手順書（詳細版）

このドキュメントは、Railwayを使用したデプロイ手順を詳しく説明します。

## 🎯 Railwayでのデプロイ（推奨）

### 前提条件

- GitHubアカウント
- Railwayアカウント（[railway.app](https://railway.app/) で無料登録可能）
- Google Cloud Consoleアカウント（Google Sheets API用）

### ステップ1: GitHubリポジトリの準備

1. GitHubに新しいリポジトリを作成
2. ローカルリポジトリをGitHubにプッシュ：

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/your-repo-name.git
git push -u origin main
```

### ステップ2: Google Sheets APIの設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成（または既存のプロジェクトを選択）
3. 「APIとサービス」→「ライブラリ」から「Google Sheets API」を検索して有効化
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「サービスアカウント」
5. サービスアカウント名を入力して作成
6. 作成したサービスアカウントをクリック→「キー」タブ→「キーを追加」→「JSON」を選択
7. JSONファイルをダウンロード（後で使用します）

### ステップ3: スプレッドシートの準備

1. Googleスプレッドシートを新規作成
2. スプレッドシートのIDを確認（URLの `/d/` と `/edit` の間の文字列）
3. 以下のシートを作成：

#### Employees シート

| employee_id | name | role | department | email | password_hash | is_active | created_at | updated_at |
|-------------|------|------|------------|-------|---------------|-----------|------------|------------|

#### AttendanceLog シート

| employee_id | event_type | timestamp | client_ts | device_info | edited_by | edited_at | edit_reason | original_timestamp | original_event_type |
|-------------|------------|-----------|-----------|-------------|-----------|-----------|-------------|-------------------|-------------------|

4. スプレッドシートを開き、「共有」ボタンをクリック
5. サービスアカウントのメールアドレス（JSONファイルの `client_email`）を追加
6. 権限を「編集者」に設定

### ステップ4: Railwayでのデプロイ

1. [Railway](https://railway.app/) にログイン
2. 「New Project」をクリック
3. 「Deploy from GitHub repo」を選択
4. GitHubアカウントを認証（初回のみ）
5. リポジトリを選択
6. Railwayが自動的にデプロイを開始

### ステップ5: 環境変数の設定

1. Railwayのプロジェクト画面で「Variables」タブを開く
2. 以下の環境変数を追加：

```
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_JSON_PATH=./service-account.json
PORT=3000
JWT_SECRET=your_strong_random_secret_here
```

**JWT_SECRETの生成方法**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ステップ6: サービスアカウントJSONファイルのアップロード

1. Railwayのプロジェクト画面で「Variables」タブを開く
2. 下にスクロールして「Files」セクションを開く
3. 「Add File」をクリック
4. ファイル名: `service-account.json`
5. 内容: ステップ2でダウンロードしたJSONファイルの内容を貼り付け
6. 「Save」をクリック

### ステップ7: デプロイの確認

1. Railwayのプロジェクト画面で「Deployments」タブを開く
2. デプロイが完了するまで待つ（数分かかります）
3. デプロイが完了すると、自動的にURLが生成されます
4. 生成されたURLをクリックして、アプリケーションにアクセス

### ステップ8: テストユーザーの作成

1. スプレッドシートの `Employees` シートを開く
2. パスワードハッシュを生成：

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('test123', 10).then(hash => console.log(hash));"
```

3. 以下の行を追加：

| employee_id | name | role | department | email | password_hash | is_active | created_at | updated_at |
|-------------|------|------|------------|-------|---------------|-----------|------------|------------|
| E001 | テスト太郎 | employee | 営業部 | test@example.com | [生成されたハッシュ] | TRUE | 2025-01-01 | 2025-01-01 |
| ADMIN01 | 管理者一郎 | admin | 管理部 | admin@example.com | [生成されたハッシュ] | TRUE | 2025-01-01 | 2025-01-01 |

### ステップ9: 動作確認

1. デプロイされたURLにアクセス
2. テストユーザー（E001 / test123）でログイン
3. 出勤ボタンをクリック
4. スプレッドシートの `AttendanceLog` シートにデータが記録されることを確認
5. 管理者ユーザー（ADMIN01 / test123）でログイン
6. 管理者画面が表示されることを確認

## 🔄 更新のデプロイ

コードを更新した場合：

1. 変更をコミット：
```bash
git add .
git commit -m "Update description"
git push
```

2. Railwayが自動的にデプロイを開始します
3. デプロイが完了するまで待ちます（数分）

## 📊 ログの確認

1. Railwayのプロジェクト画面で「Deployments」タブを開く
2. 最新のデプロイをクリック
3. 「View Logs」をクリックしてログを確認

## 🔧 環境変数の変更

1. Railwayのプロジェクト画面で「Variables」タブを開く
2. 環境変数を編集
3. 保存すると自動的に再デプロイされます

## 🗑️ デプロイの削除

Railwayのプロジェクトを削除する場合：

1. プロジェクト画面で「Settings」タブを開く
2. 下にスクロールして「Delete Project」をクリック
3. 確認して削除

## 💰 料金について

Railwayの無料プランでは：
- 月500時間の無料利用
- $5分の無料クレジット
- 個人利用であれば十分な範囲

本番環境で24時間稼働させる場合は、有料プランが必要になる場合があります。

## 🆘 よくある問題

### デプロイが失敗する

- 環境変数が正しく設定されているか確認
- `service-account.json` ファイルが正しくアップロードされているか確認
- ログを確認してエラーメッセージを確認

### アプリケーションが起動しない

- ポート番号が正しく設定されているか確認（Railwayは自動設定）
- 環境変数が正しく設定されているか確認

### ログインできない

- スプレッドシートの `Employees` シートにユーザーが存在するか確認
- パスワードハッシュが正しく設定されているか確認

