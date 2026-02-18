import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { billsAPI, paymentsAPI, disputesAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import {
  ArrowLeft, Receipt, Calendar, DollarSign, CalendarCheck,
  CreditCard, AlertTriangle, FileText, Send, Upload,
  CheckCircle, Clock, User, Sun, Moon,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const BillDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isStudent, isContractor, isWarden, user, loading: authLoading } = useAuth();

  const [bill, setBill] = useState(null);
  const [payments, setPayments] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'online', transaction_id: '', receipt: null });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Dispute modal
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ dispute_type: 'billing', description: '' });
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  useEffect(() => {
    // Wait for auth to load before fetching
    if (!authLoading && user) {
      fetchBillDetail();
    } else if (!authLoading && !user) {
      setLoading(false);
      setError('Please log in to view bill details.');
    }
  }, [id, authLoading, user]);

  const fetchBillDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      // Use user.role directly to avoid stale isStudent value
      const userIsStudent = user?.role === 'student';
      console.log('[BillDetail] Fetching for userIsStudent:', userIsStudent, 'user.role:', user?.role);
      if (userIsStudent) {
        // Use student-specific detail endpoint with enhanced data
        res = await billsAPI.getMyBillDetail(id);
      } else {
        res = await billsAPI.getById(id);
      }
      const data = res.data;
      setBill(data);
      // Use payment_history from API if available, otherwise use payments
      setPayments(data.payment_history || data.payments || []);
      setDisputes(data.disputes || []);
    } catch (err) {
      console.error('Failed to fetch bill detail:', err);
      setError('Failed to load bill details.');
    } finally {
      setLoading(false);
    }
  };

  /* ---- Payment submission ---- */
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }
    setPaymentSubmitting(true);
    try {
      const payload = {
        bill: id,
        amount: paymentForm.amount,
        payment_method: paymentForm.payment_method,
      };
      if (paymentForm.transaction_id.trim()) {
        payload.transaction_id = paymentForm.transaction_id.trim();
      }
      if (paymentForm.receipt) {
        payload.receipt = paymentForm.receipt;
      }
      await paymentsAPI.submit(payload);
      toast.success('Payment submitted successfully!');
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', payment_method: 'online', transaction_id: '', receipt: null });
      await fetchBillDetail();
    } catch (err) {
      console.error('Payment submission failed:', err);
      const msg = err.response?.data?.detail || err.response?.data?.message || Object.values(err.response?.data || {}).flat()[0] || 'Payment submission failed.';
      toast.error(msg);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  /* ---- Dispute submission ---- */
  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!disputeForm.description.trim()) {
      toast.error('Please provide a description for the dispute.');
      return;
    }
    setDisputeSubmitting(true);
    try {
      await disputesAPI.create({
        bill: id,
        dispute_type: disputeForm.dispute_type,
        description: disputeForm.description.trim(),
      });
      toast.success('Dispute raised successfully!');
      setShowDisputeModal(false);
      setDisputeForm({ dispute_type: 'billing', description: '' });
      await fetchBillDetail();
    } catch (err) {
      console.error('Dispute submission failed:', err);
      const msg = err.response?.data?.detail || err.response?.data?.message || Object.values(err.response?.data || {}).flat()[0] || 'Failed to raise dispute.';
      toast.error(msg);
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr), 'MMM dd, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 rounded-2xl" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
          <AlertTriangle size={48} style={{ color: '#f87171' }} />
        </div>
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {error || 'Bill not found'}
        </p>
        <button onClick={() => navigate('/bills')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Bills
        </button>
      </div>
    );
  }

  const studentName = bill.student_name ||
    (bill.student?.first_name ? `${bill.student.first_name} ${bill.student.last_name || ''}`.trim() : null) ||
    bill.student?.username || 'N/A';

  // Use API-provided values if available, otherwise calculate locally
  const paidAmount = bill.paid_amount ?? payments
    .filter((p) => p.status === 'verified' || p.status === 'submitted')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const remainingAmount = bill.remaining_amount ?? Math.max(0, Number(bill.total_amount || 0) - paidAmount);
  const paymentProgress = bill.payment_progress ?? (bill.total_amount > 0 ? Math.round((paidAmount / bill.total_amount) * 100) : 0);
  
  // Check eligibility from API or derive from status
  const canMakePayment = bill.can_make_payment ?? (bill.status !== 'paid' && remainingAmount > 0);
  const canRaiseDispute = bill.can_raise_dispute ?? (bill.status !== 'paid' && !disputes.some(d => d.status === 'pending'));
  const isOverdue = bill.is_overdue ?? (bill.due_date && new Date(bill.due_date) < new Date() && bill.status !== 'paid');
  const daysOverdue = bill.days_overdue ?? (isOverdue ? Math.ceil((new Date() - new Date(bill.due_date)) / (1000 * 60 * 60 * 24)) : 0);
  
  // Progress bar color
  const progressColor = paymentProgress >= 100 ? '#34d399' : paymentProgress >= 50 ? '#22d3ee' : '#f59e0b';

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/bills')}
        className="flex items-center gap-2 mb-6 text-sm font-medium transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#a5b4fc')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
      >
        <ArrowLeft size={18} /> Back to Bills
      </button>

      {/* Bill Info Card */}
      <div
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.06))',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 blur-[60px]" style={{ background: '#6366f1' }} />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                }}
              >
                <Receipt size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Bill #{bill.id}
                </h1>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {monthNames[(bill.month || 1) - 1]} {bill.year}
                </p>
              </div>
            </div>
            <StatusBadge status={bill.status} />
          </div>

          {/* Key details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <DetailItem icon={User} label="Student" value={studentName} />
            <DetailItem icon={Calendar} label="Period" value={`${monthNames[(bill.month || 1) - 1]} ${bill.year}`} />
            <DetailItem icon={Sun} label="Lunch Days" value={bill.lunch_days ?? '-'} valueColor="#22d3ee" />
            <DetailItem icon={Moon} label="Dinner Days" value={bill.dinner_days ?? '-'} valueColor="#fbbf24" />
            <DetailItem icon={DollarSign} label="Lunch Rate" value={bill.lunch_rate != null ? `Rs ${Number(bill.lunch_rate).toLocaleString()}` : '-'} valueColor="#22d3ee" />
            <DetailItem icon={DollarSign} label="Dinner Rate" value={bill.dinner_rate != null ? `Rs ${Number(bill.dinner_rate).toLocaleString()}` : '-'} valueColor="#fbbf24" />
            <DetailItem icon={Receipt} label="Total Amount" value={`Rs ${Number(bill.total_amount || 0).toLocaleString()}`} valueColor="#a5b4fc" />
            {bill.due_date && (
              <DetailItem 
                icon={Clock} 
                label="Due Date" 
                value={formatDate(bill.due_date)} 
                valueColor={isOverdue ? '#f87171' : '#64748b'} 
              />
            )}
          </div>
        </div>
      </div>

      {/* Payment Progress Card - For Students */}
      {isStudent && (
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Payment Progress
            </h3>
            <span className="text-sm font-bold" style={{ color: progressColor }}>
              {paymentProgress}%
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="h-3 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(51, 65, 85, 0.5)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(paymentProgress, 100)}%`, background: progressColor }}
            />
          </div>
          
          {/* Summary Row */}
          <div className="flex items-center justify-between text-sm">
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Paid: </span>
              <span className="font-semibold" style={{ color: '#34d399' }}>Rs {Number(paidAmount).toLocaleString()}</span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Remaining: </span>
              <span className="font-semibold" style={{ color: remainingAmount > 0 ? '#fbbf24' : '#34d399' }}>
                Rs {Number(remainingAmount).toLocaleString()}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Total: </span>
              <span className="font-semibold" style={{ color: '#a5b4fc' }}>Rs {Number(bill.total_amount || 0).toLocaleString()}</span>
            </div>
          </div>
          
          {/* Overdue Warning */}
          {isOverdue && (
            <div
              className="mt-4 p-3 rounded-xl flex items-center gap-2"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertTriangle size={16} style={{ color: '#f87171' }} />
              <span className="text-sm" style={{ color: '#f87171' }}>
                This bill is {daysOverdue} day{daysOverdue > 1 ? 's' : ''} overdue
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons for students */}
      {isStudent && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative group">
            <button
              onClick={() => {
                setPaymentForm({ ...paymentForm, amount: remainingAmount > 0 ? remainingAmount : '' });
                setShowPaymentModal(true);
              }}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canMakePayment}
            >
              <CreditCard size={16} /> Make Payment
            </button>
            {!canMakePayment && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                {bill.status === 'paid' ? 'Bill is fully paid' : bill.billing_cycle_status === 'CLOSED' ? 'Billing cycle is closed' : 'Payment not available'}
              </div>
            )}
          </div>
          <div className="relative group">
            <button
              onClick={() => setShowDisputeModal(true)}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canRaiseDispute}
            >
              <AlertTriangle size={16} /> Raise Dispute
            </button>
            {!canRaiseDispute && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                {bill.dispute_info?.has_active_dispute ? 'Active dispute exists' : bill.dispute_info?.outside_window ? 'Dispute window expired' : 'Cannot raise dispute'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payments section */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <CreditCard size={18} style={{ color: '#818cf8' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Payments</h2>
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Paid: <span style={{ color: '#34d399' }}>Rs {paidAmount.toLocaleString()}</span>
            {remainingAmount > 0 && (
              <> / Remaining: <span style={{ color: '#fbbf24' }}>Rs {remainingAmount.toLocaleString()}</span></>
            )}
          </div>
        </div>

        {payments.length > 0 ? (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {payments.map((payment) => (
              <div key={payment.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16, 185, 129, 0.1)' }}
                  >
                    <CreditCard size={18} style={{ color: '#34d399' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Rs {Number(payment.amount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {payment.payment_method || 'Online'} {payment.reference_number ? `- Ref: ${payment.reference_number}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatDateTime(payment.created_at || payment.date)}
                  </span>
                  <StatusBadge status={payment.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CreditCard}
            message="No payments yet"
            description="No payments have been recorded for this bill."
          />
        )}
      </div>

      {/* Disputes section */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Disputes</h2>
        </div>

        {disputes.length > 0 ? (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {disputes.map((dispute) => (
              <div key={dispute.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {dispute.reason || 'Dispute'}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDateTime(dispute.created_at)}
                    </span>
                    <StatusBadge status={dispute.status} />
                  </div>
                </div>
                {dispute.description && (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {dispute.description}
                  </p>
                )}
                {dispute.response && (
                  <div
                    className="mt-3 p-3 rounded-lg"
                    style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.12)' }}
                  >
                    <p className="text-xs font-semibold mb-1" style={{ color: '#818cf8' }}>Response:</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {dispute.response}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={AlertTriangle}
            message="No disputes"
            description="No disputes have been raised for this bill."
          />
        )}
      </div>

      {/* ============ Payment Modal ============ */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Make Payment">
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Amount (Rs) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }}>
                <DollarSign size={17} />
              </div>
              <input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                className="input-field pl-11"
                placeholder="Enter amount"
                step="0.01"
                min="0"
                max={remainingAmount || undefined}
              />
            </div>
            {remainingAmount > 0 && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Remaining: Rs {remainingAmount.toLocaleString()}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Payment Method
            </label>
            <select
              value={paymentForm.payment_method}
              onChange={(e) => setPaymentForm((p) => ({ ...p, payment_method: e.target.value }))}
              className="input-field appearance-none"
            >
              <option value="online">Online Transfer</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Transaction ID */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Transaction ID
            </label>
            <input
              type="text"
              value={paymentForm.transaction_id}
              onChange={(e) => setPaymentForm((p) => ({ ...p, transaction_id: e.target.value }))}
              className="input-field"
              placeholder="Transaction ID / Reference"
            />
          </div>

          {/* Receipt upload */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Receipt (optional)
            </label>
            <div
              className="relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
              style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px dashed var(--color-border)' }}
              onClick={() => document.getElementById('receipt-input').click()}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            >
              <Upload size={18} style={{ color: 'var(--color-text-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {paymentForm.receipt ? paymentForm.receipt.name : 'Click to upload receipt'}
              </span>
              <input
                id="receipt-input"
                type="file"
                className="hidden"
                accept="image/*,.pdf"
                onChange={(e) => setPaymentForm((p) => ({ ...p, receipt: e.target.files[0] || null }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={paymentSubmitting}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {paymentSubmitting ? <LoadingSpinner size="sm" /> : <Send size={16} />}
              {paymentSubmitting ? 'Submitting...' : 'Submit Payment'}
            </button>
          </div>
        </form>

        <style>{`
          select option {
            background: #1e293b;
            color: #f1f5f9;
          }
        `}</style>
      </Modal>

      {/* ============ Dispute Modal ============ */}
      <Modal isOpen={showDisputeModal} onClose={() => setShowDisputeModal(false)} title="Raise Dispute">
        <form onSubmit={handleDisputeSubmit} className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Please explain why you believe this bill is incorrect. Your dispute will be reviewed by the contractor and warden.
          </p>

          {/* Dispute Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Dispute Type <span style={{ color: '#f87171' }}>*</span>
            </label>
            <select
              value={disputeForm.dispute_type}
              onChange={(e) => setDisputeForm((p) => ({ ...p, dispute_type: e.target.value }))}
              className="input-field appearance-none"
            >
              <option value="billing">Billing</option>
              <option value="attendance">Attendance</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Description <span style={{ color: '#f87171' }}>*</span>
            </label>
            <textarea
              value={disputeForm.description}
              onChange={(e) => setDisputeForm((p) => ({ ...p, description: e.target.value }))}
              className="input-field"
              rows={4}
              placeholder="Describe the issue in detail..."
              style={{ resize: 'vertical', minHeight: '100px' }}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button type="button" onClick={() => setShowDisputeModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={disputeSubmitting}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {disputeSubmitting ? <LoadingSpinner size="sm" /> : <AlertTriangle size={16} />}
              {disputeSubmitting ? 'Submitting...' : 'Raise Dispute'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ---- Helper component for bill detail items ---- */
const DetailItem = ({ icon: Icon, label, value, valueColor }) => (
  <div className="flex items-start gap-2.5">
    <div className="p-1.5 rounded-lg mt-0.5" style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
      <Icon size={14} style={{ color: '#818cf8' }} />
    </div>
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: valueColor || 'var(--color-text-primary)' }}>
        {value}
      </p>
    </div>
  </div>
);

export default BillDetail;
