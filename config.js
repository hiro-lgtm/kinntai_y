require('dotenv').config();
const fs = require('fs');
const path = require('path');

// 秘密鍵の処理を改善
function processPrivateKey(key) {
  if (!key) return null;
  // 文字列リテラルの \n を実際の改行に変換
  // ダブルクォートを削除
  return key.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
}

// JSONファイルから認証情報を読み込む（オプション）
function loadFromJsonFile() {
  const jsonPath = process.env.GOOGLE_SHEETS_JSON_PATH;
  if (jsonPath && fs.existsSync(jsonPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return {
        clientEmail: json.client_email,
        privateKey: json.private_key,
      };
    } catch (error) {
      console.error('JSONファイルの読み込みエラー:', error);
      return null;
    }
  }
  return null;
}

// 認証情報の取得（環境変数またはJSONファイル）
const jsonAuth = loadFromJsonFile();
const googleSheetsConfig = jsonAuth || {
  clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  privateKey: processPrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY),
};

module.exports = {
  spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  googleSheets: googleSheetsConfig,
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  tokenTTL: 30 * 60 * 1000, // 30分
};

