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
    ];
    await sheetsService.appendRow('AttendanceLog', values);
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
    const data = await sheetsService.getSheetData('Employees');
    if (data.length < 2) return [];

    const headers = data[0];
    const indexMap = sheetsService.buildIndexMap(headers);
    const idCol = indexMap['employee_id'] ?? indexMap['id'];
    const nameCol = indexMap['name'];
    const roleCol = indexMap['role'];
    const departmentCol = indexMap['department'];
    const emailCol = indexMap['email'];
    const isActiveCol = indexMap['is_active'] ?? indexMap['isactive'];

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
    return employees;
  }

  // 日次サマリーを取得
  async getDailySummaries(fromDate, toDate, employeeId = null) {
    // 実装は後で追加
    return [];
  }
}

module.exports = new SpreadsheetRepository();

