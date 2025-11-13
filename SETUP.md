# セットアップガイド

## 1. Google Sheets API の認証設定

### サービスアカウントの作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成（または既存のプロジェクトを選択）
3. 「APIとサービス」→「ライブラリ」から「Google Sheets API」を検索して有効化
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「サービスアカウント」
5. サービスアカウント名を入力して作成
6. 作成したサービスアカウントをクリック→「キー」タブ→「キーを追加」→「JSON」を選択
7. ダウンロードしたJSONファイルを開き、以下の情報を取得：
   - `client_email`: サービスアカウントのメールアドレス
   - `private_key`: 秘密鍵

### スプレッドシートへの権限付与

1. 使用するスプレッドシートを開く
2. 「共有」ボタンをクリック
3. サービスアカウントのメールアドレス（`client_email`）を追加
4. 権限を「編集者」に設定

## 2. 環境変数の設定

`.env` ファイルを作成し、以下の内容を設定します。

### 方法1: JSONファイルから読み込む（推奨）

サービスアカウントのJSONファイルをプロジェクトディレクトリに配置し、`.env` に以下を設定：

```env
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_JSON_PATH=./path/to/your-service-account.json
PORT=3000
JWT_SECRET=your_jwt_secret_here
```

### 方法2: 環境変数で直接設定

```env
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PORT=3000
JWT_SECRET=your_jwt_secret_here
```

**注意**: 方法2の場合、`GOOGLE_SHEETS_PRIVATE_KEY` はダブルクォートで囲み、改行文字は `\n` として記述してください。

## 3. スプレッドシートの準備

### Employees シート

以下のヘッダー行を作成：

| employee_id | name | role | department | email | password_hash | is_active | created_at | updated_at |
|-------------|------|------|------------|-------|---------------|-----------|------------|------------|

### AttendanceLog シート

以下のヘッダー行を作成：

| employee_id | event_type | timestamp | client_ts | device_info |
|-------------|------------|-----------|-----------|-------------|

## 4. パスワードハッシュの生成

Node.jsで以下のコマンドを実行：

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your_password', 10).then(hash => console.log(hash));"
```

生成されたハッシュを `Employees` シートの `password_hash` 列に設定してください。

## 5. 起動

```bash
npm install
npm start
```

ブラウザで `http://localhost:3000` にアクセスしてください。

