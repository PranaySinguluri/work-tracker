/* google-calendar.js — OAuth2 authentication & Google Calendar API */

const GCalendar = (() => {
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

  let isConnected = false;
  let userEmail = '';
  let userCalendarId = 'primary';
  let tokenClient = null;
  let clientId = '';

  // ── Initialize OAuth2 ────────────────────────────────────
  async function init(cid) {
    clientId = cid;
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        _loadGapi(resolve, reject);
      } else {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => _loadGapi(resolve, reject);
        script.onerror = () => reject(new Error('Failed to load Google API'));
        document.head.appendChild(script);
      }
    });
  }

  function _loadGapi(resolve, reject) {
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        });
        _loadGsi(resolve, reject);
      } catch(e) { reject(e); }
    });
  }

  function _loadGsi(resolve, reject) {
    if (window.google && window.google.accounts) {
      _createTokenClient(resolve, reject);
    } else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = () => _createTokenClient(resolve, reject);
      s.onerror = () => reject(new Error('Failed to load GSI'));
      document.head.appendChild(s);
    }
  }

  function _createTokenClient(resolve, reject) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { 
          reject(new Error(resp.error)); 
          return; 
        }
        // Save token
        const creds = Storage.getGCalCreds() || {};
        creds.accessToken = resp.access_token;
        creds.expiresAt = Date.now() + (resp.expires_in * 1000);
        Storage.saveGCalCreds(creds);
        
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
  }

  // ── Request OAuth2 Sign In ───────────────────────────────
  function requestSignIn() {
    if (!tokenClient) throw new Error('GCalendar not initialized');
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  // ── Auto-reconnect with stored token ─────────────────────
  async function autoReconnect() {
    const creds = Storage.getGCalCreds();
    if (!creds || !creds.accessToken) return false;

    // Check if token expired
    if (creds.expiresAt && Date.now() > creds.expiresAt) {
      // Token expired — for now, require re-signin (refresh token not stored in this flow)
      Storage.clearGCalCreds();
      return false;
    }

    try {
      // Verify token still works by getting user profile
      await window.gapi.client.request({
        path: 'https://www.googleapis.com/oauth2/v1/userinfo',
      });
      userEmail = creds.email || '';
      userCalendarId = creds.calendarId || 'primary';
      isConnected = true;
      return true;
    } catch(e) {
      Storage.clearGCalCreds();
      return false;
    }
  }

  // ── Get list of user's calendars ─────────────────────────
  async function listCalendars() {
    if (!isConnected) throw new Error('Not connected');
    const resp = await window.gapi.client.calendar.calendarList.list();
    return resp.result.items || [];
  }

  // ── Create a new calendar ────────────────────────────────
  async function createCalendar(name) {
    if (!isConnected) throw new Error('Not connected');
    const resp = await window.gapi.client.calendar.calendars.insert({
      resource: {
        summary: name,
        description: 'Class & Work schedule'
      }
    });
    return resp.result.id;
  }

  // ── Set the user's calendar ──────────────────────────────
  function setCalendarId(calId) {
    userCalendarId = calId;
    const creds = Storage.getGCalCreds();
    if (creds) {
      creds.calendarId = calId;
      Storage.saveGCalCreds(creds);
    }
  }

  // ── Create Event ─────────────────────────────────────────
  async function createEvent(event) {
    if (!isConnected) throw new Error('Not connected');
    const body = toGCalBody(event);
    const resp = await window.gapi.client.calendar.events.insert({
      calendarId: userCalendarId,
      resource: body,
    });
    return resp.result;
  }

  // ── Update Event ─────────────────────────────────────────
  async function updateEvent(gcalEventId, event) {
    if (!isConnected) throw new Error('Not connected');
    const body = toGCalBody(event);
    const resp = await window.gapi.client.calendar.events.update({
      calendarId: userCalendarId,
      eventId: gcalEventId,
      resource: body,
    });
    return resp.result;
  }

  // ── Delete Event ─────────────────────────────────────────
  async function deleteEvent(gcalEventId) {
    if (!isConnected) throw new Error('Not connected');
    await window.gapi.client.calendar.events.delete({
      calendarId: userCalendarId,
      eventId: gcalEventId,
    });
  }

  // ── Sync selected events ─────────────────────────────────
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

  // ── Convert local event to GCal format ────────────────────
  function toGCalBody(event) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const start = event.startTime
      ? { dateTime: `${event.date}T${event.startTime}:00`, timeZone: tz }
      : { date: event.date };
    const end = event.endTime
      ? { dateTime: `${event.date}T${event.endTime}:00`, timeZone: tz }
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
    const map = { lecture: '9', lab: '10', exam: '11', work: '3', other: '8' };
    return map[type] || '8';
  }

  function getStatus() { 
    return { isConnected, userEmail, userCalendarId }; 
  }

  function signOut() {
    isConnected = false;
    userEmail = '';
    userCalendarId = 'primary';
    Storage.clearGCalCreds();
  }

  return { 
    init, requestSignIn, autoReconnect, 
    listCalendars, createCalendar, setCalendarId,
    createEvent, updateEvent, deleteEvent, syncEvents, 
    getStatus, signOut 
  };
})();
