import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import { User, Mail, Phone, Hash, Building, DoorOpen, Save, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, updateUser } = useAuth();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    room_number: user?.room_number || '',
    hostel: user?.hostel || '',
  });
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUser(form);
      setEditing(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      await authAPI.changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      toast.success('Password changed successfully!');
      setShowPasswordForm(false);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Failed to change password.';
      if (data) {
        if (data.old_password) msg = Array.isArray(data.old_password) ? data.old_password[0] : data.old_password;
        else if (data.new_password) msg = Array.isArray(data.new_password) ? data.new_password[0] : data.new_password;
        else if (data.detail) msg = data.detail;
      }
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const infoFields = [
    { icon: User, label: 'Username', value: user.username },
    { icon: Mail, label: 'Email', value: user.email || '-' },
    { icon: Phone, label: 'Phone', value: user.phone || '-' },
    { icon: Hash, label: 'Enrollment No.', value: user.enrollment_number || '-', show: user.role === 'student' },
    { icon: Building, label: 'Hostel', value: user.hostel || '-' },
    { icon: DoorOpen, label: 'Room', value: user.room_number || '-' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Profile</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Manage your account information
          </p>
        </div>
        <StatusBadge status={user.role} />
      </div>

      {/* Profile card */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
              color: '#a5b4fc',
            }}
          >
            {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.username}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              @{user.username}
            </p>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>First Name</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Last Name</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Hostel</label>
                <input
                  type="text"
                  value={form.hostel}
                  onChange={(e) => setForm((p) => ({ ...p, hostel: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Room Number</label>
                <input
                  type="text"
                  value={form.room_number}
                  onChange={(e) => setForm((p) => ({ ...p, room_number: e.target.value }))}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {saving ? <LoadingSpinner size="sm" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {infoFields
                .filter((f) => f.show !== false)
                .map((field) => (
                  <div key={field.label} className="flex items-start gap-3">
                    <div className="p-2 rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                      <field.icon size={16} style={{ color: '#818cf8' }} />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                        {field.label}
                      </p>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {field.value}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setEditing(true)} className="btn-primary text-sm">
                Edit Profile
              </button>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Lock size={14} /> Change Password
              </button>
            </div>
          </>
        )}
      </div>

      {/* Password change form */}
      {showPasswordForm && (
        <div className="glass-card p-6">
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Change Password
          </h3>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Current Password</label>
              <input
                type="password"
                value={passwordForm.old_password}
                onChange={(e) => setPasswordForm((p) => ({ ...p, old_password: e.target.value }))}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>New Password</label>
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
                className="input-field"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirm_password: e.target.value }))}
                className="input-field"
                required
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={changingPassword} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {changingPassword ? <LoadingSpinner size="sm" /> : <Lock size={16} />}
                {changingPassword ? 'Changing...' : 'Change Password'}
              </button>
              <button
                type="button"
                onClick={() => { setShowPasswordForm(false); setPasswordForm({ old_password: '', new_password: '', confirm_password: '' }); }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Profile;
