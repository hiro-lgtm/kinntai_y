const repository = require('./SpreadsheetRepository');
const authService = require('./AuthService');

class AttendanceService {
  // 現在のステータスを取得
  async fetchStatus(employeeId) {
    const recentEvents = await repository.getRecentEvents(employeeId, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = await repository.getEventsForDate(employeeId, today);

    const currentState = this.deriveState(recentEvents);

    return {
      status: 'success',
      currentState,
      recentEvents: recentEvents.slice(0, 5),
      todayLog: todayLogs,
      warnings: [],
    };
  }

  // イベントを登録
  async registerEvent(employeeId, eventType, clientTs, deviceInfo) {
    // 状態遷移の検証
    const recentEvents = await repository.getRecentEvents(employeeId, 1);
    const currentState = this.deriveState(recentEvents);
    const validation = this.validateEvent(currentState, eventType);

    if (!validation.valid) {
      return {
        status: 'error',
        code: 'INVALID_SEQUENCE',
        message: validation.message,
        warnings: validation.warnings || [],
      };
    }

    // ログを追加
    await repository.appendAttendanceLog({
      employeeId,
      eventType,
      timestamp: new Date().toISOString(),
      clientTs: clientTs || new Date().toISOString(),
      deviceInfo: deviceInfo || '',
    });

    // 更新されたステータスを返す
    return await this.fetchStatus(employeeId);
  }

  // 現在の状態を導出
  deriveState(events) {
    if (events.length === 0) return 'NONE';

    const lastEvent = events[events.length - 1];
    switch (lastEvent.eventType) {
      case 'CLOCK_IN':
        return 'WORKING';
      case 'BREAK_START':
        return 'BREAK';
      case 'BREAK_END':
        return 'WORKING';
      case 'CLOCK_OUT':
        return 'CLOCKED_OUT';
      default:
        return 'NONE';
    }
  }

  // イベントの妥当性を検証
  validateEvent(currentState, eventType) {
    const validTransitions = {
      NONE: ['CLOCK_IN'],
      WORKING: ['BREAK_START', 'CLOCK_OUT'],
      BREAK: ['BREAK_END'],
      CLOCKED_OUT: ['CLOCK_IN'],
    };

    const allowed = validTransitions[currentState] || [];
    if (!allowed.includes(eventType)) {
      return {
        valid: false,
        message: `現在のステータスでは ${eventType} は実行できません。`,
        warnings: [`現在のステータス: ${currentState}`],
      };
    }

    return { valid: true };
  }
}

module.exports = new AttendanceService();

