const API_BASE_URL = '/api';

const state = {
  token: localStorage.getItem('token') || null,
  adminId: '',
  filters: {
    from: null,
    to: null,
    employeeId: ''
  },
  employees: [],
  summary: null,
  attendances: [],
  logs: []
};

document.addEventListener('DOMContentLoaded', init);

function init() {
  // トークンと従業員情報を復元
  const employeeData = localStorage.getItem('employee');
  if (!state.token || !employeeData) {
    alert('管理者セッションが確認できません。ログインし直してください。');
    window.location.href = '/';
    return;
  }

  try {
    const employee = JSON.parse(employeeData);
    if (employee.role !== 'admin') {
      alert('管理者権限が必要です。');
      window.location.href = '/';
      return;
    }
    state.adminId = employee.id;
    document.getElementById('adminId').textContent = `ID: ${employee.id}`;
  } catch (e) {
    alert('セッション情報の読み込みに失敗しました。');
    window.location.href = '/';
    return;
  }

  const form = document.getElementById('adminFilterForm');
  const logoutBtn = document.getElementById('adminLogoutBtn');
  const exportBtn = document.getElementById('exportCsvBtn');
  const addLogBtn = document.getElementById('addLogBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const deleteLogBtn = document.getElementById('deleteLogBtn');
  const editLogForm = document.getElementById('editLogForm');
  const closeEmployeeModalBtn = document.getElementById('closeEmployeeModalBtn');
  const cancelEmployeeEditBtn = document.getElementById('cancelEmployeeEditBtn');
  const editEmployeeForm = document.getElementById('editEmployeeForm');

  setDefaultDates();
  form.addEventListener('submit', handleFilterSubmit);
  logoutBtn.addEventListener('click', handleLogout);
  exportBtn.addEventListener('click', handleExportCsv);
  addLogBtn.addEventListener('click', () => openEditModal(null));
  closeModalBtn.addEventListener('click', closeEditModal);
  cancelEditBtn.addEventListener('click', closeEditModal);
  deleteLogBtn.addEventListener('click', handleDeleteLog);
  editLogForm.addEventListener('submit', handleSaveLog);

  // 従業員編集モーダルのイベントリスナー
  if (closeEmployeeModalBtn) {
    closeEmployeeModalBtn.addEventListener('click', closeEditEmployeeModal);
  }
  if (cancelEmployeeEditBtn) {
    cancelEmployeeEditBtn.addEventListener('click', closeEditEmployeeModal);
  }
  if (editEmployeeForm) {
    editEmployeeForm.addEventListener('submit', handleSaveEmployee);
  }

  // モーダル外クリックで閉じる
  const editModal = document.getElementById('editModal');
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target.id === 'editModal') {
        closeEditModal();
      }
    });
  }
  
  const editEmployeeModal = document.getElementById('editEmployeeModal');
  if (editEmployeeModal) {
    editEmployeeModal.addEventListener('click', (e) => {
      if (e.target.id === 'editEmployeeModal') {
        closeEditEmployeeModal();
      }
    });
  }

  loadEmployees().then(refreshData).catch(handleError);
}

function setDefaultDates() {
  const today = new Date();
  // 開始日と終了日の両方を本日に設定
  state.filters.from = formatInputDate(today);
  state.filters.to = formatInputDate(today);
  const form = document.getElementById('adminFilterForm');
  form.elements.from.value = state.filters.from;
  form.elements.to.value = state.filters.to;
}

function formatInputDate(date) {
  // 日本時間（JST）で日付を取得
  const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function handleFilterSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  state.filters.from = form.elements.from.value;
  state.filters.to = form.elements.to.value;
  state.filters.employeeId = form.elements.employeeId.value;
  refreshData();
}

function handleLogout() {
  state.token = null;
  localStorage.removeItem('token');
  localStorage.removeItem('employee');
  window.location.href = '/';
}

function refreshData() {
  Promise.all([fetchSummary(), fetchAttendances(), fetchLogs()]).catch(handleError);
}

async function callApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Content-Type をチェック
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('非JSONレスポンス:', text.substring(0, 500));
      throw new Error(`サーバーがJSONを返しませんでした (${response.status}): ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      if (response.status === 401) {
        // 認証エラーの場合のみログアウト
        handleLogout();
        throw new Error('UNAUTHORIZED');
      }
      if (response.status === 403) {
        // 権限エラーはログアウトしない（管理者権限が必要なだけ）
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'この操作には管理者権限が必要です');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // ネットワークエラーやその他のエラーをキャッチ
    if (error.message) {
      throw error;
    }
    throw new Error(`API呼び出しエラー: ${error.message || error}`);
  }
}

async function loadEmployees() {
  try {
    const response = await callApi('/admin/employees');
    if (response.status === 'success') {
      state.employees = response.employees || [];
      updateEmployeeSelect();
      updateEmployeeTable();
    }
  } catch (error) {
    console.error('従業員一覧取得エラー:', error);
    if (error.message === 'UNAUTHORIZED') {
      // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
      return;
    }
    // その他のエラーは表示するだけ（ログアウトしない）
    console.error('従業員一覧取得に失敗しました:', error.message);
  }
}

function updateEmployeeSelect() {
  const select = document.getElementById('employeeSelect');
  if (select) {
    select.innerHTML = '<option value="">全員</option>';
    state.employees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.id;
      option.textContent = `${emp.name} (${emp.id})`;
      select.appendChild(option);
    });
  }
}

function updateEmployeeTable() {
  const tbody = document.querySelector('#employeeTable tbody');
  if (!tbody) return;

  if (state.employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-placeholder">データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = state.employees.map(emp => {
    const roleText = emp.role === 'admin' ? '管理者' : '従業員';
    const statusText = emp.isActive ? '有効' : '無効';
    return `
      <tr>
        <td>${emp.id}</td>
        <td>${emp.name}</td>
        <td>${roleText}</td>
        <td>${emp.department || '-'}</td>
        <td>${emp.email || '-'}</td>
        <td>${statusText}</td>
        <td>
          <button class="btn btn-small primary" data-employee-id="${emp.id}" data-action="edit-employee">編集</button>
        </td>
      </tr>
    `;
  }).join('');
  
  // イベントリスナーを設定
  tbody.querySelectorAll('[data-action="edit-employee"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const employeeId = e.target.getAttribute('data-employee-id');
      openEditEmployeeModal(employeeId);
    });
  });
}

async function fetchSummary() {
  try {
    const response = await callApi(`/admin/summary?from=${state.filters.from}&to=${state.filters.to}&employeeId=${state.filters.employeeId}`);
    if (response.status === 'success') {
      state.summary = response.summary || {};
      document.getElementById('summaryWork').textContent = formatMinutes(state.summary.totalWorkMinutes || 0);
      document.getElementById('summaryOvertime').textContent = formatMinutes(state.summary.totalOvertimeMinutes || 0);
      document.getElementById('summaryAverage').textContent = formatMinutes(state.summary.averageWorkMinutes || 0);
      document.getElementById('summaryAlerts').textContent = state.summary.alertCount || 0;
      
      // アラートを表示
      if (response.alerts && response.alerts.length > 0) {
        renderAlerts(response.alerts);
      } else {
        const alertList = document.getElementById('alertList');
        alertList.innerHTML = '<li class="empty">該当なし</li>';
      }
    }
  } catch (error) {
    console.error('サマリー取得エラー:', error);
    if (error.message === 'UNAUTHORIZED') {
      // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
      return;
    }
    // その他のエラーは表示するだけ（ログアウトしない）
    console.error('サマリー取得に失敗しました:', error.message);
  }
}

function renderAlerts(alerts) {
  const alertList = document.getElementById('alertList');
  if (alerts.length === 0) {
    alertList.innerHTML = '<li class="empty">該当なし</li>';
    return;
  }
  
  alertList.innerHTML = alerts.map(alert => 
    `<li>${alert.employeeName} (${alert.employeeId}): ${alert.message}</li>`
  ).join('');
}

async function fetchAttendances() {
  try {
    const response = await callApi(`/admin/attendances?from=${state.filters.from}&to=${state.filters.to}&employeeId=${state.filters.employeeId}`);
    if (response.status === 'success') {
      state.attendances = response.attendances || [];
      renderAttendances(state.attendances);
      document.getElementById('tableCount').textContent = `${response.count || 0}件`;
    }
  } catch (error) {
    console.error('勤怠一覧取得エラー:', error);
    if (error.message === 'UNAUTHORIZED') {
      // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
      return;
    }
    // その他のエラーは表示するだけ（ログアウトしない）
    console.error('勤怠一覧取得に失敗しました:', error.message);
  }
}

function renderAttendances(attendances) {
  const tbody = document.querySelector('#attendanceTable tbody');
  
  if (attendances.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-placeholder">データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = attendances.map(att => {
    // 日付文字列を日本時間として解釈
    const date = new Date(att.date + 'T00:00:00+09:00');
    const dateStr = date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      timeZone: 'Asia/Tokyo'
    });
    
    return `
      <tr>
        <td>${dateStr}</td>
        <td>${att.employeeId}</td>
        <td>${att.employeeName}</td>
        <td>${formatMinutes(att.workMinutes)}</td>
        <td>${formatMinutes(att.breakMinutes)}</td>
        <td>${formatMinutes(att.overtimeMinutes)}</td>
        <td>${att.status}</td>
      </tr>
    `;
  }).join('');
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}時間${mins}分`;
}

function handleExportCsv() {
  // 実装は後で追加
  alert('CSV出力機能は実装中です');
}

// 打刻ログを取得
async function fetchLogs() {
  try {
    const response = await callApi(`/admin/attendance-logs?from=${state.filters.from}&to=${state.filters.to}&employeeId=${state.filters.employeeId}`);
    if (response.status === 'success') {
      state.logs = response.logs || [];
      renderLogs(state.logs);
    }
  } catch (error) {
    console.error('打刻ログ取得エラー:', error);
    if (error.message === 'UNAUTHORIZED') {
      // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
      return;
    }
    // その他のエラーは表示するだけ（ログアウトしない）
    console.error('打刻ログ取得に失敗しました:', error.message);
  }
}

function renderLogs(logs) {
  const tbody = document.querySelector('#logTable tbody');
  
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-placeholder">データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const date = new Date(log.timestamp);
    const dateStr = date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
    
    const eventTypeMap = {
      'CLOCK_IN': '出勤',
      'CLOCK_OUT': '退勤',
      'BREAK_START': '休憩入',
      'BREAK_END': '休憩出'
    };
    
    const statusBadge = log.isEdited 
      ? '<span class="edit-badge" title="修正者: ' + (log.editedBy || '不明') + '&#10;修正日時: ' + (log.editedAt ? new Date(log.editedAt).toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}) : '不明') + '">修正済み</span>' 
      : '<span class="normal-badge">通常</span>';
    
    return `
      <tr>
        <td>${dateStr}</td>
        <td>${log.employeeId}</td>
        <td>${log.employeeName}</td>
        <td>${eventTypeMap[log.eventType] || log.eventType}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-small primary" data-row-number="${log.rowNumber}" data-action="edit-attendance-log">編集</button>
        </td>
      </tr>
    `;
  }).join('');
  
  // イベントリスナーを設定
  tbody.querySelectorAll('[data-action="edit-attendance-log"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rowNumber = parseInt(e.target.getAttribute('data-row-number'));
      openEditModal(rowNumber);
    });
  });
}

function openEditModal(rowNumber) {
  const modal = document.getElementById('editModal');
  const form = document.getElementById('editLogForm');
  const editRowNumber = document.getElementById('editRowNumber');
  const editEmployeeId = document.getElementById('editEmployeeId');
  const editEventType = document.getElementById('editEventType');
  const editTimestamp = document.getElementById('editTimestamp');
  const deleteBtn = document.getElementById('deleteLogBtn');
  const modalTitle = document.getElementById('modalTitle');

  // 従業員選択肢を設定
  editEmployeeId.innerHTML = '<option value="">選択してください</option>';
  state.employees.forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.id;
    option.textContent = `${emp.name} (${emp.id})`;
    editEmployeeId.appendChild(option);
  });

  if (rowNumber) {
    // 編集モード
    const log = state.logs.find(l => l.rowNumber === rowNumber);
    if (!log) {
      alert('打刻ログが見つかりません');
      return;
    }

    modalTitle.textContent = '打刻を編集';
    editRowNumber.value = rowNumber;
    editEmployeeId.value = log.employeeId;
    editEventType.value = log.eventType;
    
    // UTCタイムスタンプを日本時間のdatetime-local形式に変換
    const date = new Date(log.timestamp);
    const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    const year = jstDate.getFullYear();
    const month = String(jstDate.getMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getDate()).padStart(2, '0');
    const hours = String(jstDate.getHours()).padStart(2, '0');
    const minutes = String(jstDate.getMinutes()).padStart(2, '0');
    editTimestamp.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    const editReason = document.getElementById('editReason');
    if (editReason) {
      editReason.value = log.editReason || '';
    }
    
    deleteBtn.style.display = 'block';
  } else {
    // 新規追加モード
    modalTitle.textContent = '打刻を追加';
    editRowNumber.value = '';
    editEmployeeId.value = '';
    editEventType.value = 'CLOCK_IN';
    const now = new Date();
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const year = jstDate.getFullYear();
    const month = String(jstDate.getMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getDate()).padStart(2, '0');
    const hours = String(jstDate.getHours()).padStart(2, '0');
    const minutes = String(jstDate.getMinutes()).padStart(2, '0');
    editTimestamp.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    deleteBtn.style.display = 'none';
  }

  modal.style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

async function handleSaveLog(event) {
  event.preventDefault();
  
  const rowNumber = document.getElementById('editRowNumber').value;
  const employeeId = document.getElementById('editEmployeeId').value;
  const eventType = document.getElementById('editEventType').value;
  const timestampLocal = document.getElementById('editTimestamp').value;
  const editReason = document.getElementById('editReason') ? document.getElementById('editReason').value : '';

  // 日本時間のdatetime-localをUTCに変換
  const localDate = new Date(timestampLocal);
  const utcDate = new Date(localDate.getTime() - (9 * 60 * 60 * 1000));
  const timestamp = utcDate.toISOString();

  try {
    if (rowNumber) {
      // 更新
      await callApi(`/admin/attendance-logs/${rowNumber}`, {
        method: 'PUT',
        body: JSON.stringify({
          employeeId,
          eventType,
          timestamp,
          clientTs: timestamp,
          deviceInfo: '管理者による手動修正',
          editedBy: state.adminId,
          editedAt: new Date().toISOString(),
          editReason: editReason || '管理者による修正'
        })
      });
      alert('打刻ログを更新しました');
    } else {
      // 追加
      await callApi('/admin/attendance-logs', {
        method: 'POST',
        body: JSON.stringify({
          employeeId,
          eventType,
          timestamp,
          clientTs: timestamp,
          deviceInfo: '管理者による手動追加'
        })
      });
      alert('打刻ログを追加しました');
    }
    
    // 更新後にログイン情報が保持されているか確認
    if (!state.token) {
      console.error('更新後にログイン情報が失われました');
      return;
    }
    
    closeEditModal();
    
    // エラーが発生してもログアウトしないように個別にエラーハンドリング
    if (state.token) {
      try {
        refreshData();
      } catch (error) {
        console.error('データ更新エラー:', error);
        // エラーを無視（ログアウトしない）
        if (error.message === 'UNAUTHORIZED') {
          // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
          return;
        }
      }
    }
  } catch (error) {
    console.error('保存エラー:', error);
    if (error.message === 'UNAUTHORIZED') {
      // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
      return;
    }
    alert('保存に失敗しました: ' + error.message);
  }
}

async function handleDeleteLog() {
  const rowNumber = document.getElementById('editRowNumber').value;
  if (!rowNumber) return;

  if (!confirm('この打刻ログを削除しますか？この操作は取り消せません。')) {
    return;
  }

  try {
    await callApi(`/admin/attendance-logs/${rowNumber}`, {
      method: 'DELETE'
    });
    
    // 削除後にログイン情報が保持されているか確認
    if (!state.token) {
      console.error('削除後にログイン情報が失われました');
      return;
    }
    
    alert('打刻ログを削除しました');
    closeEditModal();
    
    // エラーが発生してもログアウトしないように個別にエラーハンドリング
    if (state.token) {
      try {
        refreshData();
      } catch (error) {
        console.error('データ更新エラー:', error);
        // エラーを無視（ログアウトしない）
        if (error.message === 'UNAUTHORIZED') {
          // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
          return;
        }
      }
    }
  } catch (error) {
    console.error('削除エラー:', error);
    if (error.message === 'UNAUTHORIZED') {
      // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
      return;
    }
    alert('削除に失敗しました: ' + error.message);
  }
}

// 従業員編集モーダルを開く
function openEditEmployeeModal(employeeId) {
  const employee = state.employees.find(emp => emp.id === employeeId);
  if (!employee) {
    alert('従業員が見つかりません');
    return;
  }

  document.getElementById('editEmployeeId').value = employee.id;
  document.getElementById('editEmployeeName').value = employee.name || '';
  document.getElementById('editEmployeeRole').value = employee.role || 'employee';
  document.getElementById('editEmployeeDepartment').value = employee.department || '';
  document.getElementById('editEmployeeEmail').value = employee.email || '';
  document.getElementById('editEmployeePassword').value = '';
  document.getElementById('editEmployeeIsActive').checked = employee.isActive !== false;

  const modal = document.getElementById('editEmployeeModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

// 従業員編集モーダルを閉じる
function closeEditEmployeeModal() {
  const modal = document.getElementById('editEmployeeModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 従業員情報を保存
async function handleSaveEmployee(event) {
  event.preventDefault();
  
  const employeeId = document.getElementById('editEmployeeId').value;
  const name = document.getElementById('editEmployeeName').value;
  const role = document.getElementById('editEmployeeRole').value;
  const department = document.getElementById('editEmployeeDepartment').value;
  const email = document.getElementById('editEmployeeEmail').value;
  const password = document.getElementById('editEmployeePassword').value;
  const isActive = document.getElementById('editEmployeeIsActive').checked;

  try {
    const updateData = {
      name,
      role,
      department,
      email,
      isActive
    };
    
    if (password) {
      updateData.password = password;
    }

    await callApi(`/admin/employees/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    
    // 更新後にログイン情報が保持されているか確認
    if (!state.token) {
      console.error('更新後にログイン情報が失われました');
      return;
    }
    
    alert('従業員情報を更新しました');
    closeEditEmployeeModal();
    
    // エラーが発生してもログアウトしないように個別にエラーハンドリング
    if (state.token) {
      try {
        // 従業員一覧を再読み込み
        await loadEmployees();
      } catch (error) {
        console.error('従業員一覧再読み込みエラー:', error);
        // エラーを無視（ログアウトしない）
        if (error.message === 'UNAUTHORIZED') {
          // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
          return;
        }
      }
      
      if (state.token) {
        try {
          // 他のデータも更新（従業員選択リストなど）
          refreshData();
        } catch (error) {
          console.error('データ更新エラー:', error);
          // エラーを無視（ログアウトしない）
          if (error.message === 'UNAUTHORIZED') {
            // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
            return;
          }
        }
      }
    }
  } catch (error) {
    console.error('保存エラー:', error);
    if (error.message === 'UNAUTHORIZED') {
      // 認証エラーの場合のみログアウト（既にhandleLogoutが呼ばれている）
      return;
    }
    alert('保存に失敗しました: ' + error.message);
  }
}

// グローバルスコープに公開（HTMLのonclickから呼び出すため）
window.openEditModal = openEditModal;
window.openEditEmployeeModal = openEditEmployeeModal;

function handleError(error) {
  console.error('エラー:', error);
  alert('エラーが発生しました: ' + error.message);
}

