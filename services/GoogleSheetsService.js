const { google } = require('googleapis');
const config = require('../config');

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.initializeAuth();
  }

  async initializeAuth() {
    try {
      this.auth = new google.auth.JWT(
        config.googleSheets.clientEmail,
        null,
        config.googleSheets.privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
      );
      await this.auth.authorize();
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      console.error('Google Sheets認証エラー:', error);
      throw error;
    }
  }

  async ensureAuth() {
    if (!this.sheets) {
      await this.initializeAuth();
    }
  }

  // ヘッダー行からカラムインデックスのマップを構築
  buildIndexMap(headers) {
    const map = {};
    headers.forEach((name, index) => {
      map[String(name).trim().toLowerCase()] = index;
    });
    return map;
  }

  // シートの全データを取得
  async getSheetData(sheetName) {
    await this.ensureAuth();
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `${sheetName}!A:Z`,
      });
      return response.data.values || [];
    } catch (error) {
      console.error(`シート "${sheetName}" の取得エラー:`, error);
      throw error;
    }
  }

  // シートにデータを追加
  async appendRow(sheetName, values) {
    await this.ensureAuth();
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] },
      });
    } catch (error) {
      console.error(`シート "${sheetName}" への追加エラー:`, error);
      throw error;
    }
  }

  // シートのセルを更新
  async updateCell(sheetName, row, col, value) {
    await this.ensureAuth();
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: `${sheetName}!${this.getColumnLetter(col)}${row}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[value]] },
      });
    } catch (error) {
      console.error(`セル更新エラー:`, error);
      throw error;
    }
  }

  // 列番号を列文字に変換（1 -> A, 2 -> B, ...）
  getColumnLetter(col) {
    let letter = '';
    while (col > 0) {
      col--;
      letter = String.fromCharCode(65 + (col % 26)) + letter;
      col = Math.floor(col / 26);
    }
    return letter;
  }

  // 行番号を取得（ヘッダー行を除く）
  getRowNumber(index) {
    return index + 2; // ヘッダー行(1) + 0ベースインデックス + 1
  }

  // 行を削除
  async deleteRow(sheetName, rowNumber) {
    await this.ensureAuth();
    try {
      // シートIDを取得
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });
      const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        throw new Error(`シート "${sheetName}" が見つかりません`);
      }
      const sheetId = sheet.properties.sheetId;

      // 行を削除
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.spreadsheetId,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1, // 0ベース
                endIndex: rowNumber,
              },
            },
          }],
        },
      });
    } catch (error) {
      console.error(`行削除エラー:`, error);
      throw error;
    }
  }

  // 行を更新
  async updateRow(sheetName, rowNumber, values) {
    await this.ensureAuth();
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: `${sheetName}!${rowNumber}:${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] },
      });
    } catch (error) {
      console.error(`行更新エラー:`, error);
      throw error;
    }
  }
}

module.exports = new GoogleSheetsService();

