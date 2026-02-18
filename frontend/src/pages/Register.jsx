import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Lock, User, Eye, EyeOff, Mail, Phone, UtensilsCrossed,
  ArrowRight, Building, Hash, GraduationCap, ChevronDown,
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const InputField = ({ label, field, icon: Icon, type = 'text', placeholder, required = false, autoComplete, value, onChange, error }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
      {label} {required && <span style={{ color: '#f87171' }}>*</span>}
    </label>
    <div className="relative">
      <div
        className="absolute left-3.5 top-1/2 -translate-y-1/2"
        style={{ color: error ? '#f87171' : 'var(--color-text-secondary)' }}
      >
        <Icon size={17} />
      </div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="input-field pl-11"
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={error ? { borderColor: '#ef4444' } : {}}
      />
    </div>
    {error && (
      <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>
    )}
  </div>
);

const Register = () => {
  const { register, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
    role: 'student',
    phone: '',
    enrollment_number: '',
    hostel: '',
    room_number: '',
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = 'Username is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.first_name.trim()) errs.first_name = 'First name is required';
    if (!form.last_name.trim()) errs.last_name = 'Last name is required';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (!form.password_confirm) errs.password_confirm = 'Please confirm your password';
    else if (form.password !== form.password_confirm) errs.password_confirm = 'Passwords do not match';
    if (!form.role) errs.role = 'Role is required';
    if (form.role === 'student' && !form.enrollment_number.trim()) {
      errs.enrollment_number = 'Enrollment number is required for students';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors in the form.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        password: form.password,
        password_confirm: form.password_confirm,
        role: form.role,
      };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.role === 'student') {
        payload.enrollment_number = form.enrollment_number.trim();
      }
      if (form.hostel.trim()) payload.hostel = form.hostel.trim();
      if (form.room_number.trim()) payload.room_number = form.room_number.trim();

      const userData = await register(payload);
      if (userData) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch {
      // toast is handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0f172a] py-8">
      {/* Animated gradient orbs */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-[120px]"
        style={{
          background: 'radial-gradient(circle, #6366f1, transparent 70%)',
          top: '-10%',
          left: '-10%',
          animation: 'orbFloat1 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
        style={{
          background: 'radial-gradient(circle, #8b5cf6, transparent 70%)',
          bottom: '-5%',
          right: '-5%',
          animation: 'orbFloat2 10s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[350px] h-[350px] rounded-full opacity-10 blur-[80px]"
        style={{
          background: 'radial-gradient(circle, #06b6d4, transparent 70%)',
          top: '40%',
          left: '65%',
          animation: 'orbFloat3 12s ease-in-out infinite',
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Register Card */}
      <div
        className="relative z-10 w-full max-w-xl mx-4"
        style={{ animation: 'cardEntry 0.6s ease-out' }}
      >
        <div
          className="glass-card p-8"
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), 0 0 120px rgba(99, 102, 241, 0.07)',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
              }}
            >
              <UtensilsCrossed size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Create Account</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Join the Mess Billing System
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row: First + Last name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="First Name" field="first_name" icon={User} placeholder="John" required autoComplete="given-name" value={form.first_name} onChange={handleChange('first_name')} error={errors.first_name} />
              <InputField label="Last Name" field="last_name" icon={User} placeholder="Doe" required autoComplete="family-name" value={form.last_name} onChange={handleChange('last_name')} error={errors.last_name} />
            </div>

            {/* Username + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Username" field="username" icon={User} placeholder="johndoe" required autoComplete="username" value={form.username} onChange={handleChange('username')} error={errors.username} />
              <InputField label="Email" field="email" icon={Mail} type="email" placeholder="john@example.com" required autoComplete="email" value={form.email} onChange={handleChange('email')} error={errors.email} />
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Role <span style={{ color: '#f87171' }}>*</span>
              </label>
              <div className="relative">
                <div
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <GraduationCap size={17} />
                </div>
                <select
                  value={form.role}
                  onChange={handleChange('role')}
                  className="input-field pl-11 pr-10 appearance-none cursor-pointer"
                >
                  <option value="student">Student</option>
                  <option value="contractor">Contractor</option>
                  <option value="warden">Warden</option>
                </select>
                <div
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <ChevronDown size={17} />
                </div>
              </div>
              {errors.role && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.role}</p>
              )}
            </div>

            {/* Conditional: Enrollment number for students */}
            {form.role === 'student' && (
              <div style={{ animation: 'slideIn 0.3s ease-out' }}>
                <InputField
                  label="Enrollment Number"
                  field="enrollment_number"
                  icon={Hash}
                  placeholder="ENR-2024-001"
                  required
                  value={form.enrollment_number}
                  onChange={handleChange('enrollment_number')}
                  error={errors.enrollment_number}
                />
              </div>
            )}

            {/* Hostel + Room  */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Hostel" field="hostel" icon={Building} placeholder="Hostel A" value={form.hostel} onChange={handleChange('hostel')} error={errors.hostel} />
              <InputField label="Room Number" field="room_number" icon={Hash} placeholder="101" value={form.room_number} onChange={handleChange('room_number')} error={errors.room_number} />
            </div>

            {/* Phone */}
            <InputField label="Phone" field="phone" icon={Phone} type="tel" placeholder="+91 9876543210" autoComplete="tel" value={form.phone} onChange={handleChange('phone')} error={errors.phone} />

            {/* Password + Confirm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Password <span style={{ color: '#f87171' }}>*</span>
                </label>
                <div className="relative">
                  <div
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: errors.password ? '#f87171' : 'var(--color-text-secondary)' }}
                  >
                    <Lock size={17} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange('password')}
                    className="input-field pl-11 pr-11"
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    style={errors.password ? { borderColor: '#ef4444' } : {}}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Confirm Password <span style={{ color: '#f87171' }}>*</span>
                </label>
                <div className="relative">
                  <div
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: errors.password_confirm ? '#f87171' : 'var(--color-text-secondary)' }}
                  >
                    <Lock size={17} />
                  </div>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={form.password_confirm}
                    onChange={handleChange('password_confirm')}
                    className="input-field pl-11 pr-11"
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    style={errors.password_confirm ? { borderColor: '#ef4444' } : {}}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password_confirm && (
                  <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.password_confirm}</p>
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base mt-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-5 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold transition-colors"
                style={{ color: '#818cf8' }}
                onMouseEnter={(e) => (e.target.style.color = '#a5b4fc')}
                onMouseLeave={(e) => (e.target.style.color = '#818cf8')}
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          className="h-1 mx-8 rounded-b-full"
          style={{
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)',
            opacity: 0.6,
          }}
        />
      </div>

      <style>{`
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 20px) scale(1.1); }
          66% { transform: translate(20px, -40px) scale(0.9); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 30px) scale(1.08); }
        }
        @keyframes cardEntry {
          from { opacity: 0; transform: translateY(30px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        select option {
          background: #1e293b;
          color: #f1f5f9;
        }
      `}</style>
    </div>
  );
};

export default Register;
