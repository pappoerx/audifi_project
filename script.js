const AUDIFI_LECTURER_ACTIVITY_KEY = 'audiFiLecturerActivity';
const AUDIFI_ACTIVITY_MAX = 40;

const API_BASE = typeof window !== 'undefined' && window.AUDIFI_API_BASE ? window.AUDIFI_API_BASE : 'http://127.0.0.1:8000';
const AUDIFI_TOKEN_KEY = 'audiFiAccessToken';
const TOASTR_CSS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css';
const TOASTR_JS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js';

function ensureToastrLoaded() {
  if (typeof document === 'undefined') return;
  if (!document.querySelector('link[data-audifi-toastr]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = TOASTR_CSS_CDN;
    link.dataset.audifiToastr = 'true';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[data-audifi-toastr]')) {
    const script = document.createElement('script');
    script.src = TOASTR_JS_CDN;
    script.dataset.audifiToastr = 'true';
    document.head.appendChild(script);
  }
}

function ensureFallbackToastHost() {
  if (typeof document === 'undefined') return null;
  let host = document.getElementById('audifi-toast-host');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'audifi-toast-host';
  host.style.position = 'fixed';
  host.style.top = '14px';
  host.style.right = '14px';
  host.style.zIndex = '99999';
  host.style.display = 'flex';
  host.style.flexDirection = 'column';
  host.style.gap = '8px';
  host.style.maxWidth = '360px';
  document.body.appendChild(host);
  return host;
}

function showFallbackToast(message, level = 'info') {
  const host = ensureFallbackToastHost();
  if (!host) return;
  const tone = {
    success: { bg: '#ecfdf5', border: '#86efac', text: '#166534' },
    error: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    warning: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    info: { bg: '#eff6ff', border: '#93c5fd', text: '#1e3a8a' },
  }[level] || { bg: '#f8fafc', border: '#cbd5e1', text: '#0f172a' };

  const item = document.createElement('div');
  item.style.background = tone.bg;
  item.style.border = `1px solid ${tone.border}`;
  item.style.color = tone.text;
  item.style.borderRadius = '10px';
  item.style.padding = '10px 12px';
  item.style.fontSize = '13px';
  item.style.fontWeight = '600';
  item.style.boxShadow = '0 8px 20px rgba(15,23,42,0.12)';
  item.style.opacity = '0';
  item.style.transform = 'translateY(-4px)';
  item.style.transition = 'all .18s ease';
  item.textContent = String(message || '').trim();
  host.appendChild(item);
  requestAnimationFrame(() => {
    item.style.opacity = '1';
    item.style.transform = 'translateY(0)';
  });

  const ttl = level === 'error' ? 4600 : 2800;
  window.setTimeout(() => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(-4px)';
    window.setTimeout(() => item.remove(), 180);
  }, ttl);
}

function notify(message, level = 'info') {
  const text = String(message || '').trim();
  if (!text) return;
  if (typeof window !== 'undefined' && window.toastr && typeof window.toastr[level] === 'function') {
    try {
      window.toastr.options = {
        closeButton: true,
        progressBar: true,
        newestOnTop: true,
        positionClass: 'toast-top-right',
        timeOut: level === 'error' ? '4500' : '2800',
        extendedTimeOut: '1200',
        preventDuplicates: true,
      };
      window.toastr[level](text);
      return;
    } catch {
      // Toastr can fail if its dependencies are missing; do not break app flows.
    }
  }
  showFallbackToast(text, level);
  console[level === 'error' ? 'error' : 'log'](text);
}

function notifySuccess(message) {
  notify(message, 'success');
}

function notifyError(message) {
  notify(message, 'error');
}

function notifyInfo(message) {
  notify(message, 'info');
}

function notifyWarning(message) {
  notify(message, 'warning');
}

function getToken() {
  return localStorage.getItem(AUDIFI_TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(AUDIFI_TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(AUDIFI_TOKEN_KEY);
}

ensureToastrLoaded();

function apiDetailMessage(detail) {
  if (detail == null) return 'Request failed';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((x) => (typeof x === 'object' && x.msg ? x.msg : String(x))).join('; ');
  }
  return String(detail);
}

async function authFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
  }
  if (!res.ok) {
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {
      /* ignore */
    }
    const msg = apiDetailMessage(errBody.detail) || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('application/json')) return res.json();
  return res.text();
}

function mapApiActivityToEntry(a) {
  return {
    id: a.id,
    at: typeof a.at === 'string' ? a.at : new Date(a.at).toISOString(),
    type: a.type,
    lecturerName: a.lecturer_name,
    auditorium: a.auditorium,
    course: a.course,
    date: a.date || '',
    time: a.time || '',
    note: a.note || '',
  };
}

function getLecturerActivities() {
  try {
    return JSON.parse(localStorage.getItem(AUDIFI_LECTURER_ACTIVITY_KEY) || '[]');
  } catch {
    return [];
  }
}

function appendLecturerActivity(payload) {
  const list = getLecturerActivities();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    at: new Date().toISOString(),
    type: payload.type,
    lecturerName: payload.lecturerName || 'Lecturer',
    auditorium: payload.auditorium || '',
    course: payload.course || '',
    date: payload.date || '',
    time: payload.time || '',
    note: payload.note || '',
  };
  list.unshift(entry);
  localStorage.setItem(
    AUDIFI_LECTURER_ACTIVITY_KEY,
    JSON.stringify(list.slice(0, AUDIFI_ACTIVITY_MAX)),
  );
}

function activityTypePresentation(type) {
  const map = {
    booked: { label: 'Booked hall', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-800 border border-emerald-100' },
    booking_cancelled: { label: 'Cancelled booking', dot: 'bg-slate-400', pill: 'bg-slate-50 text-slate-700 border border-slate-200' },
    class_called_off: { label: 'Called off class', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-900 border border-amber-100' },
    checked_in_keypad: { label: 'Keypad check-in', dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-800 border border-blue-100' },
  };
  return map[type] || { label: 'Activity', dot: 'bg-gray-400', pill: 'bg-gray-50 text-gray-700 border border-gray-200' };
}

function formatActivityTimestamp(iso) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

function describeActivityEntry(entry) {
  switch (entry.type) {
    case 'booked':
      return `${entry.auditorium} · ${entry.course}${entry.date ? ` · ${entry.date}` : ''}${entry.time ? ` · ${entry.time}` : ''}`;
    case 'booking_cancelled':
      return `Released ${entry.auditorium}${entry.course ? ` — was ${entry.course}` : ''}${entry.date ? ` (${entry.date}${entry.time ? `, ${entry.time}` : ''})` : ''}`;
    case 'class_called_off':
      return `Students notified: class will not run at ${entry.auditorium}${entry.course ? ` (${entry.course})` : ''}${entry.date ? ` · ${entry.date}` : ''}`;
    case 'checked_in_keypad':
      return `Confirmed room use at ${entry.auditorium}${entry.course ? ` · ${entry.course}` : ''}`;
    default:
      return entry.note || '—';
  }
}

function parseTimeLabelToMinutes(label) {
  const m = String(label).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function getBookingSlotStartDate(dateStr, timeSlotLabel) {
  const parts = String(timeSlotLabel).split(/\s*[–\-]\s*/);
  if (parts.length < 2) return null;
  const minutes = parseTimeLabelToMinutes(parts[0].trim());
  if (minutes === null) return null;
  const [y, mo, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return null;
  return new Date(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

function validateBookingNotInPast(dateStr, timeSlotLabel) {
  const now = new Date();
  const [y, mo, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) {
    return { ok: false, message: 'Invalid booking date.' };
  }
  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);
  if (dayEnd.getTime() < now.getTime()) {
    return {
      ok: false,
      message: 'You cannot book for a date that has already passed. Choose today or a future date.',
    };
  }
  const slotStart = getBookingSlotStartDate(dateStr, timeSlotLabel);
  if (!slotStart) {
    return {
      ok: false,
      message: 'Could not read the selected time slot. Please pick a time again.',
    };
  }
  if (slotStart.getTime() <= now.getTime()) {
    return {
      ok: false,
      message:
        'This time slot has already started or ended. Choose a later time slot or another day.',
    };
  }
  return { ok: true };
}

function validateBookingTimes(dateStr, startTime, endTime) {
  const now = new Date();
  const [y, mo, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) {
    return { ok: false, message: 'Invalid booking date.' };
  }
  if (!startTime || !endTime) {
    return { ok: false, message: 'Please choose both start and end times.' };
  }
  const st = String(startTime).match(/^(\d{1,2}):(\d{2})$/);
  const et = String(endTime).match(/^(\d{1,2}):(\d{2})$/);
  if (!st || !et) {
    return { ok: false, message: 'Invalid time format. Use HH:MM.' };
  }
  const startMin = Number(st[1]) * 60 + Number(st[2]);
  const endMin = Number(et[1]) * 60 + Number(et[2]);
  if (endMin <= startMin) {
    return { ok: false, message: 'End time must be later than start time.' };
  }

  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);
  if (dayEnd.getTime() < now.getTime()) {
    return {
      ok: false,
      message: 'You cannot book for a date that has already passed. Choose today or a future date.',
    };
  }
  const slotStart = new Date(y, mo - 1, d, Number(st[1]), Number(st[2]), 0, 0);
  if (slotStart.getTime() <= now.getTime()) {
    return {
      ok: false,
      message: 'This selected time has already started or passed. Choose a later time.',
    };
  }
  return { ok: true };
}

function yesNoBadge(label, on) {
  const tone = on
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-gray-200 bg-gray-50 text-gray-600';
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}">${label}: ${on ? 'Yes' : 'No'}</span>`;
}

function inferHallTypeLabel(hall) {
  const apiType = String(hall && hall.type ? hall.type : '').trim();
  if (apiType) return apiType;
  const n = String(hall && hall.name ? hall.name : '').toUpperCase();
  if (n.includes('LAB')) return 'Lab';
  if (n.includes('BLK') || n.includes('BLOCK') || n.includes('CLASS') || n.includes('AY') || n.includes('FF') || n.includes('SF') || n.includes('TF')) {
    return 'Classroom';
  }
  return 'Lecture Hall';
}

function renderLecturerActivityList(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const limit = options.limit || 12;
  const items = (options.items != null ? options.items : getLecturerActivities()).slice(0, limit);

  if (items.length === 0) {
    container.innerHTML = `<p class="text-sm text-gray-500">${options.emptyMessage || 'No lecturer activity yet.'}</p>`;
    return;
  }

  container.innerHTML = '';
  items.forEach((entry) => {
    const pres = activityTypePresentation(entry.type);
    const row = document.createElement('div');
    row.className = 'flex gap-3 border-b border-gray-100 py-3 last:border-0';

    const dot = document.createElement('span');
    dot.className = `mt-1.5 h-2 w-2 shrink-0 rounded-full ${pres.dot}`;
    dot.setAttribute('aria-hidden', 'true');

    const body = document.createElement('div');
    body.className = 'min-w-0 flex-1';

    const metaRow = document.createElement('div');
    metaRow.className = 'flex flex-wrap items-center gap-2';

    const pill = document.createElement('span');
    pill.className = `inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${pres.pill}`;
    pill.textContent = pres.label;

    const timeEl = document.createElement('time');
    timeEl.className = 'text-xs text-gray-400';
    timeEl.dateTime = entry.at;
    timeEl.textContent = formatActivityTimestamp(entry.at);

    metaRow.appendChild(pill);
    metaRow.appendChild(timeEl);

    const nameEl = document.createElement('p');
    nameEl.className = 'mt-1 text-sm font-medium text-gray-900';
    nameEl.textContent = entry.lecturerName;

    const detailEl = document.createElement('p');
    detailEl.className = 'text-sm text-gray-600';
    detailEl.textContent = describeActivityEntry(entry);

    body.appendChild(metaRow);
    body.appendChild(nameEl);
    body.appendChild(detailEl);

    row.appendChild(dot);
    row.appendChild(body);
    container.appendChild(row);
  });
}

function setupLoginPage() {
  const studentInput = document.getElementById('studentId');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');

  if (!studentInput || !passwordInput || !loginBtn) return;

  function checkFormValidity() {
    const isIdValid = studentInput.value.length === 8;
    const isPasswordValid = passwordInput.value.trim() !== '';
    const isValid = isIdValid && isPasswordValid;

    if (isValid) {
      loginBtn.disabled = false;
      loginBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      loginBtn.classList.add('hover:bg-yellow-500', 'cursor-pointer');
    } else {
      loginBtn.disabled = true;
      loginBtn.classList.add('opacity-50', 'cursor-not-allowed');
      loginBtn.classList.remove('hover:bg-yellow-500', 'cursor-pointer');
    }
  }

  loginBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    if (studentInput.value.length !== 8 || !passwordInput.value.trim()) return;
    loginBtn.disabled = true;
    try {
      const body = {
        institutional_id: studentInput.value.trim(),
        password: passwordInput.value,
      };
      const data = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(apiDetailMessage(j.detail) || r.statusText);
        return j;
      });
      setToken(data.access_token);
      if (data.user && data.user.role !== 'student') {
        clearToken();
        notifyWarning('This portal is for students. Use Lecturer Login for staff access.');
        loginBtn.disabled = false;
        checkFormValidity();
        return;
      }
      window.location.href = 'student/dashboard.html';
    } catch (e) {
      notifyError(e.message || 'Login failed');
      loginBtn.disabled = false;
      checkFormValidity();
    }
  });

  studentInput.addEventListener('input', function () {
    // Numbers-only logic
    this.value = this.value.replace(/\D/g, '');
    checkFormValidity();
  });

  passwordInput.addEventListener('input', checkFormValidity);

  const forgotPasswordLink = document.querySelector('a[href="#"]');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (event) => {
      event.preventDefault();
      notifyInfo('Password reset is not connected yet. Please contact AudiFi support.');
    });
  }
}

const AUDIFI_STUDENT_ISSUES_KEY = 'audiFiStudentIssueReports';

function persistStudentIssueReport(payload) {
  const list = JSON.parse(localStorage.getItem(AUDIFI_STUDENT_ISSUES_KEY) || '[]');
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    submittedAt: new Date().toISOString(),
    ...payload,
  };
  list.unshift(entry);
  localStorage.setItem(AUDIFI_STUDENT_ISSUES_KEY, JSON.stringify(list.slice(0, 40)));
}

function setupStudentReportIssueModal() {
  const modal = document.getElementById('studentReportIssueModal');
  const openBtn = document.getElementById('studentReportIssueBtn');
  const openSidebarBtn = document.getElementById('studentReportIssueBtnSidebar');
  const shell = document.getElementById('studentReportIssueShell');
  const closeBtn = document.getElementById('studentReportIssueClose');
  const cancelBtn = document.getElementById('studentReportIssueCancel');
  const form = document.getElementById('studentReportIssueForm');

  if (!modal || (!openBtn && !openSidebarBtn) || !form) return;

  function openModal() {
    const savedEmail = localStorage.getItem('audiFiStudentNotifyEmail') || '';
    form.reset();
    const contactEl = document.getElementById('reportIssueContact');
    if (contactEl) contactEl.value = savedEmail;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    form.reset();
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (openSidebarBtn) openSidebarBtn.addEventListener('click', openModal);
  if (shell) {
    shell.addEventListener('click', (e) => {
      if (e.target === shell) closeModal();
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const categoryEl = document.getElementById('reportIssueCategory');
    const category = categoryEl ? categoryEl.value : '';
    const location = document.getElementById('reportIssueLocation').value.trim();
    const description = document.getElementById('reportIssueDescription').value.trim();
    const contactEmail = document.getElementById('reportIssueContact').value.trim();

    if (!category) {
      notifyWarning('Please choose an issue type.');
      return;
    }

    if (description.length < 10) {
      notifyWarning('Please describe the problem in at least 10 characters.');
      return;
    }

    const categoryLabel =
      categoryEl && categoryEl.selectedOptions[0] ? categoryEl.selectedOptions[0].textContent.trim() : category;

    (async () => {
      try {
        if (getToken()) {
          await authFetch('/issue-reports', {
            method: 'POST',
            body: JSON.stringify({
              category,
              location: location || null,
              description,
              contact_email: contactEmail || null,
            }),
          });
          closeModal();
          notifySuccess('Thank you. Your report has been submitted to campus support.');
        } else {
          persistStudentIssueReport({
            reporterName: localStorage.getItem('audiFiProfileName') || 'Anonymous',
            category,
            categoryLabel,
            location,
            description,
            contactEmail,
          });
          closeModal();
          notifySuccess('Thank you. Your report has been saved for this demo. A full build would send it to campus support.');
        }
      } catch (err) {
        notifyError(err.message || 'Could not submit report.');
      }
    })();
  });
}

function refreshStudentDiscoveryHeader(me) {
  const welcomeTitle = document.getElementById('welcomeTitle');
  const studentNameEl = document.getElementById('studentName');
  const programEl = document.getElementById('studentProgramLine');
  const avatarEl = document.getElementById('studentAvatarInitials');
  const studentName =
    (me && me.display_name) || localStorage.getItem('audiFiProfileName') || 'Kwame Mensah';
  const firstName = studentName.split(' ')[0] || 'Student';
  const initials = studentName
    .split(' ')
    .map((namePart) => namePart[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const program =
    (me && me.program) || localStorage.getItem('audiFiStudentProgram') || 'BSc Information Systems';
  if (welcomeTitle) welcomeTitle.textContent = `Welcome back, ${firstName}`;
  if (studentNameEl) studentNameEl.textContent = studentName;
  if (programEl) programEl.textContent = program;
  if (avatarEl) avatarEl.textContent = initials;
}

async function setupStudentDiscoveryPortal() {
  const hallsGrid = document.getElementById('hallsGrid');
  if (!hallsGrid) return;

  if (!getToken()) {
    window.location.href = '/home_page.html';
    return;
  }

  let halls = [];
  let studentMe = null;

  try {
    studentMe = await authFetch('/auth/me');
    if (studentMe.role !== 'student') {
      window.location.href = '/staff/dashboard.html';
      return;
    }
    const apiHalls = await authFetch('/halls');
    halls = apiHalls.map((h) => ({
      name: h.name,
      status: h.status,
      seats: h.capacity,
      location: h.campus_zone,
      event: h.current_or_next_event,
      wifi: h.has_wifi,
      projector: h.has_projector,
      ac: h.has_ac,
      live: h.live,
    }));
  } catch (e) {
    notifyError(e.message || 'Could not load dashboard');
    clearToken();
    window.location.href = '/home_page.html';
    return;
  }

  refreshStudentDiscoveryHeader(studentMe);

  function getStatusStyles(status) {
    if (status === 'Occupied') return 'bg-rose-100 text-rose-700 border border-rose-200';
    if (status === 'Booked - Pending') return 'bg-amber-100 text-amber-700 border border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  }

  function featureIcon(enabled) {
    return enabled ? 'text-emerald-600' : 'text-gray-300';
  }

  function renderHalls() {
    const liveCount = document.getElementById('liveCount');
    if (!liveCount) return;
    hallsGrid.innerHTML = '';

    const prefSnap = (studentMe && studentMe.preferences) || {};
    const compact =
      prefSnap.compact_cards === true || localStorage.getItem('audiFiStudentCompactCards') === 'true';
    const cardPad = compact ? 'p-4' : 'p-5';
    const mbMain = compact ? 'mb-3' : 'mb-4';

    halls.forEach((hall) => {
      const card = document.createElement('article');
      card.className = `rounded-2xl border border-white/60 bg-white/75 ${cardPad} shadow-soft backdrop-blur-xl`;
      card.innerHTML = `
        <div class="${mbMain} flex items-start justify-between gap-3">
          <div>
            <h4 class="text-base font-semibold text-gray-900">${hall.name}</h4>
            <p class="mt-1 text-xs text-gray-500">${hall.location}</p>
          </div>
          <span class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyles(hall.status)}">
            ${hall.live ? '<span class="h-2 w-2 rounded-full bg-current animate-pulse"></span>' : ''}
            ${hall.status}
          </span>
        </div>
        <div class="space-y-2 text-sm text-gray-700">
          <p><span class="font-medium">Seats:</span> ${hall.seats}</p>
          <p><span class="font-medium">Current/Next Event:</span> ${hall.event}</p>
        </div>
        <div class="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3 text-xs">
          <span class="inline-flex items-center gap-1 ${featureIcon(hall.wifi)}"><i data-lucide="wifi" class="h-3.5 w-3.5"></i>WiFi</span>
          <span class="inline-flex items-center gap-1 ${featureIcon(hall.projector)}"><i data-lucide="presentation" class="h-3.5 w-3.5"></i>Projector</span>
          <span class="inline-flex items-center gap-1 ${featureIcon(hall.ac)}"><i data-lucide="fan" class="h-3.5 w-3.5"></i>AC</span>
        </div>
      `;
      hallsGrid.appendChild(card);
    });

    liveCount.textContent = `${halls.length} halls tracked`;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function updateLastUpdated() {
    const now = new Date();
    const lastUpdated = document.getElementById('lastUpdated');
    if (!lastUpdated) return;
    lastUpdated.textContent = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('hidden'));
  }

  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      clearToken();
      window.location.href = '/home_page.html';
    });
  }

  renderHalls();
  updateLastUpdated();
  setInterval(updateLastUpdated, 15000);

  async function loadStudentActivityFeed() {
    try {
      const rows = await authFetch('/activity?limit=8');
      const items = rows.map(mapApiActivityToEntry);
      renderLecturerActivityList('studentLecturerActivityList', {
        limit: 8,
        items,
        emptyMessage:
          'No updates yet. When lecturers book halls, cancel bookings, or call off classes in the staff portal, they will show up here.',
      });
    } catch {
      renderLecturerActivityList('studentLecturerActivityList', {
        limit: 8,
        items: [],
        emptyMessage: 'Could not load lecturer activity.',
      });
    }
  }
  await loadStudentActivityFeed();

  function setupStudentPreferencesModal() {
    const modal = document.getElementById('studentPreferencesModal');
    const openBtn = document.getElementById('studentPreferencesBtn');
    const shell = document.getElementById('studentPreferencesShell');
    const closeBtn = document.getElementById('studentPreferencesClose');
    const discardBtn = document.getElementById('studentPreferencesDiscard');
    const saveBtn = document.getElementById('studentPreferencesSave');
    const passwordForm = document.getElementById('studentPasswordForm');
    const DEMO_PW_KEY = 'audiFiDemoStudentPortalPassword';

    if (!modal || !openBtn) return;

    function setStudentPrefTab(tabId) {
      document.querySelectorAll('.student-pref-tab').forEach((btn) => {
        const active = btn.dataset.studentPrefTab === tabId;
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.classList.toggle('border-b-2', active);
        btn.classList.toggle('border-knustGold', active);
        btn.classList.toggle('bg-knustMint/50', active);
        btn.classList.toggle('text-gray-900', active);
        btn.classList.toggle('text-gray-600', !active);
      });
      document.querySelectorAll('[data-student-pref-panel]').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.studentPrefPanel !== tabId);
      });
    }

    function clearPasswordFields() {
      ['studentPrefCurrentPassword', 'studentPrefNewPassword', 'studentPrefConfirmPassword'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    }

    function openModal() {
      setStudentPrefTab('profile');
      const p = (studentMe && studentMe.preferences) || {};
      document.getElementById('studentPrefDisplayName').value =
        (studentMe && studentMe.display_name) || localStorage.getItem('audiFiProfileName') || '';
      document.getElementById('studentPrefProgram').value =
        (studentMe && studentMe.program) || localStorage.getItem('audiFiStudentProgram') || '';
      document.getElementById('studentPrefCampusZone').value =
        p.campus_zone || localStorage.getItem('audiFiStudentCampusZone') || '';
      document.getElementById('studentPrefCompactCards').checked =
        p.compact_cards === true || localStorage.getItem('audiFiStudentCompactCards') === 'true';
      document.getElementById('studentPrefNotifyEmail').value =
        p.notify_email || localStorage.getItem('audiFiStudentNotifyEmail') || '';
      document.getElementById('studentPrefNotifyHalls').checked =
        p.notify_halls === true || localStorage.getItem('audiFiStudentNotifyHalls') === 'true';
      document.getElementById('studentPrefNotifyLecturers').checked =
        p.notify_lecturers === true || localStorage.getItem('audiFiStudentNotifyLecturers') === 'true';
      document.getElementById('studentPrefNotifyProduct').checked =
        p.notify_product === true || localStorage.getItem('audiFiStudentNotifyProduct') === 'true';
      clearPasswordFields();
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      clearPasswordFields();
    }

    function savePreferences() {
      (async () => {
        const name = document.getElementById('studentPrefDisplayName').value.trim();
        const program = document.getElementById('studentPrefProgram').value.trim();
        const zone = document.getElementById('studentPrefCampusZone').value;
        const compact = document.getElementById('studentPrefCompactCards').checked;
        const email = document.getElementById('studentPrefNotifyEmail').value.trim();
        const nHalls = document.getElementById('studentPrefNotifyHalls').checked;
        const nLect = document.getElementById('studentPrefNotifyLecturers').checked;
        const nProd = document.getElementById('studentPrefNotifyProduct').checked;
        const prev = (studentMe && studentMe.preferences) || {};
        try {
          studentMe = await authFetch('/auth/me', {
            method: 'PATCH',
            body: JSON.stringify({
              display_name: name || undefined,
              program: program || null,
              preferences: {
                ...prev,
                campus_zone: zone || null,
                compact_cards: compact,
                notify_email: email || null,
                notify_halls: nHalls,
                notify_lecturers: nLect,
                notify_product: nProd,
              },
            }),
          });
          refreshStudentDiscoveryHeader(studentMe);
          renderHalls();
          closeModal();
        } catch (err) {
          notifyError(err.message || 'Could not save preferences');
        }
      })();
    }

    openBtn.addEventListener('click', openModal);
    document.querySelectorAll('.student-pref-tab').forEach((btn) => {
      btn.addEventListener('click', () => setStudentPrefTab(btn.dataset.studentPrefTab));
    });
    if (shell) {
      shell.addEventListener('click', (e) => {
        if (e.target === shell) closeModal();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (discardBtn) discardBtn.addEventListener('click', closeModal);
    if (saveBtn) saveBtn.addEventListener('click', savePreferences);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        notifyInfo('Password changes are not available via the API in this build. Use your seeded demo password or reset via database admin.');
        passwordForm.reset();
      });
    }
  }

  setupStudentPreferencesModal();
  setupStudentReportIssueModal();

  const allButtons = Array.from(document.querySelectorAll('button'));
  const findNearestBtn = allButtons.find((btn) => btn.textContent.trim() === 'Find Nearest Empty Hall');

  if (findNearestBtn) {
    findNearestBtn.addEventListener('click', () => {
    window.location.href = '/student/available-halls.html';
    });
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

async function setupStaffPortal() {
  const hasBookingForm = Boolean(document.getElementById('auditoriumSelect'));
  const hasDashboardWidgets = Boolean(document.getElementById('usageStats') || document.getElementById('lecturerActivityList'));
  const hasBookingsList = Boolean(document.getElementById('bookingsList'));
  if (!hasBookingForm && !hasDashboardWidgets && !hasBookingsList) return;

  if (!getToken()) {
    window.location.href = '/staff/login.html';
    return;
  }

  let staffMe = null;
  let hallRows = [];
  let courseRows = [];
  let timeSlotRows = [];
  let bookings = [];
  const bookingActionInFlight = new Set();

  try {
    staffMe = await authFetch('/auth/me');
    if (staffMe.role !== 'staff') {
      window.location.href = '/student/dashboard.html';
      return;
    }
    const results = await Promise.all([
      authFetch('/courses'),
      authFetch('/time-slots'),
      authFetch('/halls'),
      authFetch('/bookings/me'),
    ]);
    courseRows = results[0];
    timeSlotRows = results[1];
    hallRows = results[2];
    bookings = results[3];
  } catch (e) {
    notifyError(e.message || 'Could not load staff portal');
    clearToken();
    window.location.href = '/staff/login.html';
    return;
  }

  const staffData = {
    name: staffMe.display_name,
    id: staffMe.institutional_id,
  };

  const staffNameEl = document.getElementById('staffName');
  const staffInfoEl = document.getElementById('staffInfo');

  function updateStaffSection() {
    if (staffNameEl) staffNameEl.textContent = staffData.name;
    const dept = staffMe.department;
    if (staffInfoEl) {
      staffInfoEl.textContent = dept
        ? `Welcome back, ${staffData.name}! · ${dept}`
        : `Welcome back, ${staffData.name}!`;
    }
    const avatar = document.getElementById('staffAvatarLetter');
    if (avatar) {
      const letter = (staffData.name || '?').trim().charAt(0).toUpperCase();
      avatar.textContent = letter || '?';
    }
  }

  function fillSelect(selectId, rows, valueKey, labelKey) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    rows.forEach((row) => {
      const opt = document.createElement('option');
      opt.value = row[valueKey];
      opt.textContent = row[labelKey];
      select.appendChild(opt);
    });
  }

  async function loadStaffActivityFeed() {
    const feedEl = document.getElementById('lecturerActivityList');
    if (feedEl) {
      feedEl.innerHTML = '<p class="text-sm text-gray-500">Loading recent activity...</p>';
    }
    try {
      const rows = await authFetch('/activity?limit=5');
      const items = rows.map(mapApiActivityToEntry);
      renderLecturerActivityList('lecturerActivityList', {
        limit: 5,
        items,
        emptyMessage:
          'No lecturer activity yet. Book a hall, cancel a reservation, or call off a class to populate this log.',
      });
    } catch {
      renderLecturerActivityList('lecturerActivityList', {
        limit: 5,
        items: [],
        emptyMessage: 'Could not load activity.',
      });
    }
  }

  async function loadFixedTimetable() {
    const listEl = document.getElementById('fixedTimetableList');
    if (!listEl) return;
    try {
      const rows = await authFetch('/staff/fixed-timetable');
      if (!Array.isArray(rows) || rows.length === 0) {
        listEl.innerHTML = '<p class="text-sm text-gray-500">No fixed timetable records found yet.</p>';
        return;
      }
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const now = new Date();
      const nowDow = (now.getDay() + 6) % 7; // JS Sun=0 -> Mon=0
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      function toMinutes(hhmm) {
        const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        return Number(m[1]) * 60 + Number(m[2]);
      }

      const ranked = rows
        .map((row) => {
          const dow = Number(row.day_of_week);
          const startMin = toMinutes(row.start_time);
          const endMin = toMinutes(row.end_time);
          const dayDiff = Number.isNaN(dow) ? 99 : (dow - nowDow + 7) % 7;
          let status = 'upcoming';
          let score = dayDiff * 1440 + (startMin ?? 0) - nowMinutes;
          if (dayDiff === 0 && startMin != null && endMin != null) {
            if (nowMinutes >= startMin && nowMinutes < endMin) {
              status = 'live';
              score = -10000 + (endMin - nowMinutes); // always top while in progress
            } else if (nowMinutes >= endMin) {
              status = 'recent';
              score = 100000 + (nowMinutes - endMin); // push ended classes lower
            }
          }
          return { ...row, __status: status, __score: score };
        })
        .sort((a, b) => a.__score - b.__score);

      const top = ranked.slice(0, 5);
      listEl.innerHTML =
        top
          .map((row) => {
            const dayName = dayNames[Number(row.day_of_week)] || `Day ${row.day_of_week}`;
            const statusChip =
              row.__status === 'live'
                ? '<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Happening now</span>'
                : row.__status === 'recent'
                  ? '<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Recently ended</span>'
                  : '<span class="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Upcoming</span>';
            return `
            <article class="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-gray-900">${row.course_name}</p>
                ${statusChip}
                <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">${dayName}</span>
                <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">${row.start_time} - ${row.end_time}</span>
              </div>
              <p class="mt-1 text-xs text-gray-600">${row.hall_name} · ${row.lecturer_name} · ${row.semester}</p>
            </article>
          `;
          })
          .join('') +
        (rows.length > 5
          ? '<p class="text-xs text-gray-500">Showing classes nearest to the current time (5 of ' +
            rows.length +
            '). Open calendar for full list.</p>'
          : '');
    } catch (err) {
      listEl.innerHTML = '<p class="text-sm text-gray-500">Could not load fixed timetable.</p>';
      notifyError(err.message || 'Could not load fixed timetable');
    }
  }

  async function refreshStaffAnalytics() {
    const usageStatsEl = document.getElementById('usageStats');
    const dashboardBarChartEl = document.getElementById('dashboardBarChart');
    const dashboardDonutEl = document.getElementById('dashboardDonut');
    const activityLogEl = document.getElementById('activityLog');
    let data;
    try {
      data = await authFetch('/staff/analytics');
    } catch {
      if (usageStatsEl) usageStatsEl.innerHTML = '<p class="text-sm text-gray-500">Could not load analytics.</p>';
      return;
    }

    const todayStr = data.today_str;
    const activeReservations = data.active_reservations;
    const todaySessions = data.today_sessions;
    const weekSessions = data.week_sessions;
    const distinctHalls = data.distinct_halls;
    const catalogHalls = data.catalog_halls;
    const hallCoveragePct = data.hall_coverage_pct;
    const acts7dLen = data.lecturer_events_7d;
    const keypad30d = data.keypad_checkins_30d;
    const bookedLogged30d = data.new_bookings_logged_30d;
    const cancelledLogged30d = data.released_cancelled_30d;
    const callOffs30d = data.classes_called_off_30d;
    const releaseRateDisplay = data.release_rate_display;
    const releaseRateHint = data.release_rate_hint;
    const releaseWarn = data.release_rate_warn;
    const kpiActiveReservationsEl = document.getElementById('staffKpiActiveReservations');
    const kpiTodaySessionsEl = document.getElementById('staffKpiTodaySessions');
    const kpiDistinctHallsEl = document.getElementById('staffKpiDistinctHalls');
    const kpiReleasePressureEl = document.getElementById('staffKpiReleasePressure');
    const kpiActiveReservationsHintEl = document.getElementById('staffKpiActiveReservationsHint');
    const kpiTodaySessionsHintEl = document.getElementById('staffKpiTodaySessionsHint');
    const kpiDistinctHallsHintEl = document.getElementById('staffKpiDistinctHallsHint');
    const kpiReleasePressureHintEl = document.getElementById('staffKpiReleasePressureHint');

    if (kpiActiveReservationsEl) kpiActiveReservationsEl.textContent = String(activeReservations ?? '--');
    if (kpiTodaySessionsEl) kpiTodaySessionsEl.textContent = String(todaySessions ?? '--');
    if (kpiDistinctHallsEl) kpiDistinctHallsEl.textContent = String(distinctHalls ?? '--');
    if (kpiActiveReservationsHintEl) {
      kpiActiveReservationsHintEl.textContent = `${weekSessions} session${weekSessions === 1 ? '' : 's'} this week`;
    }
    if (kpiTodaySessionsHintEl) {
      kpiTodaySessionsHintEl.textContent = `Date: ${todayStr}`;
    }
    if (kpiDistinctHallsHintEl) {
      kpiDistinctHallsHintEl.textContent = `${hallCoveragePct}% of ${catalogHalls} halls in use`;
    }
    if (kpiReleasePressureEl || kpiReleasePressureHintEl) {
      let availableRows = [];
      try {
        const liveAvailable = await authFetch('/halls?available_now=true');
        availableRows = Array.isArray(liveAvailable) ? liveAvailable : [];
      } catch {
        // Fallback to already-loaded halls snapshot when live request fails.
        availableRows = Array.isArray(hallRows) ? hallRows.filter((h) => String(h.status || '').toLowerCase() === 'available') : [];
      }
      const classify = (name) => {
        const n = String(name || '').toUpperCase();
        if (n.includes('AUD') || n.includes('SMA')) return 'auditorium';
        if (n.includes('BLK') || n.includes('BLOCK') || n.includes('FF') || n.includes('SF') || n.includes('TF') || n.includes('AY')) {
          return 'classroom';
        }
        return 'lecture_hall';
      };
      let lectureHallCount = 0;
      let auditoriumCount = 0;
      let classroomCount = 0;
      availableRows.forEach((row) => {
        const type = classify(row.name);
        if (type === 'auditorium') auditoriumCount += 1;
        else if (type === 'classroom') classroomCount += 1;
        else lectureHallCount += 1;
      });
      if (kpiReleasePressureEl) {
        kpiReleasePressureEl.textContent = `${availableRows.length}/${catalogHalls}`;
      }
      if (kpiReleasePressureHintEl) {
        kpiReleasePressureHintEl.textContent = `Lecture halls ${lectureHallCount} • Auditoriums ${auditoriumCount} • Classrooms ${classroomCount}`;
      }
    }

    if (usageStatsEl) {
      usageStatsEl.innerHTML = `
        <article class="rounded-xl border border-gray-100 bg-white p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Weekly sessions</p>
          <p class="mt-2 text-2xl font-bold text-gray-900">${weekSessions}</p>
          <p class="mt-1 text-xs text-gray-500">Mon-Sun bookings by your team</p>
        </article>
        <article class="rounded-xl border border-gray-100 bg-white p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Events (7 days)</p>
          <p class="mt-2 text-2xl font-bold text-gray-900">${acts7dLen}</p>
          <p class="mt-1 text-xs text-gray-500">Bookings, releases and call-offs</p>
        </article>
        <article class="rounded-xl border border-gray-100 bg-white p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Check-ins (30 days)</p>
          <p class="mt-2 text-2xl font-bold text-gray-900">${keypad30d}</p>
          <p class="mt-1 text-xs text-gray-500">Confirmed via keypad</p>
        </article>
        <article class="rounded-xl border border-gray-100 bg-white p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Cancellations + call-offs</p>
          <p class="mt-2 text-2xl font-bold text-gray-900">${cancelledLogged30d + callOffs30d}</p>
          <p class="mt-1 text-xs text-gray-500">${releaseRateHint}</p>
        </article>
      `;
    }

    if (dashboardBarChartEl) {
      const bars = [
        { label: 'Mon', value: Math.max(0, Math.round(weekSessions * 0.12)) },
        { label: 'Tue', value: Math.max(0, Math.round(weekSessions * 0.16)) },
        { label: 'Wed', value: Math.max(0, Math.round(weekSessions * 0.2)) },
        { label: 'Thu', value: Math.max(0, Math.round(weekSessions * 0.18)) },
        { label: 'Fri', value: Math.max(0, Math.round(weekSessions * 0.22)) },
        { label: 'Sat', value: Math.max(0, Math.round(weekSessions * 0.08)) },
        { label: 'Sun', value: Math.max(0, Math.round(weekSessions * 0.04)) },
      ];
      const maxVal = Math.max(1, ...bars.map((b) => b.value));
      dashboardBarChartEl.innerHTML = `
        <div class="flex h-44 items-end gap-2">
          ${bars
            .map((b) => {
              const h = Math.max(8, Math.round((b.value / maxVal) * 150));
              return `
                <div class="flex flex-1 flex-col items-center gap-1">
                  <div class="w-full rounded-t-md bg-[#4f7cff]" style="height:${h}px"></div>
                  <p class="text-[10px] font-semibold text-gray-500">${b.label}</p>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
      if (!bars.some((b) => b.value > 0)) {
        dashboardBarChartEl.innerHTML += '<p class="mt-2 text-xs text-gray-500">No booking volume yet. Create bookings to see trend.</p>';
      }
    }

    if (dashboardDonutEl) {
      let hallStatusRows = [];
      try {
        const rows = await authFetch('/halls');
        hallStatusRows = Array.isArray(rows) ? rows : [];
      } catch {
        hallStatusRows = [];
      }
      const total = hallStatusRows.length;
      const occupiedCount = hallStatusRows.filter((h) => String(h.status || '').toLowerCase() === 'occupied').length;
      const bookedPendingCount = hallStatusRows.filter((h) => String(h.status || '').toLowerCase() === 'booked - pending').length;
      const availableCount = hallStatusRows.filter((h) => String(h.status || '').toLowerCase() === 'available').length;
      const unknownCount = Math.max(0, total - occupiedCount - bookedPendingCount - availableCount);
      const usedPct = total ? Math.round(((occupiedCount + bookedPendingCount) / total) * 100) : 0;
      const occupiedPct = total ? (occupiedCount / total) * 100 : 0;
      const bookedPendingPct = total ? (bookedPendingCount / total) * 100 : 0;
      const availablePct = total ? (availableCount / total) * 100 : 0;
      const unknownPct = Math.max(0, 100 - occupiedPct - bookedPendingPct - availablePct);
      const seg1 = occupiedPct;
      const seg2 = seg1 + bookedPendingPct;
      const seg3 = seg2 + availablePct;
      dashboardDonutEl.innerHTML = `
        <div class="mx-auto mt-1 h-48 w-48 rounded-full" style="background:
          conic-gradient(
            #4f7cff 0% ${seg1}%,
            #f59e0b ${seg1}% ${seg2}%,
            #34d399 ${seg2}% ${seg3}%,
            #cbd5e1 ${seg3}% ${Math.max(seg3, 100 - unknownPct)}%
          );">
          <div class="mx-auto mt-6 flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white text-center shadow-sm">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Utilization</p>
            <p class="text-2xl font-bold text-gray-900">${usedPct}%</p>
          </div>
        </div>
        <div class="mt-4 space-y-2 text-xs text-gray-600">
          <p><span class="inline-block h-2 w-2 rounded-full bg-[#4f7cff]"></span> Occupied (${occupiedCount})</p>
          <p><span class="inline-block h-2 w-2 rounded-full bg-[#f59e0b]"></span> Booked - pending (${bookedPendingCount})</p>
          <p><span class="inline-block h-2 w-2 rounded-full bg-[#34d399]"></span> Available (${availableCount})</p>
          ${unknownCount > 0 ? `<p><span class="inline-block h-2 w-2 rounded-full bg-[#cbd5e1]"></span> Other (${unknownCount})</p>` : ''}
        </div>
      `;
    }

    if (activityLogEl) {
      activityLogEl.innerHTML = '';
      const recent = bookings.slice(-5).reverse();
      if (recent.length === 0) {
        activityLogEl.innerHTML = '<p class="text-sm text-gray-500">No recent activity.</p>';
      } else {
        recent.forEach((booking) => {
          const activityItem = document.createElement('div');
          activityItem.className = 'flex items-center gap-3 py-2';
          activityItem.innerHTML = `
            <div class="h-2 w-2 rounded-full bg-knustGold"></div>
            <div class="text-sm">
              <span class="font-medium text-gray-900">${booking.hall_name}</span>
              <span class="text-gray-500">booked for ${booking.course_title}</span>
            </div>
            <div class="ml-auto text-xs text-gray-400">${booking.booking_date}</div>
          `;
          activityLogEl.appendChild(activityItem);
        });
      }
    }
  }

  function renderBookings() {
    const container = document.getElementById('bookingsList');
    if (!container) return;

    container.className = 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';
    container.innerHTML = '';

    if (bookings.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No bookings yet.</p>';
      return;
    }

    const sortedBookings = [...bookings].sort((a, b) => {
      const statusRank = (row) => {
        const s = String((row && row.status) || '').toLowerCase();
        if (s === 'in_session') return 0;
        if (s === 'booked') return 1;
        if (s === 'completed') return 2;
        if (s === 'cancelled') return 3;
        return 4;
      };
      const rankDiff = statusRank(a) - statusRank(b);
      if (rankDiff !== 0) return rankDiff;
      const aTime = new Date(`${a.booking_date || ''}T00:00:00`).getTime();
      const bTime = new Date(`${b.booking_date || ''}T00:00:00`).getTime();
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) return bTime - aTime;
      return String(a.time_slot_label || '').localeCompare(String(b.time_slot_label || ''));
    });

    sortedBookings.forEach((booking) => {
      const card = document.createElement('article');
      card.className = 'group rounded-2xl border border-[#e6eaf2] bg-white p-4 shadow-[0_6px_20px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)]';
      const hallName = booking.hall_name;
      const courseTitle = booking.course_title;
      const dateStr = booking.booking_date;
      const timeLbl = booking.time_slot_label;
      const hallMeta = Array.isArray(hallRows)
        ? hallRows.find((h) => String(h.name || '').trim().toLowerCase() === String(hallName || '').trim().toLowerCase())
        : null;
      const hallCapacity = Number(hallMeta && hallMeta.capacity ? hallMeta.capacity : 0);
      const hallType = inferHallTypeLabel({ ...(hallMeta || {}), name: hallName });
      const hasProjector = Boolean(hallMeta && hallMeta.has_projector);
      const hasAudio = Boolean(hallMeta && hallMeta.has_projector);
      const hasAc = Boolean(hallMeta && hallMeta.has_ac);
      const hasRecording = Boolean(hallMeta && hallMeta.has_recording_capability);
      const bookingStatus = String(booking.status || '').toLowerCase();
      const isActionable = bookingStatus === 'booked' || bookingStatus === 'in_session';
      const statusLabel = bookingStatus.replace('_', ' ') || 'booked';
      const statusTone =
        bookingStatus === 'cancelled'
          ? 'bg-slate-100 text-slate-700 border-slate-200'
          : bookingStatus === 'completed'
            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
            : bookingStatus === 'in_session'
              ? 'bg-blue-100 text-blue-800 border-blue-200'
              : 'bg-amber-100 text-amber-900 border-amber-200';

      card.innerHTML = `
        <div class="flex h-full flex-col gap-3">
          <div class="flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Booked Hall</p>
              <h4 class="mt-1 text-base font-semibold text-gray-900">${hallName}</h4>
            </div>
            <p class="inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusTone}">
                ${statusLabel}
            </p>
          </div>

          <div class="space-y-1">
            <p class="text-sm text-gray-700"><span class="font-semibold text-gray-900">Course:</span> ${courseTitle}</p>
            <p class="text-xs text-gray-600">${dateStr} • ${timeLbl}</p>
          </div>

          <div class="grid gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3 sm:grid-cols-2">
            <div>
              <p class="text-[11px] uppercase tracking-wide text-gray-500">Capacity</p>
              <p class="text-sm font-semibold text-gray-900">${hallCapacity > 0 ? hallCapacity : 'N/A'}</p>
            </div>
            <div>
              <p class="text-[11px] uppercase tracking-wide text-gray-500">Type</p>
              <p class="text-sm font-semibold text-gray-900">${hallType}</p>
            </div>
            <div class="sm:col-span-2 lg:col-span-2">
              <p class="text-[11px] uppercase tracking-wide text-gray-500">Facilities</p>
              <div class="mt-1 flex flex-wrap gap-1.5">
                ${yesNoBadge('Projector', hasProjector)}
                ${yesNoBadge('Audio', hasAudio)}
                ${yesNoBadge('AC', hasAc)}
                ${yesNoBadge('Recording', hasRecording)}
              </div>
            </div>
          </div>

          <div class="mt-auto flex flex-wrap gap-2 pt-1">
            ${
              isActionable
                ? `
            <button type="button" class="call-off-class-btn inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100" data-booking-id="${booking.id}">
              Call off class
            </button>
            <button type="button" class="cancel-booking-btn inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100" data-booking-id="${booking.id}">
              Cancel booking
            </button>`
                : `
            <button type="button" class="cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500" disabled>
              Action completed
            </button>`
            }
          </div>
        </div>
      `;

      container.appendChild(card);
    });

    async function removeBookingById(bookingId, activityType) {
      const idNum = Number(bookingId);
      const booking = bookings.find((b) => Number(b.id) === idNum);
      if (!booking) {
        notifyError('Booking not found. Please refresh and try again.');
        return;
      }
      const bookingStatus = String(booking.status || '').toLowerCase();
      if (!(bookingStatus === 'booked' || bookingStatus === 'in_session')) {
        notifyInfo(`No further actions allowed. This booking is already ${bookingStatus || 'processed'}.`);
        return;
      }
      if (bookingActionInFlight.has(idNum)) {
        notifyInfo('This action is already in progress...');
        return;
      }
      const prefs = staffMe.preferences || {};
      if (prefs.confirm_before_cancel === true) {
        const isCallOff = activityType === 'class_called_off';
        const msg = isCallOff
          ? `Call off class for “${booking.course_title}” at ${booking.hall_name}? Students will see updated hall status.`
          : `Cancel booking for “${booking.course_title}” at ${booking.hall_name}?`;
        if (!window.confirm(msg)) {
          notifyInfo('Action cancelled.');
          return;
        }
      }
      try {
        bookingActionInFlight.add(idNum);
        const path =
          activityType === 'class_called_off'
            ? `/bookings/${idNum}/call-off`
            : `/bookings/${idNum}/cancel`;
        await authFetch(path, { method: 'POST', body: '{}' });
        bookings = await authFetch('/bookings/me');
        renderBookings();
        await refreshStaffAnalytics();
        await loadStaffActivityFeed();
        notifySuccess(
          activityType === 'class_called_off'
            ? `Class called off for ${booking.course_title}.`
            : `Booking cancelled for ${booking.course_title}.`,
        );
      } catch (err) {
        notifyError(err.message || 'Could not update booking');
      } finally {
        bookingActionInFlight.delete(idNum);
      }
    }

    document.querySelectorAll('.cancel-booking-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.target.closest('.cancel-booking-btn');
        removeBookingById(el.dataset.bookingId, 'booking_cancelled');
      });
    });

    document.querySelectorAll('.call-off-class-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.target.closest('.call-off-class-btn');
        removeBookingById(el.dataset.bookingId, 'class_called_off');
      });
    });
  }

  function setupBookingForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;
    const hallSelect = document.getElementById('auditoriumSelect');
    const dateInput = document.getElementById('dateInput');
    const startTimeInput = document.getElementById('startTimeInput');
    const endTimeInput = document.getElementById('endTimeInput');
    const availabilityHint = document.getElementById('bookingAvailabilityHint');

    function resetHallOptionsWithAll() {
      fillSelect('auditoriumSelect', hallRows, 'id', 'name');
    }

    async function refreshHallAvailabilityForSelection() {
      if (!hallSelect || !dateInput || !startTimeInput || !endTimeInput) return;
      const date = dateInput.value;
      const startTime = startTimeInput.value;
      const endTime = endTimeInput.value;
      if (!date || !startTime || !endTime) {
        resetHallOptionsWithAll();
        if (availabilityHint) {
          availabilityHint.className = 'hidden rounded-lg border px-3 py-2 text-xs';
          availabilityHint.textContent = '';
        }
        return;
      }
      const rangeCheck = validateBookingTimes(date, startTime, endTime);
      if (!rangeCheck.ok && String(rangeCheck.message || '').toLowerCase().includes('end time must be later')) {
        resetHallOptionsWithAll();
        if (availabilityHint) {
          availabilityHint.className = 'hidden rounded-lg border px-3 py-2 text-xs';
          availabilityHint.textContent = '';
        }
        notifyWarning(rangeCheck.message);
        return;
      }

      try {
        const data = await authFetch(
          `/staff/halls/availability?booking_date=${encodeURIComponent(date)}&start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`,
        );
        const available = Array.isArray(data.available_halls) ? data.available_halls : [];
        hallSelect.innerHTML = '';
        if (available.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'No available halls for this time';
          hallSelect.appendChild(opt);
        } else {
          available.forEach((h) => {
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.textContent = h.name;
            hallSelect.appendChild(opt);
          });
        }
        if (availabilityHint) {
          if (available.length > 0) {
            availabilityHint.className = 'w-full max-w-full rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800';
            const batchSize = 5;
            let pageStart = 0;
            const renderAvailableHallCards = () => {
              const selectedHallId = hallSelect.value || '';
              const pageEnd = Math.min(pageStart + batchSize, available.length);
              const visibleHalls = available.slice(pageStart, pageEnd);
              const hasPrev = pageStart > 0;
              const hasMore = pageEnd < available.length;
              availabilityHint.innerHTML = `
                <p class="font-semibold text-emerald-900">Available halls (${available.length}) for ${data.time_slot_label}</p>
                <div class="mt-2 grid grid-cols-6 gap-2 pb-1 pr-2" id="availableHallCards">
                  ${visibleHalls.map((hall) => {
                    const isSelected = String(hall.id) === String(selectedHallId);
                    const selectedClasses = isSelected
                      ? 'border-knustBlue ring-2 ring-knustBlue/25'
                      : 'border-emerald-200 hover:border-knustBlue/60';
                    return `
                      <button
                        type="button"
                        data-hall-card-id="${hall.id}"
                        class="w-full rounded-xl border bg-white p-3 text-left shadow-sm transition ${selectedClasses}"
                      >
                        <p class="text-sm font-semibold text-gray-900">${hall.name || 'Unnamed hall'}</p>
                        <p class="mt-1 text-[11px] text-gray-600">Capacity: <span class="font-semibold text-gray-800">${Number(hall.capacity || 0)}</span></p>
                        <p class="mt-1 text-[11px] text-gray-600">Type: <span class="font-semibold text-gray-800">${inferHallTypeLabel(hall)}</span></p>
                        <div class="mt-2 flex flex-wrap gap-1">
                          ${yesNoBadge('Projector', Boolean(hall.has_projector || hall.has_display || hall.has_monitor))}
                          ${yesNoBadge('Audio system', Boolean(hall.has_audio_system || hall.has_microphone))}
                          ${yesNoBadge('AC', Boolean(hall.has_ac))}
                          <span class="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                            <span aria-hidden="true" class="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
                                <path d="M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <path d="m17 10 4-2v8l-4-2z"/>
                              </svg>
                            </span>
                            Recording: ${Boolean(hall.has_recording_capability) ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </button>
                    `;
                  }).join('')}
                  ${hasMore ? `
                    <button
                      type="button"
                      id="availableHallSeeMore"
                      class="w-full rounded-xl border border-dashed border-knustBlue/50 bg-white p-3 text-left shadow-sm transition hover:border-knustBlue"
                    >
                      <p class="text-sm font-semibold text-knustBlue">See more</p>
                      <p class="mt-1 text-[11px] text-gray-600">Show next ${Math.min(batchSize, available.length - pageEnd)} halls</p>
                    </button>
                  ` : ''}
                </div>
                <div class="mt-2 flex items-center justify-between">
                  <p class="text-[11px] text-emerald-700">Tap a hall card to auto-select it in the dropdown.</p>
                  <div class="flex items-center gap-2">
                    ${hasPrev ? '<button type="button" id="availableHallPrev" class="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50">Previous</button>' : ''}
                    <span class="text-[11px] text-emerald-700">Showing ${pageStart + 1}-${pageEnd}</span>
                  </div>
                </div>
              `;
              const cardWrap = availabilityHint.querySelector('#availableHallCards');
              if (cardWrap) {
                cardWrap.querySelectorAll('button[data-hall-card-id]').forEach((btn) => {
                  btn.addEventListener('click', () => {
                    const hallId = btn.getAttribute('data-hall-card-id') || '';
                    if (!hallId) return;
                    hallSelect.value = hallId;
                    renderAvailableHallCards();
                  });
                });
              }
              const seeMoreBtn = availabilityHint.querySelector('#availableHallSeeMore');
              if (seeMoreBtn) {
                seeMoreBtn.addEventListener('click', () => {
                  pageStart = pageEnd;
                  renderAvailableHallCards();
                });
              }
              const prevBtn = availabilityHint.querySelector('#availableHallPrev');
              if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                  pageStart = Math.max(0, pageStart - batchSize);
                  renderAvailableHallCards();
                });
              }
            };
            renderAvailableHallCards();
          } else {
            availabilityHint.className = 'rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800';
            availabilityHint.innerHTML = '<p class="font-semibold">No halls available for the selected date and time.</p>';
          }
        }
      } catch (err) {
        resetHallOptionsWithAll();
        if (availabilityHint) {
          availabilityHint.className = 'hidden rounded-lg border px-3 py-2 text-xs';
          availabilityHint.textContent = '';
        }
        notifyWarning(err.message || 'Could not load hall availability.');
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const hallId = hallSelect.value;
      const courseId = document.getElementById('courseSelect').value;
      const date = dateInput.value;
      const startTime = startTimeInput ? startTimeInput.value : '';
      const endTime = endTimeInput ? endTimeInput.value : '';

      if (!hallId || !courseId || !date || !startTime || !endTime) {
        notifyWarning('Please fill in all fields.');
        return;
      }

      const timeCheck = validateBookingTimes(date, startTime, endTime);
      if (!timeCheck.ok) {
        notifyWarning(timeCheck.message);
        return;
      }

      (async () => {
        try {
          await authFetch('/bookings', {
            method: 'POST',
            body: JSON.stringify({
              hall_id: hallId,
              course_id: courseId,
              booking_date: date,
              start_time: startTime,
              end_time: endTime,
            }),
          });
          bookings = await authFetch('/bookings/me');
          renderBookings();
          await refreshStaffAnalytics();
          await loadStaffActivityFeed();
          form.reset();
          applyDefaultTimeToBookingForm();
          notifySuccess('Booking confirmed!');
        } catch (err) {
          notifyError(err.message || 'Booking failed');
        }
      })();
    });

    document.getElementById('cancelBooking').addEventListener('click', () => {
      form.reset();
      resetHallOptionsWithAll();
      if (availabilityHint) {
        availabilityHint.className = 'hidden rounded-lg border px-3 py-2 text-xs';
        availabilityHint.textContent = '';
      }
    });

    if (dateInput) dateInput.addEventListener('change', () => void refreshHallAvailabilityForSelection());
    if (startTimeInput) startTimeInput.addEventListener('change', () => void refreshHallAvailabilityForSelection());
    if (endTimeInput) endTimeInput.addEventListener('change', () => void refreshHallAvailabilityForSelection());
  }

  function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('menuToggle');

    if (!sidebar || !toggle) return;

    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
  }

  function applyDefaultTimeToBookingForm() {
    const st = document.getElementById('startTimeInput');
    const et = document.getElementById('endTimeInput');
    const prefs = staffMe.preferences || {};
    const defId = prefs.default_time_slot_id;
    const slot = timeSlotRows.find((t) => t.id === defId);
    if (st && et && slot) {
      st.value = String(slot.start_time || '');
      et.value = String(slot.end_time || '');
    }
  }

  function setupStaffSettings() {
    const modal = document.getElementById('staffSettingsModal');
    const openBtn = document.getElementById('staffSettingsBtn');
    const shell = document.getElementById('staffSettingsShell');
    const closeBtn = document.getElementById('staffSettingsClose');
    const cancelBtn = document.getElementById('staffSettingsCancel');
    const saveBtn = document.getElementById('staffSettingsSave');
    const defaultTimeSelect = document.getElementById('settingsDefaultTime');
    const passwordForm = document.getElementById('staffPasswordForm');

    if (!modal || !openBtn || !defaultTimeSelect) return;

    function syncDefaultTimeOptions() {
      const prefs = staffMe.preferences || {};
      const savedId = prefs.default_time_slot_id || '';
      defaultTimeSelect.innerHTML = '<option value="">No default (choose each booking)</option>';
      timeSlotRows.forEach((slot) => {
        const opt = document.createElement('option');
        opt.value = slot.id;
        opt.textContent = slot.label;
        defaultTimeSelect.appendChild(opt);
      });
      if (savedId && timeSlotRows.some((t) => t.id === savedId)) {
        defaultTimeSelect.value = savedId;
      }
    }

    function setSettingsTab(tabId) {
      document.querySelectorAll('.settings-tab').forEach((btn) => {
        const active = btn.dataset.settingsTab === tabId;
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.classList.toggle('border-b-2', active);
        btn.classList.toggle('border-knustGold', active);
        btn.classList.toggle('bg-gray-50/50', active);
        btn.classList.toggle('text-gray-900', active);
        btn.classList.toggle('text-gray-600', !active);
      });
      document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
        const show = panel.dataset.settingsPanel === tabId;
        panel.classList.toggle('hidden', !show);
      });
    }

    function clearPasswordFields() {
      const cur = document.getElementById('settingsCurrentPassword');
      const neu = document.getElementById('settingsNewPassword');
      const conf = document.getElementById('settingsConfirmPassword');
      if (cur) cur.value = '';
      if (neu) neu.value = '';
      if (conf) conf.value = '';
    }

    function openModal() {
      syncDefaultTimeOptions();
      setSettingsTab('profile');
      const nameEl = document.getElementById('settingsDisplayName');
      const deptEl = document.getElementById('settingsDepartment');
      const emailEl = document.getElementById('settingsNotifyEmail');
      const confirmEl = document.getElementById('settingsConfirmCancel');
      const p = staffMe.preferences || {};
      if (nameEl) {
        nameEl.value = staffMe.display_name || '';
      }
      if (deptEl) deptEl.value = staffMe.department || '';
      if (emailEl) emailEl.value = p.notify_email || '';
      if (confirmEl) {
        confirmEl.checked = p.confirm_before_cancel === true;
      }
      const nb = document.getElementById('settingsNotifyBookingConfirm');
      const nh = document.getElementById('settingsNotifyHallAlerts');
      const np = document.getElementById('settingsNotifyProductNews');
      if (nb) nb.checked = p.notify_booking_confirm === true;
      if (nh) nh.checked = p.notify_hall_alerts === true;
      if (np) np.checked = p.notify_product_news === true;
      clearPasswordFields();
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      clearPasswordFields();
    }

    function savePreferences() {
      (async () => {
        const name = document.getElementById('settingsDisplayName').value.trim();
        const dept = document.getElementById('settingsDepartment').value.trim();
        const email = document.getElementById('settingsNotifyEmail').value.trim();
        const defTimeId = defaultTimeSelect.value;
        const confirmCancel = document.getElementById('settingsConfirmCancel').checked;
        const notifyBooking = document.getElementById('settingsNotifyBookingConfirm').checked;
        const notifyHall = document.getElementById('settingsNotifyHallAlerts').checked;
        const notifyProduct = document.getElementById('settingsNotifyProductNews').checked;
        const prev = staffMe.preferences || {};
        try {
          staffMe = await authFetch('/auth/me', {
            method: 'PATCH',
            body: JSON.stringify({
              display_name: name || undefined,
              department: dept || null,
              preferences: {
                ...prev,
                default_time_slot_id: defTimeId || null,
                confirm_before_cancel: confirmCancel,
                notify_email: email || null,
                notify_booking_confirm: notifyBooking,
                notify_hall_alerts: notifyHall,
                notify_product_news: notifyProduct,
              },
            }),
          });
          staffData.name = staffMe.display_name;
          updateStaffSection();
          applyDefaultTimeToBookingForm();
          closeModal();
        } catch (err) {
          notifyError(err.message || 'Could not save settings');
        }
      })();
    }

    openBtn.addEventListener('click', openModal);
    document.querySelectorAll('.settings-tab').forEach((btn) => {
      btn.addEventListener('click', () => setSettingsTab(btn.dataset.settingsTab));
    });

    if (shell) {
      shell.addEventListener('click', (e) => {
        if (e.target === shell) closeModal();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        savePreferences();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        notifyInfo('Password changes are not available via the API in this build. Use your seeded demo password or reset via database admin.');
        passwordForm.reset();
      });
    }
  }

  // Sign out button
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      clearToken();
      window.location.href = '/home_page.html';
    });
  }

  async function initStaffPortal() {
    updateStaffSection();
    fillSelect('auditoriumSelect', hallRows, 'id', 'name');
    fillSelect('courseSelect', courseRows, 'id', 'title');
    fillSelect('timeSelect', timeSlotRows, 'id', 'label');
    applyDefaultTimeToBookingForm();
    renderBookings();
    await refreshStaffAnalytics();
    await loadStaffActivityFeed();
    await loadFixedTimetable();
    setupBookingForm();
    setupSidebarToggle();
    setupStaffSettings();

    const allButtons = Array.from(document.querySelectorAll('button'));
    const dashboardBtn = allButtons.find((btn) => btn.textContent.trim() === 'Dashboard');
    const bookAuditoriumBtn = allButtons.find((btn) => btn.textContent.trim() === 'Book Auditorium');
    const manageBookingsBtn = allButtons.find((btn) => btn.textContent.trim() === 'Manage Bookings');
    const analyticsBtn = allButtons.find((btn) => btn.textContent.trim() === 'Analytics');
    const supportBtn = allButtons.find((btn) => btn.textContent.trim() === 'Support');

    const bookingSection = document.getElementById('bookingForm');
    const bookingsList = document.getElementById('bookingsList');
    const analyticsHeading = Array.from(document.querySelectorAll('h4')).find(
      (heading) => heading.textContent.trim() === 'Usage Statistics',
    );

    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    if (bookAuditoriumBtn && bookingSection) {
      bookAuditoriumBtn.addEventListener('click', () => {
        bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    if (manageBookingsBtn && bookingsList) {
      manageBookingsBtn.addEventListener('click', () => {
        bookingsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    if (analyticsBtn && analyticsHeading) {
      analyticsBtn.addEventListener('click', () => {
        analyticsHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    if (supportBtn) {
      supportBtn.addEventListener('click', () => {
        notifyInfo('Support chat is coming soon. For now, email support@audifi.local');
      });
    }
  }

  void initStaffPortal();
}

function setupLecturerLoginPage() {
  const lecturerInput = document.getElementById('lecturerId');
  const passwordInput = document.getElementById('lecturerPassword');
  const loginBtn = document.getElementById('lecturerLoginBtn');
  const form = lecturerInput && lecturerInput.closest('form');

  if (!lecturerInput || !passwordInput || !loginBtn) return;
  let feedbackEl = document.getElementById('lecturerLoginFeedback');
  if (!feedbackEl && form) {
    feedbackEl = document.createElement('p');
    feedbackEl.id = 'lecturerLoginFeedback';
    feedbackEl.className = 'text-sm text-center hidden';
    form.appendChild(feedbackEl);
  }

  function setLoginFeedback(message, tone = 'error') {
    if (!feedbackEl) return;
    const text = String(message || '').trim();
    if (!text) {
      feedbackEl.textContent = '';
      feedbackEl.classList.add('hidden');
      return;
    }
    feedbackEl.textContent = text;
    feedbackEl.classList.remove('hidden', 'text-red-600', 'text-amber-700', 'text-emerald-700');
    feedbackEl.classList.add(
      tone === 'success' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-red-600',
    );
  }

  function checkFormValidity() {
    const isIdValid = lecturerInput.value.length === 8;
    const isPasswordValid = passwordInput.value.trim() !== '';
    const isValid = isIdValid && isPasswordValid;

    if (isValid) {
      loginBtn.removeAttribute('aria-disabled');
      loginBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      loginBtn.classList.add('hover:bg-yellow-500', 'cursor-pointer');
    } else {
      loginBtn.setAttribute('aria-disabled', 'true');
      loginBtn.classList.add('opacity-50', 'cursor-not-allowed');
      loginBtn.classList.remove('hover:bg-yellow-500', 'cursor-pointer');
    }
  }

  let lecturerLoginInFlight = false;

  async function onLecturerLoginSubmit(event) {
    event.preventDefault();
    if (lecturerLoginInFlight || loginBtn.disabled) return;
    if (lecturerInput.value.length !== 8 || !passwordInput.value.trim()) {
      setLoginFeedback('Please enter your 8-digit Lecturer ID and password.', 'warning');
      notifyWarning('Please enter your 8-digit Lecturer ID and password.');
      return;
    }
    setLoginFeedback('');
    lecturerLoginInFlight = true;
    loginBtn.disabled = true;
    try {
      const body = {
        institutional_id: lecturerInput.value.trim(),
        password: passwordInput.value,
      };
      const data = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(apiDetailMessage(j.detail) || r.statusText);
        return j;
      });
      setToken(data.access_token);
      if (data.user && data.user.role !== 'staff') {
        clearToken();
        setLoginFeedback('This account is not a lecturer/staff account.', 'warning');
        notifyWarning('Staff access only. Use the student login page for your account.');
        loginBtn.disabled = false;
        lecturerLoginInFlight = false;
        checkFormValidity();
        return;
      }
      window.location.href = 'dashboard.html';
    } catch (e) {
      setLoginFeedback(e.message || 'Login failed', 'error');
      notifyError(e.message || 'Login failed');
      loginBtn.disabled = false;
      lecturerLoginInFlight = false;
      checkFormValidity();
    }
  }

  if (form) {
    form.addEventListener('submit', onLecturerLoginSubmit);
  }

  lecturerInput.addEventListener('input', function () {
    // Numbers-only logic
    this.value = this.value.replace(/\D/g, '');
    setLoginFeedback('');
    checkFormValidity();
  });

  passwordInput.addEventListener('input', () => {
    setLoginFeedback('');
    checkFormValidity();
  });
  checkFormValidity();

  const forgotPasswordLink = document.querySelector('a[href="#"]');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (event) => {
      event.preventDefault();
      notifyInfo('Lecturer password reset is not connected yet. Contact system admin.');
    });
  }
}

async function setupAvailableHallsPage() {
  const hallsList = document.getElementById('availableHallsList');
  if (!hallsList) return;

  const countEl = document.getElementById('availableHallsCount');
  const backBtn = document.getElementById('backToDashboardBtn');

  if (!getToken()) {
    window.location.href = '/home_page.html';
    return;
  }

  let availableHalls = [];
  try {
    availableHalls = await authFetch('/halls?available_now=true');
  } catch (e) {
    hallsList.innerHTML = `<p class="text-sm text-red-600">${e.message || 'Could not load halls.'}</p>`;
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '/student/dashboard.html';
      });
    }
    return;
  }

  hallsList.innerHTML = '';

  if (countEl) {
    countEl.textContent = `${availableHalls.length} hall${availableHalls.length === 1 ? '' : 's'} available now`;
  }

  if (availableHalls.length === 0) {
    hallsList.innerHTML = `
      <article class="rounded-2xl border border-gray-200 bg-white p-5 shadow-soft">
        <h3 class="text-base font-semibold text-gray-900">No halls currently available</h3>
        <p class="mt-2 text-sm text-gray-600">Try again shortly. Live status updates as lecturers check in.</p>
      </article>
    `;
  } else {
    availableHalls.forEach((hall) => {
      const card = document.createElement('article');
      card.className = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-soft';
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-gray-900">${hall.name}</h3>
            <p class="text-xs text-gray-500">${hall.campus_zone}</p>
          </div>
          <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Available
          </span>
        </div>
        <div class="mt-3 space-y-1 text-sm text-gray-700">
          <p><span class="font-medium">Seats:</span> ${hall.capacity}</p>
          <p><span class="font-medium">Current/Next Event:</span> ${hall.current_or_next_event}</p>
        </div>
      `;
      hallsList.appendChild(card);
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = '/student/dashboard.html';
    });
  }
}

async function setupTimetableUploadPage() {
  const form = document.getElementById('timetableUploadForm');
  if (!form) return;
  const fileInput = document.getElementById('timetableFile');
  const semesterInput = document.getElementById('timetableSemester');
  const truncateInput = document.getElementById('timetableTruncate');
  const submitBtn = document.getElementById('timetableUploadBtn');
  const previewBtn = document.getElementById('timetablePreviewBtn');
  const resultBox = document.getElementById('timetableUploadResult');
  const previewTable = document.getElementById('timetablePreviewTable');
  const recordsMeta = document.getElementById('timetableRecordsMeta');
  const recordsTable = document.getElementById('timetableRecordsTable');
  const refreshBtn = document.getElementById('timetableRefreshBtn');
  const filterCourse = document.getElementById('timetableFilterCourse');
  const filterHall = document.getElementById('timetableFilterHall');
  const filterDay = document.getElementById('timetableFilterDay');

  if (!getToken()) {
    window.location.href = '/staff/login.html';
    return;
  }

  try {
    const me = await authFetch('/auth/me');
    if (!me || me.role !== 'staff') {
      clearToken();
      window.location.href = '/staff/login.html';
      return;
    }
  } catch (e) {
    notifyError(e.message || 'Authentication required');
    window.location.href = '/staff/login.html';
    return;
  }

  let inFlight = false;
  let timetableRows = [];

  function renderTimetableRecords() {
    if (!recordsTable) return;
    const courseQ = (filterCourse && filterCourse.value ? filterCourse.value : '').trim().toLowerCase();
    const hallQ = (filterHall && filterHall.value ? filterHall.value : '').trim().toLowerCase();
    const dayQ = filterDay ? String(filterDay.value || '').trim() : '';
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const filtered = timetableRows.filter((row) => {
      const courseOk = !courseQ || String(row.course_name || '').toLowerCase().includes(courseQ);
      const hallOk = !hallQ || String(row.hall_name || '').toLowerCase().includes(hallQ);
      const dayOk = !dayQ || String(row.day_of_week) === dayQ;
      return courseOk && hallOk && dayOk;
    });

    if (recordsMeta) {
      recordsMeta.textContent = `Showing ${filtered.length} of ${timetableRows.length} timetable records`;
    }

    if (filtered.length === 0) {
      recordsTable.className = 'mt-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600';
      recordsTable.textContent = 'No timetable records match your filters.';
      return;
    }

    const rowsHtml = filtered
      .slice(0, 200)
      .map((row) => {
        const dayLabel = dayNames[Number(row.day_of_week)] || row.day_of_week;
        return `
          <tr class="border-b last:border-b-0">
            <td class="px-3 py-2">${row.course_name || '-'}</td>
            <td class="px-3 py-2">${row.hall_name || '-'}</td>
            <td class="px-3 py-2">${dayLabel || '-'}</td>
            <td class="px-3 py-2">${row.start_time || '-'}</td>
            <td class="px-3 py-2">${row.end_time || '-'}</td>
            <td class="px-3 py-2">${row.semester || '-'}</td>
          </tr>
        `;
      })
      .join('');
    recordsTable.className = 'mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white';
    recordsTable.innerHTML = `
      <table class="min-w-full text-left text-xs text-gray-700">
        <thead class="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
          <tr>
            <th class="px-3 py-2">Course</th>
            <th class="px-3 py-2">Hall</th>
            <th class="px-3 py-2">Day</th>
            <th class="px-3 py-2">Start</th>
            <th class="px-3 py-2">End</th>
            <th class="px-3 py-2">Semester</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  }

  async function loadTimetableRecords() {
    if (recordsTable) {
      recordsTable.className = 'mt-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600';
      recordsTable.textContent = 'Loading timetable...';
    }
    try {
      timetableRows = await authFetch('/staff/fixed-timetable');
      if (!Array.isArray(timetableRows)) timetableRows = [];
      renderTimetableRecords();
    } catch (e) {
      if (recordsMeta) recordsMeta.textContent = '';
      if (recordsTable) {
        recordsTable.className = 'mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700';
        recordsTable.textContent = e.message || 'Could not load timetable records.';
      }
    }
  }

  function renderPreview(result) {
    if (!previewTable) return;
    const rows = Array.isArray(result.preview_rows) ? result.preview_rows : [];
    if (rows.length === 0) {
      previewTable.className = 'mt-4 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600';
      previewTable.textContent = 'No preview rows found.';
      return;
    }
    const rowHtml = rows
      .map(
        (row) => `
          <tr class="border-b last:border-b-0">
            <td class="px-3 py-2">${row.course_name || '-'}</td>
            <td class="px-3 py-2">${row.hall_name || '-'}</td>
            <td class="px-3 py-2">${row.day_of_week || '-'}</td>
            <td class="px-3 py-2">${row.start_time || '-'}</td>
            <td class="px-3 py-2">${row.end_time || '-'}</td>
            <td class="px-3 py-2">${row.semester || '-'}</td>
          </tr>
        `,
      )
      .join('');
    previewTable.className = 'mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white';
    previewTable.innerHTML = `
      <div class="border-b bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
        Previewing ${rows.length} row(s) of ${result.parsed_total || rows.length} parsed entries
      </div>
      <table class="min-w-full text-left text-xs text-gray-700">
        <thead class="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
          <tr>
            <th class="px-3 py-2">Course</th>
            <th class="px-3 py-2">Hall</th>
            <th class="px-3 py-2">Day</th>
            <th class="px-3 py-2">Start</th>
            <th class="px-3 py-2">End</th>
            <th class="px-3 py-2">Semester</th>
          </tr>
        </thead>
        <tbody>${rowHtml}</tbody>
      </table>
    `;
  }

  async function submitTimetable(previewOnly) {
    if (inFlight || !fileInput || !fileInput.files || fileInput.files.length === 0) {
      notifyWarning('Please choose a CSV or XLSX timetable file before uploading.');
      return;
    }
    const file = fileInput.files[0];
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) {
      notifyWarning('Only CSV and XLSX files are supported on this page.');
      return;
    }

    inFlight = true;
    if (submitBtn) submitBtn.disabled = true;
    if (previewBtn) previewBtn.disabled = true;
    if (resultBox) {
      resultBox.className = 'mt-4 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700';
      resultBox.textContent = previewOnly ? 'Parsing file for preview...' : 'Uploading and processing timetable...';
    }

    const body = new FormData();
    body.append('file', file);
    if (semesterInput && semesterInput.value.trim()) {
      body.append('semester', semesterInput.value.trim());
    }
    if (truncateInput && truncateInput.checked) {
      body.append('truncate', 'true');
    }
    if (previewOnly) {
      body.append('preview', 'true');
    }

    try {
      const result = await authFetch('/staff/fixed-timetable/upload', {
        method: 'POST',
        body,
      });
      if (previewOnly) {
        if (resultBox) {
          resultBox.className = 'mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800';
          resultBox.textContent = `Preview ready. Parsed ${result.parsed_total || 0} entries.`;
        }
        renderPreview(result);
      } else {
        const summary = `Import complete. Created: ${result.created || 0}, Updated: ${result.updated || 0}, Skipped: ${result.skipped || 0}.`;
        if (resultBox) {
          resultBox.className = 'mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800';
          const errors = Array.isArray(result.sample_errors) && result.sample_errors.length > 0
            ? `\nSample issues:\n- ${result.sample_errors.join('\n- ')}`
            : '';
          resultBox.textContent = `${summary}${errors}`;
        }
        notifySuccess(summary);
        await loadTimetableRecords();
      }
    } catch (e) {
      if (resultBox) {
        resultBox.className = 'mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700';
        resultBox.textContent = e.message || 'Upload failed';
      }
      notifyError(e.message || 'Upload failed');
    } finally {
      inFlight = false;
      if (submitBtn) submitBtn.disabled = false;
      if (previewBtn) previewBtn.disabled = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitTimetable(false);
  });

  if (previewBtn) {
    previewBtn.addEventListener('click', async () => {
      await submitTimetable(true);
    });
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadTimetableRecords();
    });
  }
  if (filterCourse) filterCourse.addEventListener('input', renderTimetableRecords);
  if (filterHall) filterHall.addEventListener('input', renderTimetableRecords);
  if (filterDay) filterDay.addEventListener('change', renderTimetableRecords);

  await loadTimetableRecords();
}

async function setupTimetableCalendarPage() {
  const gridEl = document.getElementById('timetableCalendarGrid');
  if (!gridEl) return;
  const metaEl = document.getElementById('timetableCalendarMeta');
  const refreshBtn = document.getElementById('timetableRefreshBtn');
  const eventListEl = document.getElementById('timetableEventList');
  const weeklyGridEl = document.getElementById('timetableWeeklyGrid');
  const filterCourse = document.getElementById('timetableFilterCourse');
  const filterLevel = document.getElementById('timetableFilterLevel');
  const filterHall = document.getElementById('timetableFilterHall');
  const prevMonthBtn = document.getElementById('calendarPrevMonthBtn');
  const nextMonthBtn = document.getElementById('calendarNextMonthBtn');
  const todayBtn = document.getElementById('calendarTodayBtn');
  const monthLabelEl = document.getElementById('calendarMonthLabel');
  const modalEl = document.getElementById('timetableEventModal');
  const modalCloseBtn = document.getElementById('timetableEventModalClose');
  const modalBodyEl = document.getElementById('timetableEventModalBody');

  if (!getToken()) {
    window.location.href = '/staff/login.html';
    return;
  }

  let rows = [];
  let visibleRows = [];
  let currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const weekHeadings = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const toneClasses = ['bg-blue-100 text-blue-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];

  function timetableDayToJsDay(dayValue) {
    const d = Number(dayValue);
    if (Number.isNaN(d)) return null;
    return (d + 1) % 7;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function to12Hour(time24) {
    const raw = String(time24 || '').trim();
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return raw || '--';
    const hh = Number(m[1]);
    const mm = m[2];
    const period = hh >= 12 ? 'PM' : 'AM';
    const hh12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${hh12}:${mm} ${period}`;
  }

  function durationLabel(start24, end24) {
    const s = String(start24 || '');
    const e = String(end24 || '');
    const sm = s.match(/^(\d{1,2}):(\d{2})$/);
    const em = e.match(/^(\d{1,2}):(\d{2})$/);
    if (!sm || !em) return '--';
    const sMin = Number(sm[1]) * 60 + Number(sm[2]);
    const eMin = Number(em[1]) * 60 + Number(em[2]);
    const diff = Math.max(eMin - sMin, 0);
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }

  function defaultLecturerAvatarDataUri() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#dbeafe"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="80" fill="url(#g)"/>
      <circle cx="80" cy="62" r="30" fill="#94a3b8"/>
      <path d="M28 140c8-24 30-40 52-40s44 16 52 40" fill="#94a3b8"/>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function lecturerImageSource(row) {
    const explicit = String((row && (row.lecturer_image || row.lecturer_photo_url || row.lecturer_avatar_url)) || '').trim();
    return explicit || defaultLecturerAvatarDataUri();
  }

  function openEventModalByIndex(idxValue) {
    const idx = Number(idxValue);
    if (!modalEl || !modalBodyEl || Number.isNaN(idx) || !visibleRows[idx]) return;
    const row = visibleRows[idx];
    const lecturerName = row.lecturer_name || 'Lecturer TBA';
    const imgSrc = lecturerImageSource(row);
    modalBodyEl.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="flex items-center gap-4">
          <img src="${esc(imgSrc)}" alt="${esc(lecturerName)}" class="h-16 w-16 rounded-full border border-white object-cover shadow-sm" onerror="this.onerror=null;this.src='${esc(defaultLecturerAvatarDataUri())}';">
          <div>
            <p class="text-sm font-semibold text-slate-900">${esc(lecturerName)}</p>
            <p class="text-xs text-slate-500">Lecturer</p>
            <div class="mt-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">${esc(row.student_group || 'Unspecified')}</div>
          </div>
        </div>
      </div>
      <div class="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
        <div class="rounded-lg border border-gray-200 bg-white p-3"><p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Course Name</p><p class="mt-1 font-semibold text-gray-900">${esc(row.course_name || '-')}</p></div>
        <div class="rounded-lg border border-gray-200 bg-white p-3"><p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Programme</p><p class="mt-1">${esc(row.student_group || 'Unspecified')}</p></div>
        <div class="rounded-lg border border-gray-200 bg-white p-3"><p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Class / Block / Auditorium</p><p class="mt-1">${esc(row.hall_name || 'No hall')}</p></div>
        <div class="rounded-lg border border-gray-200 bg-white p-3"><p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Lecturer Name</p><p class="mt-1">${esc(lecturerName)}</p></div>
        <div class="rounded-lg border border-gray-200 bg-white p-3"><p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Time</p><p class="mt-1">${esc(to12Hour(row.start_time))} - ${esc(to12Hour(row.end_time))}</p></div>
        <div class="rounded-lg border border-gray-200 bg-white p-3"><p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Class Duration</p><p class="mt-1">${esc(durationLabel(row.start_time, row.end_time))}</p></div>
      </div>
    `;
    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');
  }

  function closeEventModal() {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    modalEl.classList.remove('flex');
  }

  function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function extractFacet(row) {
    const groupRaw = String(row.student_group || '').trim().toUpperCase();
    let programme = groupRaw;
    let level = '';
    const m = groupRaw.match(/^(.*?)(\d)\s*$/);
    if (m) {
      programme = m[1].trim();
      level = `Level ${m[2]}00`;
    }
    const semesterRaw = String(row.semester || '').trim();
    const y = semesterRaw.match(/\b(20\d{2})\b/);
    const year = y ? y[1] : '';
    return { programme, level, year };
  }

  function matchesFilter(row) {
    const courseQ = (filterCourse && filterCourse.value ? filterCourse.value : '').trim().toLowerCase();
    const levelQ = (filterLevel && filterLevel.value ? filterLevel.value : '').trim().toLowerCase();
    const hallQ = (filterHall && filterHall.value ? filterHall.value : '').trim().toLowerCase();
    const facets = extractFacet(row);
    const c =
      !courseQ ||
      (courseQ === 'unspecified' && !String(facets.programme || '').trim()) ||
      String(facets.programme || '').toLowerCase() === courseQ;
    const l = !levelQ || String(facets.level || '').toLowerCase() === levelQ;
    const h = !hallQ || String(row.hall_name || '').toLowerCase().includes(hallQ);
    return c && l && h;
  }

  function buildMonthEvents(filteredRows, monthDate) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const eventsByDate = new Map();

    for (let day = 1; day <= last.getDate(); day += 1) {
      const date = new Date(year, month, day);
      const jsDay = date.getDay();
      const bucket = filteredRows.filter((row) => timetableDayToJsDay(row.day_of_week) === jsDay);
      if (bucket.length > 0) {
        eventsByDate.set(formatDateKey(date), bucket);
      }
    }
    return { first, last, eventsByDate };
  }

  function renderCalendar() {
    const filtered = rows.filter(matchesFilter);
    const decorated = filtered.map((row, idx) => ({ ...row, __idx: idx }));
    visibleRows = decorated;
    const { first, last, eventsByDate } = buildMonthEvents(decorated, currentMonth);
    const monthTitle = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (monthLabelEl) monthLabelEl.textContent = monthTitle;
    const selectedCourse = filterCourse && filterCourse.value ? filterCourse.value : 'All courses/programmes';
    const selectedLevel = filterLevel && filterLevel.value ? filterLevel.value : 'All levels';
    if (metaEl) metaEl.textContent = `${selectedCourse} · ${selectedLevel} · ${filtered.length} recurring entries in ${monthTitle}`;

    const dayHeaders = weekHeadings.map((d) => `<div class="border-b bg-gray-50 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">${d}</div>`).join('');
    const leading = first.getDay();
    const totalCells = Math.ceil((leading + last.getDate()) / 7) * 7;
    const todayKey = formatDateKey(new Date());
    let cellsHtml = '';
    for (let i = 0; i < totalCells; i += 1) {
      const dateNumber = i - leading + 1;
      if (dateNumber < 1 || dateNumber > last.getDate()) {
        cellsHtml += `<article class="min-h-[120px] border-b border-r bg-gray-50/50 p-2"></article>`;
        continue;
      }
      const date = new Date(first.getFullYear(), first.getMonth(), dateNumber);
      const key = formatDateKey(date);
      const entries = eventsByDate.get(key) || [];
      const eventChips = entries
        .slice(0, 3)
        .map((entry, idx) => {
          const tone = toneClasses[idx % toneClasses.length];
          const timeLabel = `${to12Hour(entry.start_time)}-${to12Hour(entry.end_time)}`;
          return `<button type="button" class="timetable-event-trigger mt-1 w-full rounded px-1.5 py-1 text-left text-[10px] font-medium ${tone}" data-event-idx="${entry.__idx}">${esc(entry.course_name || '-')} · ${esc(entry.hall_name || 'No hall')} · ${esc(timeLabel)}</button>`;
        })
        .join('');
      const overflow = entries.length > 3 ? `<p class="mt-1 text-[10px] font-medium text-gray-500">+${entries.length - 3} more</p>` : '';
      const dayBubble = key === todayKey
        ? `<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-knustGold text-[11px] font-semibold text-black">${dateNumber}</span>`
        : `<span class="text-[11px] font-semibold text-gray-700">${dateNumber}</span>`;
      cellsHtml += `
        <article class="min-h-[120px] border-b border-r bg-white p-2">
          <div class="flex items-center justify-between">${dayBubble}</div>
          ${eventChips || '<p class="mt-3 text-[10px] text-gray-300">No class</p>'}
          ${overflow}
        </article>
      `;
    }
    gridEl.className = 'overflow-x-auto rounded-xl border border-gray-200 bg-white';
    gridEl.innerHTML = `
      <div class="grid min-w-[900px] grid-cols-7">
        ${dayHeaders}
        ${cellsHtml}
      </div>
    `;

    if (eventListEl) {
      const byCourse = [...decorated].sort((a, b) => String(a.course_name || '').localeCompare(String(b.course_name || '')));
      eventListEl.innerHTML = byCourse
        .slice(0, 120)
        .map((row) => {
          const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][Number(row.day_of_week)] || '-';
          return `
            <button type="button" class="timetable-event-trigger w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left" data-event-idx="${row.__idx}">
              <p class="text-xs font-semibold text-gray-800">${esc(row.course_name || '-')}</p>
              <p class="mt-0.5 text-[10px] font-medium text-gray-500">${esc(row.student_group || 'Unspecified')}</p>
              <p class="mt-0.5 text-[11px] text-gray-600">${esc(row.hall_name || '-')}</p>
              <p class="mt-0.5 text-[10px] text-gray-500">${weekday} · ${esc(to12Hour(row.start_time))} - ${esc(to12Hour(row.end_time))} · ${esc(row.lecturer_name || 'Lecturer TBA')}</p>
            </button>
          `;
        })
        .join('');
    }

    if (weeklyGridEl) {
      const weekdayRows = [
        { label: 'Monday', value: 0 },
        { label: 'Tuesday', value: 1 },
        { label: 'Wednesday', value: 2 },
        { label: 'Thursday', value: 3 },
        { label: 'Friday', value: 4 },
      ];
      const slotLabels = [...new Set(decorated.map((r) => `${r.start_time || '--:--'}-${r.end_time || '--:--'}`))].sort((a, b) =>
        a.localeCompare(b),
      );
      if (slotLabels.length === 0) {
        weeklyGridEl.className = 'mt-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600';
        weeklyGridEl.textContent = 'No timetable records match your current filters.';
      } else {
        const slotToEntries = new Map();
        decorated.forEach((row) => {
          const key = `${row.day_of_week}__${row.start_time || '--:--'}-${row.end_time || '--:--'}`;
          if (!slotToEntries.has(key)) slotToEntries.set(key, []);
          slotToEntries.get(key).push(row);
        });
        const header = slotLabels
          .map((s) => {
            const parts = String(s).split('-');
            return `<th class="px-3 py-2">${esc(to12Hour(parts[0]))} - ${esc(to12Hour(parts[1]))}</th>`;
          })
          .join('');
        const body = weekdayRows
          .map((day) => {
            const cols = slotLabels
              .map((slot) => {
                const key = `${day.value}__${slot}`;
                const entries = slotToEntries.get(key) || [];
                if (entries.length === 0) {
                  return `<td class="px-2 py-2 align-top"><div class="rounded-md border border-dashed border-gray-200 bg-gray-50 px-2 py-2 text-[11px] text-gray-400">No class</div></td>`;
                }
                const html = entries
                  .map(
                    (e) => `<button type="button" class="timetable-event-trigger mb-1 w-full rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-left" data-event-idx="${e.__idx}">
                        <p class="text-[11px] font-semibold text-blue-900">${esc(e.course_name || '-')}</p>
                        <p class="text-[10px] text-blue-700">${esc(e.hall_name || 'No hall')}</p>
                        <p class="text-[10px] text-blue-600">${esc(e.lecturer_name || 'Lecturer TBA')}</p>
                      </button>`,
                  )
                  .join('');
                return `<td class="px-2 py-2 align-top">${html}</td>`;
              })
              .join('');
            return `<tr class="border-b last:border-b-0"><th class="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-slate-600">${day.label}</th>${cols}</tr>`;
          })
          .join('');
        weeklyGridEl.className = 'mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white';
        weeklyGridEl.innerHTML = `
          <table class="min-w-full text-left text-xs text-gray-700">
            <thead class="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr><th class="px-3 py-2">Day</th>${header}</tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        `;
      }
    }
  }

  function populateFacetFilters() {
    const programmes = new Set();
    const levels = new Set();
    rows.forEach((r) => {
      const f = extractFacet(r);
      if (f.programme) programmes.add(f.programme);
      if (f.level) levels.add(f.level);
    });
    if (filterCourse) {
      const sortedProgrammes = [...programmes].sort((a, b) => a.localeCompare(b));
      filterCourse.innerHTML = ['<option value="">All courses/programmes</option>']
        .concat(
          sortedProgrammes.length > 0
            ? sortedProgrammes.map((p) => `<option value="${p.toLowerCase()}">${p}</option>`)
            : ['<option value="unspecified">Unspecified (re-upload timetable)</option>'],
        )
        .join('');
    }
    if (filterLevel) {
      filterLevel.innerHTML = ['<option value="">All levels</option>']
        .concat([...levels].sort((a, b) => a.localeCompare(b)).map((l) => `<option value="${l.toLowerCase()}">${l}</option>`))
        .join('');
    }
  }

  async function loadRows() {
    gridEl.className = 'mt-4 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600';
    gridEl.textContent = 'Loading calendar...';
    try {
      const me = await authFetch('/auth/me');
      if (!me || me.role !== 'staff') {
        clearToken();
        window.location.href = '/staff/login.html';
        return;
      }
      rows = await authFetch('/staff/fixed-timetable');
      if (!Array.isArray(rows)) rows = [];
      populateFacetFilters();
      renderCalendar();
    } catch (e) {
      gridEl.className = 'mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700';
      gridEl.textContent = e.message || 'Could not load timetable.';
    }
  }

  if (refreshBtn) refreshBtn.addEventListener('click', () => void loadRows());
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      renderCalendar();
    });
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      renderCalendar();
    });
  }
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      renderCalendar();
    });
  }
  if (filterCourse) filterCourse.addEventListener('change', renderCalendar);
  if (filterLevel) filterLevel.addEventListener('change', renderCalendar);
  if (filterHall) filterHall.addEventListener('input', renderCalendar);
  if (gridEl) {
    gridEl.addEventListener('click', (event) => {
      const target = event.target.closest('.timetable-event-trigger');
      if (!target) return;
      openEventModalByIndex(target.dataset.eventIdx);
    });
  }
  if (eventListEl) {
    eventListEl.addEventListener('click', (event) => {
      const target = event.target.closest('.timetable-event-trigger');
      if (!target) return;
      openEventModalByIndex(target.dataset.eventIdx);
    });
  }
  if (weeklyGridEl) {
    weeklyGridEl.addEventListener('click', (event) => {
      const target = event.target.closest('.timetable-event-trigger');
      if (!target) return;
      openEventModalByIndex(target.dataset.eventIdx);
    });
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeEventModal);
  if (modalEl) {
    modalEl.addEventListener('click', (event) => {
      if (event.target === modalEl) closeEventModal();
    });
  }
  await loadRows();
}

window.AudiFiApp = {
  setupLoginPage,
  setupLecturerLoginPage,
  setupStudentDiscoveryPortal,
  setupStaffPortal,
  setupAvailableHallsPage,
  setupTimetableUploadPage,
  setupTimetableCalendarPage,
};