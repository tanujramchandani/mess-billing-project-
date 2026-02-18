import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import {
  CalendarCheck, ChevronLeft, ChevronRight, CheckSquare, Square,
  Check, X, Calendar, TrendingUp, Users, Save, RefreshCw,
  Sun, Moon, Search, Eye, ArrowUpDown,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

/* ================================================================== */
/*  CONTRACTOR VIEW - Mark Attendance                                  */
/* ================================================================== */
const ContractorAttendance = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStudentsAndAttendance();
  }, [selectedDate]);

  const fetchStudentsAndAttendance = async () => {
    setLoading(true);
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        attendanceAPI.getStudents(),
        attendanceAPI.list({ date: selectedDate }),
      ]);

      const studentsList = studentsRes.data?.results || studentsRes.data || [];
      setStudents(studentsList);

      const records = attendanceRes.data?.results || attendanceRes.data || [];

      const attendanceMap = {};
      studentsList.forEach((s) => {
        const record = records.find(
          (r) => (r.student === s.id || r.student?.id === s.id)
        );
        attendanceMap[s.id] = {
          lunch: record ? !!record.lunch : false,
          dinner: record ? !!record.dinner : false,
        };
      });
      setAttendance(attendanceMap);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      toast.error('Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  const toggleLunch = (id) => {
    setAttendance((prev) => ({
      ...prev,
      [id]: { ...prev[id], lunch: !prev[id]?.lunch },
    }));
  };

  const toggleDinner = (id) => {
    setAttendance((prev) => ({
      ...prev,
      [id]: { ...prev[id], dinner: !prev[id]?.dinner },
    }));
  };

  const selectAllLunch = () => {
    setAttendance((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s.id] = { ...next[s.id], lunch: true };
      });
      return next;
    });
  };

  const selectAllDinner = () => {
    setAttendance((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s.id] = { ...next[s.id], dinner: true };
      });
      return next;
    });
  };

  const deselectAll = () => {
    const newAttendance = {};
    students.forEach((s) => {
      newAttendance[s.id] = { lunch: false, dinner: false };
    });
    setAttendance(newAttendance);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = students.map((s) => ({
        student_id: s.id,
        lunch: !!attendance[s.id]?.lunch,
        dinner: !!attendance[s.id]?.dinner,
      }));
      await attendanceAPI.markBulk({ date: selectedDate, students: entries });
      toast.success('Attendance saved successfully!');
      await fetchStudentsAndAttendance();
    } catch (err) {
      console.error('Failed to save attendance:', err);
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to save attendance.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const lunchCount = Object.values(attendance).filter((a) => a?.lunch).length;
  const dinnerCount = Object.values(attendance).filter((a) => a?.dinner).length;

  const getStudentStatus = (a) => {
    if (a?.lunch && a?.dinner) return 'both';
    if (a?.lunch) return 'lunch_only';
    if (a?.dinner) return 'dinner_only';
    return 'absent';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Mark Attendance</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Record lunch and dinner attendance for students
          </p>
        </div>
      </div>

      {/* Date picker + stats */}
      <div className="glass-card p-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>
              <Calendar size={20} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field"
                max={format(new Date(), 'yyyy-MM-dd')}
                style={{ width: '180px' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Sun size={14} style={{ color: '#22d3ee' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Lunch: <span style={{ color: '#22d3ee' }}>{lunchCount}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Moon size={14} style={{ color: '#fbbf24' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Dinner: <span style={{ color: '#fbbf24' }}>{dinnerCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : students.length === 0 ? (
        <EmptyState icon={Users} message="No students found" description="There are no registered students to mark attendance for." />
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Toolbar */}
          <div
            className="flex items-center justify-between px-5 py-3 flex-wrap gap-2"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={selectAllLunch} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Sun size={14} /> All Lunch
              </button>
              <button onClick={selectAllDinner} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Moon size={14} /> All Dinner
              </button>
              <button onClick={deselectAll} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Square size={14} /> Clear All
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-60"
            >
              {saving ? <LoadingSpinner size="sm" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>

          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Student</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#22d3ee' }}>
                    <div className="flex items-center justify-center gap-1"><Sun size={14} /> Lunch</div>
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#fbbf24' }}>
                    <div className="flex items-center justify-center gap-1"><Moon size={14} /> Dinner</div>
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const a = attendance[student.id] || { lunch: false, dinner: false };
                  return (
                    <tr key={student.id} className="table-row">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                              color: '#a5b4fc',
                            }}
                          >
                            {(student.first_name?.[0] || student.username?.[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                              {student.first_name && student.last_name
                                ? `${student.first_name} ${student.last_name}`
                                : student.username}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                              {student.enrollment_number || student.email || `ID: ${student.id}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => toggleLunch(student.id)}
                          className="w-7 h-7 rounded-md flex items-center justify-center mx-auto transition-all duration-200"
                          style={{
                            background: a.lunch
                              ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
                              : 'rgba(51, 65, 85, 0.5)',
                            border: a.lunch ? 'none' : '1.5px solid #475569',
                          }}
                        >
                          {a.lunch && <Check size={14} className="text-white" />}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => toggleDinner(student.id)}
                          className="w-7 h-7 rounded-md flex items-center justify-center mx-auto transition-all duration-200"
                          style={{
                            background: a.dinner
                              ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                              : 'rgba(51, 65, 85, 0.5)',
                            border: a.dinner ? 'none' : '1.5px solid #475569',
                          }}
                        >
                          {a.dinner && <Check size={14} className="text-white" />}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <StatusBadge status={getStudentStatus(a)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/*  STUDENT / WARDEN VIEW - View Attendance                            */
/* ================================================================== */
const ViewAttendance = () => {
  const { isStudent, loading: authLoading, user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mealView, setMealView] = useState('combined'); // 'combined', 'lunch', 'dinner'

  useEffect(() => {
    // Wait for auth to load before fetching
    if (!authLoading && user) {
      fetchAttendance();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [month, year, isStudent, authLoading, user]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = { month, year };
      // Use user.role directly to avoid stale isStudent value
      const userIsStudent = user?.role === 'student';
      console.log('[Attendance] Fetching for userIsStudent:', userIsStudent, 'user.role:', user?.role);
      if (userIsStudent) {
        const recordsRes = await attendanceAPI.getMyAttendance(params);
        console.log('[Attendance] Student data received:', recordsRes.data);
        const recs = recordsRes.data?.records || [];
        setRecords(recs);
        setSummary(recordsRes.data?.summary || null);
      } else {
        const [recordsRes, summaryRes] = await Promise.all([
          attendanceAPI.list(params),
          attendanceAPI.getSummary(params),
        ]);
        const recs = recordsRes.data?.results || recordsRes.data || [];
        setRecords(recs);
        setSummary(summaryRes.data);
      }
    } catch (err) {
      console.error('[Attendance] Failed to fetch attendance:', err);
      toast.error('Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  };

  // Calendar grid - must be defined first as it's used below
  const calendarDays = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    const days = eachDayOfInterval({ start, end });
    const startPadding = getDay(start);

    const recordMap = {};
    records.forEach((r) => {
      const dateKey = typeof r.date === 'string' ? r.date : format(new Date(r.date), 'yyyy-MM-dd');
      recordMap[dateKey] = { lunch: !!r.lunch, dinner: !!r.dinner };
    });

    return { days, startPadding, recordMap };
  }, [month, year, records]);

  const lunchDays = summary?.lunch_days ?? records.filter((r) => r.lunch).length;
  const dinnerDays = summary?.dinner_days ?? records.filter((r) => r.dinner).length;
  const bothDays = summary?.both_days ?? records.filter((r) => r.lunch && r.dinner).length;
  const absentDays = summary?.absent_days ?? records.filter((r) => !r.lunch && !r.dinner).length;

  // Calculate attendance percentage
  const totalDaysInMonth = calendarDays.days.length;
  const totalMeals = totalDaysInMonth * 2; // Lunch + Dinner
  const attendedMeals = lunchDays + dinnerDays;
  const overallPercentage = totalMeals > 0 ? Math.round((attendedMeals / totalMeals) * 100) : 0;
  const lunchPercentage = totalDaysInMonth > 0 ? Math.round((lunchDays / totalDaysInMonth) * 100) : 0;
  const dinnerPercentage = totalDaysInMonth > 0 ? Math.round((dinnerDays / totalDaysInMonth) * 100) : 0;

  // Filter records based on meal view
  const filteredRecords = useMemo(() => {
    if (mealView === 'lunch') return records.filter(r => r.lunch);
    if (mealView === 'dinner') return records.filter(r => r.dinner);
    return records;
  }, [records, mealView]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">
            {isStudent ? 'My Attendance' : 'Attendance Records'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {isStudent ? 'Track your monthly attendance' : 'View attendance records'}
          </p>
        </div>
        {/* Overall Percentage Badge */}
        {isStudent && !loading && (
          <div
            className="px-4 py-2 rounded-xl flex items-center gap-2"
            style={{
              background: overallPercentage >= 75 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${overallPercentage >= 75 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            }}
          >
            <TrendingUp size={14} style={{ color: overallPercentage >= 75 ? '#34d399' : '#f87171' }} />
            <span className="text-sm font-semibold" style={{ color: overallPercentage >= 75 ? '#34d399' : '#f87171' }}>
              {overallPercentage}% Attendance
            </span>
          </div>
        )}
      </div>

      {/* Month / Year selector + Meal View Toggle */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Month Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 rounded-xl transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#a5b4fc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold min-w-[140px] text-center" style={{ color: 'var(--color-text-primary)' }}>
              {monthNames[month - 1]} {year}
            </h2>
            <button
              onClick={() => changeMonth(1)}
              className="p-2 rounded-xl transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#a5b4fc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Meal View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
            <button
              onClick={() => setMealView('combined')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mealView === 'combined' ? '' : 'hover:bg-white/5'}`}
              style={{
                background: mealView === 'combined' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                color: mealView === 'combined' ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              Combined
            </button>
            <button
              onClick={() => setMealView('lunch')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${mealView === 'lunch' ? '' : 'hover:bg-white/5'}`}
              style={{
                background: mealView === 'lunch' ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'transparent',
                color: mealView === 'lunch' ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              <Sun size={12} /> Lunch ({lunchPercentage}%)
            </button>
            <button
              onClick={() => setMealView('dinner')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${mealView === 'dinner' ? '' : 'hover:bg-white/5'}`}
              style={{
                background: mealView === 'dinner' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                color: mealView === 'dinner' ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              <Moon size={12} /> Dinner ({dinnerPercentage}%)
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
                  <Sun size={20} style={{ color: '#22d3ee' }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Lunch Days</p>
                  <p className="text-2xl font-bold" style={{ color: '#22d3ee' }}>{lunchDays}</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                  <Moon size={20} style={{ color: '#fbbf24' }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Dinner Days</p>
                  <p className="text-2xl font-bold" style={{ color: '#fbbf24' }}>{dinnerDays}</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                  <Check size={20} style={{ color: '#34d399' }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Both Meals</p>
                  <p className="text-2xl font-bold" style={{ color: '#34d399' }}>{bothDays}</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
                  <X size={20} style={{ color: '#f87171' }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Absent Days</p>
                  <p className="text-2xl font-bold" style={{ color: '#f87171' }}>{absentDays}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="glass-card p-5 mb-6">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Calendar View
            </h3>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {d}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty padding for start of month */}
              {Array.from({ length: calendarDays.startPadding }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {calendarDays.days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const record = calendarDays.recordMap[dateKey];
                const isToday = isSameDay(day, new Date());
                const dayName = format(day, 'EEEE');
                const fullDate = format(day, 'MMM dd, yyyy');

                // Generate tooltip text
                const tooltipParts = [fullDate, dayName];
                if (record?.lunch && record?.dinner) {
                  tooltipParts.push('✓ Lunch ✓ Dinner');
                } else if (record?.lunch) {
                  tooltipParts.push('✓ Lunch ✗ Dinner');
                } else if (record?.dinner) {
                  tooltipParts.push('✗ Lunch ✓ Dinner');
                } else {
                  tooltipParts.push('Absent');
                }
                const tooltipText = tooltipParts.join('\n');

                // Determine if should show based on mealView filter
                const showLunch = mealView === 'combined' || mealView === 'lunch';
                const showDinner = mealView === 'combined' || mealView === 'dinner';

                return (
                  <div
                    key={dateKey}
                    className="group relative flex flex-col items-center justify-center py-2 rounded-lg transition-all cursor-default"
                    style={{
                      background: isToday ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      border: isToday ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                    }}
                    title={tooltipText}
                  >
                    <span className="text-sm font-medium" style={{ color: isToday ? '#a5b4fc' : 'var(--color-text-primary)' }}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      {showLunch && (
                        <div
                          className="w-2 h-2 rounded-full transition-transform group-hover:scale-125"
                          style={{ background: record?.lunch ? '#06b6d4' : '#334155' }}
                        />
                      )}
                      {showDinner && (
                        <div
                          className="w-2 h-2 rounded-full transition-transform group-hover:scale-125"
                          style={{ background: record?.dinner ? '#f59e0b' : '#334155' }}
                        />
                      )}
                    </div>
                    {/* Tooltip popover on hover */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap"
                      style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                      <div className="font-medium">{fullDate}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                        <span style={{ color: record?.lunch ? '#22d3ee' : '#64748b' }}>L: {record?.lunch ? '✓' : '✗'}</span>
                        <span className="mx-1">|</span>
                        <span style={{ color: record?.dinner ? '#fbbf24' : '#64748b' }}>D: {record?.dinner ? '✓' : '✗'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#06b6d4' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Lunch</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Dinner</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#334155' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Not Taken</span>
              </div>
            </div>
          </div>

          {/* Records table */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Attendance Log
                {mealView !== 'combined' && (
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                    ({mealView === 'lunch' ? 'Lunch only' : 'Dinner only'})
                  </span>
                )}
              </h3>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
              </span>
            </div>
            {filteredRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Date</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Day</th>
                      {(mealView === 'combined' || mealView === 'lunch') && (
                        <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#22d3ee' }}>Lunch</th>
                      )}
                      {(mealView === 'combined' || mealView === 'dinner') && (
                        <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#fbbf24' }}>Dinner</th>
                      )}
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record, idx) => {
                      const d = typeof record.date === 'string' ? parseISO(record.date) : new Date(record.date);
                      return (
                        <tr
                          key={record.id || idx}
                          className="table-row"
                        >
                          <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                            {format(d, 'MMM dd, yyyy')}
                          </td>
                          <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {format(d, 'EEEE')}
                          </td>
                          {(mealView === 'combined' || mealView === 'lunch') && (
                            <td className="px-5 py-3 text-center">
                              {record.lunch
                                ? <Check size={16} style={{ color: '#22d3ee', display: 'inline' }} />
                                : <X size={16} style={{ color: '#475569', display: 'inline' }} />}
                            </td>
                          )}
                          {(mealView === 'combined' || mealView === 'dinner') && (
                            <td className="px-5 py-3 text-center">
                              {record.dinner
                                ? <Check size={16} style={{ color: '#fbbf24', display: 'inline' }} />
                                : <X size={16} style={{ color: '#475569', display: 'inline' }} />}
                            </td>
                          )}
                          <td className="px-5 py-3">
                            <StatusBadge status={record.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={CalendarCheck}
                message="No attendance records"
                description={`No records found for ${monthNames[month - 1]} ${year}${mealView !== 'combined' ? ` (${mealView} only)` : ''}.`}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* ================================================================== */
/*  WARDEN VIEW - All Students Attendance Table                        */
/* ================================================================== */
const WardenAttendance = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [totalDaysInMonth, setTotalDaysInMonth] = useState(0);

  // Modal states for student detail view
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentRecords, setStudentRecords] = useState([]);
  const [studentSummary, setStudentSummary] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchSummaries();
  }, [month, year]);

  const fetchSummaries = async () => {
    setLoading(true);
    try {
      const res = await attendanceAPI.getSummary({ month, year, search });
      setSummaries(res.data?.summaries || []);
      setTotalDaysInMonth(res.data?.total_days_in_month || 0);
    } catch (err) {
      console.error('Failed to fetch attendance summaries:', err);
      toast.error('Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchSummaries();
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchSummaries();
    }
  };

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  };

  const handleViewDetails = async (student) => {
    setSelectedStudent(student);
    setDetailLoading(true);
    try {
      const res = await attendanceAPI.getStudentDetail({
        month,
        year,
        student_id: student.student_id,
      });
      setStudentRecords(res.data?.records || []);
      setStudentSummary(res.data?.summary || null);
    } catch (err) {
      console.error('Failed to fetch student attendance details:', err);
      toast.error('Failed to load student details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setSelectedStudent(null);
    setStudentRecords([]);
    setStudentSummary(null);
  };

  // Calendar grid for detail modal
  const calendarDays = useMemo(() => {
    if (!selectedStudent) return { days: [], startPadding: 0, recordMap: {} };

    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    const days = eachDayOfInterval({ start, end });
    const startPadding = getDay(start);

    const recordMap = {};
    studentRecords.forEach((r) => {
      const dateKey = typeof r.date === 'string' ? r.date : format(new Date(r.date), 'yyyy-MM-dd');
      recordMap[dateKey] = { lunch: !!r.lunch, dinner: !!r.dinner };
    });

    return { days, startPadding, recordMap };
  }, [selectedStudent, month, year, studentRecords]);

  // Filter summaries based on search (client-side for quick filtering)
  const filteredSummaries = useMemo(() => {
    if (!search.trim()) return summaries;
    const lowerSearch = search.toLowerCase();
    return summaries.filter(
      (s) =>
        s.student_name?.toLowerCase().includes(lowerSearch) ||
        s.student_enrollment?.toLowerCase().includes(lowerSearch) ||
        s.hostel?.toLowerCase().includes(lowerSearch)
    );
  }, [summaries, search]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Attendance Overview</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            View all students attendance for the selected month
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Month selector */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 rounded-xl transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#a5b4fc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold min-w-[160px] text-center" style={{ color: 'var(--color-text-primary)' }}>
              {monthNames[month - 1]} {year}
            </h2>
            <button
              onClick={() => changeMonth(1)}
              className="p-2 rounded-xl transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#a5b4fc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                placeholder="Search by name, roll no, hostel..."
                className="input-field pl-9"
                style={{ width: '280px' }}
              />
            </div>
            <button onClick={handleSearch} className="btn-secondary py-2 px-4">
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
              <Users size={20} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total Students</p>
              <p className="text-2xl font-bold" style={{ color: '#818cf8' }}>{filteredSummaries.length}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
              <Calendar size={20} style={{ color: '#22d3ee' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Days in Month</p>
              <p className="text-2xl font-bold" style={{ color: '#22d3ee' }}>{totalDaysInMonth}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
              <Sun size={20} style={{ color: '#34d399' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Avg Lunch %</p>
              <p className="text-2xl font-bold" style={{ color: '#34d399' }}>
                {filteredSummaries.length > 0
                  ? Math.round(
                      (filteredSummaries.reduce((acc, s) => acc + s.lunch_days, 0) /
                        (filteredSummaries.length * totalDaysInMonth)) *
                        100
                    ) || 0
                  : 0}%
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
              <Moon size={20} style={{ color: '#fbbf24' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Avg Dinner %</p>
              <p className="text-2xl font-bold" style={{ color: '#fbbf24' }}>
                {filteredSummaries.length > 0
                  ? Math.round(
                      (filteredSummaries.reduce((acc, s) => acc + s.dinner_days, 0) /
                        (filteredSummaries.length * totalDaysInMonth)) *
                        100
                    ) || 0
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredSummaries.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          message="No attendance data"
          description={`No attendance records found for ${monthNames[month - 1]} ${year}.`}
        />
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>S.No</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Roll No</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Hostel</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#22d3ee' }}>
                    <div className="flex items-center justify-center gap-1"><Sun size={14} /> Lunch</div>
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#fbbf24' }}>
                    <div className="flex items-center justify-center gap-1"><Moon size={14} /> Dinner</div>
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#34d399' }}>Present</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#f87171' }}>Absent</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.map((student, idx) => (
                  <tr key={student.student_id} className="table-row">
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {idx + 1}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium" style={{ color: '#a5b4fc' }}>
                      {student.student_enrollment || '-'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                            color: '#a5b4fc',
                          }}
                        >
                          {(student.student_name?.[0] || '?').toUpperCase()}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {student.student_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {student.hostel || '-'}
                    </td>
                    <td className="px-5 py-3 text-center text-sm font-medium" style={{ color: '#22d3ee' }}>
                      {student.lunch_days}
                    </td>
                    <td className="px-5 py-3 text-center text-sm font-medium" style={{ color: '#fbbf24' }}>
                      {student.dinner_days}
                    </td>
                    <td className="px-5 py-3 text-center text-sm font-semibold" style={{ color: '#34d399' }}>
                      {student.present_days}
                    </td>
                    <td className="px-5 py-3 text-center text-sm font-semibold" style={{ color: '#f87171' }}>
                      {student.absent_days}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => handleViewDetails(student)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--color-text-secondary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#818cf8'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      <Modal
        isOpen={!!selectedStudent}
        onClose={closeDetailModal}
        title={`Attendance Details - ${selectedStudent?.student_name || ''}`}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-10">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div>
            {/* Student Info */}
            <div className="glass-card p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Roll No</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {selectedStudent?.student_enrollment || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Hostel</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {selectedStudent?.hostel || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Room</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {selectedStudent?.room_number || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Period</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {monthNames[month - 1]} {year}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="stat-card p-3">
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Lunch Days</p>
                <p className="text-xl font-bold" style={{ color: '#22d3ee' }}>{studentSummary?.lunch_days || 0}</p>
              </div>
              <div className="stat-card p-3">
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Dinner Days</p>
                <p className="text-xl font-bold" style={{ color: '#fbbf24' }}>{studentSummary?.dinner_days || 0}</p>
              </div>
              <div className="stat-card p-3">
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Both Meals</p>
                <p className="text-xl font-bold" style={{ color: '#34d399' }}>{studentSummary?.both_days || 0}</p>
              </div>
              <div className="stat-card p-3">
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Absent Days</p>
                <p className="text-xl font-bold" style={{ color: '#f87171' }}>{studentSummary?.absent_days || 0}</p>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                Calendar View
              </h3>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: calendarDays.startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {calendarDays.days.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const record = calendarDays.recordMap[dateKey];
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={dateKey}
                      className="flex flex-col items-center justify-center py-2 rounded-lg transition-all"
                      style={{
                        background: isToday ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        border: isToday ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                      }}
                    >
                      <span className="text-sm font-medium" style={{ color: isToday ? '#a5b4fc' : 'var(--color-text-primary)' }}>
                        {format(day, 'd')}
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: record?.lunch ? '#06b6d4' : '#334155' }}
                          title="Lunch"
                        />
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: record?.dinner ? '#f59e0b' : '#334155' }}
                          title="Dinner"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#06b6d4' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Lunch</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Dinner</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#334155' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Not Taken</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

/* ================================================================== */
/*  MAIN ATTENDANCE PAGE                                               */
/* ================================================================== */
const Attendance = () => {
  const { isContractor, isWarden, loading } = useAuth();

  // Wait for auth to load before deciding which view to show
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isContractor) {
    return <ContractorAttendance />;
  }

  if (isWarden) {
    return <WardenAttendance />;
  }

  return <ViewAttendance />;
};

export default Attendance;
