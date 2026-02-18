import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, User, Bell, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const Topbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user?.username?.[0]?.toUpperCase() || 'U';
  };

  const getRoleBadgeStyle = () => {
    const styles = {
      student: { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' },
      contractor: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
      warden: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' },
    };
    return styles[user?.role] || styles.student;
  };

  const roleBadge = getRoleBadgeStyle();

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-6 py-3"
      style={{
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl transition-all duration-200 lg:hidden"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
            e.currentTarget.style.color = '#a5b4fc';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <Menu size={22} />
        </button>

        {/* Greeting */}
        <div className="hidden sm:block">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {new Date().getHours() < 12
              ? 'Good Morning'
              : new Date().getHours() < 17
              ? 'Good Afternoon'
              : 'Good Evening'}
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          className="relative p-2.5 rounded-xl transition-all duration-200"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
            e.currentTarget.style.color = '#a5b4fc';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <Bell size={20} />
          <span
            className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 0 8px rgba(99, 102, 241, 0.6)',
            }}
          />
        </button>

        {/* Divider */}
        <div className="w-px h-8" style={{ background: 'var(--color-border)' }} />

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 p-1.5 pr-3 rounded-xl transition-all duration-200"
            style={{ border: '1px solid transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
            }}
            onMouseLeave={(e) => {
              if (!dropdownOpen) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }
            }}
          >
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              }}
            >
              {getInitials()}
            </div>

            {/* Name and role */}
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                {user?.first_name
                  ? `${user.first_name} ${user.last_name || ''}`
                  : user?.username || 'User'}
              </p>
              <span
                className="inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5"
                style={{ background: roleBadge.bg, color: roleBadge.color }}
              >
                {user?.role || 'user'}
              </span>
            </div>

            <ChevronDown
              size={16}
              className="hidden md:block transition-transform duration-200"
              style={{
                color: 'var(--color-text-secondary)',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden"
              style={{
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                animation: 'slideDown 0.2s ease-out',
              }}
            >
              {/* User info header */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {user?.first_name
                    ? `${user.first_name} ${user.last_name || ''}`
                    : user?.username || 'User'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {user?.email || ''}
                </p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/profile');
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  <User size={16} />
                  View Profile
                </button>
              </div>

              {/* Logout */}
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors"
                  style={{ color: '#f87171' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
};

export default Topbar;
