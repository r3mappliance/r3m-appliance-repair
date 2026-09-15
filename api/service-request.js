// Handles submissions from /schedule-service.html
// - Saves the request to Supabase (service_requests table)
// - Emails the owner (replaces the old Formspree notification)
// - Sends an automatic confirmation email to the customer (if they gave an email)
//
// Requires these Vercel Environment Variables:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL       (optional, defaults to a resend.dev sandbox sender)
//   OWNER_NOTIFICATION_EMAIL (optional, defaults to R3mappliances@gmail.com)

const REQUIRED_FIELDS = [
  'name', 'phone', 'street_address', 'city', 'state', 'zip_code', 'appliance', 'issue',
];

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

async function sendEmail({ apiKey, from, to, subject, text }) {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    return r.ok;
  } catch (err) {
    console.error('sendEmail failed', err);
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = readJsonBody(req);

  // honeypot: bots fill every field, real users never see or fill this one
  if (body._gotcha) {
    return res.status(200).json({ ok: true });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || String(body[field]).trim() === '') {
      return res.status(400).json({ ok: false, error: `missing_${field}` });
    }
  }

  const record = {
    name: String(body.name).trim(),
    phone: String(body.phone).trim(),
    email: body.email ? String(body.email).trim() : null,
    street_address: String(body.street_address).trim(),
    city: String(body.city).trim(),
    state: String(body.state || 'TX').trim(),
    zip_code: String(body.zip_code).trim(),
    appliance: String(body.appliance).trim(),
    brand: body.brand ? String(body.brand).trim() : null,
    model_number: body.model_number ? String(body.model_number).trim() : null,
    issue: String(body.issue).trim(),
    preferred_date: body.preferred_date || null,
    preferred_time: body.preferred_time || null,
  };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const OWNER_EMAIL = process.env.OWNER_NOTIFICATION_EMAIL || 'R3mappliances@gmail.com';
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'R3M Appliance Repair <onboarding@resend.dev>';

  let insertedId = null;
  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/service_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (dbRes.ok) {
        const rows = await dbRes.json();
        insertedId = rows && rows[0] ? rows[0].id : null;
      } else {
        console.error('Supabase insert failed', dbRes.status, await dbRes.text());
      }
    } catch (err) {
      console.error('Supabase insert error', err);
    }
  }

  const summaryText = [
    `Name: ${record.name}`,
    `Phone: ${record.phone}`,
    `Email: ${record.email || '-'}`,
    `Address: ${record.street_address}, ${record.city}, ${record.state} ${record.zip_code}`,
    `Appliance: ${record.appliance}`,
    `Brand: ${record.brand || '-'}`,
    `Model: ${record.model_number || '-'}`,
    `Issue: ${record.issue}`,
    `Preferred date: ${record.preferred_date || '-'}`,
    `Preferred time: ${record.preferred_time || '-'}`,
  ].join('\n');

  if (RESEND_KEY) {
    // Notify the owner
    await sendEmail({
      apiKey: RESEND_KEY,
      from: FROM_EMAIL,
      to: OWNER_EMAIL,
      subject: `New Service Request — ${record.name} (${record.city})`,
      text: `New service request from the website:\n\n${summaryText}\n`,
    });

    // Confirm to the customer
    if (record.email) {
      const confirmed = await sendEmail({
        apiKey: RESEND_KEY,
        from: FROM_EMAIL,
        to: record.email,
        subject: 'We got your service request — R3M Appliance Repair',
        text: `Hi ${record.name},\n\nThanks for reaching out to R3M Appliance Repair. We received your request for your ${record.appliance.toLowerCase()} and will contact you shortly at ${record.phone} to confirm a time.\n\nWhat you sent us:\nAppliance: ${record.appliance}${record.brand ? ' (' + record.brand + ')' : ''}\nIssue: ${record.issue}\nAddress: ${record.street_address}, ${record.city}, ${record.state} ${record.zip_code}\n${record.preferred_date ? 'Preferred date: ' + record.preferred_date + '\n' : ''}\nNeed to reach us sooner? Call or text (469) 446-4242.\n\n— R3M Appliance Repair`,
      });

      if (confirmed && insertedId && SUPABASE_URL && SERVICE_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/service_requests?id=eq.${insertedId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: SERVICE_KEY,
              Authorization: `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({ confirmation_email_sent: true }),
          });
        } catch (err) {
          console.error('Failed to flag confirmation_email_sent', err);
        }
      }
    }
  }

  return res.status(200).json({ ok: true });
}
