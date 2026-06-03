/* ocr.js — OCR and event detection */

const OCR = (() => {

  // ── Run Tesseract on an image file ──────────────────────
  async function extractTextFromImage(file, onProgress) {
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100), 'Reading text…');
        }
      }
    });
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    return text;
  }

  // ── Extract text from PDF via pdf.js ────────────────────
  async function extractTextFromPDF(file, onProgress) {
    if (onProgress) onProgress(10, 'Loading PDF…');
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(s => s.str).join(' ') + '\n';
      if (onProgress) onProgress(10 + Math.round((i / pdf.numPages) * 80), `Page ${i} of ${pdf.numPages}…`);
    }
    if (onProgress) onProgress(100, 'Done');
    return fullText;
  }

  // ── Detect draft events from extracted text ──────────────
  // Looks for patterns like:
  //   Monday 9:00 AM - 10:15 AM  MATH 101
  //   CS 201 Lab  Tu/Th  2:30-4:00pm
  //   Exam: Chemistry  April 15  3:00 PM
  function detectEvents(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const events = [];

    // Days mapping
    const dayMap = {
      'mon': 1, 'monday': 1, 'mo': 1,
      'tue': 2, 'tuesday': 2, 'tu': 2,
      'wed': 3, 'wednesday': 3, 'we': 3,
      'thu': 4, 'thursday': 4, 'th': 4,
      'fri': 5, 'friday': 5, 'fr': 5,
      'sat': 6, 'saturday': 6, 'sa': 6,
      'sun': 0, 'sunday': 0, 'su': 0
    };

    // Month map
    const monthMap = {
      jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
      jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
      january:0, february:1, march:2, april:3, june:5,
      july:6, august:7, september:8, october:9, november:10, december:11
    };

    const timeRx = /(\d{1,2}:\d{2})\s*(am|pm)?/gi;
    const typeKeywords = {
      exam: /\b(exam|midterm|final|quiz|test)\b/i,
      lab:  /\b(lab|laboratory)\b/i,
      lecture: /\b(lecture|class|lec|course|section)\b/i,
    };

    lines.forEach(line => {
      // Try to find time range
      const times = [];
      let m;
      const rx = /(\d{1,2}:\d{2})\s*(am|pm)?/gi;
      while ((m = rx.exec(line)) !== null) times.push({ raw: m[1], ampm: m[2] });

      if (times.length < 1) return; // no time = skip

      // Determine type
      let type = 'other';
      if (typeKeywords.exam.test(line)) type = 'exam';
      else if (typeKeywords.lab.test(line)) type = 'lab';
      else if (typeKeywords.lecture.test(line)) type = 'lecture';

      // Try to find a date
      let date = '';
      const dateRx = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
      const dateM = dateRx.exec(line);
      if (dateM) {
        const year = dateM[3] ? (dateM[3].length === 2 ? '20' + dateM[3] : dateM[3]) : new Date().getFullYear();
        date = `${year}-${String(dateM[1]).padStart(2,'0')}-${String(dateM[2]).padStart(2,'0')}`;
      } else {
        // Try month name
        const mNameRx = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i;
        const mMatch = mNameRx.exec(line);
        if (mMatch) {
          const mo = monthMap[mMatch[1].toLowerCase().slice(0,3)];
          const dy = parseInt(mMatch[2]);
          const yr = mMatch[3] ? parseInt(mMatch[3]) : new Date().getFullYear();
          date = `${yr}-${String(mo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
        }
      }

      // Clean title: remove time patterns and date patterns
      let title = line
        .replace(/\d{1,2}:\d{2}\s*(?:am|pm)?/gi, '')
        .replace(/\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/g, '')
        .replace(/-+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!title) title = 'Event';

      const startTime = normalizeTime(times[0].raw, times[0].ampm);
      const endTime   = times[1] ? normalizeTime(times[1].raw, times[1].ampm) : '';

      events.push({ id: null, title, type, date, startTime, endTime, notes: '' });
    });

    return events;
  }

  function normalizeTime(timeStr, ampm) {
    let [h, m] = timeStr.split(':').map(Number);
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && h < 12) h += 12;
      if (ampm.toLowerCase() === 'am' && h === 12) h = 0;
    }
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  return { extractTextFromImage, extractTextFromPDF, detectEvents };
})();
