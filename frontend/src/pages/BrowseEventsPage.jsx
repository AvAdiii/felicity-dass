import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { apiRequest } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function BrowseEventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    search: '',
    type: '',
    eligibility: '',
    from: '',
    to: '',
    followedOnly: false
  });

  useEffect(() => {
    let ignore = false;

    async function loadTrending() {
      try {
        const response = await apiRequest('/events/trending');
        if (!ignore) setTrending(response.events || []);
      } catch (err) {
        // Trending fallback stays empty in case of API errors.
      }
    }

    loadTrending();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadEvents() {
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams();
        if (filters.search) query.set('search', filters.search);
        if (filters.type) query.set('type', filters.type);
        if (filters.eligibility) query.set('eligibility', filters.eligibility);
        if (filters.from) query.set('from', filters.from);
        if (filters.to) query.set('to', filters.to);
        if (filters.followedOnly) query.set('followedOnly', 'true');

        const response = await apiRequest(`/events?${query.toString()}`);
        if (!ignore) setEvents(response.events || []);
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadEvents();

    return () => {
      ignore = true;
    };
  }, [filters]);

  const recommendations = useMemo(() => {
    const interests = new Set(user?.preferences?.interests || []);
    const followed = new Set((user?.preferences?.followedOrganizers || []).map(String));

    return [...events]
      .map((event) => {
        let score = 0;

        if (followed.has(String(event.organizer?._id || event.organizer))) {
          score += 3;
        }

        for (const tag of event.tags || []) {
          if (interests.has(tag)) score += 1;
        }

        return { event, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.event)
      .slice(0, 5);
  }, [events, user]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Browse Events</h2>

        <div className="filters-row">
          <input
            placeholder="Search Event / Organizer"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
          />

          <select value={filters.type} onChange={(e) => updateFilter('type', e.target.value)}>
            <option value="">All Types</option>
            <option value="NORMAL">Normal</option>
            <option value="MERCHANDISE">Merchandise</option>
          </select>

          <select value={filters.eligibility} onChange={(e) => updateFilter('eligibility', e.target.value)}>
            <option value="">All Eligibility</option>
            <option value="IIIT">IIIT</option>
            <option value="NON_IIIT">NON_IIIT</option>
            <option value="OPEN">OPEN</option>
          </select>

          <label>
            From
            <input type="date" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} />
          </label>

          <label>
            To
            <input type="date" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} />
          </label>

          <label className="inline-check">
            <input
              type="checkbox"
              checked={filters.followedOnly}
              onChange={(e) => updateFilter('followedOnly', e.target.checked)}
            />
            Followed Clubs
          </label>
        </div>

        {error ? <p className="error-box">{error}</p> : null}
      </section>

      <section className="card">
        <h3>Trending (Top 5 in 24h)</h3>
        <div className="card-grid">
          {trending.length ? (
            trending.map((event) => (
              <Link key={event.id || event._id} to={`/events/${event.id || event._id}`} className="event-card">
                <h4>{event.name}</h4>
                <p>{event.type}</p>
                <small>{dayjs(event.startDate).format('DD MMM, HH:mm')}</small>
              </Link>
            ))
          ) : (
            <p>No trending data yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Recommended For You</h3>
        {recommendations.length ? (
          <div className="card-grid">
            {recommendations.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className="event-card">
                <h4>{event.name}</h4>
                <p>{event.organizer?.organizerName || 'Organizer'}</p>
                <small>Tags: {(event.tags || []).join(', ') || 'None'}</small>
              </Link>
            ))}
          </div>
        ) : (
          <p>Add interests/follows in profile to improve recommendations.</p>
        )}
      </section>

      <section className="card">
        <h3>All Matching Events</h3>

        {loading ? <p>Loading events...</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Organizer</th>
                <th>Eligibility</th>
                <th>Dates</th>
                <th>Capacity</th>
              </tr>
            </thead>
            <tbody>
              {events.length ? (
                events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <Link to={`/events/${event.id}`}>{event.name}</Link>
                    </td>
                    <td>{event.type}</td>
                    <td>{event.organizer?.organizerName || '-'}</td>
                    <td>{(event.eligibility || []).join(', ') || 'Open'}</td>
                    <td>
                      {dayjs(event.startDate).format('DD MMM')} - {dayjs(event.endDate).format('DD MMM')}
                    </td>
                    <td>
                      {event.occupiedSpots}/{event.registrationLimit}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No events found for selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
