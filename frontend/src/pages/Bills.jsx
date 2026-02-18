import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { billsAPI, billingCyclesAPI } from '../services/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import {
  Receipt, Filter, Eye, FileText, Calendar, ChevronDown, Zap, RefreshCw,
  Search, Download, Edit, DollarSign, Clock, AlertTriangle, CheckCircle,
  TrendingUp, Lock, AlertCircle, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

const Bills = () => {
  const { isStudent, isContractor, isWarden, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenModal, setShowGenModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, count: 0 });

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [filters, setFilters] = useState({
    month: currentMonth.toString(),
    year: currentYear.toString(),
    status: '',
    search: '',
  });

  const [genForm, setGenForm] = useState({
    month: currentMonth,
    year: currentYear,
  });

  const [exporting, setExporting] = useState(false);

  // Fetch bills summary
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params = {};
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;
      let response;
      // Use user.role directly to avoid stale isStudent value
      const userIsStudent = user?.role === 'student';
      if (userIsStudent) {
        response = await billsAPI.getMyBillSummary();
      } else {
        response = await billsAPI.summary(params);
      }
      setSummary(response.data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [filters.month, filters.year, user]);

  useEffect(() => {
    // Wait for auth to load before fetching
    if (!authLoading && user) {
      fetchBills();
      fetchSummary();
    }
  }, [filters.month, filters.year, filters.status, authLoading, user, isStudent]);

  const fetchBills = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page };
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;

      let response;
      // Use user.role directly to avoid stale isStudent value
      const userIsStudent = user?.role === 'student';
      console.log('[Bills] Fetching with userIsStudent:', userIsStudent, 'user.role:', user?.role);
      if (userIsStudent) {
        response = await billsAPI.getMyBills(params);
      } else {
        response = await billsAPI.list(params);
      }
      
      // Handle paginated response
      if (response.data?.results) {
        setBills(response.data.results);
        setPagination({
          page: page,
          totalPages: Math.ceil(response.data.count / 20),
          count: response.data.count,
        });
      } else {
        setBills(response.data || []);
        setPagination({ page: 1, totalPages: 1, count: (response.data || []).length });
      }
    } catch (err) {
      console.error('Failed to fetch bills:', err);
      toast.error('Failed to load bills.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchBills();
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchBills();
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;
      if (filters.status) params.status = filters.status;

      const response = await billsAPI.export(params);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bills_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Bills exported successfully!');
    } catch (err) {
      console.error('Failed to export bills:', err);
      toast.error('Failed to export bills.');
    } finally {
      setExporting(false);
    }
  };

  // Fetch preview when opening generate modal
  const handleOpenGenModal = async () => {
    setShowGenModal(true);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const response = await billsAPI.preview({
        month: Number(genForm.month),
        year: Number(genForm.year),
      });
      setPreview(response.data);
    } catch (err) {
      console.error('Failed to fetch preview:', err);
      const errorData = err.response?.data;
      setPreview({
        can_generate: false,
        reason: errorData?.reason || errorData?.detail || 'Failed to fetch preview',
        billing_cycle: errorData?.billing_cycle,
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Update preview when month/year changes in modal
  const handleGenFormChange = async (field, value) => {
    const newForm = { ...genForm, [field]: value };
    setGenForm(newForm);
    
    setPreviewLoading(true);
    try {
      const response = await billsAPI.preview({
        month: Number(newForm.month),
        year: Number(newForm.year),
      });
      setPreview(response.data);
    } catch (err) {
      const errorData = err.response?.data;
      setPreview({
        can_generate: false,
        reason: errorData?.reason || errorData?.detail || 'Failed to fetch preview',
        billing_cycle: errorData?.billing_cycle,
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!preview?.can_generate) {
      toast.error(preview?.reason || 'Cannot generate bills for this period.');
      return;
    }
    setGenerating(true);
    try {
      const response = await billsAPI.generate({
        month: Number(genForm.month),
        year: Number(genForm.year),
      });
      toast.success(response.data?.detail || 'Bills generated successfully!');
      setShowGenModal(false);
      setPreview(null);
      await fetchBills();
      await fetchSummary();
    } catch (err) {
      console.error('Failed to generate bills:', err);
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to generate bills.';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleFilterChange = (field) => (e) => {
    setFilters((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const clearFilters = () => {
    setFilters({ month: currentMonth.toString(), year: currentYear.toString(), status: '', search: '' });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'generated', label: 'Generated' },
    { value: 'pending', label: 'Pending' },
    { value: 'partially_paid', label: 'Partially Paid' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'disputed', label: 'Disputed' },
  ];

  const columns = [
    // Serial number column (for non-students) - Fixed with pagination offset
    ...(isStudent
      ? []
      : [
          {
            key: 'serial_no',
            label: 'S.No',
            sortable: false,
            render: (_, row) => {
              // Calculate serial number based on row position in bills array
              const indexInPage = bills.findIndex(b => b.id === row.id);
              const serialNo = ((pagination.page - 1) * 20) + (indexInPage >= 0 ? indexInPage : 0) + 1;
              return (
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {serialNo}
                </span>
              );
            },
          },
          {
            key: 'student_enrollment',
            label: 'Roll No',
            render: (val) => (
              <span className="text-sm font-medium" style={{ color: '#a5b4fc' }}>
                {val || '-'}
              </span>
            ),
          },
          {
            key: 'student_name',
            label: 'Student Name',
            render: (val, row) => {
              const name = (val && val.trim()) || row.student_username || row.student_enrollment || 'Unknown';
              return (
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                      color: '#a5b4fc',
                    }}
                  >
                    {(name[0] || '?').toUpperCase()}
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {name}
                  </span>
                </div>
              );
            },
          },
        ]),
    {
      key: 'month',
      label: 'Period',
      render: (val, row) => (
        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {monthNames[(row.month || 1) - 1]} {row.year}
        </span>
      ),
    },
    // Due Date column for students
    ...(isStudent
      ? [
          {
            key: 'due_date',
            label: 'Due Date',
            render: (val, row) => {
              const dueDate = val ? new Date(val) : null;
              const isOverdue = dueDate && dueDate < new Date() && row.status !== 'paid';
              const daysUntilDue = dueDate ? Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-sm"
                    style={{
                      color: isOverdue ? '#f87171' : daysUntilDue !== null && daysUntilDue <= 7 ? '#fbbf24' : 'var(--color-text-secondary)',
                    }}
                  >
                    {val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                  </span>
                  {isOverdue && <AlertTriangle size={14} style={{ color: '#f87171' }} />}
                </div>
              );
            },
          },
        ]
      : []),
    {
      key: 'days_present',
      label: 'Days Present',
      render: (val, row) => (
        <span className="text-sm font-medium" style={{ color: '#22d3ee' }}>
          {val ?? Math.max(row.lunch_days || 0, row.dinner_days || 0)}
        </span>
      ),
    },
    {
      key: 'rate_per_day',
      label: 'Rate/Day',
      render: (val, row) => {
        const rate = val || (Number(row.lunch_rate || 0) + Number(row.dinner_rate || 0));
        return (
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Rs {Number(rate).toLocaleString()}
          </span>
        );
      },
    },
    {
      key: 'total_amount',
      label: 'Total Amount',
      render: (val) => (
        <span className="text-sm font-semibold" style={{ color: '#a5b4fc' }}>
          Rs {Number(val || 0).toLocaleString()}
        </span>
      ),
    },
    // Remaining Amount column for students
    ...(isStudent
      ? [
          {
            key: 'remaining_amount',
            label: 'Remaining',
            render: (val, row) => {
              const remaining = val ?? (Number(row.total_amount || 0) - Number(row.paid_amount || 0));
              return (
                <span
                  className="text-sm font-semibold"
                  style={{ color: remaining > 0 ? '#fbbf24' : '#34d399' }}
                >
                  Rs {Number(remaining).toLocaleString()}
                </span>
              );
            },
          },
          {
            key: 'payment_progress',
            label: 'Progress',
            render: (val, row) => {
              const progress = val ?? (row.total_amount > 0
                ? Math.round(((row.paid_amount || 0) / row.total_amount) * 100)
                : 0);
              const progressColor = progress >= 100 ? '#34d399' : progress >= 50 ? '#22d3ee' : '#f59e0b';
              return (
                <div className="flex items-center gap-2 min-w-[100px]">
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(51, 65, 85, 0.5)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(progress, 100)}%`, background: progressColor }}
                    />
                  </div>
                  <span className="text-xs font-medium min-w-[32px]" style={{ color: progressColor }}>
                    {progress}%
                  </span>
                </div>
              );
            },
          },
        ]
      : []),
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (val, row) => {
        // For students, show overdue indicator
        if (isStudent && row.is_overdue) {
          return (
            <div className="flex items-center gap-1.5">
              <StatusBadge status="overdue" />
            </div>
          );
        }
        return <StatusBadge status={val} />;
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/bills/${row.id}`); }}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#818cf8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            title="View Details"
          >
            <Eye size={16} />
          </button>
          {isStudent && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(row); }}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.color = '#34d399'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
              title="Download Invoice"
            >
              <Download size={16} />
            </button>
          )}
          {(isContractor || isWarden) && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/bills/${row.id}`); }}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'; e.currentTarget.style.color = '#fbbf24'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
              title="Edit"
            >
              <Edit size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Download invoice for a specific bill
  const handleDownloadInvoice = async (bill) => {
    try {
      toast.loading('Generating invoice...', { id: 'invoice' });
      // Generate a simple text-based invoice
      const invoiceContent = `
=====================================
         MESS BILL INVOICE
=====================================

Bill ID: ${bill.id}
Period: ${monthNames[(bill.month || 1) - 1]} ${bill.year}
Generated: ${new Date().toLocaleDateString('en-IN')}

-------------------------------------
DETAILS
-------------------------------------
Lunch Days: ${bill.lunch_days || 0}
Dinner Days: ${bill.dinner_days || 0}
Lunch Rate: Rs ${Number(bill.lunch_rate || 0).toLocaleString()}
Dinner Rate: Rs ${Number(bill.dinner_rate || 0).toLocaleString()}

-------------------------------------
SUMMARY
-------------------------------------
Total Amount: Rs ${Number(bill.total_amount || 0).toLocaleString()}
Paid Amount: Rs ${Number(bill.paid_amount || 0).toLocaleString()}
Remaining: Rs ${Number((bill.total_amount || 0) - (bill.paid_amount || 0)).toLocaleString()}

Status: ${(bill.status || 'pending').toUpperCase()}
Due Date: ${bill.due_date ? new Date(bill.due_date).toLocaleDateString('en-IN') : 'N/A'}

=====================================
      Thank you for your payment
=====================================
      `;
      const blob = new Blob([invoiceContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${bill.month}_${bill.year}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Invoice downloaded!', { id: 'invoice' });
    } catch (err) {
      console.error('Failed to download invoice:', err);
      toast.error('Failed to download invoice.', { id: 'invoice' });
    }
  };

  const hasActiveFilters = filters.month || filters.year || filters.status || filters.search;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">
            {isStudent ? 'My Bills' : 'Bills Management'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {isStudent ? 'View and manage your mess bills' : 'View, generate, and manage mess bills'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(isContractor || isWarden) && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-secondary flex items-center gap-2"
            >
              {exporting ? <LoadingSpinner size="sm" /> : <Download size={18} />}
              Export CSV
            </button>
          )}
          {isContractor && (
            <button onClick={handleOpenGenModal} className="btn-primary flex items-center gap-2">
              <Zap size={18} /> Generate Bills
            </button>
          )}
        </div>
      </div>

      {/* Summary Section - For Students */}
      {isStudent && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {/* Current Year Paid */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                <CheckCircle size={20} style={{ color: '#34d399' }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>This Year Paid</p>
                {summaryLoading ? (
                  <div className="h-6 w-20 rounded animate-pulse" style={{ background: 'rgba(16, 185, 129, 0.1)' }} />
                ) : (
                  <p className="text-lg font-bold" style={{ color: '#34d399' }}>
                    Rs {Number(summary?.current_year_paid || 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Total Pending */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                <Clock size={20} style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total Pending</p>
                {summaryLoading ? (
                  <div className="h-6 w-20 rounded animate-pulse" style={{ background: 'rgba(245, 158, 11, 0.1)' }} />
                ) : (
                  <p className="text-lg font-bold" style={{ color: '#fbbf24' }}>
                    Rs {Number(summary?.total_pending || 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Average Monthly Bill */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                <TrendingUp size={20} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Avg Monthly</p>
                {summaryLoading ? (
                  <div className="h-6 w-20 rounded animate-pulse" style={{ background: 'rgba(99, 102, 241, 0.1)' }} />
                ) : (
                  <p className="text-lg font-bold" style={{ color: '#818cf8' }}>
                    Rs {Number(summary?.avg_monthly_bill || 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Overdue Count */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: summary?.overdue_count > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(51, 65, 85, 0.3)' }}>
                <AlertTriangle size={20} style={{ color: summary?.overdue_count > 0 ? '#f87171' : '#64748b' }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Overdue Bills</p>
                {summaryLoading ? (
                  <div className="h-6 w-10 rounded animate-pulse" style={{ background: 'rgba(239, 68, 68, 0.1)' }} />
                ) : (
                  <p
                    className="text-lg font-bold"
                    style={{ color: summary?.overdue_count > 0 ? '#f87171' : 'var(--color-text-primary)' }}
                  >
                    {summary?.overdue_count || 0}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Section - For Contractors/Wardens */}
      {!isStudent && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {/* Total Revenue */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                <DollarSign size={20} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total Revenue</p>
                {summaryLoading ? (
                  <div className="h-6 w-20 rounded animate-pulse" style={{ background: 'rgba(99, 102, 241, 0.1)' }} />
                ) : (
                  <p className="text-lg font-bold" style={{ color: '#818cf8' }}>
                    Rs {Number(summary?.total_revenue || 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Total Paid */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                <CheckCircle size={20} style={{ color: '#34d399' }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total Paid</p>
                {summaryLoading ? (
                  <div className="h-6 w-20 rounded animate-pulse" style={{ background: 'rgba(16, 185, 129, 0.1)' }} />
                ) : (
                  <p className="text-lg font-bold" style={{ color: '#34d399' }}>
                    Rs {Number(summary?.paid_amount || 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Pending */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                <Clock size={20} style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Pending</p>
                {summaryLoading ? (
                  <div className="h-6 w-20 rounded animate-pulse" style={{ background: 'rgba(245, 158, 11, 0.1)' }} />
                ) : (
                  <p className="text-lg font-bold" style={{ color: '#fbbf24' }}>
                    Rs {Number(summary?.pending_amount || 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Overdue */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
                <AlertTriangle size={20} style={{ color: '#f87171' }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Overdue</p>
                {summaryLoading ? (
                  <div className="h-6 w-20 rounded animate-pulse" style={{ background: 'rgba(239, 68, 68, 0.1)' }} />
                ) : (
                  <p className="text-lg font-bold" style={{ color: '#f87171' }}>
                    Rs {Number(summary?.overdue_amount || 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            {summary?.billing_cycle && (
              <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-1">
                  {summary.billing_cycle.is_locked && <Lock size={12} style={{ color: '#94a3b8' }} />}
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Cycle: {summary.billing_cycle.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter bar */}
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
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  onKeyPress={handleSearchKeyPress}
                  placeholder="Search roll no / name..."
                  className="input-field pl-9 text-sm"
                  style={{ width: '200px' }}
                />
              </div>
            )}

            {/* Month filter */}
            <div className="relative">
              <select
                value={filters.month}
                onChange={handleFilterChange('month')}
                className="input-field appearance-none pr-8 text-sm"
                style={{ minWidth: '140px' }}
              >
                <option value="">All Months</option>
                {monthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>{name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
            </div>

            {/* Year filter */}
            <input
              type="number"
              value={filters.year}
              onChange={handleFilterChange('year')}
              className="input-field text-sm"
              placeholder="Year"
              min={2020}
              max={2100}
              style={{ width: '100px' }}
            />

            {/* Status filter */}
            <div className="relative">
              <select
                value={filters.status}
                onChange={handleFilterChange('status')}
                className="input-field appearance-none pr-8 text-sm"
                style={{ minWidth: '150px' }}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-medium flex items-center gap-1 px-3 py-2 rounded-lg transition-colors"
                style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.08)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
              >
                <RefreshCw size={12} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bills table */}
      <div className="glass-card overflow-hidden">
        <DataTable
          columns={columns}
          data={bills}
          loading={loading}
          emptyMessage="No bills found"
          emptyIcon={Receipt}
          onRowClick={(row) => navigate(`/bills/${row.id}`)}
          pageSize={10}
        />
      </div>

      {/* Generate Bills Modal with Preview */}
      <Modal
        isOpen={showGenModal}
        onClose={() => { setShowGenModal(false); setPreview(null); }}
        title="Generate Bills"
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            This will generate bills for all students based on their attendance records and the active mess rate for the selected period.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Month */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Month
              </label>
              <select
                value={genForm.month}
                onChange={(e) => handleGenFormChange('month', e.target.value)}
                className="input-field appearance-none"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>{name}</option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Year
              </label>
              <input
                type="number"
                value={genForm.year}
                onChange={(e) => handleGenFormChange('year', e.target.value)}
                className="input-field"
                min={2020}
                max={2100}
              />
            </div>
          </div>

          {/* Preview Section */}
          <div
            className="rounded-xl p-4 mt-4"
            style={{
              background: preview?.can_generate === false
                ? 'rgba(239, 68, 68, 0.08)'
                : 'rgba(99, 102, 241, 0.08)',
              border: `1px solid ${preview?.can_generate === false ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`,
            }}
          >
            {previewLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading preview...</span>
              </div>
            ) : preview ? (
              preview.can_generate ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Info size={16} style={{ color: '#818cf8' }} />
                    <span className="text-sm font-semibold" style={{ color: '#a5b4fc' }}>Bill Generation Preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Total Students</p>
                      <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{preview.student_count}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Estimated Revenue</p>
                      <p className="text-lg font-bold" style={{ color: '#34d399' }}>Rs {Number(preview.estimated_revenue).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Lunch Rate</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Rs {preview.lunch_rate}/day</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Dinner Rate</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Rs {preview.dinner_rate}/day</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Total Lunches</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{preview.total_lunch_days}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Total Dinners</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{preview.total_dinner_days}</p>
                    </div>
                  </div>
                  {preview.will_update && (
                    <div className="flex items-center gap-2 pt-2 mt-2 border-t" style={{ borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                      <AlertCircle size={14} style={{ color: '#fbbf24' }} />
                      <span className="text-xs" style={{ color: '#fbbf24' }}>
                        {preview.existing_bills} existing bills will be updated
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#f87171' }}>Cannot Generate Bills</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{preview.reason}</p>
                    {preview.billing_cycle && (
                      <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Billing cycle status: <span className="font-semibold">{preview.billing_cycle.status}</span>
                      </p>
                    )}
                  </div>
                </div>
              )
            ) : (
              <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-secondary)' }}>
                Select month and year to see preview
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button type="button" onClick={() => { setShowGenModal(false); setPreview(null); }} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating || previewLoading || !preview?.can_generate}
              className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generating ? <LoadingSpinner size="sm" /> : <Zap size={16} />}
              {generating ? 'Generating...' : 'Generate Bills'}
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

      <style>{`
        select option {
          background: #1e293b;
          color: #f1f5f9;
        }
      `}</style>
    </div>
  );
};

export default Bills;
