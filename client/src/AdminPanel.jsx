import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminPanel.css'; // Optional styling file below

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  return 'https://drone-workshop-form.onrender.com';
};

const API_BASE_URL = getApiBaseUrl();

export default function AdminPanel() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  
  // Image Preview Modal State
  const [modalImage, setModalImage] = useState(null);
  const [modalTitle, setModalTitle] = useState('');

  // Admin Auth State (Simple Key Check)
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Fetch registrations from Backend
  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/registrations`, {
        headers: { 'x-admin-key': adminKey }
      });
      setRegistrations(res.data);
      setIsAuthenticated(true);
    } catch (err) {
      alert('Unauthorized or failed to fetch data. Please check your Admin Key.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    fetchRegistrations();
  };

  // Toggle Verification Status
  const toggleVerification = async (id, currentStatus) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/admin/verify/${id}`, 
        { is_verified: !currentStatus },
        { headers: { 'x-admin-key': adminKey } }
      );
      
      // Local state update for instant feedback
      setRegistrations(prev =>
        prev.map(reg => reg.id === id ? { ...reg, is_verified: !currentStatus } : reg)
      );
    } catch (err) {
      alert('Failed to update verification status.');
    }
  };

  // Filtered registrations based on search & registration type
  const filteredData = registrations.filter(reg => {
    const matchesSearch = 
      reg.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      reg.email?.toLowerCase().includes(search.toLowerCase()) ||
      reg.phone?.includes(search);

    const matchesFilter = 
      filterType === 'All' ? true :
      filterType === 'Verified' ? reg.is_verified :
      filterType === 'Pending' ? !reg.is_verified :
      filterType === 'Thapathali' ? reg.is_thapathali_student : true;

    return matchesSearch && matchesFilter;
  });

  if (!isAuthenticated) {
    return (
      <div className="admin-login-container">
        <div className="admin-card">
          <h2 style={{ color: '#f59e0b', marginBottom: '1rem' }}>🔐 RAC Admin Portal</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="password" 
              placeholder="Enter Admin Passkey" 
              className="admin-input"
              value={adminKey} 
              onChange={e => setAdminKey(e.target.value)} 
              required
            />
            <button type="submit" className="admin-btn">Access Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div>
          <h1 style={{ color: '#f59e0b', margin: 0 }}>Drone Workshop Admin</h1>
          <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Total Registrations: {registrations.length}</span>
        </div>
        <button className="admin-btn-secondary" onClick={() => setIsAuthenticated(false)}>Logout</button>
      </div>

      {/* CONTROLS BAR */}
      <div className="admin-controls">
        <input 
          type="text" 
          placeholder="🔍 Search name, email, phone..." 
          className="admin-input" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />

        <select className="admin-input" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="All">All Registrations</option>
          <option value="Pending">⏳ Pending Verification</option>
          <option value="Verified">✅ Verified Payments</option>
          <option value="Thapathali">🏫 Thapathali Students</option>
        </select>

        <button className="admin-btn-secondary" onClick={fetchRegistrations}>🔄 Refresh</button>
      </div>

      {/* DATA TABLE */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#fcd34d' }}>Loading dashboard data...</p>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Participant</th>
                <th>Type</th>
                <th>Campus ID</th>
                <th>Payment Slip</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
                    No registrations match your search.
                  </td>
                </tr>
              ) : (
                filteredData.map(reg => (
                  <tr key={reg.id} className={reg.is_verified ? 'row-verified' : ''}>
                    <td>
                      <span className={`badge ${reg.is_verified ? 'badge-success' : 'badge-warning'}`}>
                        {reg.is_verified ? 'VERIFIED' : 'PENDING'}
                      </span>
                    </td>
                    <td>
                      <strong>{reg.full_name}</strong>
                      <div className="sub-text">{reg.email}</div>
                      <div className="sub-text">📱 {reg.phone}</div>
                    </td>
                    <td>
                      <span className="badge badge-info">{reg.registration_type}</span>
                      {reg.is_thapathali_student && <span className="badge badge-purple">Thapathali</span>}
                    </td>
                    <td>
                      {reg.id_card_url ? (
                        <button 
                          className="view-link-btn" 
                          onClick={() => { setModalImage(reg.id_card_url); setModalTitle(`ID Card: ${reg.full_name}`); }}
                        >
                          🪪 View ID
                        </button>
                      ) : (
                        <span className="sub-text">N/A</span>
                      )}
                    </td>
                    <td>
                      {reg.payment_slip_url ? (
                        <button 
                          className="view-link-btn highlight" 
                          onClick={() => { setModalImage(reg.payment_slip_url); setModalTitle(`Payment Slip: ${reg.full_name}`); }}
                        >
                          🧾 View Slip
                        </button>
                      ) : (
                        <span className="sub-text" style={{ color: '#ef4444' }}>Missing</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className={`action-btn ${reg.is_verified ? 'btn-undo' : 'btn-verify'}`}
                        onClick={() => toggleVerification(reg.id, reg.is_verified)}
                      >
                        {reg.is_verified ? 'Mark Pending' : 'Verify Payment'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {modalImage && (
        <div className="modal-overlay" onClick={() => setModalImage(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalTitle}</h3>
              <button className="close-btn" onClick={() => setModalImage(null)}>✕</button>
            </div>
            <div className="modal-body">
              {modalImage.endsWith('.pdf') ? (
                <iframe src={modalImage} title="Document Preview" width="100%" height="400px" />
              ) : (
                <img src={modalImage} alt="Verification Proof" className="preview-img" />
              )}
            </div>
            <a href={modalImage} target="_blank" rel="noreferrer" className="admin-btn" style={{ textDecoration: 'none', display: 'block', textAlign: 'center', marginTop: '1rem' }}>
              Open High Res / Download ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}