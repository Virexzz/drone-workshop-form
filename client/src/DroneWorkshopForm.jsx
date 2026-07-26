import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DroneWorkshopForm.css';
import logo from './assets/rac-modified.png'; 
import pay from './assets/done-QR.png';

// Dynamic API Base URL determination without .env
const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  return 'https://drone-workshop-form.onrender.com';
};

const API_BASE_URL = getApiBaseUrl();

export default function DroneWorkshopForm() {
  const [capacity, setCapacity] = useState({
    totalSeatsTaken: 0,
    availableSeats: 40,
    allowTeamRegistration: true,
    isClosed: false
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    familiarity: "It's my first time experiencing this.",
    attain_goals: '',
    registration_type: 'Alone',
    referral_source: 'I saw your posters and got curious.',
    is_thapathali_student: false,
    payment_account: 'Saroj Gaire',
    stay_connected: true,
    watch_doomsday: 'Yes'
  });

  // Dedicated states for raw file handles
  const [paymentSlipFile, setPaymentSlipFile] = useState(null);
  const [idCardFile, setIdCardFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch Live Capacity from Node.js Server
  const fetchCapacity = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/capacity`);
      setCapacity(res.data);

      if (!res.data.allowTeamRegistration && formData.registration_type === 'In a team') {
        setFormData(prev => ({ ...prev, registration_type: 'Alone' }));
      }
    } catch (err) {
      console.error('Failed to fetch capacity:', err);
    }
  };

  useEffect(() => {
    fetchCapacity();
  }, []);

  const calculatePrice = () => {
    const isTeam = formData.registration_type === 'In a team';
    const isThapathali = formData.is_thapathali_student;

    if (isTeam) {
      return isThapathali ? 2699 : 3149;
    } else {
      return isThapathali ? 599 : 699;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!paymentSlipFile) {
      setMessage('❌ Please upload your payment slip.');
      setLoading(false);
      return;
    }

    if (formData.is_thapathali_student && !idCardFile) {
      setMessage('❌ Please upload your Thapathali ID card proof.');
      setLoading(false);
      return;
    }

    try {
      // Build multipart/form-data payload
      const submissionData = new FormData();
      
      // Append text fields
      submissionData.append('full_name', formData.name);
      submissionData.append('email', formData.email);
      submissionData.append('phone', formData.phone);
      submissionData.append('familiarity', formData.familiarity);
      submissionData.append('attain_goals', formData.attain_goals);
      submissionData.append('registration_type', formData.registration_type);
      submissionData.append('referral_source', formData.referral_source);
      submissionData.append('is_thapathali_student', formData.is_thapathali_student);
      submissionData.append('payment_account', formData.payment_account);
      submissionData.append('stay_connected', formData.stay_connected);
      submissionData.append('watch_doomsday', formData.watch_doomsday);

      // Append binary files
      if (paymentSlipFile) {
        submissionData.append('payment_slip', paymentSlipFile);
      }
      if (idCardFile) {
        submissionData.append('id_card', idCardFile);
      }

      await axios.post(`${API_BASE_URL}/api/register`, submissionData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage('🎉 Registration Successful! Welcome to the workshop.');
      fetchCapacity();
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Registration failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  if (capacity.isClosed) {
    return (
      <div className="workshop-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h1 style={{ color: '#f59e0b', fontSize: '1.8rem', marginBottom: '1rem' }}>REGISTRATION CLOSED</h1>
          <p style={{ color: '#9ca3af' }}>We have reached our maximum venue limit of 40 participants!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="workshop-container">
      <div className="workshop-wrapper">
        
        {/* HERO BANNER SECTION */}
        <div className="card">
          <div className="banner-header">
            <div className="logo-placeholder"><img src={logo} alt="RAC Logo" /></div>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: 0, color: '#f59e0b', fontSize: '1.8rem' }}>DRONE WORKSHOP</h1>
              <span style={{ fontSize: '0.8rem', color: '#2fbfa6' }}>Robotics & Automation Center, Thapathali</span>
            </div>
          </div>

          <p style={{ fontStyle: 'italic', color: '#fcd34d', margin: '1rem 0 0 0', fontSize: '0.9rem' }}>
            "Touch grass? Nah, Build a drone." 🚁
          </p>

          <div className="info-grid">
            <div>📅 <strong>Date:</strong> Shrawan 18 to 22</div>
            <div>⏰ <strong>Time:</strong> 5:00 PM – 6:30 PM</div>
            <div>📍 <strong>Venue:</strong> E-Block, Thapathali</div>
          </div>

          <div className="capacity-badge">
            <span>⚡ Limited Seats: {capacity.availableSeats} / 40 Remaining</span>
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${(capacity.totalSeatsTaken / 40) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* REGISTRATION FORM */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* SECTION 1: PERSONAL INFORMATION */}
          <div className="card">
            <div className="card-header">1. Personal Information</div>
            
            <div className="form-group">
              <label>Your good Name *</label>
              <input 
                type="text" required className="input-field"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email *</label>
                <input 
                  type="email" required className="input-field"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input 
                  type="tel" required className="input-field"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: BACKGROUND & TEAM SELECTION */}
          <div className="card">
            <div className="card-header">2. Workshop Details</div>
            
            <div className="form-group">
              <label>How familiar are you with Robotics and Hardware Computing? *</label>
              {[
                "It's my first time experiencing this.",
                "I am familiar with different electronic components.",
                "I have made a few small projects.",
                "I have worked in the field of robotics for a while."
              ].map(opt => (
                <label key={opt} className="radio-option">
                  <input 
                    type="radio" name="fam" value={opt}
                    checked={formData.familiarity === opt}
                    onChange={e => setFormData({...formData, familiarity: e.target.value})}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>

            <div className="form-group">
              <label>Tell us what you wish to attain from this workshop?</label>
              <textarea 
                rows="2" className="input-field"
                value={formData.attain_goals}
                onChange={e => setFormData({...formData, attain_goals: e.target.value})}
              />
            </div>

            {/* SEAT MODERATION GRID */}
            <div className="form-group">
              <label style={{ color: '#fcd34d' }}>Are you registering alone or in a team? *</label>
              <div className="selection-grid">
                
                {/* ALONE */}
                <div 
                  onClick={() => setFormData({...formData, registration_type: 'Alone'})}
                  className={`select-card ${formData.registration_type === 'Alone' ? 'active' : ''}`}
                >
                  <strong style={{ display: 'block', fontSize: '1.1rem' }}>Alone</strong>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>1 Seat Reserved</span>
                </div>

                {/* TEAM */}
                <div 
                  onClick={() => {
                    if (capacity.allowTeamRegistration) {
                      setFormData({...formData, registration_type: 'In a team'});
                    }
                  }}
                  className={`select-card ${
                    !capacity.allowTeamRegistration 
                      ? 'disabled' 
                      : formData.registration_type === 'In a team' ? 'active' : ''
                  }`}
                >
                  <strong style={{ display: 'block', fontSize: '1.1rem' }}>In a team</strong>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {capacity.allowTeamRegistration ? '5 Seats Reserved' : 'Unavailable (Seats < 5)'}
                  </span>
                </div>

              </div>
              {!capacity.allowTeamRegistration && (
                <small style={{ color: '#f59e0b', marginTop: '0.5rem' }}>
                  ⚠️ Team options are hidden because fewer than 5 seats remain.
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Where did you hear about this workshop? *</label>
              <select 
                className="input-field"
                value={formData.referral_source}
                onChange={e => setFormData({...formData, referral_source: e.target.value})}
              >
                <option>I saw your posters and got curious.</option>
                <option>You paid us a visit and I found it fun.</option>
                <option>My friend told me about it and I wanted to join in.</option>
                <option>I got an email about this workshop.</option>
              </select>
            </div>
          </div>

          {/* SECTION 3: PAYMENT */}
          <div className="card">
            <div className="card-header">3. Payment Verification</div>
            
            <label className="radio-option" style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <input 
                type="checkbox"
                checked={formData.is_thapathali_student}
                onChange={e => setFormData({...formData, is_thapathali_student: e.target.checked})}
              />
              <span>I am from Thapathali Campus (Discount Applied)</span>
            </label>

            <div className="fee-summary">
              <div>
                <span style={{ fontSize: '0.75rem', color: '#fcd34d', display: 'block' }}>Total Fee:</span>
                <span className="fee-amount">Rs. {calculatePrice()}</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {formData.registration_type === 'In a team' ? 'Full Team (5 Seats)' : 'Individual'}
              </span>
            </div>

            {formData.is_thapathali_student && (
              <div className="form-group">
                <label>Upload Campus ID Card as Proof *</label>
                <input 
                  type="file" 
                  accept="image/*,.pdf"
                  required 
                  className="input-field" 
                  onChange={e => setIdCardFile(e.target.files[0])}
                />
              </div>
            )}

            <div style={{ textAlign: 'center', margin: '1rem 0' }}>
              <p style={{ fontSize: '0.85rem' }}>Scan QR code to pay via eSewa:</p>
              
              <div className="qr-placeholder-box">
                <img src={pay} alt="Payment QR Code" />
                <span style={{ fontSize: '1rem', color: '#9ca3af', marginTop: '0.5rem' }}>Saroj Gaire</span>
              </div>

              <small style={{ color: '#ef4444', fontWeight: 'bold' }}>
                ⚠️ ADD YOUR NAME IN THE PAYMENT REMARKS!
              </small>
            </div>

            <div className="form-group">
              <label>Upload Payment Slip *</label>
              <input 
                type="file" 
                accept="image/*,.pdf"
                required 
                className="input-field" 
                onChange={e => setPaymentSlipFile(e.target.files[0])}
              />
            </div>
          </div>

          {/* SECTION 4: STAY CONNECTED */}
          <div className="card">
            <div className="card-header">4. Stay Connected</div>
            
            <div className="form-group">
              <label>Would you like to receive further news on workshops? *</label>
              <label className="radio-option">
                <input type="radio" name="connect" checked={formData.stay_connected} onChange={() => setFormData({...formData, stay_connected: true})} />
                <span>Yes, I want to stay connected to RAC.</span>
              </label>
              <label className="radio-option">
                <input type="radio" name="connect" checked={!formData.stay_connected} onChange={() => setFormData({...formData, stay_connected: false})} />
                <span>No, I will think about it after the workshop.</span>
              </label>
            </div>

            <div className="form-group">
              <label>Avengers: Doomsday 🍿</label>
              <input 
                type="text" className="input-field"
                placeholder="Will you watch the new Marvel Avengers: Doomsday?"
                value={formData.watch_doomsday}
                onChange={e => setFormData({...formData, watch_doomsday: e.target.value})}
              />
            </div>
          </div>

          {message && <div className="status-msg">{message}</div>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Submitting...' : 'SUBMIT REGISTRATION'}
          </button>
        </form>

      </div>
    </div>
  );
}