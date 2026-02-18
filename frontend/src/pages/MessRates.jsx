import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { messRatesAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import {
  DollarSign, Plus, Edit3, CheckCircle, Calendar, TrendingUp, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MessRates = () => {
  const { user } = useAuth();
  const [rates, setRates] = useState([]);
  const [activeRate, setActiveRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    month: new Date().getMonth() + 1,
    year: currentYear,
    lunch_rate: '',
    dinner_rate: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const [ratesRes, activeRes] = await Promise.all([
        messRatesAPI.list(),
        messRatesAPI.getActive().catch(() => ({ data: null })),
      ]);
      const ratesList = ratesRes.data?.results || ratesRes.data || [];
      setRates(ratesList);
      setActiveRate(activeRes.data);
    } catch (err) {
      console.error('Failed to fetch mess rates:', err);
      toast.error('Failed to load mess rates.');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.month) errs.month = 'Month is required';
    if (!form.year) errs.year = 'Year is required';
    if (!form.lunch_rate || isNaN(form.lunch_rate) || Number(form.lunch_rate) <= 0) {
      errs.lunch_rate = 'Enter a valid lunch rate';
    }
    if (!form.dinner_rate || isNaN(form.dinner_rate) || Number(form.dinner_rate) <= 0) {
      errs.dinner_rate = 'Enter a valid dinner rate';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        month: Number(form.month),
        year: Number(form.year),
        lunch_rate: Number(form.lunch_rate),
        dinner_rate: Number(form.dinner_rate),
      };
      if (editingRate) {
        await messRatesAPI.update(editingRate.id, payload);
        toast.success('Mess rate updated successfully!');
      } else {
        await messRatesAPI.create(payload);
        toast.success('Mess rate created successfully!');
      }
      setShowModal(false);
      setEditingRate(null);
      setForm({ month: new Date().getMonth() + 1, year: currentYear, lunch_rate: '', dinner_rate: '' });
      setErrors({});
      await fetchRates();
    } catch (err) {
      console.error('Failed to save mess rate:', err);
      const msg = err.response?.data?.detail || err.response?.data?.message || Object.values(err.response?.data || {}).flat()[0] || 'Failed to save mess rate.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (rate) => {
    setEditingRate(rate);
    setForm({
      month: rate.month,
      year: rate.year,
      lunch_rate: rate.lunch_rate,
      dinner_rate: rate.dinner_rate,
    });
    setErrors({});
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingRate(null);
    setForm({ month: new Date().getMonth() + 1, year: currentYear, daily_rate: '' });
    setErrors({});
    setShowModal(true);
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Mess Rates</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Manage daily mess rates for billing
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> New Rate
        </button>
      </div>

      {/* Active Rate Card */}
      {activeRate && (
        <div
          className="rounded-2xl p-6 mb-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.08))',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.1)',
          }}
        >
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 blur-[50px]" style={{ background: '#6366f1' }} />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                }}
              >
                <DollarSign size={24} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Current Active Rate
                  </p>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
                  >
                    <CheckCircle size={10} /> Active
                  </span>
                </div>
                <p className="text-3xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                  Rs {Number(activeRate.lunch_rate).toLocaleString()}
                  <span className="text-base font-normal ml-1" style={{ color: 'var(--color-text-secondary)' }}>/lunch</span>
                  <span className="text-base font-normal mx-2" style={{ color: 'var(--color-text-secondary)' }}>+</span>
                  Rs {Number(activeRate.dinner_rate).toLocaleString()}
                  <span className="text-base font-normal ml-1" style={{ color: 'var(--color-text-secondary)' }}>/dinner</span>
                </p>
              </div>
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <p>{monthNames[(activeRate.month || 1) - 1]} {activeRate.year}</p>
            </div>
          </div>
        </div>
      )}

      {/* Rates history table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Rate History
          </h2>
        </div>

        {rates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Month / Year</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Lunch Rate</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Dinner Rate</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => {
                  const isActive = activeRate && activeRate.id === rate.id;
                  return (
                    <tr key={rate.id} className="table-row">
                      <td className="px-5 py-3.5 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        <div className="flex items-center gap-2">
                          <Calendar size={14} style={{ color: 'var(--color-text-secondary)' }} />
                          {monthNames[(rate.month || 1) - 1]} {rate.year}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-semibold" style={{ color: '#22d3ee' }}>
                          Rs {Number(rate.lunch_rate).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
                          Rs {Number(rate.dinner_rate).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {isActive ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
                          >
                            <CheckCircle size={10} /> Active
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }}
                          >
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => openEdit(rate)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: 'var(--color-text-secondary)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#818cf8'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                        >
                          <Edit3 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={DollarSign}
            message="No mess rates defined"
            description="Create your first mess rate to start generating bills."
            action={
              <button onClick={openCreate} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Create Rate
              </button>
            }
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingRate(null); }}
        title={editingRate ? 'Edit Mess Rate' : 'Create New Mess Rate'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Month */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Month <span style={{ color: '#f87171' }}>*</span>
            </label>
            <select
              value={form.month}
              onChange={handleChange('month')}
              className="input-field appearance-none"
              style={errors.month ? { borderColor: '#ef4444' } : {}}
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
            {errors.month && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.month}</p>}
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Year <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="number"
              value={form.year}
              onChange={handleChange('year')}
              className="input-field"
              min={2020}
              max={2100}
              style={errors.year ? { borderColor: '#ef4444' } : {}}
            />
            {errors.year && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.year}</p>}
          </div>

          {/* Lunch Rate */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Lunch Rate (Rs) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }}>
                <DollarSign size={17} />
              </div>
              <input
                type="number"
                value={form.lunch_rate}
                onChange={handleChange('lunch_rate')}
                className="input-field pl-11"
                placeholder="e.g., 60"
                step="0.01"
                min="0"
                style={errors.lunch_rate ? { borderColor: '#ef4444' } : {}}
              />
            </div>
            {errors.lunch_rate && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.lunch_rate}</p>}
          </div>

          {/* Dinner Rate */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Dinner Rate (Rs) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }}>
                <DollarSign size={17} />
              </div>
              <input
                type="number"
                value={form.dinner_rate}
                onChange={handleChange('dinner_rate')}
                className="input-field pl-11"
                placeholder="e.g., 60"
                step="0.01"
                min="0"
                style={errors.dinner_rate ? { borderColor: '#ef4444' } : {}}
              />
            </div>
            {errors.dinner_rate && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.dinner_rate}</p>}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowModal(false); setEditingRate(null); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <LoadingSpinner size="sm" /> : <Save size={16} />}
              {saving ? 'Saving...' : editingRate ? 'Update Rate' : 'Create Rate'}
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
    </div>
  );
};

export default MessRates;
