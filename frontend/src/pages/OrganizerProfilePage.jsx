import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { organizer_category_options } from '../constants/categories';

export default function OrganizerProfilePage() {
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [reason, setReason] = useState('Forgot old password and lost local vault');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [profileRes, historyRes] = await Promise.all([
          apiRequest('/organizers/me/profile'),
          apiRequest('/organizers/me/password-reset-requests')
        ]);

        if (!ignore) {
          setProfile(profileRes.user);
          setHistory(historyRes.history || []);
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

  function update(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProfile() {
    try {
      setError('');
      setMessage('');

      await apiRequest('/organizers/me/profile', {
        method: 'PUT',
        body: {
          organizerName: profile.organizerName,
          category: profile.category,
          description: profile.description,
          contactEmail: profile.contactEmail,
          contactNumber: profile.contactNumber,
          discordWebhookUrl: profile.discordWebhookUrl
        }
      });
      setMessage('Organizer profile updated.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function requestReset() {
    try {
      await apiRequest('/organizers/me/password-reset-requests', {
        method: 'POST',
        body: { reason }
      });
      const historyRes = await apiRequest('/organizers/me/password-reset-requests');
      setHistory(historyRes.history || []);
      setMessage('Password reset request submitted to admin.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!profile) return <div className="card">Loading organizer profile...</div>;

  return (
    <div className="stack">
      <section className="card">
        <h2>Organizer Profile</h2>
        <div className="grid-form">
          <label>
            Organizer Name
            <input value={profile.organizerName || ''} onChange={(e) => update('organizerName', e.target.value)} />
          </label>

          <label>
            Category
            <select value={profile.category || ''} onChange={(e) => update('category', e.target.value)}>
              {!organizer_category_options.includes(profile.category || '') && profile.category ? (
                <option value={profile.category}>{profile.category} (legacy)</option>
              ) : null}
              {organizer_category_options.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="full">
            Description
            <textarea value={profile.description || ''} rows={3} onChange={(e) => update('description', e.target.value)} />
          </label>

          <label>
            Contact Email
            <input value={profile.contactEmail || ''} onChange={(e) => update('contactEmail', e.target.value)} />
          </label>

          <label>
            Contact Number
            <input
              value={profile.contactNumber || ''}
              onChange={(e) => update('contactNumber', e.target.value)}
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              title="Enter a 10-digit number"
            />
          </label>

          <label>
            Login Email (non-editable)
            <input value={profile.email || ''} readOnly />
          </label>

          <label className="full">
            Discord Webhook URL
            <input
              value={profile.discordWebhookUrl || ''}
              onChange={(e) => update('discordWebhookUrl', e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
            />
          </label>
        </div>

        <button type="button" className="btn" onClick={saveProfile}>
          Save Profile
        </button>
      </section>

      <section className="card">
        <h3>Organizer Password Reset Workflow</h3>
        <label>
          Reason for reset request
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button type="button" className="btn" onClick={requestReset}>
          Request Reset From Admin
        </button>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Admin Comment</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((row) => (
                  <tr key={row._id}>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                    <td>{row.reason}</td>
                    <td>{row.status}</td>
                    <td>{row.adminComment || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No reset requests yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message ? <div className="info-box">{message}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
    </div>
  );
}
