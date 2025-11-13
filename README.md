# 勤怠管理システム

Node.js + Express + Google Sheets API を使用した勤怠管理システムです。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env` にコピーして、以下の値を設定してください：

```env
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PORT=3000
JWT_SECRET=your_jwt_secret_here
```

### 3. Google Sheets API の認証設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Google Sheets API を有効化
3. サービスアカウントを作成
4. サービスアカウントのキー（JSON）をダウンロード
5. JSONファイルから `client_email` と `private_key` を `.env` に設定
6. スプレッドシートを開き、サービスアカウントのメールアドレスに編集権限を付与

### 4. スプレッドシートの準備

以下のシートを作成してください：

- **Employees**: 従業員情報
  - ヘッダー: `employee_id`, `name`, `role`, `department`, `email`, `password_hash`, `is_active`, `created_at`, `updated_at`
- **AttendanceLog**: 勤怠ログ
  - ヘッダー: `employee_id`, `event_type`, `timestamp`, `client_ts`, `device_info`
- **DailySummary**: 日次サマリー（オプション）
- **MonthlySummary**: 月次サマリー（オプション）

### 5. サンプルユーザーの作成（オプション）

テスト用のサンプルユーザーを作成するには：

```bash
npm run seed:users
```

以下のユーザーが作成されます：

- **E001** (テスト太郎) - パスワード: `test123` - 役割: 従業員
- **E002** (テスト花子) - パスワード: `test123` - 役割: 従業員
- **ADMIN01** (管理者一郎) - パスワード: `admin123` - 役割: 管理者

### 6. 手動でパスワードハッシュを生成する場合

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your_password', 10).then(hash => console.log(hash));"
```

生成されたハッシュを `Employees` シートの `password_hash` 列に設定してください。

## 起動

```bash
npm start
```

開発モード（自動リロード）:

```bash
npm run dev
```

## API エンドポイント

### 認証

- `POST /api/auth/login` - ログイン

### 勤怠

- `GET /api/attendance/status` - 現在のステータスを取得
- `POST /api/attendance/event` - イベントを登録（出勤、退勤、休憩入、休憩出）

### 管理者

- `GET /api/admin/employees` - 全従業員を取得
- `GET /api/admin/summary` - サマリーを取得

## デプロイ

### Heroku

```bash
heroku create your-app-name
heroku config:set GOOGLE_SHEETS_SPREADSHEET_ID=...
heroku config:set GOOGLE_SHEETS_CLIENT_EMAIL=...
heroku config:set GOOGLE_SHEETS_PRIVATE_KEY="..."
heroku config:set JWT_SECRET=...
git push heroku main
```

### Vercel / Netlify

静的ファイル（`public/`）をホスティングし、API部分は別途デプロイするか、サーバーレス関数として実装してください。

