import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { participant_interest_options } from '../constants/categories';

export default function ParticipantProfilePage() {
  const navigate = useNavigate();
  const { refreshMe, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [organizers, setOrganizers] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [profileRes, organizerRes] = await Promise.all([
          apiRequest('/participants/profile'),
          apiRequest('/organizers/list')
        ]);
        if (!ignore) {
          const followed = (profileRes.user?.preferences?.followedOrganizers || []).map(String);
          setProfile({
            ...profileRes.user,
            preferences: {
              ...(profileRes.user?.preferences || {}),
              followedOrganizers: followed
            }
          });
          setOrganizers(organizerRes.organizers || []);
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

  function toggleInterest(item) {
    setProfile((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        interests: prev.preferences?.interests?.includes(item)
          ? prev.preferences.interests.filter((x) => x !== item)
          : [...(prev.preferences?.interests || []), item]
      }
    }));
  }

  function toggleFollow(organizerId) {
    setProfile((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        followedOrganizers: prev.preferences?.followedOrganizers?.includes(organizerId)
          ? prev.preferences.followedOrganizers.filter((x) => x !== organizerId)
          : [...(prev.preferences?.followedOrganizers || []), organizerId]
      }
    }));
  }

  async function saveProfile() {
    try {
      setError('');
      setMessage('');

      const payload = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        contactNumber: profile.contactNumber,
        collegeName: profile.collegeName,
        interests: profile.preferences?.interests || [],
        followedOrganizers: profile.preferences?.followedOrganizers || []
      };

      await apiRequest('/participants/profile', {
        method: 'PUT',
        body: payload
      });

      await refreshMe();
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function changePassword() {
    try {
      setError('');
      setMessage('');
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: passwordForm
      });
      setPasswordForm({ currentPassword: '', newPassword: '' });
      logout();
      navigate('/login', {
        replace: true,
        state: { message: 'Password changed successfully. Please login again.' }
      });
    } catch (err) {
      setError(err.message);
    }
  }

  if (!profile) {
    return <div className="card">Loading profile...</div>;
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Participant Profile</h2>

        <div className="grid-form">
          <label>
            First Name
            <input value={profile.firstName || ''} onChange={(e) => update('firstName', e.target.value)} />
          </label>

          <label>
            Last Name
            <input value={profile.lastName || ''} onChange={(e) => update('lastName', e.target.value)} />
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
            College / Organization
            <input value={profile.collegeName || ''} onChange={(e) => update('collegeName', e.target.value)} />
          </label>

          <label>
            Email (non-editable)
            <input value={profile.email || ''} readOnly />
          </label>

          <label>
            Participant Type (non-editable)
            <input value={profile.participantType || ''} readOnly />
          </label>

          <div className="interests-box full">
            <p>Selected Interests</p>
            <div className="chips">
              {participant_interest_options.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={profile.preferences?.interests?.includes(item) ? 'chip selected' : 'chip'}
                  onClick={() => toggleInterest(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="interests-box full">
            <p>Followed Clubs / Organizers</p>
            <div className="chips">
              {organizers.map((org) => (
                <button
                  key={org._id}
                  type="button"
                  className={profile.preferences?.followedOrganizers?.includes(org._id) ? 'chip selected' : 'chip'}
                  onClick={() => toggleFollow(org._id)}
                >
                  {org.organizerName}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button type="button" className="btn" onClick={saveProfile}>
          Save Profile
        </button>
      </section>

      <section className="card">
        <h3>Security Settings</h3>
        <p className="small-text">If you forgot the current password, use the reset link on the login page.</p>
        <label>
          Current Password
          <input
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
          />
        </label>
        <label>
          New Password
          <input
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
          />
        </label>
        <button type="button" className="btn" onClick={changePassword}>
          Change Password
        </button>
      </section>

      {message ? <div className="info-box">{message}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
    </div>
  );
}
