import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, trend, trendValue, color = 'primary', className = '' }) => {
  const colorMap = {
    primary: {
      iconBg: 'rgba(99, 102, 241, 0.15)',
      iconColor: '#818cf8',
      gradient: 'from-indigo-500/10 to-purple-500/10',
    },
    success: {
      iconBg: 'rgba(16, 185, 129, 0.15)',
      iconColor: '#34d399',
      gradient: 'from-emerald-500/10 to-green-500/10',
    },
    warning: {
      iconBg: 'rgba(245, 158, 11, 0.15)',
      iconColor: '#fbbf24',
      gradient: 'from-amber-500/10 to-yellow-500/10',
    },
    danger: {
      iconBg: 'rgba(239, 68, 68, 0.15)',
      iconColor: '#f87171',
      gradient: 'from-red-500/10 to-rose-500/10',
    },
    accent: {
      iconBg: 'rgba(6, 182, 212, 0.15)',
      iconColor: '#22d3ee',
      gradient: 'from-cyan-500/10 to-teal-500/10',
    },
  };

  const colors = colorMap[color] || colorMap.primary;

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp size={14} />;
    if (trend === 'down') return <TrendingDown size={14} />;
    return <Minus size={14} />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-emerald-400';
    if (trend === 'down') return 'text-red-400';
    return 'text-slate-400';
  };

  return (
    <div className={`stat-card ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {label}
          </p>
          <p className="text-3xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>
            {value}
          </p>
          {trendValue && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div
          className="p-3 rounded-xl"
          style={{ background: colors.iconBg }}
        >
          {Icon && <Icon size={24} style={{ color: colors.iconColor }} />}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
