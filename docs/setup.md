# スプレッドシート / スクリプトID 設定手順

1. **スプレッドシートを準備**  
   先に作成した勤怠テンプレートを Google スプレッドシート上で開き、URL に含まれる ID（`https://docs.google.com/spreadsheets/d/<ID>/edit` の `<ID>` 部分）を控えます。

2. **Apps Script プロジェクトを開く**  
   GAS エディタを開き、`コンソール` から以下を実行してスクリプトプロパティへ ID を保存します。

   ```javascript
   Config.setSpreadsheetId('ここにスプレッドシートIDを貼り付け');
   ```

   実行後、`Config.getSpreadsheetId()` を呼び出すと保存された値を確認できます。

3. **CLASP を利用する場合の設定**  
   `.clasp.json` の `scriptId` に、Apps Script プロジェクトの ID を記載します。  
   Script ID は GAS エディタの `プロジェクト設定` から取得可能です。

   ```json
   {
     "scriptId": "1A2B3C...（Apps Script の Script ID）",
     "rootDir": "./"
   }
   ```

4. **初回デプロイ前に確認する項目**
   - `AttendanceLog` などのシート名がコード内の `SHEETS` 定数と一致していること。
   - シートのヘッダ行が仕様通りに並んでいること（`employee_id` 等）。
   - Apps Script の権限許可ダイアログが表示された場合は、指示に従って承認します。

上記の設定が完了すると、`SpreadsheetRepository` で自動的に設定されたスプレッドシートが利用されるようになります。

