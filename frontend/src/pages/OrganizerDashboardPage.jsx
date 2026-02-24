import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';

export default function OrganizerDashboardPage() {
  const [data, setData] = useState({ events: [], analytics: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await apiRequest('/organizers/me/dashboard');
        if (!ignore) setData(response);
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="stack">
      <section className="card">
        <h2>Organizer Dashboard</h2>
        <p>Events carousel style cards with manage links.</p>

        {error ? <p className="error-box">{error}</p> : null}

        <div className="carousel">
          {data.events.map((event) => (
            <div className="event-card" key={event.id}>
              <h3>{event.name}</h3>
              <p>Type: {event.type}</p>
              <p>Status: {event.status}</p>
              <div className="forum-actions">
                <Link className="btn-link" to={`/organizer/events/${event.id}`}>
                  View Detail
                </Link>
                <Link className="btn-link" to={`/organizer/events/${event.id}/edit`}>
                  Edit
                </Link>
              </div>
            </div>
          ))}
          {!data.events.length ? <p>No events created yet.</p> : null}
        </div>
      </section>

      <section className="card">
        <h3>Completed Event Analytics</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Registrations</th>
                <th>Sales</th>
                <th>Revenue</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {data.analytics.length ? (
                data.analytics.map((row) => (
                  <tr key={row.eventId}>
                    <td>{row.eventName}</td>
                    <td>{row.registrations}</td>
                    <td>{row.sales}</td>
                    <td>{row.revenue}</td>
                    <td>{row.attendance}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No completed event analytics yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
