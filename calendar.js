/* calendar.js — Monthly calendar rendering */

const CalendarUI = (() => {
  let currentYear  = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0-indexed
  let onEventClick = null;
  let onDayClick   = null;

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  function init(opts = {}) {
    onEventClick = opts.onEventClick || null;
    onDayClick   = opts.onDayClick   || null;
    render();
  }

  function render() {
    const grid  = document.getElementById('calGrid');
    const label = document.getElementById('calMonthLabel');
    if (!grid || !label) return;

    label.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrev  = new Date(currentYear, currentMonth, 0).getDate();

    const today = new Date();
    const events = Storage.getEvents();

    // Build a date→events map
    const evMap = {};
    events.forEach(ev => {
      if (ev.date) {
        if (!evMap[ev.date]) evMap[ev.date] = [];
        evMap[ev.date].push(ev);
      }
    });

    grid.innerHTML = '';

    // Prev month filler
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrev - i;
      const cell = makeCell(day, currentYear, currentMonth - 1, true, evMap);
      grid.appendChild(cell);
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday =
        d === today.getDate() &&
        currentMonth === today.getMonth() &&
        currentYear  === today.getFullYear();
      const cell = makeCell(d, currentYear, currentMonth, false, evMap, isToday);
      grid.appendChild(cell);
    }

    // Next month filler
    const totalCells = grid.children.length;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      const cell = makeCell(d, currentYear, currentMonth + 1, true, evMap);
      grid.appendChild(cell);
    }
  }

  function makeCell(day, year, month, isOther, evMap, isToday) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (isOther ? ' other-month' : '') + (isToday ? ' today' : '');

    // Normalize month
    const d = new Date(year, month, day);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const dayEl = document.createElement('div');
    dayEl.className = 'cal-day';
    dayEl.textContent = day;
    cell.appendChild(dayEl);

    const dayEvents = evMap[dateStr] || [];
    const evContainer = document.createElement('div');
    evContainer.className = 'cal-events';
    const MAX_SHOW = 3;

    dayEvents.slice(0, MAX_SHOW).forEach(ev => {
      const dot = document.createElement('div');
      dot.className = `cal-ev-dot ${ev.type || 'other'}`;
      dot.textContent = ev.title || 'Event';
      dot.title = ev.title;
      dot.addEventListener('click', e => {
        e.stopPropagation();
        if (onEventClick) onEventClick(ev.id);
      });
      evContainer.appendChild(dot);
    });

    if (dayEvents.length > MAX_SHOW) {
      const more = document.createElement('div');
      more.className = 'cal-more';
      more.textContent = `+${dayEvents.length - MAX_SHOW} more`;
      evContainer.appendChild(more);
    }

    cell.appendChild(evContainer);

    cell.addEventListener('click', () => {
      if (onDayClick) onDayClick(dateStr);
    });

    return cell;
  }

  function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    render();
  }

  function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    render();
  }

  function goToToday() {
    currentYear  = new Date().getFullYear();
    currentMonth = new Date().getMonth();
    render();
  }

  return { init, render, prevMonth, nextMonth, goToToday };
})();
