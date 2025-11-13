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

// 自分の打刻ログを取得（修正用）
router.get('/my-logs', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const repository = require('../services/SpreadsheetRepository');
    
    console.log(`[GET /api/attendance/my-logs] リクエスト: from=${from}, to=${to}, employeeId=${req.user.employeeId}`);
    
    if (!from || !to) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_PARAMS',
        message: '期間の開始日と終了日が必要です',
      });
    }

    const logs = await repository.getAttendanceLogsWithRowNumbers(from, to, req.user.employeeId);
    
    console.log(`[GET /api/attendance/my-logs] 取得したログ数: ${logs.length}`);
    
    res.json({
      status: 'success',
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('[GET /api/attendance/my-logs] 打刻ログ取得エラー:', error);
    console.error('[GET /api/attendance/my-logs] エラースタック:', error.stack);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: '打刻ログの取得に失敗しました',
      details: error.message,
    });
  }
});

// 自分の打刻ログを更新（従業員用）
router.put('/my-logs/:rowNumber', authenticateToken, async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber);
    if (isNaN(rowNumber) || rowNumber < 2) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_PARAMS',
        message: '無効な行番号です',
      });
    }

    const { eventType, timestamp, editReason } = req.body;
    const repository = require('../services/SpreadsheetRepository');
    
    if (!eventType || !timestamp) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_PARAMS',
        message: '必須項目が不足しています',
      });
    }

    // 自分の打刻か確認
    const logs = await repository.getAttendanceLogsWithRowNumbers(
      new Date().toISOString().split('T')[0],
      new Date().toISOString().split('T')[0],
      req.user.employeeId
    );
    const log = logs.find(l => l.rowNumber === rowNumber);
    
    if (!log) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: '自分の打刻のみ修正できます',
      });
    }

    await repository.updateAttendanceLog(rowNumber, {
      employeeId: req.user.employeeId,
      eventType,
      timestamp,
      clientTs: timestamp,
      deviceInfo: '従業員による手動修正',
      editedBy: req.user.employeeId,
      editedAt: new Date().toISOString(),
      editReason: editReason || '従業員による修正',
    });

    res.json({
      status: 'success',
      message: '打刻ログを更新しました',
    });
  } catch (error) {
    console.error('打刻ログ更新エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: '打刻ログの更新に失敗しました',
    });
  }
});

// 自分の打刻ログを削除（従業員用）
router.delete('/my-logs/:rowNumber', authenticateToken, async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber);
    if (isNaN(rowNumber) || rowNumber < 2) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_PARAMS',
        message: '無効な行番号です',
      });
    }

    const repository = require('../services/SpreadsheetRepository');
    
    // 自分の打刻か確認
    const logs = await repository.getAttendanceLogsWithRowNumbers(
      new Date().toISOString().split('T')[0],
      new Date().toISOString().split('T')[0],
      req.user.employeeId
    );
    const log = logs.find(l => l.rowNumber === rowNumber);
    
    if (!log) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: '自分の打刻のみ削除できます',
      });
    }

    await repository.deleteAttendanceLog(rowNumber);
    res.json({
      status: 'success',
      message: '打刻ログを削除しました',
    });
  } catch (error) {
    console.error('打刻ログ削除エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: '打刻ログの削除に失敗しました',
    });
  }
});

module.exports = router;

