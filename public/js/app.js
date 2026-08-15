// public/js/app.js - SKEDit Clone Web Dashboard Logic
'use strict';

let schedules      = [];
let currentFilter  = 'all';
let editingId      = null;
let pollTimer      = null;
let currentRepeat  = 'daily';
let currentAmPm    = 'AM';
let selectedDays   = [1]; // default Monday
let prevStatus     = null;

document.addEventListener('DOMContentLoaded', () => {
  startPolling();
  loadSchedules();
  loadLogs();

  // Set default date to today
  const todayStr = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('schedDate');
  if (dateInput) dateInput.value = todayStr;

  // Character counter
  document.getElementById('schedMessage').addEventListener('input', function() {
    document.getElementById('charCount').textContent = this.value.length;
  });

  updateScheduleSummary();
});

/* ═══════════════════════════════════════════
   STATUS POLLING
═══════════════════════════════════════════ */
function startPolling() {
  fetchStatus();
  pollTimer = setInterval(fetchStatus, 3000);
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    updateStatusBar(data);
    updateMetrics(data.stats);

    const qrModal = document.getElementById('qrModal');
    if (qrModal.classList.contains('open')) {
      updateQrModal(data);
    }

    if (data.state === 'connected' && prevStatus !== 'connected') {
      loadSchedules();
      loadLogs();
    }

    prevStatus = data.state;
  } catch { /* server starting */ }
}

function updateStatusBar(data) {
  const dot   = document.getElementById('statusDot');
  const text  = document.getElementById('statusText');
  const phone = document.getElementById('statusPhone');

  dot.className = 'status-dot ' + data.state;

  const labels = {
    connected:    '✓ Connected',
    connecting:   'Connecting…',
    qr_ready:     'Scan QR Code',
    disconnected: 'Disconnected',
  };

  text.textContent = labels[data.state] || data.state;
  phone.textContent = data.phone ? `+${data.phone}` : '';

  const pairBtn = document.getElementById('btnPairDevice');
  if (data.state === 'qr_ready') {
    pairBtn.classList.add('btn-primary');
    pairBtn.classList.remove('btn-outline');
  } else {
    pairBtn.classList.remove('btn-primary');
    pairBtn.classList.add('btn-outline');
  }
}

function updateMetrics(stats) {
  if (!stats) return;
  document.getElementById('mTotal').textContent  = stats.total || 0;
  document.getElementById('mActive').textContent = stats.active || 0;
  document.getElementById('mSent').textContent   = stats.sentToday || 0;
  document.getElementById('mFailed').textContent = stats.failedToday || 0;
}

/* ═══════════════════════════════════════════
   QR PAIRING MODAL
═══════════════════════════════════════════ */
function openQrModal() {
  document.getElementById('qrModal').classList.add('open');
  fetchStatus();
}

function closeQrModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('qrModal').classList.remove('open');
}

function updateQrModal(data) {
  const loading  = document.getElementById('qrLoading');
  const qrImg    = document.getElementById('qrImage');
  const success  = document.getElementById('qrSuccess');

  if (data.state === 'connected') {
    loading.classList.add('hidden');
    qrImg.classList.add('hidden');
    success.classList.remove('hidden');
    return;
  }

  success.classList.add('hidden');

  if (data.qrDataURL) {
    qrImg.src = data.qrDataURL;
    qrImg.classList.remove('hidden');
    loading.classList.add('hidden');
  } else {
    qrImg.classList.add('hidden');
    loading.classList.remove('hidden');
  }
}

/* ═══════════════════════════════════════════
   SKEDIT SCHEDULE MODAL CONTROLS
═══════════════════════════════════════════ */
function openScheduleModal(schedule = null) {
  editingId = schedule ? schedule.id : null;
  const modal = document.getElementById('scheduleModal');
  const title = document.getElementById('scheduleModalTitle');
  const saveBtn = document.getElementById('saveScheduleBtn');

  document.getElementById('scheduleForm').reset();
  document.getElementById('charCount').textContent = '0';
  document.getElementById('editScheduleId').value = editingId || '';

  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('schedDate').value = todayStr;

  if (schedule) {
    title.textContent = 'Edit Schedule';
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Update Schedule`;
    
    document.getElementById('schedName').value    = schedule.name || '';
    document.getElementById('schedTo').value      = schedule.to || '';
    document.getElementById('countryCode').value  = schedule.countryCode || '91';
    document.getElementById('schedMessage').value = schedule.message || '';
    document.getElementById('schedEnabled').checked = schedule.enabled !== false;
    document.getElementById('charCount').textContent = (schedule.message || '').length;

    setRepeatType(schedule.repeatType || 'daily');
    setAmPm(schedule.amPm || 'AM');

    if (schedule.time) {
      const [h, m] = schedule.time.split(':');
      document.getElementById('timeHour').value = h || '09';
      document.getElementById('timeMin').value  = m || '00';
    }

    if (schedule.date) document.getElementById('schedDate').value = schedule.date;
    
    if (schedule.daysOfWeek) {
      selectedDays = schedule.daysOfWeek;
      document.querySelectorAll('.dow-btn').forEach(btn => {
        const dayNum = parseInt(btn.dataset.day, 10);
        btn.classList.toggle('active', selectedDays.includes(dayNum));
      });
    }

    if (schedule.cron && schedule.repeatType === 'custom_cron') {
      document.getElementById('schedCron').value = schedule.cron;
    }
  } else {
    title.textContent = 'Add Scheduled Message';
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Save Schedule`;
    setRepeatType('daily');
    setAmPm('AM');
    selectedDays = [1];
    document.querySelectorAll('.dow-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.day === '1');
    });
  }

  updateScheduleSummary();
  modal.classList.add('open');
}

function closeScheduleModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('scheduleModal').classList.remove('open');
  editingId = null;
}

function setRepeatType(type) {
  currentRepeat = type;
  const types = ['daily', 'weekly', 'once', 'monthly', 'custom_cron'];
  
  types.forEach(t => {
    const btn = document.getElementById('rep' + t.charAt(0).toUpperCase() + t.slice(1).replace('_cron',''));
    if (btn) btn.classList.toggle('active', t === type);
  });

  document.getElementById('dowGroup').classList.toggle('hidden', type !== 'weekly');
  document.getElementById('dateGroup').classList.toggle('hidden', type !== 'once' && type !== 'monthly');
  document.getElementById('customCronGroup').classList.toggle('hidden', type !== 'custom_cron');
  document.getElementById('timePickerGroup').classList.toggle('hidden', type === 'custom_cron');

  updateScheduleSummary();
}

function setAmPm(ampm) {
  currentAmPm = ampm;
  document.getElementById('amBtn').classList.toggle('active', ampm === 'AM');
  document.getElementById('pmBtn').classList.toggle('active', ampm === 'PM');
  updateScheduleSummary();
}

function toggleDow(btn) {
  const day = parseInt(btn.dataset.day, 10);
  if (selectedDays.includes(day)) {
    if (selectedDays.length > 1) {
      selectedDays = selectedDays.filter(d => d !== day);
      btn.classList.remove('active');
    }
  } else {
    selectedDays.push(day);
    selectedDays.sort();
    btn.classList.add('active');
  }
  updateScheduleSummary();
}

function setPreset(text) {
  document.getElementById('schedMessage').value = text;
  document.getElementById('charCount').textContent = text.length;
}

function updateScheduleSummary() {
  const banner = document.getElementById('summaryBanner');
  if (!banner) return;

  const h = document.getElementById('timeHour').value;
  const m = document.getElementById('timeMin').value;
  const timeFormatted = `${h}:${m} ${currentAmPm}`;
  const dateVal = document.getElementById('schedDate').value;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (currentRepeat === 'daily') {
    banner.textContent = `⏰ Will send Every day at ${timeFormatted}`;
  } else if (currentRepeat === 'weekly') {
    const names = selectedDays.map(d => dayNames[d]).join(', ');
    banner.textContent = `⏰ Will send Every week on (${names}) at ${timeFormatted}`;
  } else if (currentRepeat === 'once') {
    banner.textContent = `⏰ Will send One-time on ${dateVal || 'selected date'} at ${timeFormatted}`;
  } else if (currentRepeat === 'monthly') {
    const dNum = dateVal ? new Date(dateVal).getDate() : 1;
    banner.textContent = `⏰ Will send Monthly on day ${dNum} at ${timeFormatted}`;
  } else if (currentRepeat === 'custom_cron') {
    const c = document.getElementById('schedCron').value.trim() || '* * * * *';
    banner.textContent = `⏰ Custom Cron: "${c}"`;
  }
}

/* ═══════════════════════════════════════════
   SAVE SCHEDULE
═══════════════════════════════════════════ */
async function saveSchedule(e) {
  e.preventDefault();
  const btn = document.getElementById('saveScheduleBtn');
  btn.disabled = true;

  const h = document.getElementById('timeHour').value;
  const m = document.getElementById('timeMin').value;

  const payload = {
    name:        document.getElementById('schedName').value.trim(),
    to:          document.getElementById('schedTo').value.trim(),
    countryCode: document.getElementById('countryCode').value,
    message:     document.getElementById('schedMessage').value.trim(),
    repeatType:  currentRepeat,
    time:        `${h}:${m}`,
    amPm:        currentAmPm,
    date:        document.getElementById('schedDate').value,
    daysOfWeek:  selectedDays,
    cron:        document.getElementById('schedCron').value.trim(),
    enabled:     document.getElementById('schedEnabled').checked,
  };

  try {
    const method = editingId ? 'PUT' : 'POST';
    const url    = editingId ? `/api/schedules/${editingId}` : '/api/schedules';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save schedule');
    }

    closeScheduleModal();
    await loadSchedules();
    showToast(editingId ? 'Schedule updated!' : 'Schedule created!', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════
   LOAD & RENDER SCHEDULES
═══════════════════════════════════════════ */
async function loadSchedules() {
  try {
    const res = await fetch('/api/schedules');
    schedules = await res.json();
    renderSchedules();
  } catch { /* silent */ }
}

async function toggleSchedule(id) {
  const s = schedules.find(x => x.id === id);
  if (!s) return;
  try {
    await fetch(`/api/schedules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    await loadSchedules();
    showToast(s.enabled ? 'Schedule paused' : 'Schedule resumed', 'success');
  } catch { showToast('Failed to update schedule', 'error'); }
}

async function deleteSchedule(id) {
  if (!confirm('Delete this schedule?')) return;
  try {
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    await loadSchedules();
    showToast('Schedule deleted', 'success');
  } catch { showToast('Failed to delete schedule', 'error'); }
}

async function testSchedule(id) {
  const s = schedules.find(x => x.id === id);
  if (!s) return;
  showToast(`Sending test to +${s.countryCode || '91'}${s.to}…`);
  try {
    const res = await fetch(`/api/schedules/${id}/test`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('✅ WhatsApp Message Sent!', 'success');
      setTimeout(loadLogs, 1000);
    } else {
      showToast('❌ ' + (data.error || 'Send failed'), 'error');
    }
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

function setFilter(f) {
  currentFilter = f;
  ['all','active','paused'].forEach(x => {
    document.getElementById('filter' + x.charAt(0).toUpperCase() + x.slice(1))
      .classList.toggle('active', x === f);
  });
  renderSchedules();
}

function renderSchedules() {
  const grid = document.getElementById('scheduleGrid');
  const empty = document.getElementById('emptyState');

  let filtered = schedules;
  if (currentFilter === 'active') filtered = schedules.filter(s => s.enabled);
  if (currentFilter === 'paused') filtered = schedules.filter(s => !s.enabled);

  if (filtered.length === 0) {
    grid.innerHTML = '';
    grid.appendChild(empty);
    empty.style.display = 'flex';
    empty.style.flexDirection = 'column';
    empty.style.alignItems = 'center';
    return;
  }

  empty.style.display = 'none';

  grid.innerHTML = filtered.map(s => {
    const fullPhone = s.countryCode ? `+${s.countryCode} ${s.to}` : s.to;
    const summary = s.scheduleSummary || `Every day at ${s.time || '09:00'} ${s.amPm || 'AM'}`;
    const lastSent = s.lastSent ? new Date(s.lastSent).toLocaleString() : 'Never';

    return `
    <div class="schedule-card ${s.enabled ? '' : 'paused'}" id="card-${s.id}">
      <div class="schedule-card-top">
        <div class="schedule-name">${escHtml(s.name)}</div>
        <span class="schedule-badge ${s.enabled ? 'badge-active' : 'badge-paused'}">
          ${s.enabled ? 'Active' : 'Paused'}
        </span>
      </div>

      <div class="schedule-to">📱 ${escHtml(fullPhone)}</div>

      <div class="schedule-summary">⏰ ${escHtml(summary)}</div>

      <div class="schedule-message">${escHtml(s.message)}</div>

      <div style="font-size:0.72rem;color:var(--text-muted)">Sent: ${s.sentCount || 0} times | Last: ${lastSent}</div>

      <div class="schedule-actions">
        <button class="btn btn-sm btn-outline btn-icon" title="Test send now"
          onclick="testSchedule('${s.id}')">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
        <button class="btn btn-sm btn-outline btn-icon" title="${s.enabled ? 'Pause' : 'Resume'}"
          onclick="toggleSchedule('${s.id}')">
          ${s.enabled
            ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`}
        </button>
        <div class="spacer"></div>
        <button class="btn btn-sm btn-outline btn-icon" title="Edit"
          onclick="openScheduleModal(${JSON.stringify(s).replace(/"/g, '&quot;')})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-sm btn-danger btn-icon" title="Delete"
          onclick="deleteSchedule('${s.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════
   LOGS
═══════════════════════════════════════════ */
async function loadLogs() {
  try {
    const res = await fetch('/api/logs?limit=50');
    const logs = await res.json();
    renderLogs(logs);
  } catch { /* silent */ }
}

function renderLogs(logs) {
  const tbody = document.getElementById('logTableBody');
  if (!logs.length) {
    tbody.innerHTML = '<tr class="log-empty"><td colspan="5">No dispatch activity recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const status = l.status.includes('failed') ? 'failed'
                 : l.status.includes('test')   ? 'test'
                 : 'sent';
    const recipient = l.countryCode ? `+${l.countryCode} ${l.to}` : l.to;
    return `
    <tr>
      <td style="white-space:nowrap;font-size:0.75rem;color:var(--text-muted)">
        ${new Date(l.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
        <br><span style="font-size:0.68rem">${new Date(l.timestamp).toLocaleDateString()}</span>
      </td>
      <td style="font-weight:600;color:var(--text-primary)">${escHtml(l.scheduleName || '—')}</td>
      <td style="color:var(--blue);font-size:0.78rem">${escHtml(recipient)}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(l.message || '')}">${escHtml(l.message || '')}</td>
      <td><span class="log-status ${status}">${escHtml(l.status)}</span></td>
    </tr>`;
  }).join('');
}

setInterval(loadLogs, 8000);

/* ═══════════════════════════════════════════
   TOAST & UTILS
═══════════════════════════════════════════ */
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
