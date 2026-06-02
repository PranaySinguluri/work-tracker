/* google-calendar.js — Google Calendar API integration */

const GCalendar = (() => {
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

  let gapi = null;
  let tokenClient = null;
  let isConnected = false;
  let userEmail = '';
  let _creds = null;

  // ── Initialize ─────────────────────────────────────────
  async function init(creds) {
    _creds = creds;
    return new Promise((resolve, reject) => {
      // Load gapi script if needed
      if (window.gapi) {
        _initGapi(creds, resolve, reject);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => _initGapi(creds, resolve, reject);
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }

  function _initGapi(creds, resolve, reject) {
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          apiKey: creds.apiKey,
          discoveryDocs: [DISCOVERY_DOC],
        });
        _loadGsiClient(creds, resolve, reject);
      } catch(e) { reject(e); }
    });
  }

  function _loadGsiClient(creds, resolve, reject) {
    if (window.google && window.google.accounts) {
      _createTokenClient(creds, resolve, reject);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => _createTokenClient(creds, resolve, reject);
    s.onerror = () => reject(new Error('Failed to load GSI'));
    document.head.appendChild(s);
  }

  function _createTokenClient(creds, resolve, reject) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: creds.clientId,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        // Get user profile
        try {
          const profile = await window.gapi.client.request({
            path: 'https://www.googleapis.com/oauth2/v1/userinfo',
          });
          userEmail = profile.result.email || '';
        } catch(_) {}
        isConnected = true;
        resolve({ connected: true, email: userEmail });
      }
    });
    // Request token immediately
    tokenClient.requestAccessToken({ prompt: '' });
  }

  // ── Create Event ────────────────────────────────────────
  async function createEvent(event) {
    if (!isConnected) throw new Error('Not connected');
    const body = toGCalBody(event);
    const resp = await window.gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: body,
    });
    return resp.result;
  }

  // ── Update Event ────────────────────────────────────────
  async function updateEvent(gcalEventId, event) {
    if (!isConnected) throw new Error('Not connected');
    const body = toGCalBody(event);
    const resp = await window.gapi.client.calendar.events.update({
      calendarId: 'primary',
      eventId: gcalEventId,
      resource: body,
    });
    return resp.result;
  }

  // ── Delete Event ────────────────────────────────────────
  async function deleteEvent(gcalEventId) {
    if (!isConnected) throw new Error('Not connected');
    await window.gapi.client.calendar.events.delete({
      calendarId: 'primary',
      eventId: gcalEventId,
    });
  }

  // ── Sync selected events ────────────────────────────────
  async function syncEvents(events, types) {
    const toSync = events.filter(e => types.includes(e.type) && e.date);
    const results = { success: 0, failed: 0 };
    for (const ev of toSync) {
      try {
        if (ev.gcalEventId) {
          await updateEvent(ev.gcalEventId, ev);
        } else {
          const created = await createEvent(ev);
          Storage.updateEvent(ev.id, { gcalEventId: created.id });
          ev.gcalEventId = created.id;
        }
        results.success++;
      } catch(e) {
        results.failed++;
      }
    }
    return results;
  }

  // ── Convert local event to GCal format ──────────────────
  function toGCalBody(event) {
    const start = event.startTime
      ? { dateTime: `${event.date}T${event.startTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      : { date: event.date };
    const end = event.endTime
      ? { dateTime: `${event.date}T${event.endTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      : start;

    return {
      summary: event.title,
      description: event.notes || '',
      start,
      end,
      colorId: typeToColorId(event.type),
    };
  }

  function typeToColorId(type) {
    // GCal color IDs: 1=Lavender,2=Sage,3=Grape,4=Flamingo,5=Banana,6=Tangerine,7=Peacock,8=Graphite,9=Blueberry,10=Basil,11=Tomato
    const map = { lecture: '9', lab: '10', exam: '11', work: '3', other: '8' };
    return map[type] || '8';
  }

  function getStatus() { return { isConnected, userEmail }; }

  return { init, createEvent, updateEvent, deleteEvent, syncEvents, getStatus };
})();
