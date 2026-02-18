import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import {
  DollarSign, Receipt, Clock, TrendingUp, Wallet, PieChart,
  BarChart3, Calendar, ChevronRight, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area, ComposedChart, Line, PieChart as RechartsPie, Pie, Cell,
} from 'recharts';

/* ================================================================== */
/*  CHART GRADIENTS                                                    */
/* ================================================================== */
const ChartGradients = () => (
  <defs>
    <linearGradient id="gradientIndigo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
    </linearGradient>
    <linearGradient id="gradientCyan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
    </linearGradient>
    <linearGradient id="gradientEmerald" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
      <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
    </linearGradient>
    <linearGradient id="gradientAmber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
    </linearGradient>
  </defs>
);

/* ================================================================== */
/*  CUSTOM TOOLTIP                                                     */
/* ================================================================== */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-lg p-3 shadow-xl border"
      style={{
        background: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </p>
      {payload.map((entry, index) => (
        <p key={index} className="text-xs flex items-center gap-2" style={{ color: entry.color }}>
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color }}
          />
          {entry.name}: {typeof entry.value === 'number' && entry.dataKey !== 'attendance_percentage'
            ? `Rs ${entry.value.toLocaleString()}`
            : `${entry.value}%`}
        </p>
      ))}
    </div>
  );
};

/* ================================================================== */
/*  STAT CARD                                                          */
/* ================================================================== */
const StatCard = ({ icon: Icon, label, value, subValue, trend, color = 'primary' }) => {
  const colorMap = {
    primary: { bg: 'rgba(99, 102, 241, 0.12)', icon: '#818cf8', value: '#a5b4fc' },
    success: { bg: 'rgba(16, 185, 129, 0.12)', icon: '#34d399', value: '#6ee7b7' },
    warning: { bg: 'rgba(245, 158, 11, 0.12)', icon: '#fbbf24', value: '#fcd34d' },
    danger: { bg: 'rgba(239, 68, 68, 0.12)', icon: '#f87171', value: '#fca5a5' },
    cyan: { bg: 'rgba(6, 182, 212, 0.12)', icon: '#22d3ee', value: '#67e8f9' },
    purple: { bg: 'rgba(168, 85, 247, 0.12)', icon: '#a78bfa', value: '#c4b5fd' },
  };

  const colors = colorMap[color] || colorMap.primary;

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl" style={{ background: colors.bg }}>
          <Icon size={22} style={{ color: colors.icon }} />
        </div>
        {trend && (
          <div
            className="flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5"
            style={{
              background: trend === 'up' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: trend === 'up' ? '#34d399' : '#f87171',
            }}
          >
            {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {subValue}
          </div>
        )}
      </div>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: colors.value }}>
        {value}
      </p>
      {!trend && subValue && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {subValue}
        </p>
      )}
    </div>
  );
};

/* ================================================================== */
/*  PAYMENT METHOD PIE                                                 */
/* ================================================================== */
const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#34d399', '#a78bfa'];

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
const FinancialSummary = () => {
  const { user, isStudent, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Wait for auth to load before fetching
    if (!authLoading && user) {
      fetchFinancialSummary();
    }
  }, [authLoading, user]);

  const fetchFinancialSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await analyticsAPI.getStudentFinancialSummary();
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch financial summary:', err);
      setError('Failed to load financial summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={DollarSign}
        message="Failed to load data"
        description={error}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={PieChart}
        message="No financial data"
        description="No financial information available yet."
      />
    );
  }

  const stats = data.stats || {};
  const monthlyTrend = data.monthly_trend || [];
  const correlationData = data.correlation_data || [];
  const paymentMethods = data.payment_methods || [];

  // Prepare payment method data for pie chart
  const pieData = Object.entries(paymentMethods).map(([method, count], idx) => ({
    name: method.charAt(0).toUpperCase() + method.slice(1),
    value: count || 0,
    color: COLORS[idx % COLORS.length],
  })).filter(d => d.value > 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text">Financial Summary</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Your comprehensive financial overview and analytics
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          icon={Wallet}
          label="Lifetime Paid"
          value={`Rs ${Number(stats.lifetime_paid || 0).toLocaleString()}`}
          color="success"
        />
        <StatCard
          icon={Receipt}
          label="Bills Generated"
          value={stats.total_bills || 0}
          color="primary"
        />
        <StatCard
          icon={Clock}
          label="Total Pending"
          value={`Rs ${Number(stats.total_pending || 0).toLocaleString()}`}
          color="warning"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Monthly Bill"
          value={`Rs ${Number(stats.avg_monthly_bill || 0).toLocaleString()}`}
          color="cyan"
        />
        <StatCard
          icon={Calendar}
          label="This Year Paid"
          value={`Rs ${Number(stats.current_year_paid || 0).toLocaleString()}`}
          color="purple"
        />
        <StatCard
          icon={DollarSign}
          label="Payment Rate"
          value={`${stats.payment_rate || 0}%`}
          subValue={stats.paid_bills ? `${stats.paid_bills} paid` : undefined}
          color={stats.payment_rate >= 80 ? 'success' : stats.payment_rate >= 50 ? 'warning' : 'danger'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Spending Trend */}
        <div className="glass-card p-5">
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Monthly Spending Trend
          </h3>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyTrend}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} iconType="circle" iconSize={8} />
                <Area
                  type="monotone"
                  dataKey="bill_amount"
                  name="Bill Amount"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#gradientIndigo)"
                />
                <Area
                  type="monotone"
                  dataKey="paid_amount"
                  name="Paid Amount"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gradientEmerald)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px]" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-sm">No monthly data available yet.</p>
            </div>
          )}
        </div>

        {/* Attendance vs Bill Correlation */}
        <div className="glass-card p-5">
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Attendance vs Bill Correlation
          </h3>
          {correlationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={correlationData}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} iconType="circle" iconSize={8} />
                <Bar
                  yAxisId="left"
                  dataKey="bill_amount"
                  name="Bill Amount"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="attendance_percentage"
                  name="Attendance %"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', strokeWidth: 0, r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px]" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-sm">No correlation data available yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods Distribution */}
        <div className="glass-card p-5">
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Payment Methods
          </h3>
          {pieData.length > 0 ? (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px]" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-sm">No payment data yet.</p>
            </div>
          )}
          {/* Legend */}
          {pieData.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: entry.color }}
                  />
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Insights */}
        <div className="lg:col-span-2 glass-card p-5">
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Quick Insights
          </h3>
          <div className="space-y-3">
            {/* Insight items */}
            <InsightItem
              icon={TrendingUp}
              title="Spending Pattern"
              description={
                stats.avg_monthly_bill > 0
                  ? `Your average monthly bill is Rs ${Number(stats.avg_monthly_bill).toLocaleString()}`
                  : 'Not enough data to analyze spending patterns.'
              }
              color="primary"
            />
            <InsightItem
              icon={Wallet}
              title="Payment Status"
              description={
                stats.total_pending > 0
                  ? `You have Rs ${Number(stats.total_pending).toLocaleString()} pending payments.`
                  : 'All your bills are paid. Great job!'
              }
              color={stats.total_pending > 0 ? 'warning' : 'success'}
            />
            <InsightItem
              icon={Calendar}
              title="Billing History"
              description={`${stats.total_bills || 0} total bills generated, ${stats.paid_bills || 0} fully paid.`}
              color="cyan"
            />
            <InsightItem
              icon={Receipt}
              title="Current Year"
              description={`You have paid Rs ${Number(stats.current_year_paid || 0).toLocaleString()} this year.`}
              color="purple"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  INSIGHT ITEM                                                       */
/* ================================================================== */
const InsightItem = ({ icon: Icon, title, description, color = 'primary' }) => {
  const colorMap = {
    primary: { bg: 'rgba(99, 102, 241, 0.1)', icon: '#818cf8', border: 'rgba(99, 102, 241, 0.2)' },
    success: { bg: 'rgba(16, 185, 129, 0.1)', icon: '#34d399', border: 'rgba(16, 185, 129, 0.2)' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', icon: '#fbbf24', border: 'rgba(245, 158, 11, 0.2)' },
    danger: { bg: 'rgba(239, 68, 68, 0.1)', icon: '#f87171', border: 'rgba(239, 68, 68, 0.2)' },
    cyan: { bg: 'rgba(6, 182, 212, 0.1)', icon: '#22d3ee', border: 'rgba(6, 182, 212, 0.2)' },
    purple: { bg: 'rgba(168, 85, 247, 0.1)', icon: '#a78bfa', border: 'rgba(168, 85, 247, 0.2)' },
  };

  const colors = colorMap[color] || colorMap.primary;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl transition-all"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <div className="p-2 rounded-lg flex-shrink-0" style={{ background: colors.border }}>
        <Icon size={16} style={{ color: colors.icon }} />
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      </div>
    </div>
  );
};

export default FinancialSummary;
