/**
 * Skeleton loading components for improved UX during data fetching.
 */

export const Skeleton = ({ className = '', width, height, rounded = 'md' }) => {
  const roundedMap = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
  };

  return (
    <div
      className={`animate-pulse ${roundedMap[rounded]} ${className}`}
      style={{
        width: width || '100%',
        height: height || '1rem',
        background: 'linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-bg-secondary) 50%, var(--color-bg-tertiary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
};

export const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        width={i === lines - 1 ? '75%' : '100%'}
        height="0.875rem"
        rounded="md"
      />
    ))}
  </div>
);

export const SkeletonCard = ({ className = '' }) => (
  <div
    className={`glass-card p-4 ${className}`}
    style={{ background: 'var(--color-bg-secondary)' }}
  >
    <div className="flex items-center gap-3 mb-3">
      <Skeleton width="2.5rem" height="2.5rem" rounded="xl" />
      <div className="flex-1">
        <Skeleton width="60%" height="0.75rem" className="mb-2" />
        <Skeleton width="40%" height="1.25rem" />
      </div>
    </div>
  </div>
);

export const SkeletonTable = ({ rows = 5, columns = 5, className = '' }) => (
  <div className={`overflow-hidden rounded-xl ${className}`}>
    {/* Header */}
    <div
      className="flex gap-4 p-4"
      style={{ background: 'var(--color-bg-tertiary)' }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === 0 ? '3rem' : '8rem'}
          height="0.875rem"
          rounded="md"
        />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div
        key={rowIdx}
        className="flex gap-4 p-4"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        {Array.from({ length: columns }).map((_, colIdx) => (
          <Skeleton
            key={colIdx}
            width={colIdx === 0 ? '3rem' : '8rem'}
            height="0.875rem"
            rounded="md"
          />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonChart = ({ height = '280px', className = '' }) => (
  <div className={`glass-card p-5 ${className}`}>
    <Skeleton width="40%" height="1.25rem" className="mb-4" />
    <div
      className="flex items-end gap-2 justify-around"
      style={{ height }}
    >
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton
          key={i}
          width="2rem"
          height={`${30 + Math.random() * 60}%`}
          rounded="md"
        />
      ))}
    </div>
  </div>
);

// Global shimmer animation
const style = document.createElement('style');
style.textContent = `
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;
if (typeof document !== 'undefined' && !document.querySelector('[data-skeleton-styles]')) {
  style.setAttribute('data-skeleton-styles', '');
  document.head.appendChild(style);
}

export default Skeleton;
