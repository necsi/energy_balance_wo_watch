import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './AuthContext';
import { app } from './firebase-config';     // ← ADD (your existing firebase app)
import LccAdmin from './components/Admin/LccAdminPage';     // ← ADD


import RegistrationPage    from './components/Register/RegistrationPage';
import Dashboard           from './components/Dashboard/Dashboard';
import SignInPage          from './components/SignIn/SignInPage';
import ForgotPasswordPage  from './components/SignIn/ForgotPasswordPage';
import PersonalSettings    from './components/Settings/PersonalSettings';
import SymptomTracker      from './components/SymptomTracker/SymptomTracker';
import SymptomPatterns     from './components/SymptomPatterns/SymptomPatterns';
import './App.css';

const FoodTrackerPage = lazy(() => import('./components/FoodTracker/FoodTrackerPage'));

// ── Shared loading spinner ────────────────────────────────────────────────────
const AppSpinner = () => (
  <div style={{
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  }}>
    <div style={{ textAlign: 'center', color: 'white' }}>
      <div style={{
        width: 40, height: 40,
        border: '3px solid rgba(255,255,255,0.3)',
        borderTop: '3px solid white',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        margin: '0 auto 16px',
      }} />
      <p style={{ margin: 0, fontWeight: 500 }}>Loading…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

// ── Route guards ──────────────────────────────────────────────────────────────

/** Requires a valid Firebase session. Redirects to /login if none. */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppSpinner />;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
};

/** Redirects already-authenticated users away from login/register. */
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppSpinner />;
  if (user)    return <Navigate to="/dashboard" replace />;
  return children;
};

/** Root path — send users to dashboard or login based on session. */
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <AppSpinner />;
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
};

// ── Routes ────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"                element={<PublicRoute><SignInPage /></PublicRoute>} />
      <Route path="/forgot-password"      element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/login/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/register"             element={<PublicRoute><RegistrationPage /></PublicRoute>} />

      {/* Protected */}
      <Route path="/dashboard"         element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/symptom-tracker"   element={<ProtectedRoute><SymptomTracker /></ProtectedRoute>} />
      <Route path="/symptom-patterns"  element={<ProtectedRoute><SymptomPatterns /></ProtectedRoute>} />
      <Route path="/personal-settings" element={<ProtectedRoute><PersonalSettings /></ProtectedRoute>} />
      <Route
        path="/food-tracker"
        element={
          <ProtectedRoute>
            <Suspense fallback={<AppSpinner />}>
              <FoodTrackerPage />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* Default */}
      <Route path="/" element={<RootRedirect />} />

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="not-found">
            <h2>Page Not Found</h2>
            <p>The page you're looking for doesn't exist.</p>
            <button onClick={() => window.location.href = '/'}>Go Home</button>
          </div>
        }
      />
    </Routes>
  );
}

// ── App root — AuthProvider wraps everything ──────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <Router basename="/energy_balance_wo_watch">
        <div className="App">
          <AppRoutes />
          <LccAdmin app={app} />            {/* ← ADD */}
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
