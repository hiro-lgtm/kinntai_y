/**
 * セッション管理を担うサービス。
 */
const SessionService = (() => {
  const TOKEN_TTL_MINUTES = 30;
  const cache = CacheService.getScriptCache();

  /**
   * セッションを新規作成する。
   */
  function create(employeeId, role) {
    const token = Utilities.getUuid();
    const sessionData = JSON.stringify({
      employeeId,
      role,
      issuedAt: Date.now()
    });
    cache.put(token, sessionData, TOKEN_TTL_MINUTES * 60);
    return token;
  }

  /**
   * トークンを検証する。
   */
  function validate(token) {
    if (!token) {
      return null;
    }

    const sessionJson = cache.get(token);
    if (!sessionJson) {
      return null;
    }

    const session = JSON.parse(sessionJson);
    const isExpired = Date.now() - session.issuedAt > TOKEN_TTL_MINUTES * 60 * 1000;
    if (isExpired) {
      cache.remove(token);
      return null;
    }

    session.token = token;
    return session;
  }

  /**
   * リクエストパラメータからセッションを検証する。
   */
  function validateFromRequest(e) {
    if (!e || !e.parameter || !e.parameter.token) {
      return null;
    }
    return validate(e.parameter.token);
  }

  return {
    create,
    validate,
    validateFromRequest
  };
})();

