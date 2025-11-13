/**
 * 設定値を管理。スクリプトプロパティを利用してIDを保持する。
 */
const Config = (() => {
  const SCRIPT_PROPS = PropertiesService.getScriptProperties();
  const KEYS = {
    SPREADSHEET_ID: 'SPREADSHEET_ID'
  };

  /**
   * スプレッドシートIDを登録する。
   * @param {string} spreadsheetId
   */
  function setSpreadsheetId(spreadsheetId) {
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required');
    }
    SCRIPT_PROPS.setProperty(KEYS.SPREADSHEET_ID, spreadsheetId);
  }

  /**
   * スプレッドシートIDを取得する。
   * @returns {string}
   */
  function getSpreadsheetId() {
    const id = SCRIPT_PROPS.getProperty(KEYS.SPREADSHEET_ID);
    if (!id) {
      throw new Error('SPREADSHEET_ID is not configured. Execute Config.setSpreadsheetId("<YOUR_ID>").');
    }
    return id;
  }

  /**
   * スプレッドシートのインスタンスを返す。
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  function getSpreadsheet() {
    return SpreadsheetApp.openById(getSpreadsheetId());
  }

  return {
    setSpreadsheetId,
    getSpreadsheetId,
    getSpreadsheet
  };
})();

