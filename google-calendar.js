/* google-calendar.js — OAuth2 + Google Calendar API */

const GCalendar = (() => {

  const DISCOVERY_DOC =
    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

  const SCOPES =
    'https://www.googleapis.com/auth/calendar';

  let isConnected = false;
  let userEmail = '';
  let userCalendarId = 'primary';
  let initialized = false;

  let tokenClient = null;
  let clientId = '';

  async function init(cid) {
    if (initialized) {
      console.log("INIT already done");
      return;
    }

    clientId = cid;

    return new Promise((resolve, reject) => {
      console.log("INIT start");

      function createClient() {
        console.log("CREATING TOKEN CLIENT...");

        try {
          tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,

            callback: (resp) => {
              console.log("TOKEN RESPONSE:", resp);

              if (resp.error) {
                console.error("OAuth error", resp);
                return;
              }

              try {
                window.gapi.client.setToken({
                  access_token: resp.access_token
                });

                const creds = Storage.getGCalCreds() || {};
                creds.accessToken = resp.access_token;

                if (resp.expires_in) {
                  creds.expiresAt = Date.now() + (resp.expires_in * 1000);
                }

                userEmail = 'Connected';
                creds.email = userEmail;

                Storage.saveGCalCreds(creds);

                userCalendarId = creds.calendarId || 'primary';

                isConnected = true;

                console.log("✅ CONNECTED WITH TOKEN SET");
              } catch (e) {
                console.error("OAuth callback error:", e);
              }
            }
          });

          console.log("✅ tokenClient created:", tokenClient);
          initialized = true;
          resolve();

        } catch (e) {
          console.error("Token client creation failed", e);
          reject(e);
        }
      }

      function loadGapi() {
        console.log("Loading gapi.client...");

        if (!window.gapi) {
          reject(new Error("gapi not loaded"));
          return;
        }

        window.gapi.load('client', async () => {
          try {
            console.log("Initializing gapi.client with discovery doc...");

            await window.gapi.client.init({
              discoveryDocs: [DISCOVERY_DOC]
            });

            console.log("✅ gapi.client initialized");
            createClient();

          } catch (e) {
            console.error("gapi.client.init failed", e);
            reject(e);
          }
        });
      }

      if (window.gapi) {
        console.log("gapi already loaded");
        loadGapi();
      } else {
        console.log("Loading gapi script...");
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = () => {
          console.log("✅ gapi script loaded");
          loadGapi();
        };
        gapiScript.onerror = () => {
          reject(new Error("Failed to load gapi"));
        };
        document.head.appendChild(gapiScript);
      }

      if (!window.google || !window.google.accounts) {
        console.log("Loading GSI script...");
        const gsiScript = document.createElement('script');
        gsiScript.src = 'https://accounts.google.com/gsi/client';
        gsiScript.onerror = () => {
          reject(new Error("Failed to load GSI"));
        };
        document.head.appendChild(gsiScript);
      }
    });
  }

  function requestSignIn() {
    console.log("READ tokenClient:", tokenClient);

    if (!tokenClient) {
      throw new Error('GCalendar not initialized (tokenClient missing)');
    }

    try {
      tokenClient.requestAccessToken({
        prompt: 'consent'
      });
    } catch (e) {
      console.error("requestAccessToken failed", e);
      throw e;
    }
  }

  async function autoReconnect() {
    const creds = Storage.getGCalCreds();

    if (!creds || !creds.accessToken) {
      return false;
    }

    if (creds.expiresAt && Date.now() > creds.expiresAt) {
      Storage.clearGCalCreds();
      return false;
    }

    try {
      window.gapi.client.setToken({
        access_token: creds.accessToken
      });

      userEmail = creds.email || '';
      userCalendarId = creds.calendarId || 'primary';
      isConnected = true;

      return true;

    } catch (e) {
      Storage.clearGCalCreds();
      return false;
    }
  }

  async function getAllEvents() {
    if (!isConnected) throw new Error('Not connected');

    const events = [];
    let pageToken = null;

    do {
      const resp = await window.gapi.client.calendar.events.list({
        calendarId: userCalendarId,
        pageToken: pageToken,
        maxResults: 250
      });

      if (resp.result.items) {
        events.push(...resp.result.items);
      }

      pageToken = resp.result.nextPageToken;
    } while (pageToken);

    return events;
  }

  async function listCalendars() {
    if (!isConnected) throw new Error('Not connected');

    const resp = await window.gapi.client.calendar.calendarList.list();
    return resp.result.items || [];
  }

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

  function setCalendarId(calId) {
    userCalendarId = calId;

    const creds = Storage.getGCalCreds();

    if (creds) {
      creds.calendarId = calId;
      Storage.saveGCalCreds(creds);
    }
  }

  async function createEvent(event) {
    if (!isConnected) throw new Error('Not connected');

    const body = toGCalBody(event);

    const resp = await window.gapi.client.calendar.events.insert({
      calendarId: userCalendarId,
      resource: body
    });

    return resp.result;
  }

  async function updateEvent(gcalEventId, event) {
    if (!isConnected) throw new Error('Not connected');

    const body = toGCalBody(event);

    const resp = await window.gapi.client.calendar.events.update({
      calendarId: userCalendarId,
      eventId: gcalEventId,
      resource: body
    });

    return resp.result;
  }

  async function deleteEvent(gcalEventId) {
    if (!isConnected) throw new Error('Not connected');

    await window.gapi.client.calendar.events.delete({
      calendarId: userCalendarId,
      eventId: gcalEventId
    });
  }

  async function syncEvents(events = [], types = []) {
    const toSync = (events || []).filter(
      e => (types || []).includes(e.type) && e.date
    );

    const results = {
      success: 0,
      failed: 0
    };

    for (const ev of toSync) {
      try {
        if (ev.gcalEventId) {
          await updateEvent(ev.gcalEventId, ev);
        } else {
          const created = await createEvent(ev);

          Storage.updateEvent(ev.id, {
            gcalEventId: created.id
          });

          ev.gcalEventId = created.id;
        }

        results.success++;

      } catch (e) {
        console.error('Sync failed', e);
        results.failed++;
      }
    }

    return results;
  }

  function toGCalBody(event) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const start = event.startTime
      ? {
          dateTime: `${event.date}T${event.startTime}:00`,
          timeZone: tz
        }
      : {
          date: event.date
        };

    const end = event.endTime
      ? {
          dateTime: `${event.date}T${event.endTime}:00`,
          timeZone: tz
        }
      : start;

    return {
      summary: event.title,
      description: event.notes || '',
      start,
      end,
      colorId: typeToColorId(event.type)
    };
  }

  function typeToColorId(type) {
    const map = {
      Class: '9',
      Work: '3',
      Event: '8'
    };

    return map[type] || '8';
  }

  function getStatus() {
    return {
      isConnected,
      userEmail,
      userCalendarId
    };
  }

  function signOut() {
    isConnected = false;
    userEmail = '';
    userCalendarId = 'primary';
    Storage.clearGCalCreds();
  }

  return {
    init,
    requestSignIn,
    autoReconnect,
    getAllEvents,
    listCalendars,
    createCalendar,
    setCalendarId,
    createEvent,
    updateEvent,
    deleteEvent,
    syncEvents,
    getStatus,
    signOut
  };

})();
