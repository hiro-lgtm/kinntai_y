/**
 * ログイン処理を司るサービス。
 */
const LoginService = (() => {
  function login(payload) {
    const employeeId = (payload.employeeId || '').trim();
    const password = payload.password || '';

    if (!employeeId || !password) {
      return { status: 'error', code: 'INVALID_INPUT' };
    }

    const employee = SpreadsheetRepository.getEmployeeById(employeeId);
    if (!employee || !employee.isActive) {
      return { status: 'error', code: 'NOT_FOUND' };
    }

    if (!UtilitiesService.compareHash(password, employee.passwordHash)) {
      return { status: 'error', code: 'INVALID_PASSWORD' };
    }

    const token = SessionService.create(employee.employeeId, employee.role);

    return {
      status: 'success',
      token,
      employee: {
        id: employee.employeeId,
        name: employee.name,
        role: employee.role
      }
    };
  }

  return {
    login
  };
})();

