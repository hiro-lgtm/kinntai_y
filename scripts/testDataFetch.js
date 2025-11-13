require('dotenv').config();
const repository = require('../services/SpreadsheetRepository');

async function testDataFetch() {
  try {
    console.log('=== データ取得テスト開始 ===\n');
    
    // データのタイムスタンプを確認
    console.log('--- データのタイムスタンプ確認 ---');
    const testTimestamp = '2025-11-13T21:17:34.057Z';
    const utcDate = new Date(testTimestamp);
    const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
    console.log(`UTC: ${utcDate.toISOString()}`);
    console.log(`JST: ${jstDate.toISOString()} (${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}-${String(jstDate.getDate()).padStart(2, '0')})`);
    console.log('');
    
    // 2025-11-13でテスト（日本時間）
    console.log('--- 2025-11-13（日本時間）で検索 ---');
    const fromDate1 = '2025-11-13';
    const toDate1 = '2025-11-13';
    const logs1 = await repository.getAllAttendanceLogs(fromDate1, toDate1, null);
    console.log(`取得したログ数: ${logs1.length}\n`);
    
    // 2025-11-14でテスト（日本時間）
    console.log('--- 2025-11-14（日本時間）で検索 ---');
    const fromDate2 = '2025-11-14';
    const toDate2 = '2025-11-14';
    const logs2 = await repository.getAllAttendanceLogs(fromDate2, toDate2, null);
    console.log(`取得したログ数: ${logs2.length}`);
    if (logs2.length > 0) {
      logs2.forEach((log, index) => {
        const logUtc = new Date(log.timestamp);
        const logJst = new Date(logUtc.getTime() + (9 * 60 * 60 * 1000));
        console.log(`  ${index + 1}. ${log.eventType} - UTC: ${log.timestamp}, JST: ${logJst.toISOString()}`);
      });
    }
    console.log('');
    
    // 2025-11-13から2025-11-14まででテスト
    console.log('--- 2025-11-13 ～ 2025-11-14（日本時間）で検索 ---');
    const fromDate3 = '2025-11-13';
    const toDate3 = '2025-11-14';
    const logs3 = await repository.getAllAttendanceLogs(fromDate3, toDate3, null);
    console.log(`取得したログ数: ${logs3.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('エラー:', error);
    console.error('スタック:', error.stack);
    process.exit(1);
  }
}

testDataFetch();
