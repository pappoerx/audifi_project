const AUDIFI_LECTURER_ACTIVITY_KEY = 'audiFiLecturerActivity';
const AUDIFI_ACTIVITY_MAX = 40;

const API_BASE = typeof window !== 'undefined' && window.AUDIFI_API_BASE ? window.AUDIFI_API_BASE : 'http://127.0.0.1:8000';
const AUDIFI_TOKEN_KEY = 'audiFiAccessToken';

function getToken() {
  return localStorage.getItem(AUDIFI_TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(AUDIFI_TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(AUDIFI_TOKEN_KEY);
}

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
        alert('This portal is for students. Use Lecturer Login for staff access.');
        loginBtn.disabled = false;
        checkFormValidity();
        return;
      }
      window.location.href = 'studentpage.html';
    } catch (e) {
      alert(e.message || 'Login failed');
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
      alert('Password reset is not connected yet. Please contact AudiFi support.');
    });
  }
}

function setupStudentPortal() {
  const hallSearch = document.getElementById('hallSearch');
  if (!hallSearch) return; // Not the student portal page

  // ---------- Mock data (edit here) ----------
  const studentData = {
    name: 'Kwame Mensah',
    id: 'STU-001234',
  };

  // ---------- Hall data (edit here) ----------
  const blocks = ['A', 'B', 'C', 'D', 'E', 'F'];

  const floorConfigs = [
    { prefix: 'FF', label: 'First Floor' },
    { prefix: 'SF', label: 'Second Floor' },
    { prefix: 'TF', label: 'Third Floor' },
  ];

  const halls = [];

  // Blocks (Main + Basement)
  blocks.forEach((block) => {
    ['Main', 'Basement'].forEach((level) => {
      halls.push({
        id: `block-${block}-${level.toLowerCase()}`,
        name: `Block ${block} - ${level}`,
        status: halls.length % 2 === 0 ? 'Available' : 'Ongoing Lecture',
        capacity: `${(400 + blocks.indexOf(block) * 20).toFixed(0)} Seats`,
      });
    });
  });

  // Floors (FF / SF / TF rooms 01-05)
  floorConfigs.forEach(({ prefix }) => {
    for (let i = 1; i <= 5; i += 1) {
      const room = `${prefix} ${String(i).padStart(2, '0')}`;
      halls.push({
        id: `${prefix}-${String(i).padStart(2, '0')}`,
        name: room,
        status: halls.length % 2 === 0 ? 'Available' : 'Ongoing Lecture',
        capacity: `${120 + i * 10} Seats`,
      });
    }
  });
  // ------------------------------------------

  const recentSearches = ['Block A - Main', 'FF 01', 'Block C - Basement'];
  const favoritedHalls = ['Block B - Main', 'TF 03'];

  const courses = [
    'AI 150 FUNDAMENTALS OF RESPONSIBLE AI FOR ALL',
    'BSBA 351 BUSINESS LAW',
    'BSBA 353 BUSINESS RESEARCH METHODS',
    'BSBA 361 BUILDING PROFESSIONAL SKILLS',
    'ISD 331 INTRODUCTION TO BUSINESS ANALYTICS',
    'ISD 355 DATABASE MANAGEMENT FOR BUSINESS',
    'ISD 357 INTRODUCTION TO OPERATIONS MANAGEMENT',
    'ISD 359 INTRODUCTION TO PROGRAMMING',
  ];

  const timeSlots = ['8:00 AM – 10:00 AM', '10:30 AM – 12:30 PM', '1:00 PM – 3:00 PM', '3:30 PM – 5:30 PM'];

  // ------------------------------------------

  const profileNameEl = document.getElementById('profileName');
  const studentInfoEl = document.getElementById('studentInfo');

  function updateProfileSection() {
    const savedName = localStorage.getItem('audiFiProfileName');
    if (savedName) {
      studentData.name = savedName;
    }

    if (profileNameEl) profileNameEl.textContent = studentData.name;
    if (studentInfoEl) studentInfoEl.textContent = `${studentData.name} • ${studentData.id}`;
  }

  // Modal helpers
  const modal = document.getElementById('courseModal');
  const modalHallNameEl = document.getElementById('modalHallName');
  const modalCourseEl = document.getElementById('modalCourse');
  const modalTimeEl = document.getElementById('modalTime');
  const modalClose = document.getElementById('modalClose');
  const modalCancel = document.getElementById('modalCancel');

  function closeCourseModal() {
    if (!modal) return;
    modal.classList.add('hidden');
  }

  function openCourseModal(hallName) {
    if (!modal) return;

    if (modalHallNameEl) modalHallNameEl.textContent = hallName;

    // Pick a random course to represent the "current" session
    if (modalCourseEl) {
      const randomCourse = courses[Math.floor(Math.random() * courses.length)];
      modalCourseEl.textContent = randomCourse;
    }

    // Pick a time slot from the fixed schedule
    if (modalTimeEl) {
      const randomSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
      modalTimeEl.textContent = randomSlot;
    }

    modal.classList.remove('hidden');
  }

  if (modalClose) modalClose.addEventListener('click', closeCourseModal);
  if (modalCancel) modalCancel.addEventListener('click', closeCourseModal);
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeCourseModal();
    });
  }

  // Sign out button
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      window.location.href = 'home_page.html';
    });
  }

  function createStatusBadge(status) {
    const isAvailable = status.toLowerCase().includes('available');
    const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold';
    const color = isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
    return `<span class="${base} ${color}">${status}</span>`;
  }

  function renderHallsList(items) {
    const container = document.getElementById('hallsGrid');
    if (!container) return;

    container.innerHTML = '';

    items.forEach((hall) => {
      const card = document.createElement('article');
      card.className = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md';

      card.innerHTML = `
        <div class="flex items-start justify-between gap-4">
          <div>
            <h4 class="text-lg font-semibold text-gray-800">${hall.name}</h4>
            <p class="text-sm text-gray-500 mt-1">${hall.capacity}</p>
          </div>
          <div class="shrink-0">${createStatusBadge(hall.status)}</div>
        </div>
        <div class="mt-5 flex items-center justify-between gap-3">
          <span class="text-sm font-medium text-gray-600">Room ID: ${hall.id.toUpperCase()}</span>
          <button type="button" class="hall-schedule-btn rounded-lg bg-knustGold px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-yellow-500">
            View Schedule
          </button>
        </div>
      `;

      // Only show modal for block cards (Main/Basement blocks)
      if (hall.name.startsWith('Block')) {
        card.classList.add('cursor-pointer');
        card.addEventListener('click', () => openCourseModal(hall.name));
      }

      const scheduleBtn = card.querySelector('.hall-schedule-btn');
      if (scheduleBtn) {
        scheduleBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          openCourseModal(hall.name);
        });
      }

      container.appendChild(card);
    });
  }

  function renderQuickLinks(listId, items) {
    const container = document.getElementById(listId);
    if (!container) return;

    container.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2';
      li.innerHTML = `
        <span>${item}</span>
        <button type="button" class="text-xs font-semibold text-knustGold hover:text-yellow-700">View</button>
      `;
      container.appendChild(li);
    });
  }

  function setupSearch() {
    const input = document.getElementById('hallSearch');
    if (!input) return;

    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      const filtered = halls.filter((hall) => hall.name.toLowerCase().includes(query));
      renderHallsList(filtered);
    });
  }

  function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('menuToggle');

    if (!sidebar || !toggle) return;

    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
  }

  function initStudentPortal() {
    updateProfileSection();
    renderHallsList(halls);
    renderQuickLinks('recentSearches', recentSearches);
    renderQuickLinks('favoriteHalls', favoritedHalls);
    setupSearch();
    setupSidebarToggle();
  }

  initStudentPortal();
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
  const shell = document.getElementById('studentReportIssueShell');
  const closeBtn = document.getElementById('studentReportIssueClose');
  const cancelBtn = document.getElementById('studentReportIssueCancel');
  const form = document.getElementById('studentReportIssueForm');

  if (!modal || !openBtn || !form) return;

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

  openBtn.addEventListener('click', openModal);
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
      alert('Please choose an issue type.');
      return;
    }

    if (description.length < 10) {
      alert('Please describe the problem in at least 10 characters.');
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
          alert('Thank you. Your report has been submitted to campus support.');
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
          alert('Thank you. Your report has been saved for this demo. A full build would send it to campus support.');
        }
      } catch (err) {
        alert(err.message || 'Could not submit report.');
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
    window.location.href = 'home_page.html';
    return;
  }

  let halls = [];
  let studentMe = null;

  try {
    studentMe = await authFetch('/auth/me');
    if (studentMe.role !== 'student') {
      window.location.href = 'staffpage.html';
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
    alert(e.message || 'Could not load dashboard');
    clearToken();
    window.location.href = 'home_page.html';
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
      window.location.href = 'home_page.html';
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
          alert(err.message || 'Could not save preferences');
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
        alert('Password changes are not available via the API in this build. Use your seeded demo password or reset via database admin.');
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
      window.location.href = 'available_halls.html';
    });
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

async function setupStaffPortal() {
  const staffSearch = document.getElementById('auditoriumSelect');
  if (!staffSearch) return;

  if (!getToken()) {
    window.location.href = 'lecturer_login.html';
    return;
  }

  let staffMe = null;
  let hallRows = [];
  let courseRows = [];
  let timeSlotRows = [];
  let bookings = [];

  try {
    staffMe = await authFetch('/auth/me');
    if (staffMe.role !== 'staff') {
      window.location.href = 'studentpage.html';
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
    alert(e.message || 'Could not load staff portal');
    clearToken();
    window.location.href = 'lecturer_login.html';
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
    try {
      const rows = await authFetch('/activity?limit=12');
      const items = rows.map(mapApiActivityToEntry);
      renderLecturerActivityList('lecturerActivityList', {
        limit: 12,
        items,
        emptyMessage:
          'No lecturer activity yet. Book a hall, cancel a reservation, or call off a class to populate this log.',
      });
    } catch {
      renderLecturerActivityList('lecturerActivityList', {
        limit: 12,
        items: [],
        emptyMessage: 'Could not load activity.',
      });
    }
  }

  async function refreshStaffAnalytics() {
    const usageStatsEl = document.getElementById('usageStats');
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

    const statCard = (label, value, hint, accent = 'gray') => {
      const accents = {
        gray: 'border-gray-100 bg-gray-50/90',
        emerald: 'border-emerald-100 bg-emerald-50/50',
        amber: 'border-amber-100 bg-amber-50/50',
        slate: 'border-slate-200 bg-slate-50/80',
      };
      const box = accents[accent] || accents.gray;
      return `
          <div class="rounded-xl border ${box} p-4">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-500">${label}</p>
            <p class="mt-2 text-2xl font-bold tabular-nums tracking-tight text-gray-900">${value}</p>
            <p class="mt-1 text-xs leading-snug text-gray-600">${hint}</p>
          </div>`;
    };

    if (usageStatsEl) {
      usageStatsEl.innerHTML = `
        <div>
          <p class="mb-2 text-xs font-medium text-gray-700">Schedule load</p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            ${statCard(
              'Active reservations',
              activeReservations,
              'Future or current sessions on the roster',
              'slate',
            )}
            ${statCard("Today's sessions", todaySessions, `Bookings dated ${todayStr}`, 'emerald')}
            ${statCard(
              'This week (Mon–Sun)',
              weekSessions,
              'Sessions with dates in the current calendar week',
              'gray',
            )}
            ${statCard(
              'Distinct halls in use',
              distinctHalls,
              `${hallCoveragePct}% of ${catalogHalls} bookable spaces`,
              'gray',
            )}
            ${statCard(
              'Lecturer events (7 days)',
              acts7dLen,
              'All logged actions: bookings, releases, call-offs',
              'gray',
            )}
            ${statCard(
              'Keypad check-ins (30 days)',
              keypad30d,
              'Increases when hall keypad confirms attendance',
              'emerald',
            )}
          </div>
        </div>
        <div>
          <p class="mb-2 text-xs font-medium text-gray-700">Operations & reliability</p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            ${statCard(
              'New bookings logged (30d)',
              bookedLogged30d,
              'Captures from staff portal submissions',
              'emerald',
            )}
            ${statCard(
              'Released / cancelled (30d)',
              cancelledLogged30d,
              'Reservations removed before session',
              'gray',
            )}
            ${statCard('Classes called off (30d)', callOffs30d, 'Public-facing cancellations', 'amber')}
            ${statCard(
              'Release pressure index',
              releaseRateDisplay,
              releaseRateHint,
              releaseWarn ? 'amber' : 'gray',
            )}
          </div>
        </div>
        <p class="text-[11px] text-gray-400">Numbers merge your current booking roster with the lecturer activity log and refresh after each change.</p>
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

    container.innerHTML = '';

    if (bookings.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No bookings yet.</p>';
      return;
    }

    bookings.forEach((booking) => {
      const card = document.createElement('article');
      card.className = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm';
      const hallName = booking.hall_name;
      const courseTitle = booking.course_title;
      const dateStr = booking.booking_date;
      const timeLbl = booking.time_slot_label;

      card.innerHTML = `
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 class="text-lg font-semibold text-gray-800">${hallName}</h4>
            <p class="text-sm text-gray-500 mt-1">${courseTitle}</p>
            <p class="text-sm text-gray-500">${dateStr} • ${timeLbl}</p>
          </div>
          <div class="flex flex-shrink-0 flex-wrap gap-2">
            <button type="button" class="call-off-class-btn rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100" data-booking-id="${booking.id}">
              Call off class
            </button>
            <button type="button" class="cancel-booking-btn rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100" data-booking-id="${booking.id}">
              Cancel booking
            </button>
          </div>
        </div>
      `;

      container.appendChild(card);
    });

    async function removeBookingById(bookingId, activityType) {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;
      const prefs = staffMe.preferences || {};
      if (prefs.confirm_before_cancel === true) {
        const isCallOff = activityType === 'class_called_off';
        const msg = isCallOff
          ? `Call off class for “${booking.course_title}” at ${booking.hall_name}? Students will see updated hall status.`
          : `Cancel booking for “${booking.course_title}” at ${booking.hall_name}?`;
        if (!window.confirm(msg)) return;
      }
      try {
        const path =
          activityType === 'class_called_off'
            ? `/bookings/${bookingId}/call-off`
            : `/bookings/${bookingId}/cancel`;
        await authFetch(path, { method: 'POST', body: '{}' });
        bookings = await authFetch('/bookings/me');
        renderBookings();
        await refreshStaffAnalytics();
        await loadStaffActivityFeed();
      } catch (err) {
        alert(err.message || 'Could not update booking');
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

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const hallId = document.getElementById('auditoriumSelect').value;
      const courseId = document.getElementById('courseSelect').value;
      const date = document.getElementById('dateInput').value;
      const timeSlotId = document.getElementById('timeSelect').value;

      if (!hallId || !courseId || !date || !timeSlotId) {
        alert('Please fill in all fields.');
        return;
      }

      const slot = timeSlotRows.find((t) => t.id === timeSlotId);
      const timeLabel = slot ? slot.label : '';
      const pastCheck = validateBookingNotInPast(date, timeLabel);
      if (!pastCheck.ok) {
        alert(pastCheck.message);
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
              time_slot_id: timeSlotId,
            }),
          });
          bookings = await authFetch('/bookings/me');
          renderBookings();
          await refreshStaffAnalytics();
          await loadStaffActivityFeed();
          form.reset();
          applyDefaultTimeToBookingForm();
          alert('Booking confirmed!');
        } catch (err) {
          alert(err.message || 'Booking failed');
        }
      })();
    });

    document.getElementById('cancelBooking').addEventListener('click', () => {
      form.reset();
    });
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
    const ts = document.getElementById('timeSelect');
    const prefs = staffMe.preferences || {};
    const defId = prefs.default_time_slot_id;
    if (ts && defId && timeSlotRows.some((t) => t.id === defId)) {
      ts.value = defId;
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
          alert(err.message || 'Could not save settings');
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
        alert('Password changes are not available via the API in this build. Use your seeded demo password or reset via database admin.');
        passwordForm.reset();
      });
    }
  }

  // Sign out button
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      clearToken();
      window.location.href = 'home_page.html';
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
        alert('Support chat is coming soon. For now, email support@audifi.local');
      });
    }
  }

  void initStaffPortal();
}

function setupLecturerLoginPage() {
  const lecturerInput = document.getElementById('lecturerId');
  const passwordInput = document.getElementById('lecturerPassword');
  const loginBtn = document.getElementById('lecturerLoginBtn');

  if (!lecturerInput || !passwordInput || !loginBtn) return;

  function checkFormValidity() {
    const isIdValid = lecturerInput.value.length === 8;
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
    if (lecturerInput.value.length !== 8 || !passwordInput.value.trim()) return;
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
        alert('Staff access only. Use the student login page for your account.');
        loginBtn.disabled = false;
        checkFormValidity();
        return;
      }
      window.location.href = 'staffpage.html';
    } catch (e) {
      alert(e.message || 'Login failed');
      loginBtn.disabled = false;
      checkFormValidity();
    }
  });

  lecturerInput.addEventListener('input', function () {
    // Numbers-only logic
    this.value = this.value.replace(/\D/g, '');
    checkFormValidity();
  });

  passwordInput.addEventListener('input', checkFormValidity);

  const forgotPasswordLink = document.querySelector('a[href="#"]');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (event) => {
      event.preventDefault();
      alert('Lecturer password reset is not connected yet. Contact system admin.');
    });
  }
}

async function setupAvailableHallsPage() {
  const hallsList = document.getElementById('availableHallsList');
  if (!hallsList) return;

  const countEl = document.getElementById('availableHallsCount');
  const backBtn = document.getElementById('backToDashboardBtn');

  if (!getToken()) {
    window.location.href = 'home_page.html';
    return;
  }

  let availableHalls = [];
  try {
    availableHalls = await authFetch('/halls?available_now=true');
  } catch (e) {
    hallsList.innerHTML = `<p class="text-sm text-red-600">${e.message || 'Could not load halls.'}</p>`;
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'studentpage.html';
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
      window.location.href = 'studentpage.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupLoginPage();
  setupLecturerLoginPage();
  setupStudentPortal();
  void setupStudentDiscoveryPortal();
  void setupStaffPortal();
  void setupAvailableHallsPage();
});