import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI } from '../services/api';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import {
  TrendingUp, Receipt, DollarSign, AlertCircle, Users,
  CalendarCheck, ClipboardList, CreditCard, ArrowRight,
  Activity, Eye, Sun, Moon, AlertTriangle, Clock, Wallet, Calendar,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format } from 'date-fns';

/* ------------------------------------------------------------------ */
/*  Custom dark-themed recharts tooltip                                */
/* ------------------------------------------------------------------ */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '0.75rem',
        padding: '0.75rem 1rem',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Chart gradient definitions                                         */
/* ------------------------------------------------------------------ */
const ChartGradients = () => (
  <defs>
    <linearGradient id="gradientIndigo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
    </linearGradient>
    <linearGradient id="gradientPurple" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
    </linearGradient>
    <linearGradient id="gradientCyan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
    </linearGradient>
    <linearGradient id="gradientAmber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
    </linearGradient>
    <linearGradient id="gradientGreen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
    </linearGradient>
  </defs>
);

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981'];

/* ================================================================== */
/*  STUDENT DASHBOARD                                                  */
/* ================================================================== */
const StudentDashboard = ({ data, user }) => {
  const navigate = useNavigate();
  const stats = data?.stats || {};
  const alerts = data?.alerts || {};
  const recentBills = data?.recent_bills || [];
  const attendanceTrend = data?.attendance_trend || [];
  const spendingTrend = data?.spending_trend || [];

  return (
    <>
      {/* Overdue Warning Banner */}
      {alerts.overdue_warning && (
        <div
          className="rounded-xl p-4 mb-4 flex items-center gap-3"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-400">
              You have {stats.overdue_count} overdue bill{stats.overdue_count > 1 ? 's' : ''} totaling Rs {Number(stats.overdue_amount || 0).toLocaleString()}
            </p>
            <p className="text-xs text-red-300/80 mt-0.5">Please make the payment to avoid late fees.</p>
          </div>
          <button
            onClick={() => navigate('/bills')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
          >
            View Bills
          </button>
        </div>
      )}

      {/* Attendance Eligibility Warning */}
      {alerts.attendance_below_threshold && (
        <div
          className="rounded-xl p-4 mb-4 flex items-center gap-3"
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}
        >
          <AlertCircle className="text-amber-400 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-400">
              Your attendance is below 75% ({stats.attendance_percentage}%)
            </p>
            <p className="text-xs text-amber-300/80 mt-0.5">Low attendance may affect your eligibility for certain benefits.</p>
          </div>
        </div>
      )}

      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.08))',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 blur-[60px]" style={{ background: '#6366f1' }} />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Welcome back, <span className="gradient-text">{user?.first_name || user?.username || 'Student'}</span>
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Here is your mess billing overview for today.
            </p>
          </div>
          {stats.next_due_date && (
            <div
              className="px-4 py-2 rounded-xl flex items-center gap-2"
              style={{
                background: stats.days_until_due <= 0 ? 'rgba(239, 68, 68, 0.15)' : stats.days_until_due <= 7 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: `1px solid ${stats.days_until_due <= 0 ? 'rgba(239, 68, 68, 0.4)' : stats.days_until_due <= 7 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              }}
            >
              <Clock size={14} style={{ color: stats.days_until_due <= 0 ? '#f87171' : stats.days_until_due <= 7 ? '#fbbf24' : '#34d399' }} />
              <span className="text-xs font-semibold" style={{ color: stats.days_until_due <= 0 ? '#f87171' : stats.days_until_due <= 7 ? '#fbbf24' : '#34d399' }}>
                {stats.days_until_due <= 0 ? 'Overdue' : `Due in ${stats.days_until_due} day${stats.days_until_due > 1 ? 's' : ''}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards - Row 1: Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          icon={TrendingUp}
          label="Attendance"
          value={stats.attendance_percentage != null ? `${stats.attendance_percentage}%` : '--'}
          trend={stats.attendance_percentage >= 75 ? 'up' : 'down'}
          trendValue={stats.lunch_days != null ? `L: ${stats.lunch_days} / D: ${stats.dinner_days}` : undefined}
          color="success"
        />
        <StatCard
          icon={DollarSign}
          label="Pending Amount"
          value={stats.pending_amount != null ? `Rs ${Number(stats.pending_amount).toLocaleString()}` : 'Rs 0'}
          color="warning"
        />
        <StatCard
          icon={Wallet}
          label="Lifetime Paid"
          value={stats.lifetime_paid != null ? `Rs ${Number(stats.lifetime_paid).toLocaleString()}` : 'Rs 0'}
          color="primary"
        />
        <StatCard
          icon={AlertCircle}
          label="Active Disputes"
          value={stats.active_disputes ?? 0}
          color="danger"
        />
      </div>

      {/* Stat cards - Row 2: Additional Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Receipt}
          label="Total Bills"
          value={stats.total_bills ?? 0}
          color="secondary"
        />
        <StatCard
          icon={CreditCard}
          label="This Year Paid"
          value={stats.current_year_paid != null ? `Rs ${Number(stats.current_year_paid).toLocaleString()}` : 'Rs 0'}
          color="success"
        />
        <StatCard
          icon={Calendar}
          label="Next Due Date"
          value={stats.next_due_date ? format(new Date(stats.next_due_date), 'MMM dd') : 'N/A'}
          color={stats.days_until_due <= 0 ? 'danger' : stats.days_until_due <= 7 ? 'warning' : 'primary'}
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue Bills"
          value={stats.overdue_count ?? 0}
          color="danger"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance chart */}
        <div className="lg:col-span-2 glass-card p-5">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Attendance Trend (Last 30 Days)
          </h2>
          {attendanceTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={attendanceTrend}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#334155' }} domain={[0, 1]} ticks={[0, 1]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="lunch" name="Lunch" stroke="#06b6d4" strokeWidth={2} fill="url(#gradientCyan)" />
                <Area type="monotone" dataKey="dinner" name="Dinner" stroke="#f59e0b" strokeWidth={2} fill="url(#gradientAmber)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px]" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-sm">No attendance data available yet.</p>
            </div>
          )}
        </div>

        {/* Recent Bills */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Recent Bills</h2>
            <button
              onClick={() => navigate('/bills')}
              className="text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: '#818cf8' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#a5b4fc')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#818cf8')}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>

          {recentBills.length > 0 ? (
            <div className="space-y-3">
              {recentBills.slice(0, 5).map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 rounded-xl transition-all duration-200 cursor-pointer"
                  style={{ border: '1px solid transparent' }}
                  onClick={() => navigate(`/bills/${bill.id}`)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.06)';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {bill.month}/{bill.year}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Rs {Number(bill.total_amount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {bill.due_date && new Date(bill.due_date) < new Date() && bill.status === 'pending' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Overdue</span>
                    )}
                    <StatusBadge status={bill.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-sm">No bills yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Spending Trend */}
      {spendingTrend.length > 0 && (
        <div className="glass-card p-5 mt-6">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Monthly Spending Trend (Last 6 Months)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={spendingTrend}>
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#334155' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#334155' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" name="Bill Amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
};

/* ================================================================== */
/*  CONTRACTOR DASHBOARD                                               */
/* ================================================================== */
const ContractorDashboard = ({ data, user }) => {
  const navigate = useNavigate();
  const stats = data?.stats || {};
  const attendanceSummary = data?.attendance_summary || [];
  const recentBills = data?.recent_bills || [];

  const getBillingCycleColor = (status) => {
    switch (status) {
      case 'open': return '#10b981';
      case 'billed': return '#6366f1';
      case 'payment_ongoing': return '#f59e0b';
      case 'closed': return '#64748b';
      default: return '#94a3b8';
    }
  };

  return (
    <>
      {/* Welcome banner with billing cycle status */}
      <div
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(139, 92, 246, 0.08), rgba(99, 102, 241, 0.06))',
          border: '1px solid rgba(245, 158, 11, 0.2)',
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 blur-[60px]" style={{ background: '#f59e0b' }} />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Hello, <span className="gradient-text">{user?.first_name || user?.username || 'Contractor'}</span>
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Manage attendance and billing operations from your dashboard.
            </p>
          </div>
          {stats.billing_cycle_status && (
            <div
              className="px-4 py-2 rounded-xl flex items-center gap-2"
              style={{
                background: `${getBillingCycleColor(stats.billing_cycle_status)}15`,
                border: `1px solid ${getBillingCycleColor(stats.billing_cycle_status)}40`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: getBillingCycleColor(stats.billing_cycle_status) }}
              />
              <span className="text-xs font-semibold uppercase" style={{ color: getBillingCycleColor(stats.billing_cycle_status) }}>
                Cycle: {stats.billing_cycle_status.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Primary KPI Cards - Revenue Focus */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          icon={DollarSign}
          label="Today's Revenue"
          value={`Rs ${Number(stats.today_revenue || 0).toLocaleString()}`}
          color="success"
        />
        <StatCard
          icon={TrendingUp}
          label="Month Revenue"
          value={`Rs ${Number(stats.month_revenue || 0).toLocaleString()}`}
          color="primary"
        />
        <StatCard
          icon={Receipt}
          label="Bills This Month"
          value={stats.bills_this_month ?? 0}
          color="info"
        />
        <StatCard
          icon={AlertCircle}
          label="Unpaid Bills"
          value={stats.unpaid_bills ?? 0}
          color="danger"
        />
      </div>

      {/* Secondary KPI Cards - Operational */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total Students" value={stats.total_students ?? 0} color="secondary" />
        <StatCard icon={Sun} label="Today's Lunch" value={stats.today_lunch ?? 0} color="success" />
        <StatCard icon={Moon} label="Today's Dinner" value={stats.today_dinner ?? 0} color="warning" />
        <StatCard
          icon={Activity}
          label="Weekly Attendance"
          value={`${stats.weekly_attendance_pct ?? 0}%`}
          color="info"
        />
      </div>

      {/* Charts + Quick Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass-card p-5">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Attendance Summary (Last 7 Days)
          </h2>
          {attendanceSummary.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={attendanceSummary} barSize={32}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} iconType="circle" iconSize={8} />
                <Bar dataKey="lunch" name="Lunch" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="dinner" name="Dinner" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px]" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-sm">No attendance data available yet.</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="glass-card p-5">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/attendance')}
              className="w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200"
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(99, 102, 241, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.2)' }}>
                <CalendarCheck size={20} style={{ color: '#818cf8' }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Mark Attendance</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Record student attendance</p>
              </div>
              <ArrowRight size={16} className="ml-auto" style={{ color: '#818cf8' }} />
            </button>

            <button
              onClick={() => navigate('/bills')}
              className="w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200"
              style={{
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(6, 182, 212, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)';
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(6, 182, 212, 0.2)' }}>
                <Receipt size={20} style={{ color: '#22d3ee' }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Generate Bills</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Create monthly bills</p>
              </div>
              <ArrowRight size={16} className="ml-auto" style={{ color: '#22d3ee' }} />
            </button>

            <button
              onClick={() => navigate('/mess-rates')}
              className="w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200"
              style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(139, 92, 246, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(139, 92, 246, 0.2)' }}>
                <DollarSign size={20} style={{ color: '#a78bfa' }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Manage Rates</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Set lunch & dinner rates</p>
              </div>
              <ArrowRight size={16} className="ml-auto" style={{ color: '#a78bfa' }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/* ================================================================== */
/*  WARDEN DASHBOARD                                                   */
/* ================================================================== */
const WardenDashboard = ({ data, user }) => {
  const navigate = useNavigate();
  const stats = data?.stats || {};
  const billingTrend = data?.billing_trend || [];
  const disputeDistribution = data?.dispute_distribution || [];
  const recentActivity = data?.recent_activity || [];

  return (
    <>
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.06))',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 blur-[60px]" style={{ background: '#10b981' }} />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Welcome, <span className="gradient-text">{user?.first_name || user?.username || 'Warden'}</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            System overview and administrative controls.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total Users" value={stats.total_users ?? 0} color="primary" />
        <StatCard icon={AlertCircle} label="Active Disputes" value={stats.active_disputes ?? 0} color="danger" />
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={stats.total_revenue != null ? `Rs ${Number(stats.total_revenue).toLocaleString()}` : 'Rs 0'}
          color="success"
        />
        <StatCard
          icon={CreditCard}
          label="Pending Payments"
          value={stats.pending_payments != null ? `Rs ${Number(stats.pending_payments).toLocaleString()}` : 'Rs 0'}
          color="warning"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Billing Trends */}
        <div className="lg:col-span-2 glass-card p-5">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Billing Trends
          </h2>
          {billingTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={billingTrend}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="amount" name="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#gradientIndigo)" />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2} fill="url(#gradientGreen)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px]" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-sm">No billing data available yet.</p>
            </div>
          )}
        </div>

        {/* Dispute distribution */}
        <div className="glass-card p-5">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Dispute Distribution
          </h2>
          {disputeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={disputeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                >
                  {disputeDistribution.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px]" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-sm">No dispute data available.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Recent Activity
          </h2>
        </div>
        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.slice(0, 8).map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-3 rounded-xl transition-colors"
                style={{ borderBottom: idx < recentActivity.length - 1 ? '1px solid var(--color-border)' : 'none' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(99, 102, 241, 0.12)' }}
                >
                  <Activity size={16} style={{ color: '#818cf8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {item.description || item.action || 'Activity'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.user || ''} {item.timestamp ? `- ${format(new Date(item.timestamp), 'MMM d, h:mm a')}` : ''}
                  </p>
                </div>
                {item.type && <StatusBadge status={item.type} />}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40" style={{ color: 'var(--color-text-secondary)' }}>
            <p className="text-sm">No recent activity.</p>
          </div>
        )}
      </div>
    </>
  );
};

/* ================================================================== */
/*  MAIN DASHBOARD                                                     */
/* ================================================================== */
const Dashboard = () => {
  const { user, isStudent, isContractor, isWarden, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('[Dashboard] Fetching data for user:', user?.username, 'role:', user?.role);
        const response = await analyticsAPI.getDashboardStats();
        console.log('[Dashboard] Data received:', response.data);
        setData(response.data);
      } catch (err) {
        console.error('[Dashboard] Failed to load dashboard:', err);
        const errorMsg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Unknown error';
        setError(`Failed to load dashboard: ${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };
    // Wait for auth to load before fetching dashboard
    if (!authLoading && user) {
      fetchDashboard();
    } else if (!authLoading && !user) {
      // No user after auth finished - not logged in
      console.log('[Dashboard] No user found after auth loading');
      setLoading(false);
    }
  }, [authLoading, user]);

  // Show loading while auth is loading OR while fetching data
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 rounded-2xl" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
          <AlertCircle size={48} style={{ color: '#f87171' }} />
        </div>
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Something went wrong
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-2">
          Retry
        </button>
      </div>
    );
  }

  // Debug: log role detection
  console.log('[Dashboard] Rendering for role:', user?.role, 'isStudent:', isStudent, 'isContractor:', isContractor, 'isWarden:', isWarden, 'data:', !!data);

  if (isStudent) return <StudentDashboard data={data} user={user} />;
  if (isContractor) return <ContractorDashboard data={data} user={user} />;
  if (isWarden) return <WardenDashboard data={data} user={user} />;

  // Fallback - if user has role='student' but isStudent is false (timing issue)
  if (user?.role === 'student') return <StudentDashboard data={data} user={user} />;
  if (user?.role === 'contractor') return <ContractorDashboard data={data} user={user} />;
  if (user?.role === 'warden') return <WardenDashboard data={data} user={user} />;

  // Fallback - show student dashboard for any unknown role
  return <StudentDashboard data={data} user={user} />;
};

export default Dashboard;
