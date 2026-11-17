
import { Routes, Route, Navigate } from 'react-router-dom';

import Home from './pages/Home/Home';
import Auth from './pages/Auth/Auth';
import VerifyEmail from './pages/VerifyEmail/VerifyEmail';
import PhoneAuth from './pages/Auth/PhoneAuth';

import Groups from './pages/Groups/Groups';
import GroupDetails from './pages/Groups/GroupDetails';
import JoinGroup from './pages/Groups/JoinGroup';
import Friends from './pages/Friends/Friends';
import Activity from './pages/Activity/Activity';
import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/Settings';

import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

import './App.css';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/phone-auth" element={<PhoneAuth />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/groups/:groupId" element={<GroupDetails />} />
          <Route path="/join-group/:token" element={<JoinGroup />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
