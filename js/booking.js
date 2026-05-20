/* ═══════════════════════════════════════════
   Astro Aviations — Booking Page Logic
   Slots: 08:00 → 17:00 in 1.5hr steps (1hr flight + 30min buffer)
   Price: $120/hr
═══════════════════════════════════════════ */

const AIRCRAFT = {
  c172: { name: 'Cessna 172 Skyhawk',       price: 120 },
  c500: { name: 'Cessna 500 Citation I',     price: 120 },
  c550: { name: 'Cessna 550 Citation Bravo', price: 120 },
  c650: { name: 'Cessna 650 Citation III',   price: 120 },
};

// Slot start times — 1hr booking + 30min gap = 1.5hr between starts
const SLOT_STARTS = ['08:00','09:30','11:00','12:30','14:00','15:30','17:00'];

// State per aircraft
const state = {};
Object.keys(AIRCRAFT).forEach(ac => {
  state[ac] = { year: null, month: null, selectedDate: null, selectedSlot: null, bookedSlots: [] };
});

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
  const params  = new URLSearchParams(window.location.search);
  const initAc  = params.get('ac') || 'c172';

  // Build calendars
  const now = new Date();
  Object.keys(AIRCRAFT).forEach(ac => {
    state[ac].year  = now.getFullYear();
    state[ac].month = now.getMonth();
    buildCalendar(ac);
    buildSlots(ac, null);
    setupPayBtn(ac);
  });

  // Tab switching
  document.querySelectorAll('.ac-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.ac));
  });

  switchTab(initAc);
});

function switchTab(ac) {
  document.querySelectorAll('.ac-tab').forEach(t => t.classList.toggle('active', t.dataset.ac === ac));
  document.querySelectorAll('.booking-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${ac}`));
}

/* ─── Calendar ─── */
function buildCalendar(ac) {
  const wrap = document.getElementById(`cal-${ac}`);
  if (!wrap) return;
  const s = state[ac];

  const firstDay = new Date(s.year, s.month, 1).getDay();
  const daysInMonth = new Date(s.year, s.month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

  let html = `
    <div class="cal-nav">
      <button id="prev-${ac}">&#8249;</button>
      <div class="cal-month">${monthNames[s.month]} ${s.year}</div>
      <button id="next-${ac}">&#8250;</button>
    </div>
    <div class="cal-grid">
      <div class="cal-dow">Sun</div><div class="cal-dow">Mon</div><div class="cal-dow">Tue</div>
      <div class="cal-dow">Wed</div><div class="cal-dow">Thu</div><div class="cal-dow">Fri</div>
      <div class="cal-dow">Sat</div>
  `;

  // Empty cells before month start
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month" disabled></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(s.year, s.month, d);
    const dateStr = formatDate(s.year, s.month + 1, d);
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const isSel = s.selectedDate === dateStr;
    const cls = [
      'cal-day',
      isToday ? 'today' : '',
      isSel ? 'selected' : '',
      isPast ? '' : '',
    ].filter(Boolean).join(' ');

    html += `<button class="${cls}" ${isPast ? 'disabled' : ''} data-date="${dateStr}">${d}</button>`;
  }

  html += `</div>`;
  wrap.innerHTML = html;

  wrap.querySelector(`#prev-${ac}`).addEventListener('click', () => {
    s.month--;
    if (s.month < 0) { s.month = 11; s.year--; }
    buildCalendar(ac);
  });
  wrap.querySelector(`#next-${ac}`).addEventListener('click', () => {
    s.month++;
    if (s.month > 11) { s.month = 0; s.year++; }
    buildCalendar(ac);
  });

  wrap.querySelectorAll('.cal-day:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      s.selectedDate = btn.dataset.date;
      s.selectedSlot = null;
      buildCalendar(ac);
      fetchAndBuildSlots(ac);
      updateSummary(ac);
    });
  });
}

/* ─── Slots ─── */
async function fetchAndBuildSlots(ac) {
  const s = state[ac];
  if (!s.selectedDate) return;

  // Try to fetch booked slots from API; if unavailable use empty array
  try {
    const res = await fetch(`/api/slots?aircraft=${ac}&date=${s.selectedDate}`);
    if (res.ok) {
      const data = await res.json();
      s.bookedSlots = data.booked || [];
    } else {
      s.bookedSlots = [];
    }
  } catch {
    s.bookedSlots = [];
  }

  buildSlots(ac, s.selectedDate);
}

function buildSlots(ac, date) {
  const wrap = document.getElementById(`slots-${ac}`);
  if (!wrap) return;
  const s = state[ac];

  if (!date) {
    wrap.innerHTML = `<p class="slots-empty">Select a date to see available slots.</p>`;
    return;
  }

  wrap.innerHTML = SLOT_STARTS.map(time => {
    const booked = s.bookedSlots.includes(time);
    const selected = s.selectedSlot === time;
    const cls = ['slot-btn', booked ? 'booked' : '', selected ? 'selected' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" data-time="${time}" ${booked ? 'disabled' : ''}>${time}</button>`;
  }).join('');

  wrap.querySelectorAll('.slot-btn:not(.booked)').forEach(btn => {
    btn.addEventListener('click', () => {
      s.selectedSlot = btn.dataset.time;
      buildSlots(ac, date);
      updateSummary(ac);
      checkPayReady(ac);
    });
  });
}

/* ─── Summary & Pay button ─── */
function updateSummary(ac) {
  const s = state[ac];
  const summaryEl = document.getElementById(`summary-${ac}`);
  const dateEl    = document.getElementById(`sum-date-${ac}`);
  const timeEl    = document.getElementById(`sum-time-${ac}`);

  if (s.selectedDate && s.selectedSlot) {
    dateEl.textContent = formatDateDisplay(s.selectedDate);
    timeEl.textContent = `${s.selectedSlot} – ${addHour(s.selectedSlot)}`;
    summaryEl.style.display = 'block';
  } else {
    summaryEl.style.display = 'none';
  }
  checkPayReady(ac);
}

function checkPayReady(ac) {
  const s = state[ac];
  const btn = document.getElementById(`pay-${ac}`);
  const name = document.getElementById(`name-${ac}`);
  const email = document.getElementById(`email-${ac}`);
  if (!btn) return;
  const ready = s.selectedDate && s.selectedSlot && name?.value.trim() && email?.value.trim();
  btn.disabled = !ready;
}

function setupPayBtn(ac) {
  const btn   = document.getElementById(`pay-${ac}`);
  const name  = document.getElementById(`name-${ac}`);
  const email = document.getElementById(`email-${ac}`);
  if (!btn) return;

  [name, email].forEach(el => el?.addEventListener('input', () => checkPayReady(ac)));

  btn.addEventListener('click', async () => {
    const s = state[ac];
    if (!s.selectedDate || !s.selectedSlot) return;

    btn.disabled = true;
    btn.textContent = 'Redirecting to Stripe…';

    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aircraft:  ac,
          acName:    AIRCRAFT[ac].name,
          date:      s.selectedDate,
          slot:      s.selectedSlot,
          name:      name.value.trim(),
          email:     email.value.trim(),
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No URL returned');
      }
    } catch (err) {
      alert('Could not start checkout: ' + err.message + '\n\nMake sure STRIPE_SECRET_KEY is set in Vercel environment variables.');
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="4" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M1 8h16" stroke="currentColor" stroke-width="1.5"/></svg>
        Pay $120 — Proceed to Checkout`;
    }
  });
}

/* ─── Helpers ─── */
function formatDate(y, m, d) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function formatDateDisplay(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${names[m-1]} ${y}`;
}
function addHour(timeStr) {
  const [h, min] = timeStr.split(':').map(Number);
  const newH = (h + 1) % 24;
  return `${String(newH).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}
