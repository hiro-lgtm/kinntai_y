const sheetsService = require('./GoogleSheetsService');

class SpreadsheetRepository {
  // 従業員情報を取得
  async getEmployeeById(employeeId) {
    const data = await sheetsService.getSheetData('Employees');
    if (data.length < 2) return null;

    const headers = data[0];
    const indexMap = sheetsService.buildIndexMap(headers);
    const idCol = indexMap['employee_id'] ?? indexMap['id'];
    const nameCol = indexMap['name'];
    const roleCol = indexMap['role'];
    const passwordHashCol = indexMap['password_hash'] ?? indexMap['passwordhash'];
    const isActiveCol = indexMap['is_active'] ?? indexMap['isactive'];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[idCol] === employeeId) {
        return {
          id: row[idCol] || '',
          name: row[nameCol] || '',
          role: row[roleCol] || 'employee',
          passwordHash: row[passwordHashCol] || '',
          isActive: row[isActiveCol] === 'TRUE' || row[isActiveCol] === true,
        };
      }
    }
    return null;
  }

  // 勤怠ログを追加
  async appendAttendanceLog(log) {
    const values = [
      log.employeeId || '',
      log.eventType || '',
      log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString(),
      log.clientTs || '',
      log.deviceInfo || '',
      log.editedBy || '', // 修正者
      log.editedAt || '', // 修正日時
      log.editReason || '', // 修正理由
      log.originalTimestamp || '', // 元のタイムスタンプ
      log.originalEventType || '', // 元のイベントタイプ
    ];
    await sheetsService.appendRow('AttendanceLog', values);
  }

  // 勤怠ログを削除（行番号ベース）
  async deleteAttendanceLog(rowNumber) {
    await sheetsService.deleteRow('AttendanceLog', rowNumber);
  }

  // 勤怠ログを更新（行番号ベース）
  async updateAttendanceLog(rowNumber, log) {
    // 既存のデータを取得して、元の値を保持
    const data = await sheetsService.getSheetData('AttendanceLog');
    const headers = data[0];
    const indexMap = sheetsService.buildIndexMap(headers);
    const rowIndex = rowNumber - 2; // ヘッダー行を考慮
    
    if (rowIndex >= 0 && rowIndex < data.length - 1) {
      const existingRow = data[rowIndex + 1];
      const originalTimestamp = existingRow[indexMap['timestamp']] || '';
      const originalEventType = existingRow[indexMap['event_type']] || '';
      
      // 修正情報を設定
      const values = [
        log.employeeId || '',
        log.eventType || '',
        log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString(),
        log.clientTs || '',
        log.deviceInfo || '',
        log.editedBy || '', // 修正者
        log.editedAt ? new Date(log.editedAt).toISOString() : new Date().toISOString(), // 修正日時
        log.editReason || '', // 修正理由
        originalTimestamp, // 元のタイムスタンプ
        originalEventType, // 元のイベントタイプ
      ];
      await sheetsService.updateRow('AttendanceLog', rowNumber, values);
    } else {
      // 既存データがない場合は通常の更新
      const values = [
        log.employeeId || '',
        log.eventType || '',
        log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString(),
        log.clientTs || '',
        log.deviceInfo || '',
        log.editedBy || '',
        log.editedAt ? new Date(log.editedAt).toISOString() : new Date().toISOString(),
        log.editReason || '',
        log.originalTimestamp || '',
        log.originalEventType || '',
      ];
      await sheetsService.updateRow('AttendanceLog', rowNumber, values);
    }
  }

  // 行番号を含む勤怠ログを取得
  async getAttendanceLogsWithRowNumbers(fromDate, toDate, employeeId = null) {
    console.log(`[getAttendanceLogsWithRowNumbers] 開始: fromDate=${fromDate}, toDate=${toDate}, employeeId=${employeeId}`);
    const data = await sheetsService.getSheetData('AttendanceLog');
    console.log(`[getAttendanceLogsWithRowNumbers] データ行数: ${data.length}`);
    
    if (data.length < 2) {
      console.log('[getAttendanceLogsWithRowNumbers] データが不足しています（ヘッダーのみ）');
      return [];
    }

    const headers = data[0];
    const indexMap = sheetsService.buildIndexMap(headers);
    const employeeIdCol = indexMap['employee_id'] ?? indexMap['employeeid'];
    const eventTypeCol = indexMap['event_type'] ?? indexMap['eventtype'];
    const timestampCol = indexMap['timestamp'];
    const clientTsCol = indexMap['client_ts'] ?? indexMap['clientts'];
    const deviceInfoCol = indexMap['device_info'] ?? indexMap['deviceinfo'];
    const editedByCol = indexMap['edited_by'] ?? indexMap['editedby'];
    const editedAtCol = indexMap['edited_at'] ?? indexMap['editedat'];
    const editReasonCol = indexMap['edit_reason'] ?? indexMap['editreason'];
    const originalTimestampCol = indexMap['original_timestamp'] ?? indexMap['originaltimestamp'];
    const originalEventTypeCol = indexMap['original_event_type'] ?? indexMap['originaleventtype'];

    // 日付文字列を日本時間（JST, UTC+9）として解釈し、UTCに変換
    const fromJST = new Date(fromDate + 'T00:00:00+09:00');
    const toJST = new Date(toDate + 'T23:59:59.999+09:00');
    const from = new Date(fromJST.getTime());
    const to = new Date(toJST.getTime());
    
    console.log(`[getAttendanceLogsWithRowNumbers] 検索範囲: from=${from.toISOString()}, to=${to.toISOString()}`);

    const logs = [];
    let checkedCount = 0;
    let matchedCount = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowEmployeeId = row[employeeIdCol];
      const rowTimestamp = row[timestampCol];
      
      if (!rowTimestamp) continue;
      
      // 従業員IDでフィルタリング
      if (employeeId && rowEmployeeId !== employeeId) {
        continue;
      }
      
      checkedCount++;

      const eventDate = new Date(rowTimestamp);
      if (isNaN(eventDate.getTime())) {
        console.log(`[getAttendanceLogsWithRowNumbers] 無効なタイムスタンプ: row[${i}]=${rowTimestamp}`);
        continue;
      }
      
      // 日付範囲でフィルタリング（UTCで比較）
      if (eventDate >= from && eventDate <= to) {
        matchedCount++;
        const rowNumber = sheetsService.getRowNumber(i);
        const editedBy = row[editedByCol] || '';
        const editedAt = row[editedAtCol] || '';
        const isEdited = !!(editedBy && editedAt);
        
        logs.push({
          rowNumber,
          employeeId: rowEmployeeId || '',
          eventType: row[eventTypeCol] || '',
          timestamp: rowTimestamp || '',
          clientTs: row[clientTsCol] || '',
          deviceInfo: row[deviceInfoCol] || '',
          editedBy,
          editedAt,
          editReason: row[editReasonCol] || '',
          originalTimestamp: row[originalTimestampCol] || '',
          originalEventType: row[originalEventTypeCol] || '',
          isEdited,
        });
      }
    }
    
    console.log(`[getAttendanceLogsWithRowNumbers] チェック数: ${checkedCount}, マッチ数: ${matchedCount}, 返却数: ${logs.length}`);

    return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // 従業員の最近のイベントを取得
  async getRecentEvents(employeeId, limit = 10) {
    const data = await sheetsService.getSheetData('AttendanceLog');
    if (data.length < 2) return [];

    const headers = data[0];
    const indexMap = sheetsService.buildIndexMap(headers);
    const employeeIdCol = indexMap['employee_id'] ?? indexMap['employeeid'];
    const eventTypeCol = indexMap['event_type'] ?? indexMap['eventtype'];
    const timestampCol = indexMap['timestamp'];

    const events = [];
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      if (row[employeeIdCol] === employeeId) {
        events.push({
          eventType: row[eventTypeCol] || '',
          timestamp: row[timestampCol] || '',
        });
        if (events.length >= limit) break;
      }
    }
    return events.reverse();
  }

  // 特定日のイベントを取得
  async getEventsForDate(employeeId, date) {
    const data = await sheetsService.getSheetData('AttendanceLog');
    if (data.length < 2) return [];

    const headers = data[0];
    const indexMap = sheetsService.buildIndexMap(headers);
    const employeeIdCol = indexMap['employee_id'] ?? indexMap['employeeid'];
    const eventTypeCol = indexMap['event_type'] ?? indexMap['eventtype'];
    const timestampCol = indexMap['timestamp'];

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const events = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[employeeIdCol] === employeeId) {
        const eventDate = new Date(row[timestampCol]);
        if (eventDate >= targetDate && eventDate < nextDate) {
          events.push({
            eventType: row[eventTypeCol] || '',
            timestamp: row[timestampCol] || '',
          });
        }
      }
    }
    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // 全従業員を取得
  async getAllEmployees() {
    try {
      console.log('[getAllEmployees] 開始');
      const data = await sheetsService.getSheetData('Employees');
      console.log(`[getAllEmployees] データ行数: ${data.length}`);
      
      if (data.length < 2) {
        console.log('[getAllEmployees] データが不足しています（ヘッダーのみ）');
        return [];
      }

      const headers = data[0];
      console.log(`[getAllEmployees] ヘッダー:`, headers);
      const indexMap = sheetsService.buildIndexMap(headers);
      console.log(`[getAllEmployees] インデックスマップ:`, indexMap);
      
      const idCol = indexMap['employee_id'] ?? indexMap['id'];
      const nameCol = indexMap['name'];
      const roleCol = indexMap['role'];
      const departmentCol = indexMap['department'];
      const emailCol = indexMap['email'];
      const isActiveCol = indexMap['is_active'] ?? indexMap['isactive'];

      console.log(`[getAllEmployees] カラムインデックス - id: ${idCol}, name: ${nameCol}, role: ${roleCol}`);

      const employees = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[idCol]) {
          employees.push({
            id: row[idCol] || '',
            name: row[nameCol] || '',
            role: row[roleCol] || 'employee',
            department: row[departmentCol] || '',
            email: row[emailCol] || '',
            isActive: row[isActiveCol] === 'TRUE' || row[isActiveCol] === true,
          });
        }
      }
      
      console.log(`[getAllEmployees] 取得した従業員数: ${employees.length}`);
      return employees;
    } catch (error) {
      console.error('[getAllEmployees] エラー:', error);
      console.error('[getAllEmployees] エラースタック:', error.stack);
      throw error;
    }
  }

  // 従業員情報を更新
  async updateEmployee(employeeId, employeeData) {
    const data = await sheetsService.getSheetData('Employees');
    if (data.length < 2) {
      throw new Error('従業員データが見つかりません');
    }

    const headers = data[0];
    const indexMap = sheetsService.buildIndexMap(headers);
    const idCol = indexMap['employee_id'] ?? indexMap['id'];
    const nameCol = indexMap['name'];
    const roleCol = indexMap['role'];
    const departmentCol = indexMap['department'];
    const emailCol = indexMap['email'];
    const passwordHashCol = indexMap['password_hash'] ?? indexMap['passwordhash'];
    const isActiveCol = indexMap['is_active'] ?? indexMap['isactive'];
    const updatedAtCol = indexMap['updated_at'] ?? indexMap['updatedat'];

    // 従業員を検索
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === employeeId) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('従業員が見つかりません');
    }

    const rowNumber = rowIndex + 1; // ヘッダー行を考慮（1ベース）
    const existingRow = data[rowIndex];

    // 更新する値を準備（既存の値を保持しつつ、新しい値で上書き）
    const values = [];
    headers.forEach((header, colIndex) => {
      const headerLower = String(header).trim().toLowerCase();
      if (headerLower === 'employee_id' || headerLower === 'id') {
        values[colIndex] = employeeId;
      } else if (headerLower === 'name') {
        values[colIndex] = employeeData.name !== undefined ? employeeData.name : existingRow[nameCol] || '';
      } else if (headerLower === 'role') {
        values[colIndex] = employeeData.role !== undefined ? employeeData.role : existingRow[roleCol] || 'employee';
      } else if (headerLower === 'department') {
        values[colIndex] = employeeData.department !== undefined ? employeeData.department : existingRow[departmentCol] || '';
      } else if (headerLower === 'email') {
        values[colIndex] = employeeData.email !== undefined ? employeeData.email : existingRow[emailCol] || '';
      } else if (headerLower === 'password_hash' || headerLower === 'passwordhash') {
        values[colIndex] = employeeData.passwordHash !== undefined ? employeeData.passwordHash : existingRow[passwordHashCol] || '';
      } else if (headerLower === 'is_active' || headerLower === 'isactive') {
        values[colIndex] = employeeData.isActive !== undefined ? (employeeData.isActive ? 'TRUE' : 'FALSE') : existingRow[isActiveCol] || 'TRUE';
      } else if (headerLower === 'updated_at' || headerLower === 'updatedat') {
        values[colIndex] = new Date().toISOString();
      } else {
        values[colIndex] = existingRow[colIndex] || '';
      }
    });

    await sheetsService.updateRow('Employees', rowNumber, values);
  }

  // 期間内の全勤怠ログを取得
  async getAllAttendanceLogs(fromDate, toDate, employeeId = null) {
    const data = await sheetsService.getSheetData('AttendanceLog');
    console.log(`[getAllAttendanceLogs] データ行数: ${data.length}`);
    
    if (data.length < 2) {
      console.log('[getAllAttendanceLogs] データが不足しています（ヘッダーのみ）');
      return [];
    }

    const headers = data[0];
    console.log(`[getAllAttendanceLogs] ヘッダー:`, headers);
    const indexMap = sheetsService.buildIndexMap(headers);
    console.log(`[getAllAttendanceLogs] インデックスマップ:`, indexMap);
    
    const employeeIdCol = indexMap['employee_id'] ?? indexMap['employeeid'];
    const eventTypeCol = indexMap['event_type'] ?? indexMap['eventtype'];
    const timestampCol = indexMap['timestamp'];

    console.log(`[getAllAttendanceLogs] カラムインデックス - employeeId: ${employeeIdCol}, eventType: ${eventTypeCol}, timestamp: ${timestampCol}`);

    // 日付文字列を日本時間（JST, UTC+9）として解釈し、UTCに変換
    // 例: "2025-11-13" -> 日本時間 2025-11-13 00:00:00 JST = UTC 2025-11-12 15:00:00
    // 例: "2025-11-13" -> 日本時間 2025-11-13 23:59:59 JST = UTC 2025-11-13 14:59:59
    const fromJST = new Date(fromDate + 'T00:00:00+09:00');
    const toJST = new Date(toDate + 'T23:59:59.999+09:00');
    const from = new Date(fromJST.getTime());
    const to = new Date(toJST.getTime());

    console.log(`[getAllAttendanceLogs] 期間（JST）: ${fromDate} 00:00:00 ～ ${toDate} 23:59:59`);
    console.log(`[getAllAttendanceLogs] 期間（UTC）: ${from.toISOString()} ～ ${to.toISOString()}`);
    console.log(`[getAllAttendanceLogs] 従業員IDフィルタ: ${employeeId || 'なし'}`);

    const logs = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowEmployeeId = row[employeeIdCol];
      const rowTimestamp = row[timestampCol];
      
      console.log(`[getAllAttendanceLogs] 行${i}: employeeId=${rowEmployeeId}, timestamp=${rowTimestamp}`);
      
      // 空の行をスキップ
      if (!rowTimestamp) {
        console.log(`[getAllAttendanceLogs] 行${i}: タイムスタンプが空のためスキップ`);
        continue;
      }
      
      // 従業員IDでフィルタ
      if (employeeId && rowEmployeeId !== employeeId) {
        continue;
      }

      const eventDate = new Date(rowTimestamp);
      if (isNaN(eventDate.getTime())) {
        console.log(`[getAllAttendanceLogs] 行${i}: 無効な日付形式: ${rowTimestamp}`);
        continue;
      }
      
      console.log(`[getAllAttendanceLogs] 行${i}: イベント日時=${eventDate.toISOString()}, 範囲内=${eventDate >= from && eventDate <= to}`);
      
      if (eventDate >= from && eventDate <= to) {
        logs.push({
          employeeId: rowEmployeeId || '',
          eventType: row[eventTypeCol] || '',
          timestamp: rowTimestamp || '',
        });
        console.log(`[getAllAttendanceLogs] 行${i}: ログに追加`);
      }
    }

    console.log(`[getAllAttendanceLogs] 取得したログ数: ${logs.length}`);
    return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // 日次サマリーを取得
  async getDailySummaries(fromDate, toDate, employeeId = null) {
    const logs = await this.getAllAttendanceLogs(fromDate, toDate, employeeId);
    
    // 従業員IDと日付でグループ化（日本時間基準）
    const byEmployeeAndDate = {};
    logs.forEach(log => {
      // UTCタイムスタンプを日本時間に変換して日付を取得
      const utcDate = new Date(log.timestamp);
      // 日本時間（UTC+9）に変換
      const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
      // 日付部分のみを取得（YYYY-MM-DD形式）
      const dateKey = jstDate.toISOString().split('T')[0];
      const key = `${log.employeeId}_${dateKey}`;
      
      if (!byEmployeeAndDate[key]) {
        byEmployeeAndDate[key] = {
          employeeId: log.employeeId,
          date: dateKey,
          events: [],
        };
      }
      byEmployeeAndDate[key].events.push(log);
    });

    return Object.values(byEmployeeAndDate);
  }
}

module.exports = new SpreadsheetRepository();

