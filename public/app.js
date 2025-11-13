const API_BASE_URL = '/api';

// トークンから従業員IDを取得（簡易的なデコード、検証はサーバー側で行われる）
function getEmployeeIdFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.employeeId || null;
  } catch (e) {
    return null;
  }
}

const state = {
  token: localStorage.getItem('token') || null,
  employee: null,
  currentState: 'NONE',
  myLogs: []
};

let clockIntervalId = null;

document.addEventListener('DOMContentLoaded', init);

function init() {
  const loginPage = document.querySelector('.login-page');
  const clockPage = document.querySelector('.clock-page');
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  const logoutBtn = document.getElementById('logoutBtn');
  const buttons = document.querySelectorAll('.buttons-grid button');

  // 既存のトークンでログイン状態を復元
  if (state.token) {
    const employeeData = localStorage.getItem('employee');
    if (employeeData) {
      try {
        state.employee = JSON.parse(employeeData);
        showPage('clock');
        startClock();
        fetchStatus();
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        state.token = null;
      }
    }
  }

  function showPage(page) {
    loginPage.classList.toggle('active', page === 'login');
    clockPage.classList.toggle('active', page === 'clock');
  }

  function startClock() {
    stopClock();
    updateClock();
    clockIntervalId = setInterval(updateClock, 30000);
  }

  function stopClock() {
    if (clockIntervalId) {
      clearInterval(clockIntervalId);
      clockIntervalId = null;
    }
  }

  function updateClock() {
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      timeZone: 'Asia/Tokyo'
    });
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
  }

  function translateState(currentState) {
    return {
      NONE: '未出勤',
      WORKING: '勤務中',
      BREAK: '休憩中',
      CLOCKED_OUT: '退勤済み'
    }[currentState] || '--';
  }

  function formatEventType(eventType) {
    return {
      CLOCK_IN: '出勤',
      CLOCK_OUT: '退勤',
      BREAK_START: '休憩入',
      BREAK_END: '休憩出'
    }[eventType] || eventType;
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
  }

  function updateButtonStates() {
    const machine = {
      NONE: ['CLOCK_IN'],
      WORKING: ['BREAK_START', 'CLOCK_OUT'],
      BREAK: ['BREAK_END'],
      CLOCKED_OUT: []
    };
    const allowed = state.employee ? machine[state.currentState] || [] : [];
    buttons.forEach(btn => {
      const event = btn.dataset.event;
      btn.disabled = !allowed.includes(event);
    });
  }

  function renderEvents(events) {
    const list = document.getElementById('recentEvents');
    list.innerHTML = '';
    (events || []).slice(0, 3).forEach(event => {
      const li = document.createElement('li');
      li.textContent = `${formatEventType(event.eventType)}: ${formatTime(event.timestamp)}`;
      list.appendChild(li);
    });
  }

  function renderTodayLog(logs) {
    const list = document.getElementById('todayLog');
    list.innerHTML = '';
    (logs || []).forEach(log => {
      const li = document.createElement('li');
      li.textContent = `${formatEventType(log.eventType)} ${formatTime(log.timestamp)}`;
      list.appendChild(li);
    });
  }

  function resetClockView() {
    document.getElementById('employeeName').textContent = '--';
    document.getElementById('employeeId').textContent = '--';
    document.getElementById('currentDate').textContent = '--';
    document.getElementById('currentTime').textContent = '--';
    document.getElementById('currentStatus').textContent = '--';
    renderEvents([]);
    renderTodayLog([]);
    state.currentState = 'NONE';
    updateButtonStates();
  }

  function showToast(message, isError) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.dataset.type = isError ? 'error' : 'info';
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 4000);
  }

  function handleSessionExpired() {
    state.token = null;
    state.employee = null;
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
    stopClock();
    showToast('セッションが切れました。再度ログインしてください。', true);
    resetClockView();
    loginForm.reset();
    loginMessage.textContent = '';
    showPage('login');
  }

  function handleStatusResponse(data) {
    if (data.status !== 'success') {
      if (data.code === 'UNAUTHORIZED') {
        handleSessionExpired();
        return;
      }
      if (data.message) {
        showToast('状態取得エラー: ' + data.message, true);
      } else if (data.code) {
        showToast('状態取得エラー: ' + data.code, true);
      }
      return;
    }
    
    // 従業員情報が保持されていることを確認し、表示を更新
    // ただし、localStorageから復元する際は、現在のトークンと一致する情報のみを使用
    if (state.employee) {
      document.getElementById('employeeName').textContent = state.employee.name || '--';
      document.getElementById('employeeId').textContent = state.employee.id || '--';
    } else {
      // 従業員情報が失われている場合は、localStorageから復元を試みる
      // ただし、現在のトークンと一致する情報のみを使用
      const employeeData = localStorage.getItem('employee');
      if (employeeData) {
        try {
          const employee = JSON.parse(employeeData);
          // トークンが存在する場合のみ復元（トークンと従業員情報の整合性を保つ）
          if (state.token) {
            state.employee = employee;
            document.getElementById('employeeName').textContent = state.employee.name || '--';
            document.getElementById('employeeId').textContent = state.employee.id || '--';
          }
        } catch (e) {
          console.error('従業員情報の復元に失敗しました:', e);
        }
      }
    }
    
    state.currentState = data.currentState || 'NONE';
    document.getElementById('currentStatus').textContent = translateState(state.currentState);
    renderEvents(data.recentEvents);
    renderTodayLog(data.todayLog);
    updateButtonStates();
    if (data.warnings && data.warnings.length) {
      showToast(data.warnings.join('\n'), false);
    }
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

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleSessionExpired();
        throw new Error('UNAUTHORIZED');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  async function login(event) {
    event.preventDefault();
    loginMessage.textContent = '';

    const form = new FormData(loginForm);
    try {
      const response = await callApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: form.get('employeeId'),
          password: form.get('password'),
        }),
      });

      if (response.status === 'success') {
        state.token = response.token;
        state.employee = response.employee;
        localStorage.setItem('token', response.token);
        localStorage.setItem('employee', JSON.stringify(response.employee));

        if (response.employee.role === 'admin') {
          window.location.href = '/admin.html';
          return;
        }

        document.getElementById('employeeName').textContent = response.employee.name;
        document.getElementById('employeeId').textContent = response.employee.id;
        updateButtonStates();
        showPage('clock');
        startClock();
        fetchStatus();
      } else {
        loginMessage.textContent = 'ログイン失敗: ' + (response.message || response.code || '');
      }
    } catch (error) {
      console.error('ログインエラー:', error);
      loginMessage.textContent = 'ログインに失敗しました: ' + error.message;
    }
  }

  async function fetchStatus() {
    // トークンが存在する場合は、従業員情報が失われていても復元を試みる
    // ただし、現在のトークンと一致する従業員情報のみを使用
    if (state.token && !state.employee) {
      const employeeData = localStorage.getItem('employee');
      if (employeeData) {
        try {
          const employee = JSON.parse(employeeData);
          // トークンから従業員IDを取得して確認
          const tokenEmployeeId = getEmployeeIdFromToken(state.token);
          if (tokenEmployeeId && employee.id === tokenEmployeeId) {
            state.employee = employee;
          } else {
            console.error(`トークンと従業員情報が一致しません: token=${tokenEmployeeId}, employee=${employee.id}`);
          }
        } catch (e) {
          console.error('従業員情報の復元に失敗しました:', e);
        }
      }
    }
    
    if (!state.token || !state.employee) {
      return;
    }
    
    // トークンから従業員IDを取得して確認
    const tokenEmployeeId = getEmployeeIdFromToken(state.token);
    if (tokenEmployeeId && state.employee.id !== tokenEmployeeId) {
      console.error(`トークンと従業員情報が一致しません: token=${tokenEmployeeId}, employee=${state.employee.id}`);
      // トークンと一致する従業員情報をlocalStorageから探す
      const employeeData = localStorage.getItem('employee');
      if (employeeData) {
        try {
          const employee = JSON.parse(employeeData);
          if (employee.id === tokenEmployeeId) {
            state.employee = employee;
          }
        } catch (e) {
          console.error('従業員情報の復元に失敗しました:', e);
        }
      }
    }
    
    // 現在の従業員IDを保存（更新処理の前後で一致することを確認するため）
    const currentEmployeeId = state.employee.id;
    const originalEmployee = { ...state.employee }; // コピーを作成
    
    try {
      const response = await callApi('/attendance/status');
      
      // 更新処理の後に従業員IDが一致していることを確認
      if (state.employee && state.employee.id !== currentEmployeeId) {
        console.error(`従業員IDが変更されました: ${currentEmployeeId} -> ${state.employee.id}`);
        // 元の従業員情報に戻す
        state.employee = originalEmployee;
        localStorage.setItem('employee', JSON.stringify(originalEmployee));
        document.getElementById('employeeName').textContent = originalEmployee.name || '--';
        document.getElementById('employeeId').textContent = originalEmployee.id || '--';
      }
      
      handleStatusResponse(response);
    } catch (error) {
      console.error('fetchStatus failed', error);
      if (error.message === 'UNAUTHORIZED') {
        // 認証エラーの場合のみログアウト処理
        handleSessionExpired();
        return;
      }
      // その他のエラーは表示するだけ（ログアウトしない）
      showToast('状態取得に失敗しました: ' + error.message, true);
    }
  }

  async function handleClockEvent(eventType) {
    // トークンが存在する場合は、従業員情報が失われていても復元を試みる
    // ただし、現在のトークンと一致する従業員情報のみを使用
    if (state.token && !state.employee) {
      const employeeData = localStorage.getItem('employee');
      if (employeeData) {
        try {
          const employee = JSON.parse(employeeData);
          // トークンから従業員IDを取得して確認
          const tokenEmployeeId = getEmployeeIdFromToken(state.token);
          if (tokenEmployeeId && employee.id === tokenEmployeeId) {
            state.employee = employee;
          } else {
            console.error(`トークンと従業員情報が一致しません: token=${tokenEmployeeId}, employee=${employee.id}`);
          }
        } catch (e) {
          console.error('従業員情報の復元に失敗しました:', e);
        }
      }
    }
    
    if (!state.token || !state.employee) {
      return;
    }
    
    // トークンから従業員IDを取得して確認
    const tokenEmployeeId = getEmployeeIdFromToken(state.token);
    if (tokenEmployeeId && state.employee.id !== tokenEmployeeId) {
      console.error(`トークンと従業員情報が一致しません: token=${tokenEmployeeId}, employee=${state.employee.id}`);
      // トークンと一致する従業員情報をlocalStorageから探す
      const employeeData = localStorage.getItem('employee');
      if (employeeData) {
        try {
          const employee = JSON.parse(employeeData);
          if (employee.id === tokenEmployeeId) {
            state.employee = employee;
          }
        } catch (e) {
          console.error('従業員情報の復元に失敗しました:', e);
        }
      }
    }

    try {
      const response = await callApi('/attendance/event', {
        method: 'POST',
        body: JSON.stringify({
          eventType: eventType,
          clientTs: new Date().toISOString(),
          deviceInfo: navigator.userAgent,
        }),
      });

      if (response.status === 'success') {
        handleStatusResponse(response);
        showToast('打刻しました', false);
      } else {
        const reason = response.message || response.code || '原因不明のエラー';
        showToast('打刻に失敗しました: ' + reason, true);
      }
    } catch (error) {
      console.error('打刻エラー:', error);
      if (error.message !== 'UNAUTHORIZED') {
        showToast('打刻に失敗しました: ' + error.message, true);
      }
    }
  }

  function handleLogout() {
    state.token = null;
    state.employee = null;
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
    stopClock();
    resetClockView();
    loginForm.reset();
    loginMessage.textContent = '';
    showPage('login');
  }

  // 打刻修正機能
  const showEditBtn = document.getElementById('showEditBtn');
  const editSection = document.getElementById('editSection');
  const loadMyLogsBtn = document.getElementById('loadMyLogsBtn');
  const editFromDate = document.getElementById('editFromDate');
  const editToDate = document.getElementById('editToDate');
  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const deleteMyLogBtn = document.getElementById('deleteMyLogBtn');
  const editLogForm = document.getElementById('editLogForm');

  if (showEditBtn) {
    showEditBtn.addEventListener('click', () => {
      editSection.style.display = editSection.style.display === 'none' ? 'block' : 'none';
      if (editSection.style.display === 'block') {
        setDefaultEditDates();
      }
    });
  }

  if (loadMyLogsBtn) {
    loadMyLogsBtn.addEventListener('click', loadMyLogs);
  }

  if (closeEditModalBtn) {
    closeEditModalBtn.addEventListener('click', closeEditModal);
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', closeEditModal);
  }

  if (deleteMyLogBtn) {
    deleteMyLogBtn.addEventListener('click', handleDeleteMyLog);
  }

  if (editLogForm) {
    editLogForm.addEventListener('submit', handleSaveMyLog);
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

  function setDefaultEditDates() {
    const today = new Date();
    // 開始日と終了日の両方を本日に設定
    editFromDate.value = formatInputDate(today);
    editToDate.value = formatInputDate(today);
  }

  function formatInputDate(date) {
    // 日本時間（JST）で日付を取得
    const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    const year = jstDate.getUTCFullYear();
    const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async function loadMyLogs() {
    // トークンが存在する場合は、従業員情報が失われていても復元を試みる
    // ただし、現在のトークンと一致する従業員情報のみを使用
    if (state.token && !state.employee) {
      const employeeData = localStorage.getItem('employee');
      if (employeeData) {
        try {
          const employee = JSON.parse(employeeData);
          // トークンから従業員IDを取得して確認
          const tokenEmployeeId = getEmployeeIdFromToken(state.token);
          if (tokenEmployeeId && employee.id === tokenEmployeeId) {
            state.employee = employee;
          } else {
            console.error(`トークンと従業員情報が一致しません: token=${tokenEmployeeId}, employee=${employee.id}`);
          }
        } catch (e) {
          console.error('従業員情報の復元に失敗しました:', e);
        }
      }
    }
    
    if (!state.token || !state.employee) {
      showToast('ログインが必要です', true);
      return;
    }
    
    // トークンから従業員IDを取得して確認
    const tokenEmployeeId = getEmployeeIdFromToken(state.token);
    if (tokenEmployeeId && state.employee.id !== tokenEmployeeId) {
      console.error(`トークンと従業員情報が一致しません: token=${tokenEmployeeId}, employee=${state.employee.id}`);
      // トークンと一致する従業員情報をlocalStorageから探す
      const employeeData = localStorage.getItem('employee');
      if (employeeData) {
        try {
          const employee = JSON.parse(employeeData);
          if (employee.id === tokenEmployeeId) {
            state.employee = employee;
          }
        } catch (e) {
          console.error('従業員情報の復元に失敗しました:', e);
        }
      }
    }
    
    // 現在の従業員IDを保存（更新処理の前後で一致することを確認するため）
    const currentEmployeeId = state.employee.id;
    const originalEmployee = { ...state.employee }; // コピーを作成

    const from = editFromDate.value;
    const to = editToDate.value;

    if (!from || !to) {
      showToast('期間を選択してください', true);
      return;
    }

    try {
      console.log(`[loadMyLogs] リクエスト: from=${from}, to=${to}, employeeId=${state.employee?.id}`);
      const response = await callApi(`/attendance/my-logs?from=${from}&to=${to}`);
      
      // 取得後にログイン情報が保持されているか確認
      if (!state.token || !state.employee) {
        console.error('打刻ログ取得後にログイン情報が失われました');
        handleSessionExpired();
        return;
      }
      
      // 従業員IDが変更されていないことを確認
      if (state.employee.id !== currentEmployeeId) {
        console.error(`loadMyLogs後に従業員IDが変更されました: ${currentEmployeeId} -> ${state.employee.id}`);
        // 元の従業員情報に戻す
        state.employee = originalEmployee;
        localStorage.setItem('employee', JSON.stringify(originalEmployee));
        document.getElementById('employeeName').textContent = originalEmployee.name || '--';
        document.getElementById('employeeId').textContent = originalEmployee.id || '--';
      }
      
      if (response.status === 'success') {
        console.log(`[loadMyLogs] 取得したログ数: ${response.logs?.length || 0}`);
        state.myLogs = response.logs || [];
        renderMyLogs(state.myLogs);
      } else {
        console.error('[loadMyLogs] レスポンスエラー:', response);
        showToast('打刻ログの取得に失敗しました: ' + (response.message || response.code || ''), true);
      }
    } catch (error) {
      console.error('打刻ログ取得エラー:', error);
      if (error.message === 'UNAUTHORIZED') {
        // 認証エラーの場合のみログアウト処理
        handleSessionExpired();
        return;
      }
      // その他のエラーは表示するだけ（ログアウトしない）
      showToast('打刻ログの取得に失敗しました: ' + error.message, true);
    }
  }

  function renderMyLogs(logs) {
    const tbody = document.querySelector('#myLogsTable tbody');
    
    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-placeholder">データがありません</td></tr>';
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
        ? '<span class="edit-badge">修正済み</span>' 
        : '<span class="normal-badge">通常</span>';
      
      return `
        <tr>
          <td>${dateStr}</td>
          <td>${eventTypeMap[log.eventType] || log.eventType}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-small primary" data-row-number="${log.rowNumber}" data-action="edit-log">編集</button>
          </td>
        </tr>
      `;
    }).join('');
    
    // イベントリスナーを設定
    tbody.querySelectorAll('[data-action="edit-log"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rowNumber = parseInt(e.target.getAttribute('data-row-number'));
        openEditMyLog(rowNumber);
      });
    });
  }

  function openEditMyLog(rowNumber) {
    const log = state.myLogs.find(l => l.rowNumber === rowNumber);
    if (!log) {
      showToast('打刻ログが見つかりません', true);
      return;
    }

    const modal = document.getElementById('editModal');
    const editRowNumber = document.getElementById('editRowNumber');
    const editEventType = document.getElementById('editEventType');
    const editTimestamp = document.getElementById('editTimestamp');
    const editReason = document.getElementById('editReason');
    const deleteBtn = document.getElementById('deleteMyLogBtn');

    editRowNumber.value = rowNumber;
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
    
    editReason.value = log.editReason || '';
    deleteBtn.style.display = 'block';

    modal.style.display = 'flex';
  }

  function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async function handleSaveMyLog(event) {
    event.preventDefault();
    
    // 更新前にログイン情報を確認し、従業員IDを保存
    if (!state.token || !state.employee) {
      showToast('ログイン情報が失われています。再度ログインしてください。', true);
      handleSessionExpired();
      return;
    }
    
    // 更新前の従業員IDを保存（更新後に一致することを確認するため）
    const originalEmployeeId = state.employee.id;
    const originalEmployee = { ...state.employee }; // コピーを作成
    
    const rowNumber = document.getElementById('editRowNumber').value;
    const eventType = document.getElementById('editEventType').value;
    const timestampLocal = document.getElementById('editTimestamp').value;
    const editReason = document.getElementById('editReason').value;

    // 日本時間のdatetime-localをUTCに変換
    const localDate = new Date(timestampLocal);
    const utcDate = new Date(localDate.getTime() - (9 * 60 * 60 * 1000));
    const timestamp = utcDate.toISOString();

    try {
      await callApi(`/attendance/my-logs/${rowNumber}`, {
        method: 'PUT',
        body: JSON.stringify({
          eventType,
          timestamp,
          editReason: editReason || '従業員による修正'
        })
      });
      
      // 更新後にログイン情報が保持されているか確認
      if (!state.token || !state.employee) {
        console.error('更新後にログイン情報が失われました');
        handleSessionExpired();
        return;
      }
      
      // 従業員IDが変更されていないことを確認
      if (state.employee.id !== originalEmployeeId) {
        console.error(`従業員IDが変更されました: ${originalEmployeeId} -> ${state.employee.id}`);
        // 元の従業員情報に戻す
        state.employee = originalEmployee;
        localStorage.setItem('employee', JSON.stringify(originalEmployee));
      }
      
      showToast('打刻ログを更新しました', false);
      closeEditModal();
      
      // 更新後に画面を確実に更新
      // ログイン情報が保持されていることを確認してから再読み込み
      if (state.token && state.employee && state.employee.id === originalEmployeeId) {
        // まず打刻ログを再読み込み
        try {
          await loadMyLogs();
        } catch (error) {
          console.error('打刻ログ再読み込みエラー:', error);
          // エラーが発生してもログアウトしない（認証エラーはloadMyLogs内で処理される）
          if (error.message !== 'UNAUTHORIZED') {
            showToast('打刻ログの再読み込みに失敗しました', true);
          }
        }
        
        // ステータスを更新（ボタンの状態なども更新される）
        if (state.token && state.employee && state.employee.id === originalEmployeeId) {
          try {
            await fetchStatus();
            // 更新後に従業員IDが一致していることを再確認
            if (state.employee && state.employee.id !== originalEmployeeId) {
              console.error(`fetchStatus後に従業員IDが変更されました: ${originalEmployeeId} -> ${state.employee.id}`);
              state.employee = originalEmployee;
              localStorage.setItem('employee', JSON.stringify(originalEmployee));
              document.getElementById('employeeName').textContent = originalEmployee.name || '--';
              document.getElementById('employeeId').textContent = originalEmployee.id || '--';
            }
          } catch (error) {
            console.error('ステータス更新エラー:', error);
            // エラーが発生してもログアウトしない（認証エラーはfetchStatus内で処理される）
            if (error.message !== 'UNAUTHORIZED' && state.token && state.employee) {
              // ステータス更新に失敗した場合は、手動で再取得を試みる
              setTimeout(() => {
                if (state.token && state.employee && state.employee.id === originalEmployeeId) {
                  fetchStatus().catch(err => {
                    console.error('ステータス再取得エラー:', err);
                  });
                }
              }, 1000);
            }
          }
        }
      }
    } catch (error) {
      console.error('保存エラー:', error);
      if (error.message === 'UNAUTHORIZED') {
        // 認証エラーの場合のみログアウト
        return;
      }
      showToast('保存に失敗しました: ' + error.message, true);
    }
  }

  async function handleDeleteMyLog() {
    // 削除前にログイン情報を確認し、従業員IDを保存
    if (!state.token || !state.employee) {
      showToast('ログイン情報が失われています。再度ログインしてください。', true);
      handleSessionExpired();
      return;
    }
    
    // 削除前の従業員IDを保存（削除後に一致することを確認するため）
    const originalEmployeeId = state.employee.id;
    const originalEmployee = { ...state.employee }; // コピーを作成
    
    const rowNumber = document.getElementById('editRowNumber').value;
    if (!rowNumber) return;

    if (!confirm('この打刻ログを削除しますか？この操作は取り消せません。')) {
      return;
    }

    try {
      await callApi(`/attendance/my-logs/${rowNumber}`, {
        method: 'DELETE'
      });
      
      // 削除後にログイン情報が保持されているか確認
      if (!state.token || !state.employee) {
        console.error('削除後にログイン情報が失われました');
        handleSessionExpired();
        return;
      }
      
      // 従業員IDが変更されていないことを確認
      if (state.employee.id !== originalEmployeeId) {
        console.error(`従業員IDが変更されました: ${originalEmployeeId} -> ${state.employee.id}`);
        // 元の従業員情報に戻す
        state.employee = originalEmployee;
        localStorage.setItem('employee', JSON.stringify(originalEmployee));
      }
      
      showToast('打刻ログを削除しました', false);
      closeEditModal();
      
      // 削除後に画面を確実に更新
      // ログイン情報が保持されていることを確認してから再読み込み
      if (state.token && state.employee && state.employee.id === originalEmployeeId) {
        // まず打刻ログを再読み込み
        try {
          await loadMyLogs();
        } catch (error) {
          console.error('打刻ログ再読み込みエラー:', error);
          // エラーが発生してもログアウトしない（認証エラーはloadMyLogs内で処理される）
          if (error.message !== 'UNAUTHORIZED') {
            showToast('打刻ログの再読み込みに失敗しました', true);
          }
        }
        
        // ステータスを更新（ボタンの状態なども更新される）
        if (state.token && state.employee && state.employee.id === originalEmployeeId) {
          try {
            await fetchStatus();
            // 更新後に従業員IDが一致していることを再確認
            if (state.employee && state.employee.id !== originalEmployeeId) {
              console.error(`fetchStatus後に従業員IDが変更されました: ${originalEmployeeId} -> ${state.employee.id}`);
              state.employee = originalEmployee;
              localStorage.setItem('employee', JSON.stringify(originalEmployee));
              document.getElementById('employeeName').textContent = originalEmployee.name || '--';
              document.getElementById('employeeId').textContent = originalEmployee.id || '--';
            }
          } catch (error) {
            console.error('ステータス更新エラー:', error);
            // エラーが発生してもログアウトしない（認証エラーはfetchStatus内で処理される）
            if (error.message !== 'UNAUTHORIZED' && state.token && state.employee) {
              // ステータス更新に失敗した場合は、手動で再取得を試みる
              setTimeout(() => {
                if (state.token && state.employee && state.employee.id === originalEmployeeId) {
                  fetchStatus().catch(err => {
                    console.error('ステータス再取得エラー:', err);
                  });
                }
              }, 1000);
            }
          }
        }
      }
    } catch (error) {
      console.error('削除エラー:', error);
      if (error.message === 'UNAUTHORIZED') {
        // 認証エラーの場合のみログアウト
        return;
      }
      showToast('削除に失敗しました: ' + error.message, true);
    }
  }

  // グローバルスコープに公開
  window.openEditMyLog = openEditMyLog;

  // イベントリスナー
  loginForm.addEventListener('submit', login);
  logoutBtn.addEventListener('click', handleLogout);
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const eventType = btn.dataset.event;
      if (eventType) {
        handleClockEvent(eventType);
      }
    });
  });

  // 初期表示
  if (!state.token) {
    showPage('login');
  }
}

