import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { BRAND_CONFIG } from '../config/brandConfig';
import {
  LayoutDashboard, Store, Package, MapPin, Truck, ShoppingCart, Send,
  CreditCard, BookOpen, BarChart3, Users, LogOut, Receipt, Sun, Moon,
  Lock, ChevronLeft, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Menu, X, PlusCircle, MessageCircle, Settings,
  Wrench, AlertTriangle, Headphones, FolderArchive, UserCheck, Zap,
  Search, Bell, FileSpreadsheet,
} from 'lucide-react';
import { NotepadSheetModal } from '../components/NotepadSheetModal';

export const OwnerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Collapsed icon-only state (desktop) with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('owner_sidebar_collapsed') === 'true';
  });

  // Mobile drawer open state
  const [mobileOpen, setMobileOpen] = useState(false);
  // Quick Notepad & Sheet Modal state
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);

  // Global Alt+N shortcut to toggle Notepad & Sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsNotepadOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on resize to desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setMobileOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('owner_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const { isWhatsAppEnabled, isMaintenanceMode } = useSettings();

  const navItems = [
    { to: '/owner',                    label: 'Dashboard',          icon: LayoutDashboard, end: true },
    { to: '/owner/create-order',       label: 'Fast Wholesale',     icon: Zap             },
    { to: '/owner/orders',             label: 'Sales Orders',       icon: ShoppingCart    },
    { to: '/owner/customers',          label: 'Customer Shops',     icon: Store           },
    { to: '/owner/shop-documents',     label: 'Shop Documents',     icon: FolderArchive   },
    { to: '/owner/products',           label: 'Products',           icon: Package         },
    { to: '/owner/routes',             label: 'Delivery Routes',    icon: MapPin          },
    { to: '/owner/expenses',           label: 'Expenses',           icon: Receipt         },
    { to: '/owner/payments',           label: 'Payments',           icon: CreditCard      },
    { to: '/owner/credit',             label: 'Credit Ledger',      icon: BookOpen        },
    { to: '/owner/reports',            label: 'Financial Reports',  icon: BarChart3       },
    { to: '/owner/attendance',         label: 'Attendance & Wages', icon: UserCheck       },
    { to: '/owner/notepad',            label: 'Notepad & Sheets',   icon: FileSpreadsheet },
    { to: '/owner/settings',           label: 'Settings',           icon: Settings        },
  ];

  const sidebarWidth = isCollapsed ? '72px' : '260px';

  const SidebarContent = (
    <>
      {/* Brand Header */}
      <div
        style={{
          padding: isCollapsed ? '0.85rem 0.4rem' : '0.85rem 1rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          flexShrink: 0,
          background: 'var(--bg-card)',
        }}
      >
        {isCollapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand Sidebar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', border: '1px solid #fecaca' }}>
              <img src="/app-icon.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <ChevronRight size={14} style={{ color: 'var(--primary)' }} />
          </button>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <img src="/app-icon.png" alt="Z" style={{ width: 24, height: 24, borderRadius: '6px', objectFit: 'cover' }} />
                <span style={{ fontSize: '0.95rem', color: '#b91c1c', fontWeight: 800, letterSpacing: '-0.01em' }}>
                  Zamzam Foods
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                Sample Kitchen & Dispatch
              </span>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="sidebar-desktop-toggle"
              title="Collapse to Icons"
              style={{ background: 'var(--sidebar-hover)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#b91c1c')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: isCollapsed ? '0.65rem 0.35rem' : '0.65rem 0.75rem', overflowY: 'auto', overflowX: 'hidden' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const [targetPath, targetQuery] = item.to.split('?');
            const isItemActive = (() => {
              if (location.pathname !== targetPath) return false;
              if (targetQuery) {
                return location.search === `?${targetQuery}`;
              }
              return !location.search || location.search === '';
            })();

            return (
              <li key={item.to} style={{ marginBottom: '0.2rem' }}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  title={isCollapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: isCollapsed ? 0 : '0.7rem',
                    padding: isCollapsed ? '0.55rem 0' : '0.55rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.86rem',
                    fontWeight: isItemActive ? 700 : 500,
                    color: isItemActive ? '#dc2626' : 'var(--text-secondary)',
                    backgroundColor: isItemActive ? '#fee2e2' : 'transparent',
                    boxShadow: isItemActive ? 'inset 0 0 0 1px #fecaca' : undefined,
                    transition: 'all 0.14s ease',
                    whiteSpace: 'nowrap',
                    minHeight: '38px',
                  }}
                >
                  <Icon size={isCollapsed ? 20 : 18} style={{ color: isItemActive ? '#dc2626' : 'var(--text-muted)', flexShrink: 0 }} />
                  {!isCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Card */}
      <div style={{ padding: isCollapsed ? '0.75rem 0.4rem' : '0.75rem 0.85rem', borderTop: '1px solid var(--border)', background: 'var(--sidebar-hover)', flexShrink: 0 }}>
        {isCollapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <div title={user?.first_name || user?.username} style={{ width: 32, height: 32, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', border: '1.5px solid #fca5a5' }}>
              {(user?.first_name || user?.username || 'O')[0].toUpperCase()}
            </div>
            <button type="button" onClick={handleLogout} title="Sign Out" style={{ color: 'var(--text-muted)', padding: '0.35rem', background: 'none', border: 'none', cursor: 'pointer' }}>
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', border: '1.5px solid #fca5a5', flexShrink: 0 }}>
                {(user?.first_name || user?.username || 'O')[0].toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.83rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.first_name || user?.username}
                </p>
                <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.62rem', padding: '0.06rem 0.35rem', border: '1px solid #fca5a5', marginTop: '0.1rem' }}>
                  OWNER
                </span>
              </div>
            </div>
            <button type="button" onClick={handleLogout} title="Sign Out" style={{ color: 'var(--text-muted)', padding: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <LogOut size={17} />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div
      className="manager-layout"
      style={{
        display: 'flex',
        minHeight: 'calc(100vh / var(--app-zoom-factor, 1))',
        background: 'var(--bg-main)',
        position: 'relative',
      }}
    >

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay open"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`manager-sidebar${mobileOpen ? ' mobile-open' : ''}`}
        style={{ width: sidebarWidth }}
        aria-label="Navigation"
      >
        {SidebarContent}
      </aside>

      {/* Main Content */}
      <div
        className="manager-main-area"
        style={{
          marginLeft: sidebarWidth,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh / var(--app-zoom-factor, 1))',
        }}
      >
        {/* Foodager Emerald Top Bar */}
        <header className="manager-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            {/* Hamburger for mobile */}
            <button
              type="button"
              className="sidebar-hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              style={{ color: '#ffffff', background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' }}
            >
              <Menu size={20} />
            </button>

            {/* Desktop collapse toggle */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="header-action-btn sidebar-desktop-toggle"
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar to Icons'}
            >
              {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              <span className="sidebar-toggle-label">
                {isCollapsed ? 'Expand' : 'Icon Only'}
              </span>
            </button>

            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Zamzam Foods
            </span>
          </div>

          {/* Integrated Translucent Search Pill */}
          <div className="header-search-pill" style={{ width: '100%', maxWidth: '340px' }}>
            <Search size={15} color="#ffffff" style={{ opacity: 0.85, flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search shops, invoices, items..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.currentTarget.value || '').trim();
                  if (val) navigate(`/owner/create-order?search=${encodeURIComponent(val)}`);
                }
              }}
            />
          </div>

          {/* Right Header Actions: Notepad, Notification, Theme, User Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            {/* Quick Notepad & Google Sheet Button */}
            <button
              type="button"
              onClick={() => setIsNotepadOpen(true)}
              className="header-action-btn"
              title="Quick Notepad & Google Sheet (Alt+N)"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0 0.75rem',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.78rem',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              <FileSpreadsheet size={15} />
              <span className="sidebar-toggle-label">Notepad & Sheet</span>
            </button>

            {/* Notification Bell with Badge */}
            <button
              type="button"
              className="header-action-btn"
              title="Notifications"
              style={{ position: 'relative', width: '34px', padding: 0 }}
            >
              <Bell size={16} color="#ffffff" />
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '14px',
                height: '14px',
                background: '#ffffff',
                color: '#b91c1c',
                borderRadius: '50%',
                fontSize: '0.62rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #b91c1c'
              }}>
                2
              </span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="header-action-btn"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <Moon size={15} color="#ffffff" /> : <Sun size={15} color="#ffffff" />}
              <span className="sidebar-toggle-label">{theme === 'light' ? 'Dark' : 'Light'}</span>
            </button>

            {/* User Profile Pill */}
            <div className="header-user-pill" title={`${user?.first_name || user?.username} (Owner)`}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#ffffff',
                color: '#b91c1c',
                fontWeight: 800,
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {(user?.first_name || user?.username || 'O')[0].toUpperCase()}
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff', maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.first_name || user?.username || 'Owner'}
              </span>
              <span style={{ fontSize: '0.62rem', background: 'rgba(255,255,255,0.22)', color: '#ffffff', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 800 }}>
                OWNER
              </span>
            </div>
          </div>
        </header>

        {/* Maintenance Mode Alert Banner for Owner */}
        {isMaintenanceMode && (
          <div style={{
            backgroundColor: '#dc2626',
            color: '#ffffff',
            padding: '0.65rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: '0.86rem',
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
            borderBottom: '2px solid #b91c1c',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Wrench size={18} style={{ color: '#ffffff' }} />
              <span>
                MAINTENANCE MODE IS ACTIVE: Staff operations and online ordering are paused. Only Owners have access.
              </span>
            </div>
            <Link
              to="/owner/settings"
              style={{
                color: '#ffffff',
                textDecoration: 'underline',
                fontSize: '0.82rem',
                fontWeight: 800,
              }}
            >
              Turn Off in Settings &rarr;
            </Link>
          </div>
        )}

        {/* Page Content */}
        <main className="manager-page-content">
          <Outlet />
        </main>
      </div>

      {/* Global Quick Notepad & Google Sheets Modal */}
      <NotepadSheetModal isOpen={isNotepadOpen} onClose={() => setIsNotepadOpen(false)} />
    </div>
  );
};
