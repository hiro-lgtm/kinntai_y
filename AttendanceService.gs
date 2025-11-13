/**
 * 打刻処理と状態取得を担当するサービス。
 */
const AttendanceService = (() => {
  function registerEvent(payload) {
    const session = SessionService.validate(payload.token);
    if (!session || session.employeeId !== payload.employeeId) {
      return { status: 'error', code: 'SESSION_INVALID' };
    }

    const eventType = payload.eventType;
    const validation = validateEvent(session.employeeId, eventType);
    if (!validation.ok) {
      return {
        status: 'error',
        code: validation.code,
        warnings: validation.warnings || []
      };
    }

    SpreadsheetRepository.appendAttendanceLog({
      employeeId: session.employeeId,
      eventType,
      clientTs: payload.clientTs,
      deviceInfo: payload.deviceInfo
    });

    SummaryService.updateDaily(session.employeeId, new Date());

    return fetchStatus({
      employeeId: session.employeeId,
      token: payload.token
    });
  }

  function fetchStatus(payload) {
    const session = SessionService.validate(payload.token);
    if (!session || session.employeeId !== payload.employeeId) {
      return { status: 'error', code: 'SESSION_INVALID' };
    }

    const today = new Date();
    const recentEvents = SpreadsheetRepository.getRecentEvents(session.employeeId);
    const todayLogs = SpreadsheetRepository.getEventsForDate(session.employeeId, today);
    const currentState = deriveState(recentEvents);

    return {
      status: 'success',
      currentState,
      recentEvents: recentEvents,
      todayLog: todayLogs,
      warnings: []
    };
  }

  function validateEvent(employeeId, eventType) {
    const latestEvent = SpreadsheetRepository.getLatestEvent(employeeId);
    const currentState = deriveState(latestEvent ? [latestEvent] : []);
    const allowedMap = {
      NONE: ['CLOCK_IN'],
      WORKING: ['BREAK_START', 'CLOCK_OUT'],
      BREAK: ['BREAK_END'],
      CLOCKED_OUT: []
    };

    const allowed = allowedMap[currentState] || [];
    if (!allowed.includes(eventType)) {
      return {
        ok: false,
        code: 'INVALID_SEQUENCE',
        warnings: [`現在のステータスでは ${eventType} は実行できません。`]
      };
    }

    return {
      ok: true,
      code: 'OK',
      nextState: deriveState([{ eventType }])
    };
  }

  function deriveState(events) {
    if (!events || events.length === 0) {
      return 'NONE';
    }

    const latest = events[0];
    switch (latest.eventType) {
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

  return {
    registerEvent,
    fetchStatus
  };
})();

