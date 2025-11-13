const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const repository = require('../services/SpreadsheetRepository');
const summaryService = require('../services/SummaryService');

// 全従業員を取得
router.get('/employees', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    console.log('[GET /api/admin/employees] リクエスト受信');
    const employees = await repository.getAllEmployees();
    console.log(`[GET /api/admin/employees] 取得した従業員数: ${employees.length}`);
    res.json({
      status: 'success',
      employees,
    });
  } catch (error) {
    console.error('従業員一覧取得エラー:', error);
    console.error('エラースタック:', error.stack);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: '従業員一覧の取得に失敗しました',
      details: error.message,
    });
  }
});

// サマリーを取得
router.get('/summary', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_PARAMS',
        message: '期間の開始日と終了日が必要です',
      });
    }

    const dailySummaries = await repository.getDailySummaries(from, to, employeeId || null);
    const employees = await repository.getAllEmployees();
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // 各日のサマリーを計算
    const calculatedSummaries = dailySummaries.map(day => {
      const summary = summaryService.calculateDaily(day.events);
      const employee = employeeMap.get(day.employeeId);
      return {
        date: day.date,
        employeeId: day.employeeId,
        employeeName: employee ? employee.name : day.employeeId,
        ...summary,
      };
    });

    // 全体の集計
    const aggregated = summaryService.aggregateSummaries(calculatedSummaries);

    // アラート（退勤忘れなど）を検出
    const alerts = [];
    const today = new Date().toISOString().split('T')[0];
    const todaySummaries = calculatedSummaries.filter(s => s.date === today);
    todaySummaries.forEach(summary => {
      const dayEvents = dailySummaries.find(d => d.employeeId === summary.employeeId && d.date === today);
      if (dayEvents) {
        const hasClockIn = dayEvents.events.some(e => e.eventType === 'CLOCK_IN');
        const hasClockOut = dayEvents.events.some(e => e.eventType === 'CLOCK_OUT');
        if (hasClockIn && !hasClockOut) {
          alerts.push({
            employeeId: summary.employeeId,
            employeeName: summary.employeeName,
            message: '退勤打刻が未登録です',
          });
        }
      }
    });

    res.json({
      status: 'success',
      summary: {
        ...aggregated,
        alertCount: alerts.length,
      },
      alerts,
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

// 勤怠一覧を取得
router.get('/attendances', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;
    
    console.log(`[GET /api/admin/attendances] リクエスト: from=${from}, to=${to}, employeeId=${employeeId || 'なし'}`);
    
    if (!from || !to) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_PARAMS',
        message: '期間の開始日と終了日が必要です',
      });
    }

    const dailySummaries = await repository.getDailySummaries(from, to, employeeId || null);
    console.log(`[GET /api/admin/attendances] 日次サマリー数: ${dailySummaries.length}`);
    
    const employees = await repository.getAllEmployees();
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // 各日のサマリーを計算
    const attendances = dailySummaries.map(day => {
      const summary = summaryService.calculateDaily(day.events);
      const employee = employeeMap.get(day.employeeId);
      return {
        date: day.date,
        employeeId: day.employeeId,
        employeeName: employee ? employee.name : day.employeeId,
        workMinutes: summary.workMinutes,
        breakMinutes: summary.breakMinutes,
        overtimeMinutes: summary.overtimeMinutes,
        status: day.events.length > 0 ? '出勤' : '未出勤',
      };
    });

    console.log(`[GET /api/admin/attendances] レスポンス: ${attendances.length}件`);

    res.json({
      status: 'success',
      attendances,
      count: attendances.length,
    });
  } catch (error) {
    console.error('勤怠一覧取得エラー:', error);
    console.error('エラースタック:', error.stack);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: '勤怠一覧の取得に失敗しました',
    });
  }
});

// 打刻ログ一覧を取得（編集・削除用）
router.get('/attendance-logs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_PARAMS',
        message: '期間の開始日と終了日が必要です',
      });
    }

    const logs = await repository.getAttendanceLogsWithRowNumbers(from, to, employeeId || null);
    const employees = await repository.getAllEmployees();
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    const logsWithNames = logs.map(log => {
      const employee = employeeMap.get(log.employeeId);
      return {
        ...log,
        employeeName: employee ? employee.name : log.employeeId,
      };
    });

    res.json({
      status: 'success',
      logs: logsWithNames,
      count: logsWithNames.length,
    });
  } catch (error) {
    console.error('打刻ログ取得エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: '打刻ログの取得に失敗しました',
    });
  }
});

// 打刻ログを削除
router.delete('/attendance-logs/:rowNumber', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber);
    if (isNaN(rowNumber) || rowNumber < 2) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_PARAMS',
        message: '無効な行番号です',
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

// 打刻ログを更新
router.put('/attendance-logs/:rowNumber', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber);
    if (isNaN(rowNumber) || rowNumber < 2) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_PARAMS',
        message: '無効な行番号です',
      });
    }

    const { employeeId, eventType, timestamp, clientTs, deviceInfo, editedBy, editedAt, editReason } = req.body;
    
    if (!employeeId || !eventType || !timestamp) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_PARAMS',
        message: '必須項目が不足しています',
      });
    }

    await repository.updateAttendanceLog(rowNumber, {
      employeeId,
      eventType,
      timestamp,
      clientTs: clientTs || timestamp,
      deviceInfo: deviceInfo || '',
      editedBy: editedBy || req.user.employeeId,
      editedAt: editedAt || new Date().toISOString(),
      editReason: editReason || '管理者による修正',
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

// 打刻ログを追加（管理者用）
router.post('/attendance-logs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { employeeId, eventType, timestamp, clientTs, deviceInfo } = req.body;
    
    if (!employeeId || !eventType || !timestamp) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_PARAMS',
        message: '必須項目が不足しています',
      });
    }

    await repository.appendAttendanceLog({
      employeeId,
      eventType,
      timestamp,
      clientTs: clientTs || timestamp,
      deviceInfo: deviceInfo || '管理者による手動追加',
    });

    res.json({
      status: 'success',
      message: '打刻ログを追加しました',
    });
  } catch (error) {
    console.error('打刻ログ追加エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: '打刻ログの追加に失敗しました',
    });
  }
});

// 従業員情報を更新
router.put('/employees/:employeeId', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { name, role, department, email, password, isActive } = req.body;

    // パスワードが提供されている場合はハッシュ化
    let passwordHash = null;
    if (password) {
      const authService = require('../services/AuthService');
      passwordHash = await authService.hashPassword(password);
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (email !== undefined) updateData.email = email;
    if (passwordHash) updateData.passwordHash = passwordHash;
    if (isActive !== undefined) updateData.isActive = isActive;

    await repository.updateEmployee(employeeId, updateData);

    res.json({
      status: 'success',
      message: '従業員情報を更新しました',
    });
  } catch (error) {
    console.error('従業員情報更新エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: '従業員情報の更新に失敗しました',
      details: error.message,
    });
  }
});

module.exports = router;

