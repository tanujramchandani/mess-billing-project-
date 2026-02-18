import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { paymentsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { CreditCard, Filter, CheckCircle, XCircle, Search, ArrowUpDown, ChevronDown, DollarSign, Clock, TrendingUp, Wallet, Download, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const Payments = () => {
  const { isStudent, isContractor, isWarden, loading: authLoading, user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [search, setSearch] = useState('');
  // Default sort: date desc for students, roll_no for others
  const [ordering, setOrdering] = useState('-date');
  const [verifyingId, setVerifyingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Get current year for year filter options
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  useEffect(() => {
    // Wait for auth to load before fetching
    if (!authLoading && user) {
      fetchPayments();
      fetchSummary();
    }
  }, [statusFilter, methodFilter, monthFilter, yearFilter, ordering, authLoading, user, isStudent]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = { ordering };
      if (statusFilter) params.status = statusFilter;
      if (methodFilter) params.method = methodFilter;
      if (search) params.search = search;
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;

      // Use user.role directly to avoid stale isStudent value
      const userIsStudent = user?.role === 'student';
      console.log('[Payments] Fetching for userIsStudent:', userIsStudent, 'user.role:', user?.role);
      const res = userIsStudent
        ? await paymentsAPI.getMyPayments(params)
        : await paymentsAPI.list(params);
      const data = res.data?.results || res.data || [];
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      toast.error('Failed to load payments.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      // Use user.role directly to avoid stale isStudent value
      const userIsStudent = user?.role === 'student';
      const res = userIsStudent
        ? await paymentsAPI.getMyPaymentSummary()
        : await paymentsAPI.summary();
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSearch = () => {
    fetchPayments();
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchPayments();
    }
  };

  // Export payments to CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;
      if (statusFilter) params.status = statusFilter;
      
      const response = await paymentsAPI.exportMyPayments(params);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my_payments_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Payment history exported!');
    } catch (err) {
      console.error('Failed to export payments:', err);
      toast.error('Failed to export payment history.');
    } finally {
      setExporting(false);
    }
  };

  const handleVerify = async (paymentId) => {
    setSubmitting(true);
    try {
      await paymentsAPI.verify(paymentId, { status: 'verified' });
      toast.success('Payment verified successfully!');
      setVerifyingId(null);
      await fetchPayments();
      fetchSummary();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to verify payment.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (paymentId, notes) => {
    setSubmitting(true);
    try {
      await paymentsAPI.reject(paymentId, { status: 'rejected', notes: notes || '' });
      toast.success('Payment rejected.');
      setVerifyingId(null);
      await fetchPayments();
      fetchSummary();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to reject payment.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
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

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-IN');
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const methodLabels = {
    cash: 'Cash',
    online: 'Online',
    upi: 'UPI',
    cheque: 'Cheque',
    other: 'Other',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">
            {isStudent ? 'My Payments' : 'Payments'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {isStudent ? 'Track your payment history' : 'View and manage payments'}
          </p>
        </div>
        {isStudent && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-secondary flex items-center gap-2"
          >
            {exporting ? <LoadingSpinner size="sm" /> : <Download size={18} />}
            Export CSV
          </button>
        )}
      </div>

      {/* Summary Cards - For Students */}
      {isStudent && summary && !loadingSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
                <DollarSign size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Total Paid</p>
                <p className="text-lg font-bold text-emerald-400">
                  Rs {formatCurrency(summary.total_paid || summary.total_amount)}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>
                <CreditCard size={18} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Total Payments</p>
                <p className="text-lg font-bold text-indigo-400">
                  {summary.total_count || 0}
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
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Pending</p>
                <p className="text-lg font-bold text-amber-400">
                  {summary.pending_count || 0}
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
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Avg Payment</p>
                <p className="text-lg font-bold text-purple-400">
                  Rs {formatCurrency(summary.avg_payment || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards - Only for Contractor/Warden */}
      {!isStudent && summary && !loadingSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
                <DollarSign size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Total Collected</p>
                <p className="text-lg font-bold text-emerald-400">
                  Rs {formatCurrency(summary.total_collected)}
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
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Pending Verification</p>
                <p className="text-lg font-bold text-amber-400">
                  Rs {formatCurrency(summary.total_pending)}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>
                <TrendingUp size={18} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Collection Rate</p>
                <p className="text-lg font-bold text-indigo-400">
                  {summary.collection_rate}%
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(168, 85, 247, 0.12)' }}>
                <Wallet size={18} className="text-purple-400" />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Payment Methods</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {summary.by_method && Object.entries(summary.by_method).map(([method, count]) => (
                    count > 0 && (
                      <span key={method} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' }}>
                        {methodLabels[method]}: {count}
                      </span>
                    )
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Filter size={16} style={{ color: 'var(--color-text-secondary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Filters</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search - for non-students */}
            {!isStudent && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  placeholder="Search roll no / name..."
                  className="input-field pl-9 text-sm"
                  style={{ width: '200px' }}
                />
              </div>
            )}

            {/* Month filter - for students */}
            {isStudent && (
              <div className="relative">
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="input-field appearance-none pr-8 text-sm"
                  style={{ minWidth: '130px' }}
                >
                  <option value="">All Months</option>
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx + 1}>{name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
              </div>
            )}

            {/* Year filter - for students */}
            {isStudent && (
              <div className="relative">
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="input-field appearance-none pr-8 text-sm"
                  style={{ minWidth: '100px' }}
                >
                  <option value="">All Years</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
              </div>
            )}

            {/* Status filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field appearance-none pr-8 text-sm"
                style={{ minWidth: '150px' }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
            </div>

            {/* Method filter */}
            <div className="relative">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="input-field appearance-none pr-8 text-sm"
                style={{ minWidth: '150px' }}
              >
                <option value="">All Methods</option>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
            </div>

            {/* Sort by */}
            <div className="flex items-center gap-2">
              <ArrowUpDown size={14} style={{ color: 'var(--color-text-secondary)' }} />
              <div className="relative">
                <select
                  value={ordering}
                  onChange={(e) => setOrdering(e.target.value)}
                  className="input-field appearance-none pr-8 text-sm"
                  style={{ minWidth: '150px' }}
                >
                  {/* Roll No options only for non-students */}
                  {!isStudent && (
                    <>
                      <option value="roll_no">Roll No (Asc)</option>
                      <option value="-roll_no">Roll No (Desc)</option>
                    </>
                  )}
                  <option value="-date">Date (Newest)</option>
                  <option value="date">Date (Oldest)</option>
                  <option value="-amount">Amount (High-Low)</option>
                  <option value="amount">Amount (Low-High)</option>
                  <option value="status">Status</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          message="No payments found"
          description={statusFilter ? `No payments with status "${statusFilter}".` : 'No payments have been recorded yet.'}
        />
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>S.No</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Payment</th>
                  {!isStudent && (
                    <>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Roll No</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Student</th>
                    </>
                  )}
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Bill</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Method</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                  {(isContractor || isWarden) && (
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, idx) => (
                  <tr key={payment.id} className="table-row">
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {idx + 1}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      #{payment.id}
                      {payment.transaction_id && (
                        <span className="block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          Ref: {payment.transaction_id}
                        </span>
                      )}
                    </td>
                    {!isStudent && (
                      <>
                        <td className="px-5 py-3 text-sm font-medium" style={{ color: '#a5b4fc' }}>
                          {payment.student_enrollment || '-'}
                        </td>
                        <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {payment.student_name || payment.student_username || '-'}
                        </td>
                      </>
                    )}
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {payment.bill_month && payment.bill_year
                        ? `${monthNames[(payment.bill_month || 1) - 1]} ${payment.bill_year}`
                        : `Bill #${payment.bill}`}
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold" style={{ color: '#34d399' }}>
                      Rs {Number(payment.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {methodLabels[payment.payment_method] || payment.payment_method}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDate(payment.created_at || payment.payment_date)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={payment.status} />
                    </td>
                    {(isContractor || isWarden) && (
                      <td className="px-5 py-3">
                        {payment.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleVerify(payment.id)}
                              disabled={submitting}
                              className="p-1.5 rounded-lg transition-colors hover:bg-emerald-500/20"
                              title="Verify"
                            >
                              <CheckCircle size={16} style={{ color: '#34d399' }} />
                            </button>
                            <button
                              onClick={() => handleReject(payment.id)}
                              disabled={submitting}
                              className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20"
                              title="Reject"
                            >
                              <XCircle size={16} style={{ color: '#f87171' }} />
                            </button>
                          </div>
                        )}
                        {payment.status !== 'pending' && payment.verified_by_name && (
                          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            by {payment.verified_by_name}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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

export default Payments;
