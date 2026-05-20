// Vercel Serverless Function — creates a Stripe Checkout session
// Requires env var: STRIPE_SECRET_KEY

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { aircraft, acName, date, slot, name, email } = req.body;

    if (!aircraft || !date || !slot || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const endTime = addHour(slot);
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:4200';

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${acName} — 1 Hour Flight`,
              description: `${date} · ${slot}–${endTime} · Astro Aviations`,
            },
            unit_amount: 12000, // $120.00 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/booking-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/booking.html?ac=${aircraft}`,
      metadata: {
        aircraft,
        date,
        slot,
        customer_name: name || '',
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

function addHour(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
