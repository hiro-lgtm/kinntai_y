const express = require('express');
const router = express.Router();
const authService = require('../services/AuthService');

// ログイン
router.post('/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_CREDENTIALS',
        message: '社員IDとパスワードが必要です',
      });
    }

    const result = await authService.login(employeeId, password);
    res.json({
      status: 'success',
      ...result,
    });
  } catch (error) {
    console.error('ログインエラー:', error);
    const code = error.message === 'INVALID_CREDENTIALS' ? 'INVALID_CREDENTIALS' : 'LOGIN_ERROR';
    res.status(401).json({
      status: 'error',
      code,
      message: error.message === 'INVALID_CREDENTIALS' ? '社員IDまたはパスワードが正しくありません' : 'ログインに失敗しました',
    });
  }
});

module.exports = router;

