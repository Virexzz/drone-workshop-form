require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');


const app = express();

// Configure CORS for production and local dev
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://your-vercel-app.vercel.app'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

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
      .select('registration_type');

    if (error) throw error;

    // Dynamically calculate taken seats based on registration_type
    const totalSeatsTaken = (data || []).reduce((sum, item) => {
      return sum + (item.registration_type === 'In a team' ? 5 : 1);
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
  const { registration_type } = req.body;
  const seatsRequested = registration_type === 'In a team' ? 5 : 1;

  try {
    // 1. Fetch current registrations to check capacity
    const { data, error: fetchError } = await supabase
      .from('registrations')
      .select('registration_type');

    if (fetchError) throw fetchError;

    const currentSeatsTaken = (data || []).reduce((sum, item) => {
      return sum + (item.registration_type === 'In a team' ? 5 : 1);
    }, 0);

    if (currentSeatsTaken + seatsRequested > MAX_SEATS) {
      return res.status(400).json({
        error: `Capacity exceeded! Only ${MAX_SEATS - currentSeatsTaken} seats left.`
      });
    }

    // 2. Perform insertion without seats_count property
    const { data: insertedData, error: insertError } = await supabase
      .from('registrations')
      .insert([req.body])
      .select();

    if (insertError) throw insertError;

    res.status(201).json({ success: true, data: insertedData });
  } catch (err) {
    console.error('Registration Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));