import React, { useState, useEffect } from 'react';
import DroneWorkshopForm from './DroneWorkshopForm';
import AdminPanel from './AdminPanel';

export default function App() {
  const [isAdminView, setIsAdminView] = useState(false);

  useEffect(() => {
    // Automatically switch to admin panel if URL contains ?admin=true
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
      setIsAdminView(true);
    }
  }, []);

  return (
    <div>
      {/* Subtle Admin Toggle Header */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          padding: '0.5rem 1rem', 
          background: '#0b0f17', 
          borderBottom: '1px solid #1f2937' 
        }}
      >
        <button 
          onClick={() => setIsAdminView(!isAdminView)}
          style={{ 
            background: 'transparent', 
            color: '#6b7280', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '0.8rem',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.color = '#f59e0b'}
          onMouseLeave={(e) => e.target.style.color = '#6b7280'}
        >
          {isAdminView ? '← Back to Registration Form' : '🔒 Admin Portal'}
        </button>
      </div>

      {/* Render selected view */}
      {isAdminView ? <AdminPanel /> : <DroneWorkshopForm />}
    </div>
  );
}