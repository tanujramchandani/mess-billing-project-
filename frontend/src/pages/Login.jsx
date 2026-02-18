import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, UtensilsCrossed, ArrowRight } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const Login = () => {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = 'Username is required';
    if (!form.password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login({ username: form.username.trim(), password: form.password });
      navigate('/dashboard', { replace: true });
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0f172a]">
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
          top: '50%',
          left: '60%',
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

      {/* Login Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4"
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
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
              }}
            >
              <UtensilsCrossed size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Mess Billing System</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Sign in to your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Username
              </label>
              <div className="relative">
                <div
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: errors.username ? '#f87171' : 'var(--color-text-secondary)' }}
                >
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={form.username}
                  onChange={handleChange('username')}
                  className="input-field pl-11"
                  placeholder="Enter your username"
                  autoComplete="username"
                  style={errors.username ? { borderColor: '#ef4444' } : {}}
                />
              </div>
              {errors.username && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.username}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Password
              </label>
              <div className="relative">
                <div
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: errors.password ? '#f87171' : 'var(--color-text-secondary)' }}
                >
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange('password')}
                  className="input-field pl-11 pr-11"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={errors.password ? { borderColor: '#ef4444' } : {}}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold transition-colors"
                style={{ color: '#818cf8' }}
                onMouseEnter={(e) => (e.target.style.color = '#a5b4fc')}
                onMouseLeave={(e) => (e.target.style.color = '#818cf8')}
              >
                Create Account
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
      `}</style>
    </div>
  );
};

export default Login;
