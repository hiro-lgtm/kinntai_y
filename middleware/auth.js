const authService = require('../services/AuthService');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'トークンが提供されていません',
    });
  }

  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: '無効または期限切れのトークンです',
    });
  }

  req.user = decoded;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: 'この操作には管理者権限が必要です',
      });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole };

