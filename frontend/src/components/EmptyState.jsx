import { Inbox } from 'lucide-react';

const EmptyState = ({ icon: Icon = Inbox, message = 'No data found', description, action, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
      <div
        className="p-4 rounded-2xl mb-4"
        style={{ background: 'rgba(99, 102, 241, 0.1)' }}
      >
        <Icon size={48} style={{ color: 'var(--color-text-secondary)' }} />
      </div>
      <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
        {message}
      </h3>
      {description && (
        <p className="text-sm text-center max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
