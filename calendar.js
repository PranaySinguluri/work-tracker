function renderCalendar() {
  const container = document.getElementById("calendar");
  container.innerHTML = "";

  const events = Storage.load("events");

  for (let i = 1; i <= 30; i++) {
    const dayDiv = document.createElement("div");
    dayDiv.className = "day";

    dayDiv.innerHTML = `<strong>${i}</strong>`;

    events
      .filter(e => new Date(e.date).getDate() === i)
      .forEach(e => {
        const el = document.createElement("div");
        el.textContent = e.title;
        el.style.color = getColor(e.type);
        dayDiv.appendChild(el);
      });

    container.appendChild(dayDiv);
  }
}

function getColor(type) {
  return {
    Lecture: "blue",
    Lab: "green",
    Exam: "orange",
    Work: "purple"
  }[type] || "black";
}