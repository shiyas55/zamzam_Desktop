import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, Truck, Navigation, Phone, ShieldCheck, LogOut } from 'lucide-react';

export const DriverProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Driver Profile
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          Delivery account and vehicle assignment.
        </p>
      </div>

      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '1.5rem', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={30} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {user?.first_name || user?.username}
            </h3>
            <span className="badge badge-success">Active Delivery Driver</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              <Navigation size={18} color="var(--primary)" /> Assigned Route:
            </span>
            <strong style={{ fontSize: '0.9rem' }}>{user?.assigned_route_name || 'Assigned Territory'}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              <Truck size={18} color="var(--primary)" /> Vehicle:
            </span>
            <strong style={{ fontSize: '0.9rem' }}>Delivery Van</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              <Phone size={18} color="var(--primary)" /> Phone:
            </span>
            <strong style={{ fontSize: '0.9rem' }}>{user?.phone_number || 'Registered'}</strong>
          </div>
        </div>
      </div>

      {/* PWA Home Screen Info */}
      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#065f46', marginBottom: '0.25rem' }}>
          Install App to Home Screen
        </h4>
        <p style={{ fontSize: '0.78rem', color: '#047857' }}>
          Tap your browser menu and choose "Add to Home Screen" to install this PWA for full-screen offline-ready delivery experience.
        </p>
      </div>

      <button className="btn btn-secondary btn-full" onClick={handleLogout} style={{ color: 'var(--danger)', borderColor: '#fca5a5' }}>
        <LogOut size={16} />
        <span>Sign Out of Driver Account</span>
      </button>
    </div>
  );
};
