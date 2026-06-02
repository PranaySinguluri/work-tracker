function hideAll() {
  document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
}

function openImport() {
  hideAll();
  document.getElementById("importSection").classList.remove("hidden");
}

function openShift() {
  hideAll();
  document.getElementById("shiftSection").classList.remove("hidden");
}

function openCalendar() {
  hideAll();
  document.getElementById("calendarSection").classList.remove("hidden");
  renderCalendar();
}

function openNotes() {
  hideAll();
  document.getElementById("notesSection").classList.remove("hidden");

  document.getElementById("notes").value = localStorage.getItem("notes") || "";
}

document.getElementById("notes").addEventListener("input", (e) => {
  localStorage.setItem("notes", e.target.value);
});

/* ===== Event Detection ===== */
function parseEvents() {
  const text = document.getElementById("ocrText").value;

  const drafts = text.split("\n").map(line => ({
    title: line,
    date: new Date().toISOString().split("T")[0],
    start: "09:00",
    end: "10:00",
    type: "Lecture"
  }));

  displayDrafts(drafts);
}

function displayDrafts(events) {
  const container = document.getElementById("draftEvents");
  container.innerHTML = "";

  events.forEach((e, i) => {
    const div = document.createElement("div");

    div.innerHTML = `
      <input value="${e.title}" onchange="editDraft(${i}, 'title', this.value)">
      <input type="date" value="${e.date}" onchange="editDraft(${i}, 'date', this.value)">
      <input type="time" value="${e.start}">
      <input type="time" value="${e.end}">
      <select onchange="editDraft(${i}, 'type', this.value)">
        <option>Lecture</option>
        <option>Lab</option>
        <option>Exam</option>
      </select>
      <button onclick="deleteDraft(${i})">Delete</button>
    `;

    container.appendChild(div);
  });

  window.draftEvents = events;
}

function editDraft(index, field, value) {
  draftEvents[index][field] = value;
}

function deleteDraft(i) {
  draftEvents.splice(i, 1);
  displayDrafts(draftEvents);
}

function saveDraftEvents() {
  const existing = Storage.load("events");
  Storage.save("events", [...existing, ...draftEvents]);
  alert("Saved!");
}

/* ===== Work Shift ===== */
function saveShift() {
  const shift = {
    title: document.getElementById("shiftTitle").value,
    date: document.getElementById("shiftDate").value,
    start: document.getElementById("shiftStart").value,
    end: document.getElementById("shiftEnd").value,
    type: "Work"
  };

  const events = Storage.load("events");
  events.push(shift);
  Storage.save("events", events);

  alert("Shift saved!");
}
``