// Vercel Serverless Function — returns booked slots for a given aircraft + date
// Uses Vercel KV if configured, otherwise returns empty (all slots available)
// Vercel KV env vars: KV_REST_API_URL, KV_REST_API_TOKEN

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') return res.status(405).end();

  const { aircraft, date } = req.query;
  if (!aircraft || !date) return res.status(400).json({ booked: [] });

  try {
    const KV_URL   = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_URL || !KV_TOKEN) {
      // KV not configured — all slots available
      return res.status(200).json({ booked: [] });
    }

    const key = `bookings:${aircraft}:${date}`;
    const response = await fetch(`${KV_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });

    const data = await response.json();
    const booked = data.result ? JSON.parse(data.result) : [];

    return res.status(200).json({ booked });
  } catch (err) {
    console.error('KV error:', err.message);
    return res.status(200).json({ booked: [] }); // fail open
  }
};
