import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { apiRequest } from '../api';

export default function OrganizerDetailPage() {
  const { organizerId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await apiRequest(`/organizers/${organizerId}/details`);
        if (!ignore) setData(response);
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [organizerId]);

  if (error) return <div className="card error-box">{error}</div>;
  if (!data) return <div className="card">Loading organizer details...</div>;

  return (
    <div className="stack">
      <section className="card">
        <h2>{data.organizer.organizerName}</h2>
        <p>Category: {data.organizer.category}</p>
        <p>{data.organizer.description}</p>
        <p>Contact: {data.organizer.contactEmail}</p>
      </section>

      <section className="card">
        <h3>Upcoming Events</h3>
        <div className="card-grid">
          {(data.upcoming || []).map((event) => (
            <Link className="event-card" key={event._id} to={`/events/${event._id}`}>
              <h4>{event.name}</h4>
              <p>{event.type}</p>
              <small>{dayjs(event.startDate).format('DD MMM, HH:mm')}</small>
            </Link>
          ))}
          {!data.upcoming?.length ? <p>No upcoming events.</p> : null}
        </div>
      </section>

      <section className="card">
        <h3>Past Events</h3>
        <div className="card-grid">
          {(data.past || []).map((event) => (
            <Link className="event-card" key={event._id} to={`/events/${event._id}`}>
              <h4>{event.name}</h4>
              <p>{event.type}</p>
              <small>{dayjs(event.startDate).format('DD MMM, HH:mm')}</small>
            </Link>
          ))}
          {!data.past?.length ? <p>No past events.</p> : null}
        </div>
      </section>
    </div>
  );
}
