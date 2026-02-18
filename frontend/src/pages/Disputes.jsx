import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { disputesAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { AlertTriangle, Filter, MessageSquare, Clock, CheckCircle, TrendingUp, XCircle, Calendar, RefreshCw, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const Disputes = () => {
  const { isStudent, isContractor, isWarden, loading: authLoading, user } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Contractor respond modal
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Warden resolve modal
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveAction, setResolveAction] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Reopen modal (for students)
  const [reopeningDispute, setReopeningDispute] = useState(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    // Wait for auth to load before fetching
    if (!authLoading && user) {
      // Use user.role directly to avoid stale isStudent value
      const userIsStudent = user?.role === 'student';
      // Set default status filter for students to show open disputes
      if (userIsStudent && !statusFilter) {
        setStatusFilter('open');
      }
      fetchDisputes();
      if (!userIsStudent) {
        fetchSummary();
      }
    }
  }, [statusFilter, monthFilter, yearFilter, authLoading, user]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;
      // Use user.role directly to avoid stale isStudent value
      const userIsStudent = user?.role === 'student';
      console.log('[Disputes] Fetching for userIsStudent:', userIsStudent, 'user.role:', user?.role);
      const res = userIsStudent
        ? await disputesAPI.getMyDisputes(params)
        : await disputesAPI.list(params);
      const data = res.data?.results || res.data || [];
      setDisputes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch disputes:', err);
      toast.error('Failed to load disputes.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const params = {};
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;
      const res = await disputesAPI.summary(params);
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleRespond = async (disputeId) => {
    if (!responseText.trim()) {
      toast.error('Please enter a response.');
      return;
    }
    setSubmitting(true);
    try {
      await disputesAPI.respond(disputeId, { contractor_response: responseText.trim() });
      toast.success('Response submitted successfully!');
      setRespondingTo(null);
      setResponseText('');
      await fetchDisputes();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit response.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (disputeId) => {
    if (!resolveAction) return;
    setSubmitting(true);
    try {
      if (resolveAction === 'resolved') {
        await disputesAPI.resolve(disputeId, {
          status: 'resolved',
          resolution_notes: resolutionNotes.trim(),
        });
      } else {
        await disputesAPI.reject(disputeId, {
          resolution_notes: resolutionNotes.trim(),
        });
      }
      toast.success(`Dispute ${resolveAction} successfully!`);
      setResolvingId(null);
      setResolveAction('');
      setResolutionNotes('');
      await fetchDisputes();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to update dispute.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle reopen dispute (for students)
  const handleReopen = async () => {
    if (!reopeningDispute) return;
    setReopening(true);
    try {
      await disputesAPI.reopen(reopeningDispute.id, { reason: reopenReason.trim() });
      toast.success('Dispute reopened successfully!');
      setReopeningDispute(null);
      setReopenReason('');
      await fetchDisputes();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to reopen dispute.';
      toast.error(msg);
    } finally {
      setReopening(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr), 'MMM dd, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">
            {isStudent ? 'My Disputes' : 'Disputes'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {isStudent ? 'Track your raised disputes' : 'Manage and respond to disputes'}
          </p>
        </div>
      </div>

      {/* Summary Cards - Only for Contractor/Warden */}
      {!isStudent && summary && !loadingSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>
                <AlertTriangle size={18} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Total</p>
                <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {summary.total}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
                <Clock size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Unresolved</p>
                <p className="text-lg font-bold text-amber-400">
                  {summary.counts?.unresolved || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
                <CheckCircle size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Resolved</p>
                <p className="text-lg font-bold text-emerald-400">
                  {summary.counts?.resolved || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
                <XCircle size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Rejected</p>
                <p className="text-lg font-bold text-red-400">
                  {summary.counts?.rejected || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(6, 182, 212, 0.12)' }}>
                <Calendar size={18} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Avg Resolution</p>
                <p className="text-lg font-bold text-cyan-400">
                  {summary.sla?.avg_resolution_days != null ? `${summary.sla.avg_resolution_days}d` : '-'}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(168, 85, 247, 0.12)' }}>
                <TrendingUp size={18} className="text-purple-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Resolution Rate</p>
                <p className="text-lg font-bold text-purple-400">
                  {summary.resolution_rate}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={18} style={{ color: 'var(--color-text-secondary)' }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field appearance-none"
            style={{ width: '160px' }}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="input-field appearance-none"
            style={{ width: '140px' }}
          >
            <option value="">All Months</option>
            {monthNames.map((name, idx) => (
              <option key={idx} value={idx + 1}>{name}</option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="input-field appearance-none"
            style={{ width: '100px' }}
          >
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {(statusFilter || monthFilter || yearFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setMonthFilter(''); setYearFilter(''); }}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : disputes.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          message="No disputes found"
          description={statusFilter ? `No disputes with status "${statusFilter}".` : 'No disputes have been raised yet.'}
        />
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <div key={dispute.id} className="glass-card overflow-hidden">
              {/* Dispute header */}
              <div className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-xl flex-shrink-0"
                      style={{ background: 'rgba(245, 158, 11, 0.12)' }}
                    >
                      <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Dispute #{dispute.id} — {dispute.dispute_type === 'billing' ? 'Billing' : 'Attendance'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        Bill: {monthNames[(dispute.bill_month || 1) - 1]} {dispute.bill_year}
                        {dispute.bill_amount && ` — Rs ${Number(dispute.bill_amount).toLocaleString()}`}
                        {!isStudent && dispute.raised_by_name && ` — by ${dispute.raised_by_name || dispute.raised_by_username}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDate(dispute.created_at)}
                    </span>
                    <StatusBadge status={dispute.status} />
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  {dispute.description}
                </p>

                {/* Contractor response */}
                {dispute.contractor_response && (
                  <div
                    className="p-3 rounded-lg mb-3"
                    style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.12)' }}
                  >
                    <p className="text-xs font-semibold mb-1" style={{ color: '#818cf8' }}>
                      <MessageSquare size={12} className="inline mr-1" />
                      Contractor Response:
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {dispute.contractor_response}
                    </p>
                  </div>
                )}

                {/* Resolution notes */}
                {dispute.resolution_notes && (
                  <div
                    className="p-3 rounded-lg mb-3"
                    style={{
                      background: dispute.status === 'resolved'
                        ? 'rgba(16, 185, 129, 0.06)'
                        : 'rgba(239, 68, 68, 0.06)',
                      border: `1px solid ${dispute.status === 'resolved'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)'}`,
                    }}
                  >
                    <p className="text-xs font-semibold mb-1" style={{
                      color: dispute.status === 'resolved' ? '#34d399' : '#f87171',
                    }}>
                      <CheckCircle size={12} className="inline mr-1" />
                      Resolution ({dispute.status}):
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {dispute.resolution_notes}
                    </p>
                    {dispute.resolved_by_name && (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Resolved by: {dispute.resolved_by_name}
                      </p>
                    )}
                  </div>
                )}

                {/* Timeline View - For Students */}
                {isStudent && (dispute.timeline || dispute.created_at) && (
                  <div
                    className="p-4 rounded-lg mb-3"
                    style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                  >
                    <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                      <Clock size={12} className="inline mr-1" />
                      Timeline
                      {dispute.days_to_resolve != null && (
                        <span className="ml-2 px-2 py-0.5 rounded text-[10px]" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                          {dispute.days_to_resolve === 0 ? 'Same day' : `${dispute.days_to_resolve} day${dispute.days_to_resolve > 1 ? 's' : ''} to resolve`}
                        </span>
                      )}
                    </p>
                    <div className="relative">
                      {/* Timeline track */}
                      <div
                        className="absolute left-[5px] top-0 bottom-0 w-0.5"
                        style={{ background: 'var(--color-border)' }}
                      />
                      {/* Timeline items */}
                      <div className="space-y-4">
                        {/* Created */}
                        <div className="flex items-start gap-3 relative">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5 z-10"
                            style={{ background: '#6366f1' }}
                          />
                          <div>
                            <p className="text-xs font-medium" style={{ color: '#818cf8' }}>Dispute Raised</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                              {formatDate(dispute.created_at)}
                            </p>
                          </div>
                        </div>
                        {/* Responded */}
                        {dispute.contractor_response && (
                          <div className="flex items-start gap-3 relative">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5 z-10"
                              style={{ background: '#22d3ee' }}
                            />
                            <div>
                              <p className="text-xs font-medium" style={{ color: '#22d3ee' }}>Contractor Responded</p>
                              <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                                {dispute.responded_at ? formatDate(dispute.responded_at) : 'Response submitted'}
                              </p>
                            </div>
                          </div>
                        )}
                        {/* Resolved/Rejected */}
                        {['resolved', 'rejected'].includes(dispute.status) && (
                          <div className="flex items-start gap-3 relative">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5 z-10"
                              style={{ background: dispute.status === 'resolved' ? '#34d399' : '#f87171' }}
                            />
                            <div>
                              <p className="text-xs font-medium" style={{ color: dispute.status === 'resolved' ? '#34d399' : '#f87171' }}>
                                {dispute.status === 'resolved' ? 'Resolved' : 'Rejected'}
                              </p>
                              <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                                {dispute.resolved_at ? formatDate(dispute.resolved_at) : 'Dispute closed'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reopen Dispute Button - For Students (only for resolved/rejected) */}
                {isStudent && ['resolved', 'rejected'].includes(dispute.status) && dispute.can_reopen && (
                  <button
                    onClick={() => setReopeningDispute(dispute)}
                    className="btn-secondary text-sm py-1.5 px-4 flex items-center gap-2 mt-2"
                  >
                    <RefreshCw size={14} /> Reopen Dispute
                  </button>
                )}

                {/* Contractor respond button */}
                {isContractor && (dispute.status === 'open') && (
                  respondingTo === dispute.id ? (
                    <div className="space-y-3 mt-3">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        className="input-field w-full"
                        rows={3}
                        placeholder="Enter your response..."
                        style={{ resize: 'vertical' }}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRespond(dispute.id)}
                          disabled={submitting}
                          className="btn-primary text-sm py-1.5 px-4 disabled:opacity-60"
                        >
                          {submitting ? 'Submitting...' : 'Submit Response'}
                        </button>
                        <button
                          onClick={() => { setRespondingTo(null); setResponseText(''); }}
                          className="btn-secondary text-sm py-1.5 px-4"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRespondingTo(dispute.id)}
                      className="btn-secondary text-sm py-1.5 px-4 flex items-center gap-2 mt-2"
                    >
                      <MessageSquare size={14} /> Respond
                    </button>
                  )
                )}

                {/* Warden resolve/reject buttons */}
                {isWarden && !['resolved', 'rejected'].includes(dispute.status) && (
                  resolvingId === dispute.id ? (
                    <div className="space-y-3 mt-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setResolveAction('resolved')}
                          className={`text-sm py-1.5 px-4 rounded-lg transition-colors ${
                            resolveAction === 'resolved'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'btn-secondary'
                          }`}
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => setResolveAction('rejected')}
                          className={`text-sm py-1.5 px-4 rounded-lg transition-colors ${
                            resolveAction === 'rejected'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'btn-secondary'
                          }`}
                        >
                          Reject
                        </button>
                      </div>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="input-field w-full"
                        rows={3}
                        placeholder="Resolution notes..."
                        style={{ resize: 'vertical' }}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResolve(dispute.id)}
                          disabled={submitting || !resolveAction}
                          className="btn-primary text-sm py-1.5 px-4 disabled:opacity-60"
                        >
                          {submitting ? 'Submitting...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => { setResolvingId(null); setResolveAction(''); setResolutionNotes(''); }}
                          className="btn-secondary text-sm py-1.5 px-4"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setResolvingId(dispute.id)}
                      className="btn-secondary text-sm py-1.5 px-4 flex items-center gap-2 mt-2"
                    >
                      <CheckCircle size={14} /> Resolve / Reject
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reopen Dispute Confirmation Modal */}
      {reopeningDispute && (
        <Modal
          isOpen={true}
          onClose={() => { setReopeningDispute(null); setReopenReason(''); }}
          title="Reopen Dispute"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Are you sure you want to reopen Dispute #{reopeningDispute.id}?
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              This will set the dispute status back to "Open" for review.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Reason for reopening (optional)
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="input-field w-full"
                rows={3}
                placeholder="Explain why you want to reopen this dispute..."
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleReopen}
                disabled={reopening}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                {reopening ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Reopening...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Confirm Reopen
                  </>
                )}
              </button>
              <button
                onClick={() => { setReopeningDispute(null); setReopenReason(''); }}
                className="btn-secondary"
                disabled={reopening}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        select option {
          background: #1e293b;
          color: #f1f5f9;
        }
      `}</style>
    </div>
  );
};

export default Disputes;
