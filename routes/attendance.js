const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const attendanceService = require('../services/AttendanceService');

// 現在のステータスを取得
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await attendanceService.fetchStatus(req.user.employeeId);
    res.json(result);
  } catch (error) {
    console.error('ステータス取得エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'ステータスの取得に失敗しました',
    });
  }
});

// イベントを登録
router.post('/event', authenticateToken, async (req, res) => {
  try {
    const { eventType, clientTs, deviceInfo } = req.body;

    if (!eventType) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_EVENT_TYPE',
        message: 'イベントタイプが必要です',
      });
    }

    const result = await attendanceService.registerEvent(
      req.user.employeeId,
      eventType,
      clientTs,
      deviceInfo
    );

    if (result.status === 'error') {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('イベント登録エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'イベントの登録に失敗しました',
    });
  }
});

module.exports = router;

