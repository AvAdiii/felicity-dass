import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ParticipantDashboardPage from './pages/ParticipantDashboardPage';
import BrowseEventsPage from './pages/BrowseEventsPage';
import EventDetailsPage from './pages/EventDetailsPage';
import ParticipantProfilePage from './pages/ParticipantProfilePage';
import OrganizerListPage from './pages/OrganizerListPage';
import OrganizerDetailPage from './pages/OrganizerDetailPage';
import OrganizerDashboardPage from './pages/OrganizerDashboardPage';
import OrganizerEventFormPage from './pages/OrganizerEventFormPage';
import OrganizerEventDetailPage from './pages/OrganizerEventDetailPage';
import OrganizerProfilePage from './pages/OrganizerProfilePage';
import OngoingEventsPage from './pages/OngoingEventsPage';
import AttendanceScannerPage from './pages/AttendanceScannerPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ManageOrganizersPage from './pages/ManageOrganizersPage';
import AdminResetRequestsPage from './pages/AdminResetRequestsPage';
import TicketDetailsPage from './pages/TicketDetailsPage';

function AppLayout() {
  return (
    <div className="app-root">
      <Navbar />
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}

function HomeRouter() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === 'participant') return <ParticipantDashboardPage />;
  if (user.role === 'organizer') return <OrganizerDashboardPage />;
  return <AdminDashboardPage />;
}

function ProfileRouter() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === 'participant') return <ParticipantProfilePage />;
  if (user.role === 'organizer') return <OrganizerProfilePage />;

  return (
    <div className="card">
      <h2>Admin Profile</h2>
      <p>Admin profile editing is intentionally minimal for this assignment.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRouter />} />

        <Route
          path="events"
          element={
            <ProtectedRoute roles={['participant']}>
              <BrowseEventsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="events/:eventId"
          element={
            <ProtectedRoute roles={['participant']}>
              <EventDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="organizers"
          element={
            <ProtectedRoute roles={['participant']}>
              <OrganizerListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="organizers/:organizerId"
          element={
            <ProtectedRoute roles={['participant']}>
              <OrganizerDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tickets/:ticketId"
          element={
            <ProtectedRoute roles={['participant', 'organizer', 'admin']}>
              <TicketDetailsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="organizer/events/new"
          element={
            <ProtectedRoute roles={['organizer']}>
              <OrganizerEventFormPage mode="create" />
            </ProtectedRoute>
          }
        />
        <Route
          path="organizer/events/:eventId/edit"
          element={
            <ProtectedRoute roles={['organizer']}>
              <OrganizerEventFormPage mode="edit" />
            </ProtectedRoute>
          }
        />
        <Route
          path="organizer/events/:eventId"
          element={
            <ProtectedRoute roles={['organizer']}>
              <OrganizerEventDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="organizer/ongoing"
          element={
            <ProtectedRoute roles={['organizer']}>
              <OngoingEventsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="organizer/attendance/:eventId"
          element={
            <ProtectedRoute roles={['organizer']}>
              <AttendanceScannerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin/organizers"
          element={
            <ProtectedRoute roles={['admin']}>
              <ManageOrganizersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reset-requests"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminResetRequestsPage />
            </ProtectedRoute>
          }
        />

        <Route path="profile" element={<ProfileRouter />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
