/* storage.js — Local storage helpers, keyed per Google user */

const Storage = (() => {
  let _userKey = 'default';

  // Call after login so each user has isolated storage
  function setUser(email) {
    _userKey = email ? email.replace(/[^a-z0-9]/gi, '_') : 'default';
  }

  function k(suffix) { return `cwc_${_userKey}_${suffix}`; }

  // ── Events ──────────────────────────────────────────────
  function getEvents() {
    try { return JSON.parse(localStorage.getItem(k('events'))) || []; }
    catch { return []; }
  }
  function saveEvents(events) {
    localStorage.setItem(k('events'), JSON.stringify(events));
  }
  function addEvent(event) {
    const events = getEvents();
    if (!event.id) event.id = genId();
    events.push(event);
    saveEvents(events);
    return event;
  }
  function updateEvent(id, updates) {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    events[idx] = { ...events[idx], ...updates };
    saveEvents(events);
    return events[idx];
  }
  function deleteEvent(id) {
    saveEvents(getEvents().filter(e => e.id !== id));
  }
  function getEventById(id) {
    return getEvents().find(e => e.id === id) || null;
  }

  // ── Notes ────────────────────────────────────────────────
  function getNotes() { return localStorage.getItem(k('notes')) || ''; }
  function saveNotes(text) { localStorage.setItem(k('notes'), text); }

  // ── Prefs (calendar ID, sync options, label) ─────────────
  function getPrefs() {
    try { return JSON.parse(localStorage.getItem(k('prefs'))) || {}; }
    catch { return {}; }
  }
  function savePrefs(prefs) {
    localStorage.setItem(k('prefs'), JSON.stringify({ ...getPrefs(), ...prefs }));
  }

  // ── Global creds (shared, not per-user) ─────────────────
  function getCreds() {
    try { return JSON.parse(localStorage.getItem('cwc_creds')) || null; }
    catch { return null; }
  }
  function saveCreds(creds) {
    localStorage.setItem('cwc_creds', JSON.stringify(creds));
  }
  function clearCreds() { localStorage.removeItem('cwc_creds'); }

  // ── Session token cache ──────────────────────────────────
  function getSession() {
    try { return JSON.parse(localStorage.getItem('cwc_session')) || null; }
    catch { return null; }
  }
  function saveSession(s) { localStorage.setItem('cwc_session', JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem('cwc_session'); }

  function genId() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  return {
    setUser,
    getEvents, saveEvents, addEvent, updateEvent, deleteEvent, getEventById,
    getNotes, saveNotes,
    getPrefs, savePrefs,
    getCreds, saveCreds, clearCreds,
    getSession, saveSession, clearSession
  };
})();
