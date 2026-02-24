import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';

export default function OrganizerListPage() {
  const [organizers, setOrganizers] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [orgRes, profileRes] = await Promise.all([
          apiRequest('/organizers/list'),
          apiRequest('/participants/profile')
        ]);

        if (!ignore) {
          setOrganizers(orgRes.organizers || []);
          setFollowed((profileRes.user?.preferences?.followedOrganizers || []).map(String));
        }
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  async function toggleFollow(orgId) {
    const isFollowed = followed.includes(orgId);
    try {
      if (isFollowed) {
        const response = await apiRequest(`/participants/follow/${orgId}`, { method: 'DELETE' });
        setFollowed((response.followedOrganizers || []).map(String));
      } else {
        const response = await apiRequest(`/participants/follow/${orgId}`, { method: 'POST' });
        setFollowed((response.followedOrganizers || []).map(String));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Clubs / Organizers</h2>
        {error ? <p className="error-box">{error}</p> : null}

        <div className="card-grid">
          {organizers.map((org) => {
            const isFollowed = followed.includes(org._id);
            return (
              <div className="event-card" key={org._id}>
                <h3>{org.organizerName}</h3>
                <p>{org.category}</p>
                <p>{org.description}</p>
                <div className="forum-actions">
                  <Link to={`/organizers/${org._id}`} className="btn-link">
                    View Details
                  </Link>
                  <button type="button" className="btn" onClick={() => toggleFollow(org._id)}>
                    {isFollowed ? 'Unfollow' : 'Follow'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
