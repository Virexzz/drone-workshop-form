require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://rac-workshop.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// 1. Apply CORS middleware
app.use(cors(corsOptions));

// 2. Explicitly handle Preflight OPTIONS requests
app.options('*', cors(corsOptions));

app.use(express.json());

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const MAX_SEATS = 40;

// GET: Calculate current live capacity
app.get('/api/capacity', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('registration_type, seats_count');

    if (error) throw error;

    const totalSeatsTaken = (data || []).reduce((sum, item) => {
      if (item.seats_count) return sum + item.seats_count;
      return sum + (item.registration_type === 'In a team' || item.registration_type === 'team' ? 5 : 1);
    }, 0);

    const availableSeats = Math.max(0, MAX_SEATS - totalSeatsTaken);

    res.json({
      totalSeatsTaken,
      availableSeats,
      allowTeamRegistration: totalSeatsTaken <= 35 && availableSeats >= 5,
      isClosed: totalSeatsTaken >= MAX_SEATS
    });
  } catch (err) {
    console.error('Capacity Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST: Submit Registration with ALL fields captured + Google Apps Script Webhook
app.post('/api/register', async (req, res) => {
  const body = req.body;

  // 1. Rigorous Field Resolution (Guarantees no critical NULL values)
  const resolvedName = body.full_name || body.fullName || body.name;
  
  if (!resolvedName) {
    return res.status(400).json({ error: 'Full name is required.' });
  }

  const resolvedIdCard = body.id_card_url || body.idCardUrl || body.idCard || null;
  const resolvedPaymentSlip = body.payment_slip_url || body.paymentSlipUrl || body.paymentSlip || null;

  const regType = body.registration_type || body.registrationType || 'Individual';
  const isTeam = regType.toLowerCase() === 'in a team' || regType.toLowerCase() === 'team';
  const seatsRequested = isTeam ? 5 : 1;

  try {
    // 2. Capacity Check
    const { data, error: fetchError } = await supabase
      .from('registrations')
      .select('registration_type, seats_count');

    if (fetchError) throw fetchError;

    const currentSeatsTaken = (data || []).reduce((sum, item) => {
      if (item.seats_count) return sum + item.seats_count;
      return sum + (item.registration_type === 'In a team' || item.registration_type === 'team' ? 5 : 1);
    }, 0);

    if (currentSeatsTaken + seatsRequested > MAX_SEATS) {
      return res.status(400).json({
        error: `Capacity exceeded! Only ${MAX_SEATS - currentSeatsTaken} seats left.`
      });
    }

    // 3. Complete Payload mapping EVERY database column
    const payload = {
      full_name: resolvedName,
      name: resolvedName, // Populate both columns so neither is ever NULL
      email: body.email,
      phone: body.phone,
      college_name: body.college_name || body.collegeName || 'N/A',
      registration_type: regType,
      seats_count: seatsRequested,
      referral_source: body.referral_source || body.referralSource || 'Direct',
      payment_account: body.payment_account || body.paymentAccount || 'eSewa/Khalti',
      id_card_url: resolvedIdCard,
      payment_slip_url: resolvedPaymentSlip,
      is_thapathali_student: body.is_thapathali_student ?? body.isThapathaliStudent ?? false,
      familiarity: body.familiarity || 'Beginner',
      attain_goals: body.attain_goals || body.attainGoals || null
    };

    // 4. Insert into Supabase
    const { data: insertedData, error: insertError } = await supabase
      .from('registrations')
      .insert([payload])
      .select();

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(400).json({ error: 'This email is already registered.' });
      }
      throw insertError;
    }

    // 5. Fire-and-forget sync to Google Sheets (if WEBHOOK_URL is defined in .env)
    if (process.env.GOOGLE_SHEET_WEBHOOK_URL) {
      fetch(process.env.GOOGLE_SHEET_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.error('Sheet Webhook Error:', err.message));
    }

    res.status(201).json({ success: true, data: insertedData });
  } catch (err) {
    console.error('Registration Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));