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
  attendances: []
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

  setDefaultDates();
  form.addEventListener('submit', handleFilterSubmit);
  logoutBtn.addEventListener('click', handleLogout);
  exportBtn.addEventListener('click', handleExportCsv);

  loadEmployees().then(refreshData).catch(handleError);
}

function setDefaultDates() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  state.filters.from = formatInputDate(first);
  state.filters.to = formatInputDate(today);
  const form = document.getElementById('adminFilterForm');
  form.elements.from.value = state.filters.from;
  form.elements.to.value = state.filters.to;
}

function formatInputDate(date) {
  return date.toISOString().split('T')[0];
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
  Promise.all([fetchSummary(), fetchAttendances()]).catch(handleError);
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
      handleLogout();
      throw new Error('UNAUTHORIZED');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return await response.json();
}

async function loadEmployees() {
  try {
    const response = await callApi('/admin/employees');
    if (response.status === 'success') {
      state.employees = response.employees || [];
      const select = document.getElementById('employeeSelect');
      select.innerHTML = '<option value="">全員</option>';
      state.employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.name} (${emp.id})`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('従業員一覧取得エラー:', error);
    handleError(error);
  }
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
    }
  } catch (error) {
    console.error('サマリー取得エラー:', error);
    handleError(error);
  }
}

async function fetchAttendances() {
  // 実装は後で追加
  const tbody = document.querySelector('#attendanceTable tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="table-placeholder">データがありません</td></tr>';
  document.getElementById('tableCount').textContent = '0件';
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

function handleError(error) {
  console.error('エラー:', error);
  alert('エラーが発生しました: ' + error.message);
}

