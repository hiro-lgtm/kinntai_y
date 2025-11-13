/**
 * 勤怠集計サービス。
 */
const SummaryService = (() => {
  function updateDaily(employeeId, date) {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const events = SpreadsheetRepository.getEventsForDate(employeeId, target);
    const summary = calculateDaily(events);
    SpreadsheetRepository.upsertDailySummary(employeeId, target, summary);
  }

  function calculateDaily(events) {
    let workMinutes = 0;
    let breakMinutes = 0;

    let clockIn = null;
    let breakStart = null;

    events.forEach(event => {
      const timestamp = new Date(event.timestamp);
      switch (event.eventType) {
        case 'CLOCK_IN':
          clockIn = timestamp;
          breakStart = null;
          break;
        case 'BREAK_START':
          if (clockIn) {
            breakStart = timestamp;
          }
          break;
        case 'BREAK_END':
          if (breakStart) {
            breakMinutes += minutesDiff(breakStart, timestamp);
            breakStart = null;
          }
          break;
        case 'CLOCK_OUT':
          if (clockIn) {
            workMinutes += minutesDiff(clockIn, timestamp);
            clockIn = null;
          }
          break;
        default:
          break;
      }
    });

    const regularMinutes = 8 * 60;
    const overtimeMinutes = Math.max(0, workMinutes - breakMinutes - regularMinutes);

    return {
      workMinutes,
      breakMinutes,
      overtimeMinutes,
      lateMinutes: 0,
      earlyleaveMinutes: 0,
      status: 'OK',
      notes: ''
    };
  }

  function minutesDiff(start, end) {
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  return {
    updateDaily,
    calculateDaily
  };
})();

