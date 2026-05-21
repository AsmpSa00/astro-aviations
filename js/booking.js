/* ═══════════════════════════════════════════════════════════
   Astro Aviations — Booking Page Logic
   • 1-day advance minimum (today is not bookable)
   • Slots generated from live sunrise/sunset data
   • 1-hour slots, 30-minute gap between bookings
   • Airfield timezone: Europe/London (change AIRFIELD_TZ below)
   Price: $120/hr
═══════════════════════════════════════════════════════════ */

const AIRFIELD_TZ  = 'Europe/London';
const AIRFIELD_LAT = 51.5074;
const AIRFIELD_LNG = -0.1278;

const AIRCRAFT = {
  c172: { name: 'Cessna 172 Skyhawk',        price: 120 },
  c500: { name: 'Cessna 500 Citation I',      price: 120 },
  c550: { name: 'Cessna 550 Citation Bravo',  price: 120 },
  c650: { name: 'Cessna 650 Citation III',    price: 120 },
};

// Per-aircraft state
const state = {};
Object.keys(AIRCRAFT).forEach(ac => {
  state[ac] = {
    year: null, month: null,
    selectedDate: null,
    selectedSlot: null,
    selectedSlotEnd: null,
    slots: [],           // [{start, end, available}]
    bookedSlots: [],     // ['HH:MM', ...]
  };
});

/* ─── Bootstrap ─── */
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const initAc = params.get('ac') || 'c172';

  const now = new Date();
  Object.keys(AIRCRAFT).forEach(ac => {
    state[ac].year  = now.getFullYear();
    state[ac].month = now.getMonth();
    buildCalendar(ac);
    renderSlots(ac);
    setupPayBtn(ac);
  });

  document.querySelectorAll('.ac-tab').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.ac))
  );

  switchTab(initAc);
});

function switchTab(ac) {
  document.querySelectorAll('.ac-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.ac === ac)
  );
  document.querySelectorAll('.booking-panel').forEach(p =>
    p.classList.toggle('active', p.id === `panel-${ac}`)
  );
}

/* ─── Calendar ─── */
function buildCalendar(ac) {
  const wrap = document.getElementById(`cal-${ac}`);
  if (!wrap) return;
  const s = state[ac];

  const today = new Date(); today.setHours(0,0,0,0);
  // Minimum bookable date = tomorrow (1-day advance)
  const minDate = new Date(today); minDate.setDate(minDate.getDate() + 1);

  const firstDay    = new Date(s.year, s.month, 1).getDay();
  const daysInMonth = new Date(s.year, s.month + 1, 0).getDate();
  const monthNames  = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  // Week starts Monday — shift firstDay
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1);

  let html = `
    <div class="cal-nav">
      <button id="prev-${ac}" aria-label="Previous month">&#8249;</button>
      <div class="cal-month">${monthNames[s.month]} ${s.year}</div>
      <button id="next-${ac}" aria-label="Next month">&#8250;</button>
    </div>
    <div class="cal-grid">
      <div class="cal-dow">Mon</div><div class="cal-dow">Tue</div><div class="cal-dow">Wed</div>
      <div class="cal-dow">Thu</div><div class="cal-dow">Fri</div><div class="cal-dow">Sat</div>
      <div class="cal-dow">Sun</div>
  `;

  for (let i = 0; i < startOffset; i++) {
    html += `<div class="cal-day other-month"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(s.year, s.month, d);
    const dateStr = fmtDate(s.year, s.month + 1, d);
    const tooEarly = date < minDate;
    const isToday  = date.getTime() === today.getTime();
    const isSel    = s.selectedDate === dateStr;

    const cls = [
      'cal-day',
      tooEarly ? 'past'     : '',
      isToday  ? 'today'    : '',
      isSel    ? 'selected' : '',
    ].filter(Boolean).join(' ');

    html += `<button class="${cls}" ${tooEarly ? 'disabled' : ''} data-date="${dateStr}">${d}</button>`;
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
      s.selectedDate    = btn.dataset.date;
      s.selectedSlot    = null;
      s.selectedSlotEnd = null;
      buildCalendar(ac);
      fetchAndBuildSlots(ac);
      updateSummary(ac);
    });
  });
}

/* ─── Slots ─── */
async function fetchAndBuildSlots(ac) {
  const s        = state[ac];
  const slotWrap = document.getElementById(`slots-${ac}`);
  const sunBar   = document.getElementById(`sun-info-${ac}`);
  if (!s.selectedDate || !slotWrap) return;

  slotWrap.innerHTML = `<p class="slots-empty">Loading slots…</p>`;
  if (sunBar) { sunBar.textContent = ''; sunBar.style.display = 'none'; }

  // ── 1. Fetch sunrise/sunset (free, no API key) ──────────────────
  let sunriseISO, sunsetISO;
  try {
    const sunRes = await fetch(
      `https://api.sunrise-sunset.org/json?lat=${AIRFIELD_LAT}&lng=${AIRFIELD_LNG}&date=${s.selectedDate}&formatted=0`
    );
    const sunData = await sunRes.json();
    if (sunData.status !== 'OK') throw new Error('Sun API error');
    sunriseISO = sunData.results.sunrise;
    sunsetISO  = sunData.results.sunset;
  } catch (err) {
    slotWrap.innerHTML = `<p class="slots-empty slots-error">Could not fetch daylight data. Please try again.</p>`;
    return;
  }

  // ── 2. Generate slots ────────────────────────────────────────────
  const slots = generateSlots(sunriseISO, sunsetISO);

  if (slots.length === 0) {
    slotWrap.innerHTML = `<p class="slots-empty">No flying slots available — insufficient daylight on this date.</p>`;
    return;
  }

  // Show sun window
  if (sunBar) {
    const first = slots[0].start;
    const last  = slots[slots.length - 1].end;
    sunBar.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> Flying window: <strong>${first} – ${last}</strong> &nbsp;·&nbsp; 1 hr after sunrise to 1 hr before sunset`;
    sunBar.style.display = 'flex';
  }

  // ── 3. Fetch booked slots from API ───────────────────────────────
  let bookedSlots = [];
  try {
    const slotRes = await fetch(`/api/slots?aircraft=${ac}&date=${s.selectedDate}`);
    if (slotRes.ok) {
      const slotData = await slotRes.json();
      bookedSlots = slotData.booked || [];
    } else {
      const err = await slotRes.json();
      if (err.error) {
        slotWrap.innerHTML = `<p class="slots-empty slots-error">${err.error}</p>`;
        if (sunBar) sunBar.style.display = 'none';
        return;
      }
    }
  } catch {
    // API down — show slots as available (optimistic, avoids blank UI)
  }

  // ── 4. Mark availability & render ────────────────────────────────
  s.slots = slots.map(sl => ({ ...sl, available: !bookedSlots.includes(sl.start) }));
  renderSlots(ac);
}

function generateSlots(sunriseISO, sunsetISO) {
  const sunriseMs = new Date(sunriseISO).getTime();
  const sunsetMs  = new Date(sunsetISO).getTime();

  const firstMs = sunriseMs + 60 * 60 * 1000; // sunrise + 1 hr
  const lastEndMs = sunsetMs - 60 * 60 * 1000; // sunset  - 1 hr (slot must END by this)

  const slots = [];
  let curMs = firstMs;

  while (true) {
    const endMs = curMs + 60 * 60 * 1000; // 1-hour slot
    if (endMs > lastEndMs) break;

    slots.push({
      start: fmtInTz(new Date(curMs),  AIRFIELD_TZ),
      end:   fmtInTz(new Date(endMs),  AIRFIELD_TZ),
    });

    curMs += 90 * 60 * 1000; // 1 hr flight + 30 min gap → next start
  }

  return slots;
}

function fmtInTz(date, tz) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  }).format(date);
}

function renderSlots(ac) {
  const wrap = document.getElementById(`slots-${ac}`);
  if (!wrap) return;
  const s = state[ac];

  if (!s.selectedDate) {
    wrap.innerHTML = `<p class="slots-empty">Select a date above to see available slots.</p>`;
    return;
  }

  if (!s.slots || s.slots.length === 0) return; // loading or error state handled elsewhere

  wrap.innerHTML = s.slots.map(slot => {
    const booked   = !slot.available;
    const selected = s.selectedSlot === slot.start;
    const cls = ['slot-btn', booked ? 'booked' : '', selected ? 'selected' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" data-start="${slot.start}" data-end="${slot.end}" ${booked ? 'disabled' : ''}>
      <span class="slot-time">${slot.start}</span>
      <span class="slot-sep">–</span>
      <span class="slot-end">${slot.end}</span>
    </button>`;
  }).join('');

  wrap.querySelectorAll('.slot-btn:not(.booked)').forEach(btn => {
    btn.addEventListener('click', () => {
      s.selectedSlot    = btn.dataset.start;
      s.selectedSlotEnd = btn.dataset.end;
      renderSlots(ac);
      updateSummary(ac);
      checkPayReady(ac);
    });
  });
}

/* ─── Summary & Pay ─── */
function updateSummary(ac) {
  const s         = state[ac];
  const summaryEl = document.getElementById(`summary-${ac}`);
  const dateEl    = document.getElementById(`sum-date-${ac}`);
  const timeEl    = document.getElementById(`sum-time-${ac}`);

  if (s.selectedDate && s.selectedSlot) {
    dateEl.textContent = fmtDateDisplay(s.selectedDate);
    timeEl.textContent = `${s.selectedSlot} – ${s.selectedSlotEnd || addHour(s.selectedSlot)}`;
    summaryEl.style.display = 'block';
  } else {
    summaryEl.style.display = 'none';
  }
  checkPayReady(ac);
}

function checkPayReady(ac) {
  const s     = state[ac];
  const btn   = document.getElementById(`pay-${ac}`);
  const name  = document.getElementById(`name-${ac}`);
  const email = document.getElementById(`email-${ac}`);
  if (!btn) return;
  btn.disabled = !(s.selectedDate && s.selectedSlot && name?.value.trim() && email?.value.trim());
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

    btn.disabled    = true;
    btn.textContent = 'Redirecting to Stripe…';

    try {
      const res = await fetch('/api/create-checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aircraft: ac,
          acName:   AIRCRAFT[ac].name,
          date:     s.selectedDate,
          slot:     s.selectedSlot,
          slotEnd:  s.selectedSlotEnd,
          name:     name.value.trim(),
          email:    email.value.trim(),
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No checkout URL returned');
      }
    } catch (err) {
      alert('Checkout error: ' + err.message + '\n\nEnsure STRIPE_SECRET_KEY is set in Vercel environment variables.');
      btn.disabled    = false;
      btn.textContent = 'Pay $120 — Proceed to Checkout';
    }
  });
}

/* ─── Helpers ─── */
function fmtDate(y, m, d) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function fmtDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${names[m - 1]} ${y}`;
}
function addHour(t) {
  const [h, m] = t.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
