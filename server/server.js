require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Admin secret passkey for dashboard endpoints
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'rac-admin-2026';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

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
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], // Included PATCH for status updates
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'], // Allowed custom admin auth header
  credentials: true,
  optionsSuccessStatus: 200
};

// 1. Apply CORS middleware
app.use(cors(corsOptions));

// 2. Explicitly handle Preflight OPTIONS requests
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const MAX_SEATS = 40;

// Admin Verification Middleware
const verifyAdmin = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid Admin Passkey' });
  }
  next();
};

// Helper function to upload file buffer to Supabase Storage
async function uploadToSupabaseStorage(file, folderPrefix) {
  if (!file) return null;

  const fileExt = file.originalname.split('.').pop();
  const fileName = `${folderPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('workshop-files') // Make sure this bucket is PUBLIC in Supabase
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) {
    console.error(`Supabase Storage Upload Error (${folderPrefix}):`, error.message);
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from('workshop-files')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

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

// POST: Submit Registration (Supports both Multipart Form File Uploads AND raw JSON)
app.post(
  '/api/register',
  upload.fields([
    { name: 'payment_slip', maxCount: 1 },
    { name: 'id_card', maxCount: 1 }
  ]),
  async (req, res) => {
    const body = req.body;
    const files = req.files || {};

    // 1. Rigorous Field Resolution
    const resolvedName = body.full_name || body.fullName || body.name;

    if (!resolvedName) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    try {
      // 2. Upload actual binary file attachments if present, or fallback to pre-uploaded URLs
      let paymentSlipUrl = body.payment_slip_url || body.paymentSlipUrl || null;
      let idCardUrl = body.id_card_url || body.idCardUrl || null;

      if (files['payment_slip'] && files['payment_slip'][0]) {
        paymentSlipUrl = await uploadToSupabaseStorage(files['payment_slip'][0], 'payment');
      }

      if (files['id_card'] && files['id_card'][0]) {
        idCardUrl = await uploadToSupabaseStorage(files['id_card'][0], 'id');
      }

      const regType = body.registration_type || body.registrationType || 'Individual';
      const isTeam = regType.toLowerCase() === 'in a team' || regType.toLowerCase() === 'team';
      const seatsRequested = isTeam ? 5 : 1;

      // 3. Capacity Check
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

      // 4. Complete Payload mapping EVERY database column with real uploaded URLs
      const payload = {
        full_name: resolvedName,
        name: resolvedName,
        email: body.email,
        phone: body.phone,
        college_name: body.college_name || body.collegeName || 'N/A',
        registration_type: regType,
        seats_count: seatsRequested,
        referral_source: body.referral_source || body.referralSource || 'Direct',
        payment_account: body.payment_account || body.paymentAccount || 'eSewa/Khalti',
        id_card_url: idCardUrl,
        payment_slip_url: paymentSlipUrl,
        is_thapathali_student: body.is_thapathali_student === 'true' || body.is_thapathali_student === true,
        familiarity: body.familiarity || 'Beginner',
        attain_goals: body.attain_goals || body.attainGoals || null
      };

      // 5. Insert into Supabase Table
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

      // 6. Fire-and-forget sync to Google Sheets
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
  }
);

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// GET: Retrieve all registrations for Admin Dashboard
app.get('/api/admin/registrations', verifyAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Admin Fetch Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH: Toggle payment verification status
app.patch('/api/admin/verify/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_verified } = req.body;

  try {
    const { data, error } = await supabase
      .from('registrations')
      .update({ is_verified })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ message: 'Verification status updated successfully', data });
  } catch (err) {
    console.error('Admin Verify Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));