// Vercel Serverless Function — returns booked slots for aircraft + date
// • Enforces 1-day advance booking rule
// • Reads confirmed bookings from Stripe (and Vercel KV as fallback)
// Slot times are computed client-side using live sunrise/sunset data

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const { aircraft, date } = req.query;
  if (!aircraft || !date) return res.status(400).json({ error: 'Missing params', booked: [] });

  // ── 1-day advance rule ──────────────────────────────────────────
  const todayUTC = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  if (date <= todayUTC) {
    return res.status(400).json({
      error: 'Bookings must be made at least 1 day in advance',
      booked: []
    });
  }

  let booked = [];

  // ── Stripe: check confirmed paid sessions ───────────────────────
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      // Prefer Stripe Search API (efficient, metadata-filtered)
      try {
        const results = await stripe.checkout.sessions.search({
          query: `metadata['aircraft']:'${aircraft}' AND metadata['date']:'${date}' AND payment_status:'paid'`,
          limit: 50,
        });
        booked = results.data.map(s => s.metadata.slot).filter(Boolean);
      } catch {
        // Fall back to listing if Search API not enabled on account
        const all = await stripe.checkout.sessions.list({ limit: 100 });
        booked = all.data
          .filter(s =>
            s.payment_status === 'paid' &&
            s.metadata?.aircraft === aircraft &&
            s.metadata?.date    === date
          )
          .map(s => s.metadata.slot)
          .filter(Boolean);
      }
    } catch (stripeErr) {
      console.error('Stripe error:', stripeErr.message);
    }
  }

  // ── Vercel KV (optional extra source of truth) ──────────────────
  const KV_URL   = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (KV_URL && KV_TOKEN) {
    try {
      const r = await fetch(`${KV_URL}/get/bookings:${aircraft}:${date}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      });
      const d = await r.json();
      const kvBooked = d.result ? JSON.parse(d.result) : [];
      booked = [...new Set([...booked, ...kvBooked])];
    } catch (kvErr) {
      console.error('KV error:', kvErr.message);
    }
  }

  return res.status(200).json({ booked });
};
