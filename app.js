/* app.js — Simplified Class & Work Calendar */

(function() {
  'use strict';

  const CLIENT_ID = '899491417864-hfdfqurf3rvcoic9j3s2kj9sqa1ff111.apps.googleusercontent.com';

  let currentEventId = null;
  let draftEvents = [];

  document.addEventListener('DOMContentLoaded', async () => {
    const session = Storage.getSession();
    if (session && session.email) {
      showLoadingStep();
      try {
        await GCalendar.init(CLIENT_ID);
        const reconnected = await GCalendar.autoReconnect();
        if (reconnected) {
          loginSuccess();
          return;
        }
      } catch(e) {
        console.warn('Auto-reconnect failed:', e);
      }
    }
    showSignInStep();
    setupLoginScreen();
  });

  function setupLoginScreen() {
    const btn = document.getElementById('loginGoogleBtn');
    if (btn) {
      btn.addEventListener('click', signInWithGoogle);
    }
  }

  async function signInWithGoogle() {
    showLoadingStep();
    try {
      await GCalendar.init(CLIENT_ID);
      GCalendar.requestSignIn();
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Login timeout"));
        }, 15000);

        const checkInterval = setInterval(() => {
          const status = GCalendar.getStatus();
          if (status?.isConnected) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          }
        }, 500);
      });

      loginSuccess();
    } catch (e) {
      console.error('Sign-in error:', e);
      showToast('Sign-in failed: ' + e.message);
      showSignInStep();
    }
  }

  async function loginSuccess() {
    const status = GCalendar.getStatus();
    const email = status.userEmail;
    
    Storage.setUser(email);
    Storage.saveSession({ email });
    
    showLoadingStep();
    showToast('Loading your calendar...');
    
    // Auto-load all Google Calendar events
    try {
      const gcalEvents = await GCalendar.getAllEvents();
      console.log('Loaded events from Google Calendar:', gcalEvents.length);
      
      const localEvents = [];
      
      for (const gcalEv of gcalEvents) {
        const localEvent = {
          id: genId(),
          title: gcalEv.summary,
          type: gcalEventToType(gcalEv),
          date: gcalEv.start?.date || gcalEv.start?.dateTime?.split('T')[0],
          startTime: gcalEv.start?.dateTime ? gcalEv.start.dateTime.split('T')[1].slice(0, 5) : '',
          endTime: gcalEv.end?.dateTime ? gcalEv.end.dateTime.split('T')[1].slice(0, 5) : '',
          notes: gcalEv.description || '',
          gcalEventId: gcalEv.id
        };
        localEvents.push(localEvent);
      }
      
      Storage.saveEvents(localEvents);
      showToast(`✓ Loaded ${gcalEvents.length} event(s)`);
    } catch(e) {
      console.warn('Could not load Google Calendar:', e);
    }
    
    showAppShell();
    setupAppUI();
    updateUserInfo();
    renderUpcoming();
  }

  function gcalEventToType(gcalEv) {
    const title = (gcalEv.summary || '').toLowerCase();
    if (title.includes('exam') || title.includes('test') || title.includes('lab') || title.includes('class')) return 'Class';
    if (title.includes('shift') || title.includes('work') || title.includes('job') || title.includes('hour')) return 'Work';
    return 'Event';
  }

  function showSignInStep() {
    document.getElementById('loginSignInStep').classList.remove('hidden');
    document.getElementById('loginLoadingStep').classList.add('hidden');
  }

  function showLoadingStep() {
    document.getElementById('loginSignInStep').classList.add('hidden');
    document.getElementById('loginLoadingStep').classList.remove('hidden');
  }

  function showAppShell() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appShell').classList.remove('hidden');
  }

  function setupAppUI() {
    setupNav();
    setupDashboard();
    setupCalendar();
    setupNotes();
    setupImportModal();
    setupImportTextModal();
    setupHoursModal();
    setupEventModal();
    setupModalCloseButtons();
    setDashToday();
    CalendarUI.init({ onEventClick, onDayClick });
  }

  function updateUserInfo() {
    const status = GCalendar.getStatus();
    document.getElementById('userName').textContent = status.userEmail.split('@')[0];
  }

  function setupNav() {
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.getElementById('signOutBtn').addEventListener('click', signOut);
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

  function setupDashboard() {
    document.getElementById('openImportBtn')?.addEventListener('click', () => openModal('importModal'));
    document.getElementById('openTextImportBtn')?.addEventListener('click', () => openModal('importTextModal'));
    document.getElementById('openHoursBtn')?.addEventListener('click', () => openHoursModal());
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
      strip.innerHTML = '<p class="upcoming-empty">No upcoming events.</p>';
      return;
    }

    strip.innerHTML = upcoming.map(ev => {
      const dateLabel = formatDateLabel(ev.date);
      const timeLabel = ev.startTime ? formatTime12(ev.startTime) : '';
      return `
        <div class="upcoming-chip ${ev.type || 'Event'}" data-id="${ev.id}">
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

  function setupCalendar() {
    document.getElementById('calPrev')?.addEventListener('click', () => CalendarUI.prevMonth());
    document.getElementById('calNext')?.addEventListener('click', () => CalendarUI.nextMonth());
    document.getElementById('addEventFab')?.addEventListener('click', () => openEventModalNew());
  }

  function onEventClick(id) { openEventModal(id); }
  function onDayClick(dateStr) { openEventModalNew(dateStr); }

  function setupNotes() {
    const area = document.getElementById('notesArea');
    const saved = document.getElementById('notesSaved');
    if (!area) return;
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

  // ── IMPORT SCHEDULE (Camera/File) ──────────────────────
  function setupImportModal() {
    const fileInput = document.getElementById('fileInput');
    const cameraInput = document.getElementById('cameraInput');
    const uploadZone = document.getElementById('uploadZone');

    fileInput?.addEventListener('change', e => handleFile(e.target.files[0]));
    cameraInput?.addEventListener('change', e => handleFile(e.target.files[0]));

    uploadZone?.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
    uploadZone?.addEventListener('dragleave', () => uploadZone?.classList.remove('drag-over'));
    uploadZone?.addEventListener('drop', e => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    document.getElementById('detectEventsBtn')?.addEventListener('click', () => {
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
      document.getElementById('ocrText').value = 'Could not extract text. Try another file.';
    }
  }

  function showOcrSection() {
    document.getElementById('ocrSection').classList.remove('hidden');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('ocrText').value = '';
  }

  function openReviewModal() {
    renderDraftEvents();
    openModal('reviewModal');
  }

  function renderDraftEvents() {
    const list = document.getElementById('draftEventsList');
    if (!draftEvents.length) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No events detected.</p>';
      return;
    }
    list.innerHTML = draftEvents.map((ev, idx) => `
      <div class="draft-event-card" data-draft-idx="${idx}">
        <div class="draft-row full">
          <span class="draft-label">Title</span>
          <input type="text" class="draft-title" value="${escHtml(ev.title)}" />
        </div>
        <div class="draft-row">
          <span class="draft-label">Type</span>
          <select class="draft-type">
            <option value="Class"  ${ev.type==='Class'?'selected':''}>Class</option>
            <option value="Work"   ${ev.type==='Work'?'selected':''}>Work</option>
            <option value="Event"  ${ev.type==='Event'?'selected':''}>Event</option>
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
    document.querySelectorAll('.draft-event-card').forEach(card => {
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
    if (document.getElementById('addDraftEventBtn')) {
      document.getElementById('addDraftEventBtn').addEventListener('click', () => {
        draftEvents.push({ id: genId(), title: 'New Event', type: 'Class', date: todayStr(), startTime: '', endTime: '', notes: '' });
        renderDraftEvents();
      });
      document.getElementById('saveDraftEventsBtn').addEventListener('click', async () => {
        collectDraftEdits();
        const valid = draftEvents.filter(e => e.title && e.date);
        
        for (const ev of valid) {
          if (!checkDuplicate(ev)) {
            await addAndSyncEvent(ev);
          }
        }
        
        closeModal('reviewModal');
        renderUpcoming();
        CalendarUI.render();
        showToast(`${valid.length} event(s) added ✓`);
        draftEvents = [];
      });
    }
  });

  // ── IMPORT BY TEXT (Comma-separated) ──────────────────
  function setupImportTextModal() {
    document.getElementById('importTextBtn')?.addEventListener('click', () => {
      const text = document.getElementById('importTextArea').value.trim();
      if (!text) {
        showToast('Enter event details');
        return;
      }
      
      draftEvents = parseTextEvents(text);
      if (!draftEvents.length) {
        showToast('Could not parse events. Format: Title, Class/Work/Event, YYYY-MM-DD, HH:MM, HH:MM');
        return;
      }
      
      closeModal('importTextModal');
      openReviewModal();
      document.getElementById('importTextArea').value = '';
    });
  }

  function parseTextEvents(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const events = [];
    
    lines.forEach(line => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        events.push({
          id: genId(),
          title: parts[0] || 'Event',
          type: ['Class', 'Work', 'Event'].includes(parts[1]) ? parts[1] : 'Event',
          date: parts[2] || todayStr(),
          startTime: parts[3] || '',
          endTime: parts[4] || '',
          notes: ''
        });
      }
    });
    
    return events;
  }

  // ── ADD HOURS (Work Shifts) ───────────────────────────
  function setupHoursModal() {
    document.getElementById('saveHoursBtn')?.addEventListener('click', saveHours);
  }

  function openHoursModal() {
    document.getElementById('hoursTitle').value = 'Work Shift';
    document.getElementById('hoursDate').value = todayStr();
    document.getElementById('hoursStart').value = '09:00';
    document.getElementById('hoursEnd').value = '17:00';
    openModal('hoursModal');
  }

  async function saveHours() {
    const title = document.getElementById('hoursTitle').value.trim() || 'Work Shift';
    const date  = document.getElementById('hoursDate').value;
    const start = document.getElementById('hoursStart').value;
    const end   = document.getElementById('hoursEnd').value;
    
    if (!date) { showToast('Pick a date'); return; }
    
    const ev = { title, date, startTime: start, endTime: end, type: 'Work', notes: '' };
    
    if (!checkDuplicate(ev)) {
      await addAndSyncEvent(ev);
      showToast('Work shift added ✓');
    } else {
      showToast('⚠️ Event already exists at this time');
    }
    
    closeModal('hoursModal');
    renderUpcoming();
    CalendarUI.render();
  }

  // ── EVENT MODAL ────────────────────────────────────────
  function setupEventModal() {
    document.getElementById('saveEventBtn')?.addEventListener('click', saveEvent);
    document.getElementById('deleteEventBtn')?.addEventListener('click', async () => {
      if (currentEventId && confirm('Delete this event?')) {
        const ev = Storage.getEventById(currentEventId);
        Storage.deleteEvent(currentEventId);
        if (ev?.gcalEventId) {
          await GCalendar.deleteEvent(ev.gcalEventId);
        }
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
    document.getElementById('evType').value  = ev.type || 'Event';
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
    document.getElementById('evType').value  = 'Class';
    document.getElementById('evDate').value  = dateStr || todayStr();
    document.getElementById('evStart').value = '';
    document.getElementById('evEnd').value   = '';
    document.getElementById('evNotes').value = '';
    openModal('eventModal');
  }

  async function saveEvent() {
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
      await syncEventToGoogle(currentEventId, ev);
      showToast('Event updated ✓');
    } else {
      if (!checkDuplicate(ev)) {
        await addAndSyncEvent(ev);
        showToast('Event added ✓');
      } else {
        showToast('⚠️ Event already exists');
        return;
      }
    }
    closeModal('eventModal');
    renderUpcoming();
    CalendarUI.render();
  }

  // ── DUPLICATE CHECK ────────────────────────────────────
  function checkDuplicate(newEvent) {
    const events = Storage.getEvents();
    return events.some(e => 
      e.title.toLowerCase() === newEvent.title.toLowerCase() &&
      e.date === newEvent.date &&
      e.startTime === newEvent.startTime
    );
  }

  // ── ADD & SYNC ─────────────────────────────────────────
  async function addAndSyncEvent(ev) {
    const localEv = Storage.addEvent(ev);
    try {
      const gcalEv = await GCalendar.createEvent(localEv);
      Storage.updateEvent(localEv.id, { gcalEventId: gcalEv.id });
    } catch(e) {
      console.error('Sync failed:', e);
    }
  }

  async function syncEventToGoogle(localId, ev) {
    try {
      const local = Storage.getEventById(localId);
      if (local?.gcalEventId) {
        await GCalendar.updateEvent(local.gcalEventId, ev);
      } else {
        const gcalEv = await GCalendar.createEvent({ ...ev, id: localId });
        Storage.updateEvent(localId, { gcalEventId: gcalEv.id });
      }
    } catch(e) {
      console.error('Sync to Google failed:', e);
    }
  }

  // ── SIGN OUT ───────────────────────────────────────────
  function signOut() {
    if (confirm('Sign out?')) {
      GCalendar.signOut();
      Storage.clearCreds();
      Storage.clearSession();
      location.reload();
    }
  }

  // ── MODAL HELPERS ──────────────────────────────────────
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

  // ── TOAST ──────────────────────────────────────────────
  function showToast(msg, duration = 2800) {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), duration);
    }
  }

  // ── UTILITIES ──────────────────────────────────────────
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
    const d = new Date(dateStr + 'T12:00:00');
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

})();
