// Handles submissions from /schedule-service.html
// - Saves the request to Supabase (service_requests table)
// - Emails the owner (replaces the old Formspree notification)
// - Sends an automatic confirmation email to the customer (if they gave an email)
// - Texts the owner, and texts the customer a confirmation (if Twilio is configured)
//
// Requires these Vercel Environment Variables:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL       (optional, defaults to a resend.dev sandbox sender)
//   OWNER_NOTIFICATION_EMAIL (optional, defaults to r3mappliances@gmail.com)
//   TWILIO_ACCOUNT_SID       (optional — SMS is skipped entirely if not set)
//   TWILIO_AUTH_TOKEN        (optional)
//   TWILIO_FROM_NUMBER       (optional, the Twilio number SMS is sent from, e.g. +14691234567)
//   OWNER_NOTIFICATION_PHONE (optional, defaults to +14694464242)
//
// NOTE: while using the Resend sandbox sender (onboarding@resend.dev), Resend only
// allows sending to the exact, case-sensitive email address the Resend account was
// signed up with. OWNER_NOTIFICATION_EMAIL must match that exactly (lowercase here)
// or the owner notification email will silently fail even though customer emails work.

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
    const bodyText = await r.text();
    if (!r.ok) {
      console.error('sendEmail non-ok response', r.status, bodyText);
    }
    return { ok: r.ok, status: r.status, body: bodyText };
  } catch (err) {
    console.error('sendEmail failed', err);
    return { ok: false, status: 0, body: String(err) };
  }
}

// Normalizes a US phone number to E.164 (+1XXXXXXXXXX) for Twilio.
// Returns null if it doesn't look like a valid 10 (or 11, leading 1) digit US number.
function toE164Us(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return null;
}

async function sendSms({ accountSid, authToken, from, to, body }) {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({ From: from, To: to, Body: body });
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: params.toString(),
    });
    const bodyText = await r.text();
    if (!r.ok) {
      console.error('sendSms non-ok response', r.status, bodyText);
    }
    return { ok: r.ok, status: r.status, body: bodyText };
  } catch (err) {
    console.error('sendSms failed', err);
    return { ok: false, status: 0, body: String(err) };
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
  const OWNER_EMAIL = process.env.OWNER_NOTIFICATION_EMAIL || 'r3mappliances@gmail.com';
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'R3M Appliance Repair <onboarding@resend.dev>';
  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;
  const OWNER_PHONE = toE164Us(process.env.OWNER_NOTIFICATION_PHONE) || '+14694464242';

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

  let ownerSent = null;
  let customerSent = null;

  if (RESEND_KEY) {
    // Notify the owner
    ownerSent = await sendEmail({
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
      customerSent = confirmed;

      if (confirmed.ok && insertedId && SUPABASE_URL && SERVICE_KEY) {
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

  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    // Text the owner
    await sendSms({
      accountSid: TWILIO_SID,
      authToken: TWILIO_TOKEN,
      from: TWILIO_FROM,
      to: OWNER_PHONE,
      body: `New R3M service request: ${record.name}, ${record.appliance} — ${record.city}. ${record.phone}`,
    });

    // Confirm to the customer, if we have a usable number
    const customerPhone = toE164Us(record.phone);
    if (customerPhone) {
      await sendSms({
        accountSid: TWILIO_SID,
        authToken: TWILIO_TOKEN,
        from: TWILIO_FROM,
        to: customerPhone,
        body: `Hi ${record.name}, R3M Appliance Repair got your request for your ${record.appliance.toLowerCase()}. We'll text or call ${record.phone} shortly to confirm a time. Questions? Call/text (469) 446-4242.`,
      });
    }
  }

  return res.status(200).json({ ok: true });
}
