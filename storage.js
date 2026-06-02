/* storage.js — Local storage helpers */

const Storage = (() => {
  const EVENTS_KEY  = 'cwc_events';
  const NOTES_KEY   = 'cwc_notes';
  const PREFS_KEY   = 'cwc_prefs';
  const GCAL_KEY    = 'cwc_gcal';

  // ── Events ──────────────────────────────────────────────
  function getEvents() {
    try { return JSON.parse(localStorage.getItem(EVENTS_KEY)) || []; }
    catch { return []; }
  }

  function saveEvents(events) {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  }

  function addEvent(event) {
    const events = getEvents();
    if (!event.id) event.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
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
    const events = getEvents().filter(e => e.id !== id);
    saveEvents(events);
  }

  function getEventById(id) {
    return getEvents().find(e => e.id === id) || null;
  }

  // ── Notes ────────────────────────────────────────────────
  function getNotes() {
    return localStorage.getItem(NOTES_KEY) || '';
  }
  function saveNotes(text) {
    localStorage.setItem(NOTES_KEY, text);
  }

  // ── Prefs ────────────────────────────────────────────────
  function getPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; }
    catch { return {}; }
  }
  function savePrefs(prefs) {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...getPrefs(), ...prefs }));
  }

  // ── GCal creds ──────────────────────────────────────────
  function getGCalCreds() {
    try { return JSON.parse(localStorage.getItem(GCAL_KEY)) || null; }
    catch { return null; }
  }
  function saveGCalCreds(creds) {
    localStorage.setItem(GCAL_KEY, JSON.stringify(creds));
  }
  function clearGCalCreds() {
    localStorage.removeItem(GCAL_KEY);
  }

  return {
    getEvents, saveEvents, addEvent, updateEvent, deleteEvent, getEventById,
    getNotes, saveNotes,
    getPrefs, savePrefs,
    getGCalCreds, saveGCalCreds, clearGCalCreds
  };
})();
