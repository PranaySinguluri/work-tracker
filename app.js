/* app.js — Main application controller */

(function() {
  'use strict';

  // ── State ─────────────────────────────────────────────────
  let currentEventId  = null;   // event being edited
  let draftEvents     = [];     // OCR-detected draft events
  let editShiftId     = null;   // shift being edited

  // ── Init ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    setupDashboard();
    setupCalendar();
    setupNotes();
    setupImportModal();
    setupShiftModal();
    setupEventModal();
    setupGCalModal();
    setupModalCloseButtons();
    updateGCalStatusDisplay();
    renderUpcoming();
    setDashToday();
  });

  // ── Navigation ────────────────────────────────────────────
  function setupNav() {
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.querySelectorAll('[data-view-trigger]').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.viewTrigger));
    });
  }

  function switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const view = document.getElementById(`view-${name}`);
    if (view) view.classList.add('active');
    const btn = document.querySelector(`.nav-btn[data-view="${name}"]`);
    if (btn) btn.classList.add('active');
    if (name === 'calendar') CalendarUI.render();
  }

  // ── Dashboard ─────────────────────────────────────────────
  function setupDashboard() {
    document.getElementById('openImportBtn').addEventListener('click', () => openModal('importModal'));
    document.getElementById('openShiftBtn').addEventListener('click', () => openShiftModal());
    document.getElementById('gcalConnectBtn').addEventListener('click', () => openModal('gcalModal'));
    document.getElementById('gcalStatus').addEventListener('click', () => openModal('gcalModal'));
  }

  function setDashToday() {
    const el = document.getElementById('dashToday');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function renderUpcoming() {
    const strip = document.getElementById('upcomingStrip');
    if (!strip) return;
    const events = Storage.getEvents();
    const today = todayStr();
    const upcoming = events
      .filter(e => e.date >= today)
      .sort((a, b) => (a.date + a.startTime) < (b.date + b.startTime) ? -1 : 1)
      .slice(0, 10);

    if (!upcoming.length) {
      strip.innerHTML = '<p class="upcoming-empty">No upcoming events. Add a class or shift below.</p>';
      return;
    }

    strip.innerHTML = upcoming.map(ev => {
      const dateLabel = formatDateLabel(ev.date);
      const timeLabel = ev.startTime ? formatTime12(ev.startTime) : '';
      return `
        <div class="upcoming-chip ${ev.type || 'other'}" data-id="${ev.id}">
          <div class="chip-date">${dateLabel}</div>
          <div class="chip-title">${escHtml(ev.title)}</div>
          ${timeLabel ? `<div class="chip-time">${timeLabel}</div>` : ''}
        </div>
      `;
    }).join('');

    strip.querySelectorAll('.upcoming-chip').forEach(chip => {
      chip.addEventListener('click', () => openEventModal(chip.dataset.id));
    });
  }

  // ── Calendar ──────────────────────────────────────────────
  function setupCalendar() {
    CalendarUI.init({
      onEventClick: (id) => openEventModal(id),
      onDayClick: (dateStr) => openEventModalNew(dateStr),
    });
    document.getElementById('calPrev').addEventListener('click', () => {
      CalendarUI.prevMonth();
    });
    document.getElementById('calNext').addEventListener('click', () => {
      CalendarUI.nextMonth();
    });
    document.getElementById('addEventFab').addEventListener('click', () => openEventModalNew());
  }

  // ── Notes ─────────────────────────────────────────────────
  function setupNotes() {
    const area = document.getElementById('notesArea');
    const saved = document.getElementById('notesSaved');
    area.value = Storage.getNotes();
    let timer;
    area.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        Storage.saveNotes(area.value);
        saved.classList.add('visible');
        setTimeout(() => saved.classList.remove('visible'), 2000);
      }, 600);
    });
  }

  // ── Import Modal (OCR) ────────────────────────────────────
  function setupImportModal() {
    const fileInput   = document.getElementById('fileInput');
    const cameraInput = document.getElementById('cameraInput');
    const uploadZone  = document.getElementById('uploadZone');

    fileInput.addEventListener('change',   e => handleFile(e.target.files[0]));
    cameraInput.addEventListener('change', e => handleFile(e.target.files[0]));

    // Drag & drop
    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', e => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    document.getElementById('detectEventsBtn').addEventListener('click', () => {
      const text = document.getElementById('ocrText').value;
      draftEvents = OCR.detectEvents(text).map(e => ({ ...e, id: genId() }));
      closeModal('importModal');
      openReviewModal();
    });
  }

  async function handleFile(file) {
    if (!file) return;
    showOcrSection();
    const setProgress = (pct, msg) => {
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressLabel').textContent = msg;
    };
    setProgress(5, 'Starting…');
    try {
      let text = '';
      if (file.type === 'application/pdf') {
        text = await OCR.extractTextFromPDF(file, setProgress);
      } else {
        text = await OCR.extractTextFromImage(file, setProgress);
      }
      setProgress(100, 'Done!');
      document.getElementById('ocrText').value = text;
    } catch(e) {
      document.getElementById('ocrText').value = 'Could not extract text. Please type or paste your schedule below.';
      setProgress(0, 'Error — try another file');
    }
  }

  function showOcrSection() {
    const sec = document.getElementById('ocrSection');
    sec.classList.remove('hidden');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressLabel').textContent = 'Starting…';
    document.getElementById('ocrText').value = '';
  }

  // ── Event Review Modal ────────────────────────────────────
  function openReviewModal() {
    renderDraftEvents();
    openModal('reviewModal');
  }

  function renderDraftEvents() {
    const list = document.getElementById('draftEventsList');
    if (!draftEvents.length) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No events detected. Add them manually below.</p>';
      return;
    }
    list.innerHTML = draftEvents.map((ev, idx) => `
      <div class="draft-event-card" data-draft-idx="${idx}">
        <div class="draft-row full">
          <span class="draft-label">Title</span>
          <input type="text" class="draft-title" value="${escHtml(ev.title)}" placeholder="Event title" />
        </div>
        <div class="draft-row">
          <span class="draft-label">Type</span>
          <select class="draft-type">
            <option value="lecture"  ${ev.type==='lecture'?'selected':''}>Lecture</option>
            <option value="lab"      ${ev.type==='lab'?'selected':''}>Lab</option>
            <option value="exam"     ${ev.type==='exam'?'selected':''}>Exam</option>
            <option value="other"    ${ev.type==='other'?'selected':''}>Other</option>
          </select>
        </div>
        <div class="draft-row">
          <span class="draft-label">Date</span>
          <input type="date" class="draft-date" value="${ev.date}" />
        </div>
        <div class="draft-row">
          <span class="draft-label">Start</span>
          <input type="time" class="draft-start" value="${ev.startTime}" />
        </div>
        <div class="draft-row">
          <span class="draft-label">End</span>
          <input type="time" class="draft-end" value="${ev.endTime}" />
        </div>
        <button class="draft-delete-btn" data-draft-idx="${idx}">✕ Remove</button>
      </div>
    `).join('');

    list.querySelectorAll('.draft-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        draftEvents.splice(parseInt(btn.dataset.draftIdx), 1);
        renderDraftEvents();
      });
    });
  }

  function collectDraftEdits() {
    const cards = document.querySelectorAll('.draft-event-card');
    cards.forEach(card => {
      const idx = parseInt(card.dataset.draftIdx);
      if (draftEvents[idx]) {
        draftEvents[idx].title     = card.querySelector('.draft-title').value.trim() || 'Event';
        draftEvents[idx].type      = card.querySelector('.draft-type').value;
        draftEvents[idx].date      = card.querySelector('.draft-date').value;
        draftEvents[idx].startTime = card.querySelector('.draft-start').value;
        draftEvents[idx].endTime   = card.querySelector('.draft-end').value;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addDraftEventBtn').addEventListener('click', () => {
      draftEvents.push({ id: genId(), title: 'New Event', type: 'lecture', date: todayStr(), startTime: '', endTime: '', notes: '' });
      renderDraftEvents();
    });

    document.getElementById('saveDraftEventsBtn').addEventListener('click', () => {
      collectDraftEdits();
      const valid = draftEvents.filter(e => e.title && e.date);
      valid.forEach(ev => {
        const toSave = { ...ev };
        if (!toSave.id) toSave.id = genId();
        Storage.addEvent(toSave);
      });
      closeModal('reviewModal');
      renderUpcoming();
      CalendarUI.render();
      showToast(`${valid.length} event(s) saved ✓`);
      draftEvents = [];
    });
  });

  // ── Shift Modal ───────────────────────────────────────────
  function setupShiftModal() {
    document.getElementById('saveShiftBtn').addEventListener('click', saveShift);
  }

  function openShiftModal(id = null) {
    editShiftId = id;
    const title = document.getElementById('shiftModalTitle');
    const evs = Storage.getEvents();
    if (id) {
      const ev = evs.find(e => e.id === id);
      if (ev) {
        title.textContent = 'Edit Work Shift';
        document.getElementById('shiftTitle').value = ev.title;
        document.getElementById('shiftDate').value  = ev.date;
        document.getElementById('shiftStart').value = ev.startTime;
        document.getElementById('shiftEnd').value   = ev.endTime;
      }
    } else {
      title.textContent = 'Add Work Shift';
      document.getElementById('shiftTitle').value = 'Costco Shift';
      document.getElementById('shiftDate').value  = todayStr();
      document.getElementById('shiftStart').value = '09:00';
      document.getElementById('shiftEnd').value   = '17:00';
    }
    openModal('shiftModal');
  }

  function saveShift() {
    const title = document.getElementById('shiftTitle').value.trim() || 'Work Shift';
    const date  = document.getElementById('shiftDate').value;
    const start = document.getElementById('shiftStart').value;
    const end   = document.getElementById('shiftEnd').value;
    if (!date) { showToast('Please pick a date'); return; }
    const ev = { title, date, startTime: start, endTime: end, type: 'work', notes: '' };
    if (editShiftId) {
      Storage.updateEvent(editShiftId, ev);
      showToast('Shift updated ✓');
    } else {
      Storage.addEvent(ev);
      showToast('Shift added ✓');
    }
    closeModal('shiftModal');
    renderUpcoming();
    CalendarUI.render();
  }

  // ── Event Modal (detail/edit) ─────────────────────────────
  function setupEventModal() {
    document.getElementById('saveEventBtn').addEventListener('click', saveEvent);
    document.getElementById('deleteEventBtn').addEventListener('click', () => {
      if (currentEventId && confirm('Delete this event?')) {
        Storage.deleteEvent(currentEventId);
        closeModal('eventModal');
        renderUpcoming();
        CalendarUI.render();
        showToast('Event deleted');
      }
    });
  }

  function openEventModal(id) {
    const ev = Storage.getEventById(id);
    if (!ev) return;
    currentEventId = id;
    document.getElementById('eventModalTitle').textContent = 'Edit Event';
    document.getElementById('evTitle').value = ev.title;
    document.getElementById('evType').value  = ev.type || 'other';
    document.getElementById('evDate').value  = ev.date;
    document.getElementById('evStart').value = ev.startTime || '';
    document.getElementById('evEnd').value   = ev.endTime   || '';
    document.getElementById('evNotes').value = ev.notes     || '';
    openModal('eventModal');
  }

  function openEventModalNew(dateStr = '') {
    currentEventId = null;
    document.getElementById('eventModalTitle').textContent = 'New Event';
    document.getElementById('evTitle').value = '';
    document.getElementById('evType').value  = 'lecture';
    document.getElementById('evDate').value  = dateStr || todayStr();
    document.getElementById('evStart').value = '';
    document.getElementById('evEnd').value   = '';
    document.getElementById('evNotes').value = '';
    openModal('eventModal');
  }

  function saveEvent() {
    const title = document.getElementById('evTitle').value.trim();
    const date  = document.getElementById('evDate').value;
    if (!title) { showToast('Title required'); return; }
    if (!date)  { showToast('Date required');  return; }
    const ev = {
      title,
      type:      document.getElementById('evType').value,
      date,
      startTime: document.getElementById('evStart').value,
      endTime:   document.getElementById('evEnd').value,
      notes:     document.getElementById('evNotes').value,
    };
    if (currentEventId) {
      Storage.updateEvent(currentEventId, ev);
      showToast('Event updated ✓');
    } else {
      Storage.addEvent(ev);
      showToast('Event added ✓');
    }
    closeModal('eventModal');
    renderUpcoming();
    CalendarUI.render();
  }

  // ── Google Calendar Modal ──────────────────────────────────
  function setupGCalModal() {
    const creds = Storage.getGCalCreds();
    if (creds) {
      showGCalConnected();
    }

    document.getElementById('gcalConnectConfirmBtn').addEventListener('click', async () => {
      const clientId = document.getElementById('gcalClientId').value.trim();
      const apiKey   = document.getElementById('gcalApiKey').value.trim();
      if (!clientId || !apiKey) { showToast('Enter Client ID and API Key'); return; }
      try {
        showToast('Connecting…');
        const result = await GCalendar.init({ clientId, apiKey });
        Storage.saveGCalCreds({ clientId, apiKey });
        showGCalConnected(result.email);
        updateGCalStatusDisplay();
        showToast('Connected to Google Calendar ✓');
      } catch(e) {
        showToast('Connection failed: ' + (e.message || 'Unknown error'));
      }
    });

    document.getElementById('gcalDisconnectBtn').addEventListener('click', () => {
      Storage.clearGCalCreds();
      showGCalSetup();
      updateGCalStatusDisplay();
      showToast('Disconnected');
    });

    document.getElementById('gcalSyncNowBtn').addEventListener('click', syncToGCal);
  }

  function showGCalConnected(email) {
    document.getElementById('gcalSetupView').classList.add('hidden');
    document.getElementById('gcalConnectedView').classList.remove('hidden');
    const creds = Storage.getGCalCreds();
    if (email) document.getElementById('gcalAccount').textContent = email;
  }

  function showGCalSetup() {
    document.getElementById('gcalSetupView').classList.remove('hidden');
    document.getElementById('gcalConnectedView').classList.add('hidden');
  }

  async function syncToGCal() {
    const types = [];
    if (document.getElementById('syncLecture').checked) types.push('lecture');
    if (document.getElementById('syncLab').checked)     types.push('lab');
    if (document.getElementById('syncExam').checked)    types.push('exam');
    if (document.getElementById('syncWork').checked)    types.push('work');
    showToast('Syncing…');
    try {
      const events = Storage.getEvents();
      const result = await GCalendar.syncEvents(events, types);
      showToast(`Synced ${result.success} event(s)${result.failed ? ', ' + result.failed + ' failed' : ''}`);
    } catch(e) {
      showToast('Sync failed: ' + (e.message || 'Check credentials'));
    }
  }

  function updateGCalStatusDisplay() {
    const creds = Storage.getGCalCreds();
    const dot   = document.querySelector('.gcal-dot');
    const label = document.getElementById('gcalCardLabel');
    if (creds) {
      dot.className = 'gcal-dot connected';
      if (label) label.textContent = 'Connected — click to sync';
    } else {
      dot.className = 'gcal-dot disconnected';
      if (label) label.textContent = 'Connect to sync events';
    }
  }

  // ── Modal helpers ─────────────────────────────────────────
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
  }

  function setupModalCloseButtons() {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });
  }

  // ── Toast ──────────────────────────────────────────────────
  function showToast(msg, duration = 2800) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
  }

  // ── Utilities ─────────────────────────────────────────────
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function genId() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone issues
    const today = new Date();
    const diff = Math.round((d - new Date(todayStr() + 'T12:00:00')) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatTime12(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12  = h % 12 || 12;
    return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  // Expose helpers for modules
  window.AppHelpers = { showToast, renderUpcoming, refreshCalendar: CalendarUI.render.bind(CalendarUI) };

})();
