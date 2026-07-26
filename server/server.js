const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
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
      .select('seats_count');

    if (error) throw error;

    const totalSeatsTaken = data.reduce((sum, item) => sum + item.seats_count, 0);
    const availableSeats = Math.max(0, MAX_SEATS - totalSeatsTaken);

    res.json({
      totalSeatsTaken,
      availableSeats,
      // Automatically disable Team option when taken >= 36 (i.e. remaining seats < 5)
      allowTeamRegistration: totalSeatsTaken <= 35 && availableSeats >= 5,
      isClosed: totalSeatsTaken >= MAX_SEATS
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Submit Registration with capacity enforcement
app.post('/api/register', async (req, res) => {
  const { registration_type } = req.body;
  const seatsRequested = registration_type === 'In a team' ? 5 : 1;

  try {
    // 1. Double check current capacity before inserting to avoid race conditions
    const { data, error: fetchError } = await supabase
      .from('registrations')
      .select('seats_count');

    if (fetchError) throw fetchError;

    const currentSeatsTaken = data.reduce((sum, item) => sum + item.seats_count, 0);

    if (currentSeatsTaken + seatsRequested > MAX_SEATS) {
      return res.status(400).json({
        error: `Capacity exceeded! Only ${MAX_SEATS - currentSeatsTaken} seats left.`
      });
    }

    // 2. Perform insertion
    const { data: insertedData, error: insertError } = await supabase
      .from('registrations')
      .insert([{ ...req.body, seats_count: seatsRequested }])
      .select();

    if (insertError) throw insertError;

    res.status(201).json({ success: true, data: insertedData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));