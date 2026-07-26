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
      // Prioritize seats_count column if present, fallback to registration_type check
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

// POST: Submit Registration with capacity enforcement
app.post('/api/register', async (req, res) => {
  const regType = req.body.registration_type || req.body.registrationType || 'Individual';
  const isTeam = regType.toLowerCase() === 'in a team' || regType.toLowerCase() === 'team';
  const seatsRequested = isTeam ? 5 : 1;

  try {
    // 1. Fetch current registrations to check capacity
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

    // 2. Explicitly extract and sanitize fields matching DB schema
    const payload = {
      full_name: req.body.full_name || req.body.fullName,
      email: req.body.email,
      phone: req.body.phone,
      college_name: req.body.college_name || req.body.collegeName,
      registration_type: regType,
      seats_count: seatsRequested,
      referral_source: req.body.referral_source || req.body.referralSource || 'Direct',
      payment_account: req.body.payment_account || req.body.paymentAccount || 'Pending/None'
    };

    // 3. Perform insertion with complete payload
    const { data: insertedData, error: insertError } = await supabase
      .from('registrations')
      .insert([payload])
      .select();

    if (insertError) {
      // Handle Duplicate Registration cleanly
      if (insertError.code === '23505') {
        return res.status(400).json({ error: 'This email is already registered.' });
      }
      throw insertError;
    }

    res.status(201).json({ success: true, data: insertedData });
  } catch (err) {
    console.error('Registration Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));