/**
 * HTML テンプレートを評価するレンダラー。
 */
const HtmlRenderer = (() => {
  function renderLoginPage() {
    const template = HtmlService.createTemplateFromFile('HtmlService/main');
    template.initialPage = 'login';
    template.initialToken = '';
    template.employeeName = '';
    template.employeeId = '';
    return template.evaluate().setTitle('勤怠管理 - ログイン');
  }

  function renderClockPage(session) {
    const template = HtmlService.createTemplateFromFile('HtmlService/main');
    const employee = SpreadsheetRepository.getEmployeeById(session.employeeId);
    template.employeeName = employee ? employee.name : session.employeeId;
    template.employeeId = session.employeeId;
    template.initialPage = 'clock';
    template.initialToken = session.token;
    return template.evaluate().setTitle('勤怠管理 - 打刻');
  }

  function renderAdminPage(session) {
    const template = HtmlService.createTemplateFromFile('HtmlService/admin');
    template.adminId = session.employeeId;
    template.adminToken = session.token;
    return template.evaluate().setTitle('勤怠管理 - 管理者');
  }

  return {
    renderLoginPage,
    renderClockPage,
    renderAdminPage
  };
})();

