/**
 * 管理者向けAPIサービス。
 */
const AdminService = (() => {
  function ensureAdminSession(token) {
    const session = SessionService.validate(token);
    if (!session || session.role !== 'admin') {
      throw new Error('UNAUTHORIZED');
    }
    return session;
  }

  function getSummary(payload) {
    try {
      const session = ensureAdminSession(payload.token);
      const summaries = SpreadsheetRepository.fetchDailySummaries(
        payload.from,
        payload.to,
        payload.employeeId
      );
      const totalWork = sumBy(summaries, 'workMinutes');
      const totalOvertime = sumBy(summaries, 'overtimeMinutes');
      const totalBreak = sumBy(summaries, 'breakMinutes');
      const average = summaries.length ? Math.round(totalWork / summaries.length) : 0;
      const alerts = SpreadsheetRepository.fetchAlerts(payload.from, payload.to, payload.employeeId).map(alert => ({
        date: alert.date,
        employeeId: alert.employeeId,
        employeeName: alert.employeeName,
        message: alert.notes || alert.status || '要確認'
      }));

      return {
        status: 'success',
        adminId: session.employeeId,
        data: {
          totalWorkMinutes: totalWork,
          totalOvertimeMinutes: totalOvertime,
          totalBreakMinutes: totalBreak,
          averageWorkMinutes: average,
          alertCount: alerts.length
        },
        alerts: alerts
      };
    } catch (error) {
      return handleError(error);
    }
  }

  function getAttendances(payload) {
    try {
      ensureAdminSession(payload.token);
      const summaries = SpreadsheetRepository.fetchDailySummaries(
        payload.from,
        payload.to,
        payload.employeeId
      );
      return {
        status: 'success',
        data: summaries
      };
    } catch (error) {
      return handleError(error);
    }
  }

  function getEmployees(payload) {
    try {
      ensureAdminSession(payload.token);
      const employees = SpreadsheetRepository.getAllEmployees(false).map(emp => ({
        employeeId: emp.employeeId,
        name: emp.name,
        role: emp.role
      }));
      return {
        status: 'success',
        data: employees
      };
    } catch (error) {
      return handleError(error);
    }
  }

  function updateAttendance(payload) {
    try {
      const session = ensureAdminSession(payload.token);
      if (!payload.adjustment) {
        throw new Error('INVALID_ADJUSTMENT');
      }
      const result = SpreadsheetRepository.applyAttendanceAdjustment(payload.adjustment, session.employeeId);
      return {
        status: 'success',
        data: result
      };
    } catch (error) {
      return handleError(error);
    }
  }

  function handleError(error) {
    const code = error.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'INTERNAL_ERROR';
    return {
      status: 'error',
      code,
      message: error.message
    };
  }

  function sumBy(list, key) {
    return list.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
  }

  return {
    getSummary,
    getAttendances,
    getEmployees,
    updateAttendance
  };
})();

