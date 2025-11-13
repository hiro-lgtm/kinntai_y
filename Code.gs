/**
 * メインエントリーポイント。リクエストを受けて適切なページまたはAPIレスポンスを返す。
 */
function doGet(e) {
  const session = SessionService.validateFromRequest(e);
  const page = (e && e.parameter && e.parameter.page) || 'login';

  if (!session && page !== 'login') {
    return HtmlRenderer.renderLoginPage();
  }

  switch (page) {
    case 'clock':
      return HtmlRenderer.renderClockPage(session);
    case 'admin':
      return HtmlRenderer.renderAdminPage(session);
    default:
      return HtmlRenderer.renderLoginPage();
  }
}

/**
 * JSON API 形式のリクエストを処理する。
 */
function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty request body');
  }

  const payload = JSON.parse(e.postData.contents);

  return buildJsonResponse(dispatchAction(payload));
}

/**
 * クライアントサイドから google.script.run で呼び出せるエントリーポイント。
 */
function handleApi(payloadJson) {
  const payload = typeof payloadJson === 'string' ? JSON.parse(payloadJson) : payloadJson;
  return dispatchAction(payload);
}

function dispatchAction(payload) {
  switch (payload.action) {
    case 'LOGIN':
      return LoginService.login(payload);
    case 'CLOCK_EVENT':
      return AttendanceService.registerEvent(payload);
    case 'FETCH_STATUS':
      return AttendanceService.fetchStatus(payload);
    case 'ADMIN_SUMMARY':
      return AdminService.getSummary(payload);
    case 'ADMIN_ATTENDANCES':
      return AdminService.getAttendances(payload);
    case 'ADMIN_EMPLOYEES':
      return AdminService.getEmployees(payload);
    case 'ADMIN_UPDATE_ATTENDANCE':
      return AdminService.updateAttendance(payload);
    default:
      return {
        status: 'error',
        code: 'UNSUPPORTED_ACTION'
      };
  }
}

/**
 * JSON レスポンスを作成するヘルパー。
 */
function buildJsonResponse(body, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(body));
  output.setMimeType(ContentService.MimeType.JSON);
  if (statusCode) {
    output.setContent(JSON.stringify(
      Object.assign({}, body, { statusCode: statusCode })
    ));
  }
  return output;
}

