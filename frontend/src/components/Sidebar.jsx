import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  CalendarCheck,
  Receipt,
  AlertTriangle,
  CreditCard,
  ClipboardList,
  BarChart3,
  Users,
  User,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  PieChart,
} from 'lucide-react';

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const { user } = useAuth();

  const getNavLinks = () => {
    const role = user?.role;

    const studentLinks = [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/attendance', icon: CalendarCheck, label: 'My Attendance' },
      { to: '/bills', icon: Receipt, label: 'My Bills' },
      { to: '/disputes', icon: AlertTriangle, label: 'My Disputes' },
      { to: '/payments', icon: CreditCard, label: 'My Payments' },
      { to: '/financial-summary', icon: PieChart, label: 'Financial Summary' },
      { to: '/profile', icon: User, label: 'Profile' },
    ];

    const contractorLinks = [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/attendance', icon: CalendarCheck, label: 'Mark Attendance' },
      { to: '/bills', icon: Receipt, label: 'Manage Bills' },
      { to: '/mess-rates', icon: DollarSign, label: 'Mess Rates' },
      { to: '/disputes', icon: AlertTriangle, label: 'Disputes' },
      { to: '/payments', icon: CreditCard, label: 'Payments' },
      { to: '/profile', icon: User, label: 'Profile' },
    ];

    const wardenLinks = [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
      { to: '/bills', icon: Receipt, label: 'All Bills' },
      { to: '/disputes', icon: AlertTriangle, label: 'All Disputes' },
      { to: '/payments', icon: CreditCard, label: 'All Payments' },
      { to: '/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/profile', icon: User, label: 'Profile' },
    ];

    switch (role) {
      case 'student': return studentLinks;
      case 'contractor': return contractorLinks;
      case 'warden': return wardenLinks;
      default: return studentLinks;
    }
  };

  const links = getNavLinks();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen z-50 flex flex-col transition-all duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          width: collapsed ? '80px' : '260px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderRight: '1px solid var(--color-border)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 py-5"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <UtensilsCrossed size={20} className="text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold gradient-text whitespace-nowrap">
                MessBill
              </h1>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Billing System
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-3' : ''}`
              }
              title={collapsed ? link.label : undefined}
            >
              <link.icon size={20} className="flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{link.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse button */}
        <div className="px-3 py-4 hidden lg:block" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-link w-full justify-center"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
