const StatusBadge = ({ status, className = '' }) => {
  const statusStyles = {
    // Bill statuses
    pending: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'Pending' },
    generated: { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', text: 'Generated' },
    paid: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', text: 'Paid' },
    partially_paid: { bg: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', text: 'Partial' },
    overdue: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', text: 'Overdue' },
    disputed: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'Disputed' },

    // Dispute statuses
    open: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'Open' },
    in_review: { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', text: 'In Review' },
    resolved: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', text: 'Resolved' },
    rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', text: 'Rejected' },
    closed: { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', text: 'Closed' },

    // Payment statuses
    submitted: { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', text: 'Submitted' },
    verified: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', text: 'Verified' },
    failed: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', text: 'Failed' },

    // Attendance statuses
    present: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', text: 'Present' },
    absent: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', text: 'Absent' },
    both: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', text: 'Both Meals' },
    lunch_only: { bg: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', text: 'Lunch Only' },
    dinner_only: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'Dinner Only' },

    // Roles
    student: { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', text: 'Student' },
    contractor: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'Contractor' },
    warden: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', text: 'Warden' },

    // Generic
    active: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', text: 'Active' },
    inactive: { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', text: 'Inactive' },
  };

  const normalizedStatus = status?.toLowerCase?.()?.replace(/\s+/g, '_') || 'pending';
  const style = statusStyles[normalizedStatus] || statusStyles.pending;

  return (
    <span
      className={`status-badge inline-flex items-center ${className}`}
      style={{ background: style.bg, color: style.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ background: style.color }}
      />
      {style.text}
    </span>
  );
};

export default StatusBadge;
