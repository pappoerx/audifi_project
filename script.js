const AUDIFI_LECTURER_ACTIVITY_KEY = 'audiFiLecturerActivity';
const AUDIFI_ACTIVITY_MAX = 40;

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
  const items = getLecturerActivities().slice(0, limit);

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

  loginBtn.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent form submission
    if (studentInput.value.length === 8 && passwordInput.value.trim() !== '') {
      // Check if it's a staff login (starts with STAFF-)
      if (studentInput.value.toUpperCase().startsWith('STAFF-')) {
        localStorage.setItem('audiFiStaffName', 'Dr. John Doe'); // Mock staff name
        window.location.href = 'staffpage.html';
      } else {
        window.location.href = 'studentpage.html';
      }
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
  });
}

function refreshStudentDiscoveryHeader() {
  const welcomeTitle = document.getElementById('welcomeTitle');
  const studentNameEl = document.getElementById('studentName');
  const programEl = document.getElementById('studentProgramLine');
  const avatarEl = document.getElementById('studentAvatarInitials');
  const studentName = localStorage.getItem('audiFiProfileName') || 'Kwame Mensah';
  const firstName = studentName.split(' ')[0] || 'Student';
  const initials = studentName
    .split(' ')
    .map((namePart) => namePart[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const program = localStorage.getItem('audiFiStudentProgram') || 'BSc Information Systems';
  if (welcomeTitle) welcomeTitle.textContent = `Welcome back, ${firstName}`;
  if (studentNameEl) studentNameEl.textContent = studentName;
  if (programEl) programEl.textContent = program;
  if (avatarEl) avatarEl.textContent = initials;
}

function setupStudentDiscoveryPortal() {
  const hallsGrid = document.getElementById('hallsGrid');
  if (!hallsGrid) return; // Not the discovery dashboard page

  const halls = [
    { name: 'Block A - Main Hall', status: 'Occupied', seats: 420, location: 'Commercial Area', event: 'BIT 205 Lecture', wifi: true, projector: true, ac: true, live: true },
    { name: 'Block B - Annex', status: 'Booked - Pending', seats: 280, location: 'Engineering Strip', event: 'BSBA 351 (Starts 10:30)', wifi: true, projector: true, ac: false, live: false },
    { name: 'FF 03', status: 'Available', seats: 120, location: 'Business School Wing', event: 'No active event', wifi: true, projector: false, ac: true, live: false },
    { name: 'TF 01', status: 'Occupied', seats: 95, location: 'North Academic Block', event: 'ISD 359 Lab', wifi: true, projector: true, ac: false, live: true },
    { name: 'Block C - Basement', status: 'Available', seats: 210, location: 'Commercial Area', event: 'Next: AI 150 (1:00 PM)', wifi: true, projector: true, ac: true, live: false },
    { name: 'SF 05', status: 'Booked - Pending', seats: 140, location: 'Central Walkway', event: 'MKT 214 (Awaiting check-in)', wifi: false, projector: true, ac: true, live: false },
  ];

  refreshStudentDiscoveryHeader();

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

    const compact = localStorage.getItem('audiFiStudentCompactCards') === 'true';
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
      window.location.href = 'home_page.html';
    });
  }

  renderHalls();
  updateLastUpdated();
  setInterval(updateLastUpdated, 15000);

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
      document.getElementById('studentPrefDisplayName').value =
        localStorage.getItem('audiFiProfileName') || 'Kwame Mensah';
      document.getElementById('studentPrefProgram').value =
        localStorage.getItem('audiFiStudentProgram') || '';
      document.getElementById('studentPrefCampusZone').value =
        localStorage.getItem('audiFiStudentCampusZone') || '';
      document.getElementById('studentPrefCompactCards').checked =
        localStorage.getItem('audiFiStudentCompactCards') === 'true';
      document.getElementById('studentPrefNotifyEmail').value =
        localStorage.getItem('audiFiStudentNotifyEmail') || '';
      document.getElementById('studentPrefNotifyHalls').checked =
        localStorage.getItem('audiFiStudentNotifyHalls') === 'true';
      document.getElementById('studentPrefNotifyLecturers').checked =
        localStorage.getItem('audiFiStudentNotifyLecturers') === 'true';
      document.getElementById('studentPrefNotifyProduct').checked =
        localStorage.getItem('audiFiStudentNotifyProduct') === 'true';
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
      const name = document.getElementById('studentPrefDisplayName').value.trim();
      const program = document.getElementById('studentPrefProgram').value.trim();
      const zone = document.getElementById('studentPrefCampusZone').value;
      const compact = document.getElementById('studentPrefCompactCards').checked;
      const email = document.getElementById('studentPrefNotifyEmail').value.trim();
      const nHalls = document.getElementById('studentPrefNotifyHalls').checked;
      const nLect = document.getElementById('studentPrefNotifyLecturers').checked;
      const nProd = document.getElementById('studentPrefNotifyProduct').checked;

      if (name) localStorage.setItem('audiFiProfileName', name);
      else localStorage.removeItem('audiFiProfileName');

      if (program) localStorage.setItem('audiFiStudentProgram', program);
      else localStorage.removeItem('audiFiStudentProgram');

      if (zone) localStorage.setItem('audiFiStudentCampusZone', zone);
      else localStorage.removeItem('audiFiStudentCampusZone');

      localStorage.setItem('audiFiStudentCompactCards', compact ? 'true' : 'false');

      if (email) localStorage.setItem('audiFiStudentNotifyEmail', email);
      else localStorage.removeItem('audiFiStudentNotifyEmail');

      localStorage.setItem('audiFiStudentNotifyHalls', nHalls ? 'true' : 'false');
      localStorage.setItem('audiFiStudentNotifyLecturers', nLect ? 'true' : 'false');
      localStorage.setItem('audiFiStudentNotifyProduct', nProd ? 'true' : 'false');

      refreshStudentDiscoveryHeader();
      renderHalls();
      closeModal();
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
        const current = document.getElementById('studentPrefCurrentPassword').value;
        const newPass = document.getElementById('studentPrefNewPassword').value;
        const confirmPass = document.getElementById('studentPrefConfirmPassword').value;
        const existing = localStorage.getItem(DEMO_PW_KEY);

        if (existing && current !== existing) {
          alert('Current password is incorrect.');
          return;
        }

        if (newPass.length < 8) {
          alert('New password must be at least 8 characters.');
          return;
        }

        if (newPass !== confirmPass) {
          alert('New password and confirmation do not match.');
          return;
        }

        localStorage.setItem(DEMO_PW_KEY, newPass);
        localStorage.setItem('audiFiStudentPasswordUpdatedAt', new Date().toISOString());
        passwordForm.reset();
        alert(
          'Password updated for this demo only. Use your institutional account when AudiFi connects to SSO.',
        );
      });
    }
  }

  setupStudentPreferencesModal();
  setupStudentReportIssueModal();

  const allButtons = Array.from(document.querySelectorAll('button'));
  const findNearestBtn = allButtons.find((btn) => btn.textContent.trim() === 'Find Nearest Empty Hall');

  if (findNearestBtn) {
    findNearestBtn.addEventListener('click', () => {
      const availableHalls = halls.filter((hall) => hall.status === 'Available');
      localStorage.setItem('audiFiAvailableHalls', JSON.stringify(availableHalls));
      window.location.href = 'available_halls.html';
    });
  }

  renderLecturerActivityList('studentLecturerActivityList', {
    limit: 8,
    emptyMessage:
      'No updates yet. When lecturers book halls, cancel bookings, or call off classes in the staff portal, they will show up here.',
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function setupStaffPortal() {
  const staffSearch = document.getElementById('auditoriumSelect');
  if (!staffSearch) return; // Not the staff portal page

  // ---------- Mock data (edit here) ----------
  const staffData = {
    name: 'Dr. John Doe',
    id: 'STAFF-001',
  };

  const auditoriums = [
    'Block A - Main',
    'Block A - Basement',
    'Block B - Main',
    'Block B - Basement',
    'Block C - Main',
    'Block C - Basement',
    'Block D - Main',
    'Block D - Basement',
    'Block E - Main',
    'Block E - Basement',
    'Block F - Main',
    'Block F - Basement',
    'FF 01', 'FF 02', 'FF 03', 'FF 04', 'FF 05',
    'SF 01', 'SF 02', 'SF 03', 'SF 04', 'SF 05',
    'TF 01', 'TF 02', 'TF 03', 'TF 04', 'TF 05',
  ];

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

  let bookings = JSON.parse(localStorage.getItem('audiFiBookings') || '[]');
  // ------------------------------------------

  const staffNameEl = document.getElementById('staffName');
  const staffInfoEl = document.getElementById('staffInfo');

  function updateStaffSection() {
    const savedName = localStorage.getItem('audiFiStaffName');
    if (savedName) {
      staffData.name = savedName;
    }

    if (staffNameEl) staffNameEl.textContent = staffData.name;
    const dept = localStorage.getItem('audiFiStaffDepartment');
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

  function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    options.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    });
  }

  function renderBookings() {
    const container = document.getElementById('bookingsList');
    if (!container) return;

    container.innerHTML = '';

    if (bookings.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No bookings yet.</p>';
      return;
    }

    bookings.forEach((booking, index) => {
      const card = document.createElement('article');
      card.className = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm';

      card.innerHTML = `
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 class="text-lg font-semibold text-gray-800">${booking.auditorium}</h4>
            <p class="text-sm text-gray-500 mt-1">${booking.course}</p>
            <p class="text-sm text-gray-500">${booking.date} • ${booking.time}</p>
          </div>
          <div class="flex flex-shrink-0 flex-wrap gap-2">
            <button type="button" class="call-off-class-btn rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100" data-index="${index}">
              Call off class
            </button>
            <button type="button" class="cancel-booking-btn rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100" data-index="${index}">
              Cancel booking
            </button>
          </div>
        </div>
      `;

      container.appendChild(card);
    });

    function removeBookingAt(index, activityType) {
      const booking = bookings[index];
      if (!booking) return;
      if (localStorage.getItem('audiFiStaffConfirmCancel') === 'true') {
        const isCallOff = activityType === 'class_called_off';
        const msg = isCallOff
          ? `Call off class for “${booking.course}” at ${booking.auditorium}? Students will see updated hall status.`
          : `Cancel booking for “${booking.course}” at ${booking.auditorium}?`;
        if (!window.confirm(msg)) return;
      }
      appendLecturerActivity({
        type: activityType,
        lecturerName: staffData.name,
        auditorium: booking.auditorium,
        course: booking.course,
        date: booking.date,
        time: booking.time,
      });
      bookings.splice(index, 1);
      localStorage.setItem('audiFiBookings', JSON.stringify(bookings));
      renderBookings();
      renderAnalytics();
    }

    document.querySelectorAll('.cancel-booking-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.target.closest('.cancel-booking-btn');
        const index = parseInt(el.dataset.index, 10);
        removeBookingAt(index, 'booking_cancelled');
      });
    });

    document.querySelectorAll('.call-off-class-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.target.closest('.call-off-class-btn');
        const index = parseInt(el.dataset.index, 10);
        removeBookingAt(index, 'class_called_off');
      });
    });
  }

  function setupBookingForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const auditorium = document.getElementById('auditoriumSelect').value;
      const course = document.getElementById('courseSelect').value;
      const date = document.getElementById('dateInput').value;
      const time = document.getElementById('timeSelect').value;

      if (!auditorium || !course || !date || !time) {
        alert('Please fill in all fields.');
        return;
      }

      const pastCheck = validateBookingNotInPast(date, time);
      if (!pastCheck.ok) {
        alert(pastCheck.message);
        return;
      }

      const newBooking = { auditorium, course, date, time };
      bookings.push(newBooking);
      localStorage.setItem('audiFiBookings', JSON.stringify(bookings));

      appendLecturerActivity({
        type: 'booked',
        lecturerName: staffData.name,
        auditorium,
        course,
        date,
        time,
      });

      renderBookings();
      renderAnalytics();
      form.reset();
      alert('Booking confirmed!');
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
    const def = localStorage.getItem('audiFiStaffDefaultTime');
    if (ts && def && timeSlots.includes(def)) {
      ts.value = def;
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
    const DEMO_PW_KEY = 'audiFiDemoStaffPortalPassword';

    if (!modal || !openBtn || !defaultTimeSelect) return;

    function syncDefaultTimeOptions() {
      const saved = localStorage.getItem('audiFiStaffDefaultTime') || '';
      defaultTimeSelect.innerHTML = '<option value="">No default (choose each booking)</option>';
      timeSlots.forEach((slot) => {
        const opt = document.createElement('option');
        opt.value = slot;
        opt.textContent = slot;
        defaultTimeSelect.appendChild(opt);
      });
      if (saved && timeSlots.includes(saved)) {
        defaultTimeSelect.value = saved;
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
      if (nameEl) {
        nameEl.value = localStorage.getItem('audiFiStaffName') || staffData.name || '';
      }
      if (deptEl) deptEl.value = localStorage.getItem('audiFiStaffDepartment') || '';
      if (emailEl) emailEl.value = localStorage.getItem('audiFiStaffNotifyEmail') || '';
      if (confirmEl) {
        confirmEl.checked = localStorage.getItem('audiFiStaffConfirmCancel') === 'true';
      }
      const nb = document.getElementById('settingsNotifyBookingConfirm');
      const nh = document.getElementById('settingsNotifyHallAlerts');
      const np = document.getElementById('settingsNotifyProductNews');
      if (nb) nb.checked = localStorage.getItem('audiFiStaffNotifyBookingConfirm') === 'true';
      if (nh) nh.checked = localStorage.getItem('audiFiStaffNotifyHallAlerts') === 'true';
      if (np) np.checked = localStorage.getItem('audiFiStaffNotifyProductNews') === 'true';
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
      const name = document.getElementById('settingsDisplayName').value.trim();
      const dept = document.getElementById('settingsDepartment').value.trim();
      const email = document.getElementById('settingsNotifyEmail').value.trim();
      const defTime = defaultTimeSelect.value;
      const confirmCancel = document.getElementById('settingsConfirmCancel').checked;
      const notifyBooking = document.getElementById('settingsNotifyBookingConfirm').checked;
      const notifyHall = document.getElementById('settingsNotifyHallAlerts').checked;
      const notifyProduct = document.getElementById('settingsNotifyProductNews').checked;

      if (name) {
        localStorage.setItem('audiFiStaffName', name);
        staffData.name = name;
      } else {
        localStorage.removeItem('audiFiStaffName');
        staffData.name = 'Dr. John Doe';
      }

      if (dept) localStorage.setItem('audiFiStaffDepartment', dept);
      else localStorage.removeItem('audiFiStaffDepartment');

      if (email) localStorage.setItem('audiFiStaffNotifyEmail', email);
      else localStorage.removeItem('audiFiStaffNotifyEmail');

      if (defTime && timeSlots.includes(defTime)) {
        localStorage.setItem('audiFiStaffDefaultTime', defTime);
      } else {
        localStorage.removeItem('audiFiStaffDefaultTime');
      }

      localStorage.setItem('audiFiStaffConfirmCancel', confirmCancel ? 'true' : 'false');
      localStorage.setItem('audiFiStaffNotifyBookingConfirm', notifyBooking ? 'true' : 'false');
      localStorage.setItem('audiFiStaffNotifyHallAlerts', notifyHall ? 'true' : 'false');
      localStorage.setItem('audiFiStaffNotifyProductNews', notifyProduct ? 'true' : 'false');

      updateStaffSection();
      applyDefaultTimeToBookingForm();
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
        closeModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const current = document.getElementById('settingsCurrentPassword').value;
        const newPass = document.getElementById('settingsNewPassword').value;
        const confirmPass = document.getElementById('settingsConfirmPassword').value;
        const existing = localStorage.getItem(DEMO_PW_KEY);

        if (existing && current !== existing) {
          alert('Current password is incorrect.');
          return;
        }

        if (newPass.length < 8) {
          alert('New password must be at least 8 characters.');
          return;
        }

        if (newPass !== confirmPass) {
          alert('New password and confirmation do not match.');
          return;
        }

        localStorage.setItem(DEMO_PW_KEY, newPass);
        localStorage.setItem('audiFiStaffPasswordUpdatedAt', new Date().toISOString());
        passwordForm.reset();
        alert(
          'Password updated for this demo build only. Production AudiFi would use KNUST SSO and never store raw passwords in the browser.',
        );
      });
    }
  }

  function renderAnalytics() {
    const usageStatsEl = document.getElementById('usageStats');
    const activityLogEl = document.getElementById('activityLog');

    if (usageStatsEl) {
      const todayStr = new Date().toISOString().split('T')[0];
      const startOfCalendarWeek = (d) => {
        const x = new Date(d);
        const day = x.getDay();
        const diff = x.getDate() - day + (day === 0 ? -6 : 1);
        x.setDate(diff);
        x.setHours(0, 0, 0, 0);
        return x;
      };
      const endOfCalendarWeek = (start) => {
        const e = new Date(start);
        e.setDate(e.getDate() + 7);
        return e;
      };
      const weekStart = startOfCalendarWeek(new Date());
      const weekEnd = endOfCalendarWeek(weekStart);

      const isInThisCalendarWeek = (dateStr) => {
        const bd = new Date(`${dateStr}T12:00:00`);
        return bd >= weekStart && bd < weekEnd;
      };

      const activeReservations = bookings.length;
      const todaySessions = bookings.filter((b) => b.date === todayStr).length;
      const weekSessions = bookings.filter((b) => isInThisCalendarWeek(b.date)).length;
      const distinctHalls = new Set(bookings.map((b) => b.auditorium)).size;
      const catalogHalls = auditoriums.length;
      const hallCoveragePct =
        catalogHalls === 0 ? 0 : Math.round((distinctHalls / catalogHalls) * 100);

      const nowMs = Date.now();
      const ms7d = 7 * 24 * 60 * 60 * 1000;
      const ms30d = 30 * 24 * 60 * 60 * 1000;
      const activities = getLecturerActivities();
      const acts7d = activities.filter((a) => nowMs - new Date(a.at).getTime() <= ms7d);
      const acts30d = activities.filter((a) => nowMs - new Date(a.at).getTime() <= ms30d);

      const bookedLogged30d = acts30d.filter((a) => a.type === 'booked').length;
      const cancelledLogged30d = acts30d.filter((a) => a.type === 'booking_cancelled').length;
      const callOffs30d = acts30d.filter((a) => a.type === 'class_called_off').length;
      const keypad30d = acts30d.filter((a) => a.type === 'checked_in_keypad').length;

      const releaseRateDisplay =
        bookedLogged30d === 0
          ? '—'
          : `${Math.round(((cancelledLogged30d + callOffs30d) / bookedLogged30d) * 100)}%`;
      const releaseRateHint =
        bookedLogged30d === 0
          ? 'No booking events in the last 30 days to benchmark.'
          : 'Cancel + call-off events as a share of new bookings logged (directional only).';

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
            ${statCard(
              "Today's sessions",
              todaySessions,
              `Bookings dated ${todayStr}`,
              'emerald',
            )}
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
              acts7d.length,
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
            ${statCard(
              'Classes called off (30d)',
              callOffs30d,
              'Public-facing cancellations',
              'amber',
            )}
            ${statCard(
              'Release pressure index',
              releaseRateDisplay,
              releaseRateHint,
              bookedLogged30d > 0 && (cancelledLogged30d + callOffs30d) / bookedLogged30d > 0.35
                ? 'amber'
                : 'gray',
            )}
          </div>
        </div>
        <p class="text-[11px] text-gray-400">Numbers merge your current booking roster with the lecturer activity log and refresh after each change.</p>
      `;
    }

    if (activityLogEl) {
      const recentBookings = bookings.slice(-5).reverse(); // Last 5 bookings
      activityLogEl.innerHTML = '';

      if (recentBookings.length === 0) {
        activityLogEl.innerHTML = '<p class="text-sm text-gray-500">No recent activity.</p>';
      } else {
        recentBookings.forEach((booking) => {
          const activityItem = document.createElement('div');
          activityItem.className = 'flex items-center gap-3 py-2';
          activityItem.innerHTML = `
            <div class="h-2 w-2 rounded-full bg-knustGold"></div>
            <div class="text-sm">
              <span class="font-medium text-gray-900">${booking.auditorium}</span>
              <span class="text-gray-500">booked for ${booking.course}</span>
            </div>
            <div class="ml-auto text-xs text-gray-400">${booking.date}</div>
          `;
          activityLogEl.appendChild(activityItem);
        });
      }
    }

    renderLecturerActivityList('lecturerActivityList', {
      limit: 12,
      emptyMessage:
        'No lecturer activity yet. Book a hall, cancel a reservation, or call off a class to populate this log.',
    });
  }

  // Sign out button
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      window.location.href = 'home_page.html';
    });
  }

  function initStaffPortal() {
    updateStaffSection();
    populateSelect('auditoriumSelect', auditoriums);
    populateSelect('courseSelect', courses);
    populateSelect('timeSelect', timeSlots);
    applyDefaultTimeToBookingForm();
    renderBookings();
    renderAnalytics();
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

  initStaffPortal();
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

  loginBtn.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent form submission
    if (lecturerInput.value.length === 8 && passwordInput.value.trim() !== '') {
      window.location.href = 'staffpage.html'; // Redirect to lecturer dashboard (placeholder)
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

function setupAvailableHallsPage() {
  const hallsList = document.getElementById('availableHallsList');
  if (!hallsList) return; // Not the available halls page

  const countEl = document.getElementById('availableHallsCount');
  const backBtn = document.getElementById('backToDashboardBtn');
  const stored = localStorage.getItem('audiFiAvailableHalls');
  const availableHalls = stored ? JSON.parse(stored) : [];

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
            <p class="text-xs text-gray-500">${hall.location}</p>
          </div>
          <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Available
          </span>
        </div>
        <div class="mt-3 space-y-1 text-sm text-gray-700">
          <p><span class="font-medium">Seats:</span> ${hall.seats}</p>
          <p><span class="font-medium">Current/Next Event:</span> ${hall.event}</p>
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
  setupStudentDiscoveryPortal();
  setupStaffPortal();
  setupAvailableHallsPage();
});