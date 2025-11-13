/**
 * スプレッドシートとのやり取りを抽象化するリポジトリ。
 */
const SpreadsheetRepository = (() => {
  const ss = Config.getSpreadsheet();

  const SHEETS = {
    EMPLOYEES: 'Employees',
    ATTENDANCE_LOG: 'AttendanceLog',
    DAILY_SUMMARY: 'DailySummary',
    ADMIN_ADJUSTMENT: 'AdminAdjustmentLog'
  };

  function getEmployeeById(employeeId) {
    const employees = getAllEmployeesMap();
    return employees.get(employeeId) || null;
  }

  function getAllEmployees(includeInactive) {
    const sheet = ss.getSheetByName(SHEETS.EMPLOYEES);
    const values = sheet.getDataRange().getValues();
    const header = values.shift();

    const indexMap = buildIndexMap(header);
    return values
      .map(row => ({
        employeeId: row[indexMap.employee_id],
        name: row[indexMap.name],
        role: row[indexMap.role],
        passwordHash: row[indexMap.password_hash],
        isActive: normalizeBoolean(row[indexMap.is_active])
      }))
      .filter(emp => (includeInactive ? true : emp.isActive));
  }

  function getAllEmployeesMap(includeInactive) {
    const map = new Map();
    getAllEmployees(includeInactive).forEach(emp => {
      map.set(emp.employeeId, emp);
    });
    return map;
  }

  function appendAttendanceLog(record) {
    const sheet = ss.getSheetByName(SHEETS.ATTENDANCE_LOG);
    sheet.appendRow([
      Utilities.getUuid(),
      new Date(),
      record.employeeId,
      record.eventType,
      record.clientTs || '',
      record.deviceInfo ? JSON.stringify(record.deviceInfo) : '',
      '',
      'system',
      new Date()
    ]);
  }

  function getRecentEvents(employeeId, limit) {
    const sheet = ss.getSheetByName(SHEETS.ATTENDANCE_LOG);
    const values = sheet.getDataRange().getValues();
    const header = values.shift();
    const indexMap = buildIndexMap(header);

    const filtered = values
      .filter(r => r[indexMap.employee_id] === employeeId)
      .sort((a, b) => b[indexMap.timestamp] - a[indexMap.timestamp]);

    return filtered.slice(0, limit || 5).map(row => ({
      eventType: row[indexMap.event_type],
      timestamp: row[indexMap.timestamp]
    }));
  }

  function getLatestEvent(employeeId) {
    const events = getRecentEvents(employeeId, 1);
    return events.length ? events[0] : null;
  }

  function getEventsForDate(employeeId, date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const sheet = ss.getSheetByName(SHEETS.ATTENDANCE_LOG);
    const values = sheet.getDataRange().getValues();
    const header = values.shift();
    const indexMap = buildIndexMap(header);

    return values
      .filter(row => row[indexMap.employee_id] === employeeId)
      .filter(row => {
        const ts = new Date(row[indexMap.timestamp]);
        return ts >= targetDate && ts < nextDate;
      })
      .map(row => ({
        eventType: row[indexMap.event_type],
        timestamp: row[indexMap.timestamp]
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  function upsertDailySummary(employeeId, date, summary) {
    const sheet = ss.getSheetByName(SHEETS.DAILY_SUMMARY);
    const values = sheet.getDataRange().getValues();
    const header = values.shift();
    const indexMap = buildIndexMap(header);

    const targetDate = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
    const rowIndex = values.findIndex(row =>
      row[indexMap.date] === targetDate && row[indexMap.employee_id] === employeeId
    );

    const rowValues = [
      targetDate,
      employeeId,
      summary.workMinutes,
      summary.breakMinutes,
      summary.overtimeMinutes,
      summary.lateMinutes,
      summary.earlyleaveMinutes,
      summary.status,
      summary.notes
    ];

    if (rowIndex >= 0) {
      const range = sheet.getRange(rowIndex + 2, 1, 1, rowValues.length);
      range.setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  }

  function fetchDailySummaries(from, to, employeeId) {
    const sheet = ss.getSheetByName(SHEETS.DAILY_SUMMARY);
    const values = sheet.getDataRange().getValues();
    const header = values.shift();
    const indexMap = buildIndexMap(header);

    const employees = getAllEmployeesMap(true);

    return values
      .map(row => {
        const dateStr = normalizeDate(row[indexMap.date]);
        return {
          raw: row,
          date: dateStr,
          employeeId: row[indexMap.employee_id],
          employeeName: employees.get(row[indexMap.employee_id])
            ? employees.get(row[indexMap.employee_id]).name
            : '',
          workMinutes: Number(row[indexMap.work_minutes]) || 0,
          breakMinutes: Number(row[indexMap.break_minutes]) || 0,
          overtimeMinutes: Number(row[indexMap.overtime_minutes]) || 0,
          lateMinutes: Number(row[indexMap.late_minutes]) || 0,
          earlyleaveMinutes: Number(row[indexMap.earlyleave_minutes]) || 0,
          status: row[indexMap.status],
          notes: row[indexMap.notes]
        };
      })
      .filter(entry => {
        const matchEmployee = !employeeId || entry.employeeId === employeeId;
        return matchEmployee && (!from || entry.date >= from) && (!to || entry.date <= to);
      });
  }

  function fetchAlerts(from, to, employeeId) {
    return fetchDailySummaries(from, to, employeeId).filter(
      row => (row.status && row.status !== 'OK') || (row.notes && row.notes !== '')
    );
  }

  function applyAttendanceAdjustment(adjustment, adminId) {
    if (!adjustment || !adjustment.employeeId || !adjustment.date) {
      throw new Error('INVALID_ADJUSTMENT');
    }

    const targetDate = normalizeDate(adjustment.date);
    const before =
      fetchDailySummaries(targetDate, targetDate, adjustment.employeeId)[0] || {
        date: targetDate,
        employeeId: adjustment.employeeId,
        employeeName: '',
        workMinutes: 0,
        breakMinutes: 0,
        overtimeMinutes: 0,
        lateMinutes: 0,
        earlyleaveMinutes: 0,
        status: 'OK',
        notes: ''
      };

    const updates = adjustment.updates || {};
    const after = Object.assign({}, before, {
      workMinutes: valueOrDefault(updates.workMinutes, before.workMinutes),
      breakMinutes: valueOrDefault(updates.breakMinutes, before.breakMinutes),
      overtimeMinutes: valueOrDefault(updates.overtimeMinutes, before.overtimeMinutes),
      lateMinutes: valueOrDefault(updates.lateMinutes, before.lateMinutes),
      earlyleaveMinutes: valueOrDefault(updates.earlyleaveMinutes, before.earlyleaveMinutes),
      status: updates.status || before.status,
      notes: updates.notes !== undefined ? updates.notes : before.notes
    });

    upsertDailySummary(
      adjustment.employeeId,
      new Date(targetDate),
      after
    );

    const sheet = ss.getSheetByName(SHEETS.ADMIN_ADJUSTMENT);
    sheet.appendRow([
      Utilities.getUuid(),
      new Date(),
      adminId,
      adjustment.employeeId,
      targetDate,
      JSON.stringify(before),
      JSON.stringify(after),
      adjustment.reason || ''
    ]);

    return { before, after };
  }

  function buildIndexMap(headerRow) {
    const map = {};
    headerRow.forEach((name, index) => {
      map[String(name).trim().toLowerCase()] = index;
    });
    return map;
  }

  function normalizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return !!value;
  }

  function normalizeDate(value) {
    if (!value) {
      return '';
    }
    if (value instanceof Date) {
      return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd');
    }
    if (typeof value === 'number') {
      return Utilities.formatDate(new Date(value), 'Asia/Tokyo', 'yyyy-MM-dd');
    }
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, 'Asia/Tokyo', 'yyyy-MM-dd');
    }
    return str;
  }

  function valueOrDefault(value, fallback) {
    return value !== undefined && value !== null ? value : fallback;
  }

  return {
    getEmployeeById,
    getAllEmployees,
    appendAttendanceLog,
    getRecentEvents,
    getLatestEvent,
    getEventsForDate,
    upsertDailySummary,
    fetchDailySummaries,
    fetchAlerts,
    applyAttendanceAdjustment
  };
})();

