import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Truck, HandCoins, Receipt, User as UserIcon, LogOut, Wallet, Moon, Sun } from 'lucide-react';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';

export const DriverLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/driver',          label: 'Deliveries', icon: Truck,    end: true },
    { to: '/driver/collect',  label: 'Collect ₹',  icon: HandCoins              },
    { to: '/driver/expenses', label: 'Expenses',   icon: Wallet                 },
    { to: '/driver/summary',  label: 'Summary',    icon: Receipt                },
    { to: '/driver/profile',  label: 'Profile',    icon: UserIcon               },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', justifyContent: 'center' }}>
      <div className="driver-shell" style={{ width: '100%', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>

        {/* ── Sticky Header ── */}
        <header
          className="driver-header"
          style={{
            background: '#7f1d1d',
            color: 'white',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            padding: '0 1rem 0.65rem',
            borderBottom: '1px solid #991b1b',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Brand + Route */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <div style={{ width: 24, height: 24, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                <img src="/app-icon.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <span
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  color: '#fef08a',
                  border: '1px solid rgba(251,191,36,0.4)',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  maxWidth: '140px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.assigned_route_name || 'Route'}
              </span>
            </div>
            <p style={{ fontSize: '0.7rem', color: '#fca5a5', fontWeight: 500, marginTop: '0.1rem' }}>
              {user?.first_name || user?.username}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                color: '#fef08a',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                flexShrink: 0,
              }}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign Out"
              style={{
                color: 'white',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                flexShrink: 0,
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {/* ── Scrollable Content ── */}
        <main className="driver-main">
          <Outlet />
        </main>

        {/* ── Fixed Bottom Navigation ── */}
        <nav
          className="driver-bottom-nav"
          aria-label="Driver Navigation"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.15rem',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: 'none',
                  flex: 1,
                  padding: '0.55rem 0 0.4rem',
                  minHeight: '48px',
                  justifyContent: 'center',
                  borderTop: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                })}
              >
                <Icon size={20} />
                <span style={{ fontSize: '0.68rem' }}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <PWAInstallPrompt />
    </div>
  );
};
