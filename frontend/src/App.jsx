import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Bills from './pages/Bills';
import BillDetail from './pages/BillDetail';
import MessRates from './pages/MessRates';
import Disputes from './pages/Disputes';
import Payments from './pages/Payments';
import Profile from './pages/Profile';
import FinancialSummary from './pages/FinancialSummary';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            },
          }}
        />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="bills" element={<Bills />} />
            <Route path="bills/:id" element={<BillDetail />} />
            <Route path="mess-rates" element={<MessRates />} />
            <Route path="disputes" element={<Disputes />} />
            <Route path="payments" element={<Payments />} />
            <Route path="financial-summary" element={<FinancialSummary />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
