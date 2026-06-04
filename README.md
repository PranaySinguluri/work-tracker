# Class & Work Calendar

A mobile-friendly personal scheduling app for managing college classes, labs, exams, and work shifts. Deployable directly to GitHub Pages — no backend required.

---

## Features

- **📷 Import Class Schedule** — Upload a photo, screenshot, or PDF. OCR extracts text (via Tesseract.js), you review and edit, then save as events.
- **💼 Work Shifts** — Add/edit/delete shifts with a dedicated form.
- **📅 Monthly Calendar** — Color-coded view (blue=Lecture, green=Lab, orange=Exam, purple=Work).
- **📝 Notes** — Auto-saving personal notes area.
- **🔗 Google Calendar Sync** — Sync selected event types to your primary Google Calendar.

---

## Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload all 7 files:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `ocr.js`
   - `calendar.js`
   - `storage.js`
   - `google-calendar.js`
3. Go to **Settings → Pages** → set source to `main` branch, root folder
4. Your app will be live at `https://yourusername.github.io/repo-name`

---

## Google Calendar Setup (optional)

To enable Google Calendar sync:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Google Calendar API**
3. Go to **APIs & Services → Credentials**
4. Create an **API Key**
5. Create an **OAuth 2.0 Client ID** (Web Application type)
6. Add your GitHub Pages URL to **Authorized JavaScript Origins**
   - e.g. `https://yourusername.github.io`
7. Open the app → click **Google Calendar** card → enter Client ID + API Key → Connect

---

## How OCR Works

```
Upload image / PDF
       ↓
Tesseract.js / PDF.js extracts text
       ↓
Editable text area — fix any errors
       ↓
"Detect Events" — parses times, dates, titles
       ↓
Review & edit draft events
       ↓
Save to local storage / sync to Google Calendar
```

OCR works best with clear screenshots of class schedules. Always review before saving.

---

## Local Storage

All events, notes, and preferences are saved in your browser's localStorage. Data persists between sessions on the same device/browser.

---

## Tech Stack

- Vanilla HTML / CSS / JavaScript (no framework)
- [Tesseract.js](https://tesseract.projectnaptha.com/) for OCR
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF text extraction
- Google Calendar API (optional)
- Google Fonts: DM Serif Display + DM Sans
