import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { apiRequest } from '../api';

export default function OngoingEventsPage() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await apiRequest('/organizers/me/ongoing-events');
        if (!ignore) setEvents(response.events || []);
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
        <h2>Ongoing Events</h2>
        {error ? <p className="error-box">{error}</p> : null}

        <div className="card-grid">
          {events.map((event) => (
            <div key={event._id} className="event-card">
              <h3>{event.name}</h3>
              <p>{event.type}</p>
              <p>
                {dayjs(event.startDate).format('DD MMM HH:mm')} - {dayjs(event.endDate).format('DD MMM HH:mm')}
              </p>
              <div className="forum-actions">
                <Link className="btn-link" to={`/organizer/events/${event._id}`}>
                  Manage
                </Link>
                <Link className="btn-link" to={`/organizer/attendance/${event._id}`}>
                  Attendance
                </Link>
              </div>
            </div>
          ))}

          {!events.length ? <p>No ongoing events currently.</p> : null}
        </div>
      </section>
    </div>
  );
}
