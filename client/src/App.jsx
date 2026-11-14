
import {
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import Auth from './pages/Auth/Auth';
import Groups from './pages/Groups/Groups';
import GroupDetails from './pages/Groups/GroupDetails';
import JoinGroup from './pages/Groups/JoinGroup';

import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

import './App.css';

function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Auth />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/groups"
            element={<Groups />}
          />

          <Route
            path="/groups/:groupId"
            element={<GroupDetails />}
          />

          <Route
            path="/join-group/:token"
            element={<JoinGroup />}
          />
        </Route>
      </Route>

      {/* Default route */}
      <Route
        path="/"
        element={<Navigate to="/groups" replace />}
      />

      <Route
        path="*"
        element={<Navigate to="/groups" replace />}
      />
    </Routes>
  );
}

export default App;
