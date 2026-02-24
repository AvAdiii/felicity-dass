import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await apiRequest('/admin/dashboard');
        if (!ignore) setStats(response);
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  if (error) return <div className="card error-box">{error}</div>;
  if (!stats) return <div className="card">Loading admin dashboard...</div>;

  return (
    <div className="stack">
      <section className="card">
        <h2>Admin Dashboard</h2>
        <div className="analytics-row">
          <div className="stat-card">
            <h4>Participants</h4>
            <p>{stats.participants}</p>
          </div>
          <div className="stat-card">
            <h4>Organizers</h4>
            <p>{stats.organizers}</p>
          </div>
          <div className="stat-card">
            <h4>Events</h4>
            <p>{stats.events}</p>
          </div>
          <div className="stat-card">
            <h4>Pending Resets</h4>
            <p>{stats.pendingResetRequests}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
