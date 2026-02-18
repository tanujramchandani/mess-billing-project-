const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`relative ${sizeMap[size]}`}>
        <div
          className={`absolute inset-0 rounded-full border-2 border-transparent`}
          style={{
            borderTopColor: '#6366f1',
            borderRightColor: '#8b5cf6',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div
          className={`absolute inset-1 rounded-full border-2 border-transparent`}
          style={{
            borderBottomColor: '#06b6d4',
            borderLeftColor: '#06b6d4',
            animation: 'spin 1.2s linear infinite reverse',
          }}
        />
      </div>
      {size === 'lg' || size === 'xl' ? (
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Loading...
        </p>
      ) : null}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
