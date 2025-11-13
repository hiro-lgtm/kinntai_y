class SummaryService {
  // 分単位の差分を計算
  minutesDiff(start, end) {
    return Math.floor((end - start) / (1000 * 60));
  }

  // 1日のイベントからサマリーを計算
  calculateDaily(events) {
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
            // 休憩開始までの勤務時間を加算
            workMinutes += this.minutesDiff(clockIn, timestamp);
            breakStart = timestamp;
            clockIn = null; // 休憩中は勤務時間をカウントしない
          }
          break;
        case 'BREAK_END':
          if (breakStart) {
            breakMinutes += this.minutesDiff(breakStart, timestamp);
            clockIn = timestamp; // 休憩終了後、再び勤務開始
          }
          break;
        case 'CLOCK_OUT':
          if (clockIn) {
            workMinutes += this.minutesDiff(clockIn, timestamp);
          }
          clockIn = null;
          breakStart = null;
          break;
        default:
          break;
      }
    });

    // 退勤していない場合（勤務中の場合）
    if (clockIn) {
      const now = new Date();
      workMinutes += this.minutesDiff(clockIn, now);
    }

    // 残業時間の計算（1日8時間 = 480分を超えた分）
    const standardWorkMinutes = 480;
    const overtimeMinutes = Math.max(0, workMinutes - standardWorkMinutes);

    return {
      workMinutes,
      breakMinutes,
      overtimeMinutes,
    };
  }

  // 複数日のサマリーを集計
  aggregateSummaries(dailySummaries) {
    const total = dailySummaries.reduce(
      (acc, day) => ({
        workMinutes: acc.workMinutes + (day.workMinutes || 0),
        breakMinutes: acc.breakMinutes + (day.breakMinutes || 0),
        overtimeMinutes: acc.overtimeMinutes + (day.overtimeMinutes || 0),
      }),
      { workMinutes: 0, breakMinutes: 0, overtimeMinutes: 0 }
    );

    const count = dailySummaries.length;
    return {
      totalWorkMinutes: total.workMinutes,
      totalBreakMinutes: total.breakMinutes,
      totalOvertimeMinutes: total.overtimeMinutes,
      averageWorkMinutes: count > 0 ? Math.floor(total.workMinutes / count) : 0,
    };
  }
}

module.exports = new SummaryService();

