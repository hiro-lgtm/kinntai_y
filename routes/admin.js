const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const repository = require('../services/SpreadsheetRepository');

// 全従業員を取得
router.get('/employees', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const employees = await repository.getAllEmployees();
    res.json({
      status: 'success',
      employees,
    });
  } catch (error) {
    console.error('従業員一覧取得エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: '従業員一覧の取得に失敗しました',
    });
  }
});

// サマリーを取得（簡易版）
router.get('/summary', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;
    // 実装は後で追加
    res.json({
      status: 'success',
      summary: {
        totalWorkMinutes: 0,
        totalOvertimeMinutes: 0,
        averageWorkMinutes: 0,
        alertCount: 0,
      },
    });
  } catch (error) {
    console.error('サマリー取得エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'サマリーの取得に失敗しました',
    });
  }
});

module.exports = router;

