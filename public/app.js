const API_BASE_URL = '/api';

const state = {
  token: localStorage.getItem('token') || null,
  employee: null,
  currentState: 'NONE'
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
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
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
      minute: '2-digit'
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
    if (!state.token || !state.employee) {
      return;
    }
    try {
      const response = await callApi('/attendance/status');
      handleStatusResponse(response);
    } catch (error) {
      console.error('fetchStatus failed', error);
      if (error.message !== 'UNAUTHORIZED') {
        showToast('状態取得に失敗しました: ' + error.message, true);
      }
    }
  }

  async function handleClockEvent(eventType) {
    if (!state.token || !state.employee) {
      return;
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

