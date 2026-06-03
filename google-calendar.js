/* google-calendar.js — OAuth2 authentication & Google Calendar API */

const GCalendar = (() => {

  const DISCOVERY_DOC =
    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

  const SCOPES =
    'https://www.googleapis.com/auth/calendar';

  let isConnected = false;
  let userEmail = '';
  let userCalendarId = 'primary';

  let tokenClient = null;
  let clientId = '';

  async function init(cid) {
    clientId = cid;

    return new Promise((resolve, reject) => {

      if (window.gapi) {
        _loadGapi(resolve, reject);
      } else {

        const script =
          document.createElement('script');

        script.src =
          'https://apis.google.com/js/api.js';

        script.onload =
          () => _loadGapi(resolve, reject);

        script.onerror =
          () => reject(
            new Error('Failed to load Google API')
          );

        document.head.appendChild(script);
      }

    });
  }

  function _loadGapi(resolve, reject) {

    window.gapi.load('client', async () => {

      try {

        await window.gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC]
        });

        _loadGsi(resolve, reject);

      } catch (e) {
        reject(e);
      }

    });

  }

  function _loadGsi(resolve, reject) {

    if (
      window.google &&
      window.google.accounts
    ) {
      _createTokenClient(resolve, reject);
      return;
    }

    const script =
      document.createElement('script');

    script.src =
      'https://accounts.google.com/gsi/client';

    script.onload =
      () => _createTokenClient(resolve, reject);

    script.onerror =
      () => reject(
        new Error('Failed to load Google Identity')
      );

    document.head.appendChild(script);

  }

  function _createTokenClient(resolve, reject) {

    tokenClient =
      window.google.accounts.oauth2.initTokenClient({

        client_id: clientId,

        scope: SCOPES,

        callback: async (resp) => {

          if (resp.error) {
            reject(new Error(resp.error));
            return;
          }

          try {

            const creds =
              Storage.getGCalCreds() || {};

            creds.accessToken =
              resp.access_token;

            if (resp.expires_in) {
              creds.expiresAt =
                Date.now() +
                (resp.expires_in * 1000);
            }

            userEmail = 'Connected';
            creds.email = userEmail;
            Storage.saveGCalCreds(
              creds
            );

            userCalendarId =
              creds.calendarId || 'primary';

            isConnected = true;

            resolve({
              connected: true,
              email: userEmail
            });

          } catch (e) {

            console.error(
              'OAuth callback failure',
              e
            );

            reject(e);

          }

        }

      });

  }

  function requestSignIn() {

    if (!tokenClient) {
      throw new Error(
        'GCalendar not initialized'
      );
    }

    tokenClient.requestAccessToken({
      prompt: 'consent'
    });

  }

  async function autoReconnect() {

    const creds =
      Storage.getGCalCreds();

    if (
      !creds ||
      !creds.accessToken
    ) {
      return false;
    }

    if (
      creds.expiresAt &&
      Date.now() > creds.expiresAt
    ) {
      Storage.clearGCalCreds();
      return false;
    }

    try {

      userEmail =
        creds.email || '';

      userCalendarId =
        creds.calendarId || 'primary';

      isConnected = true;

      return true;

    } catch (e) {

      Storage.clearGCalCreds();

      return false;
    }

  }

  async function listCalendars() {

    if (!isConnected)
      throw new Error('Not connected');

    const resp =
      await window.gapi.client.calendar.calendarList.list();

    return resp.result.items || [];

  }

  async function createCalendar(name) {

    if (!isConnected)
      throw new Error('Not connected');

    const resp =
      await window.gapi.client.calendar.calendars.insert({
        resource: {
          summary: name,
          description:
            'Class & Work schedule'
        }
      });

    return resp.result.id;

  }

  function setCalendarId(calId) {

    userCalendarId = calId;

    const creds =
      Storage.getGCalCreds();

    if (creds) {

      creds.calendarId = calId;

      Storage.saveGCalCreds(
        creds
      );

    }

  }

  async function createEvent(event) {

    if (!isConnected)
      throw new Error('Not connected');

    const body =
      toGCalBody(event);

    const resp =
      await window.gapi.client.calendar.events.insert({
        calendarId:
          userCalendarId,
        resource:
          body
      });

    return resp.result;

  }

  async function updateEvent(
    gcalEventId,
    event
  ) {

    if (!isConnected)
      throw new Error('Not connected');

    const body =
      toGCalBody(event);

    const resp =
      await window.gapi.client.calendar.events.update({
        calendarId:
          userCalendarId,
        eventId:
          gcalEventId,
        resource:
          body
      });

    return resp.result;

  }

  async function deleteEvent(
    gcalEventId
  ) {

    if (!isConnected)
      throw new Error('Not connected');

    await window.gapi.client.calendar.events.delete({
      calendarId:
        userCalendarId,
      eventId:
        gcalEventId
    });

  }

  async function syncEvents(
    events,
    types
  ) {

    const toSync =
      events.filter(
        e => types.includes(e.type) && e.date
      );

    const results = {
      success: 0,
      failed: 0
    };

    for (const ev of toSync) {

      try {

        if (ev.gcalEventId) {

          await updateEvent(
            ev.gcalEventId,
            ev
          );

        } else {

          const created =
            await createEvent(ev);

          Storage.updateEvent(
            ev.id,
            {
              gcalEventId:
                created.id
            }
          );

          ev.gcalEventId =
            created.id;
        }

        results.success++;

      } catch (e) {

        console.error(
          'Sync failed',
          e
        );

        results.failed++;

      }

    }

    return results;

  }

  function toGCalBody(event) {

    const tz =
      Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone;

    const start =
      event.startTime
        ? {
            dateTime:
              `${event.date}T${event.startTime}:00`,
            timeZone:
              tz
          }
        : {
            date:
              event.date
          };

    const end =
      event.endTime
        ? {
            dateTime:
              `${event.date}T${event.endTime}:00`,
            timeZone:
              tz
          }
        : start;

    return {

      summary:
        event.title,

      description:
        event.notes || '',

      start,

      end,

      colorId:
        typeToColorId(
          event.type
        )

    };

  }

  function typeToColorId(type) {

    const map = {
      lecture: '9',
      lab: '10',
      exam: '11',
      work: '3',
      other: '8'
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
