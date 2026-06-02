const CLIENT_ID = "899491417864-hfdfqurf3rvcoic9j3s2kj9sqa1ff111.apps.googleusercontent.com";
const API_KEY = "AIzaSyCmSvTjsF4DmxlSrEwocomOnD0BmRvbdDo";

const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

const SCOPES = "https://www.googleapis.com/auth/calendar";

let tokenClient;
let gapiInited = false;
let gisInited = false;

/* Init */
function initGoogle() {
  gapi.load("client", async () => {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '',
  });

  gisInited = true;
}

/* Login */
function connectGoogle() {
  if (!gapiInited || !gisInited) {
    initGoogle();
  }

  tokenClient.callback = async (resp) => {
    if (resp.error) {
      alert("Login failed");
      return;
    }
    alert("Google Calendar Connected ✅");
  };

  tokenClient.requestAccessToken({ prompt: "consent" });
}

/* Create Event */
async function createGoogleEvent(event) {
  const e = {
    summary: event.title,
    description: event.type,
    start: {
      dateTime: `${event.date}T${event.start}:00`,
      timeZone: "America/Chicago"
    },
    end: {
      dateTime: `${event.date}T${event.end}:00`,
      timeZone: "America/Chicago"
    }
  };

  return gapi.client.calendar.events.insert({
    calendarId: "primary",
    resource: e
  });
}

/* Sync Selected Events */
function syncSelectedEvents() {
  const events = Storage.load("events");

  if (!events.length) {
    alert("No events to sync");
    return;
  }

  const confirmSync = confirm(`Sync ${events.length} events to Google Calendar?`);
  if (!confirmSync) return;

  syncEventsNow(events);
}

async function syncEventsNow(events) {
  try {
    for (let e of events) {
      await createGoogleEvent(e);
    }

    alert("✅ Sync complete!");
  } catch (err) {
    console.error(err);
    alert("❌ Sync failed. Check console.");
  }
}


/* Delete Event */
async function deleteGoogleEvent(eventId) {
  return gapi.client.calendar.events.delete({
    calendarId: "primary",
    eventId: eventId
  });
}
``