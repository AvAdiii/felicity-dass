import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { apiRequest } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { participant_interest_options } from '../constants/categories';

const tabs = [
  { id: 'normal', label: 'Normal' },
  { id: 'merchandise', label: 'Merchandise' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelledRejected', label: 'Cancelled/Rejected' }
];

export default function ParticipantDashboardPage() {
  const { user, refreshMe } = useAuth();
  const [data, setData] = useState({ upcoming: [], history: {} });
  const [activeTab, setActiveTab] = useState('normal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [organizers, setOrganizers] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedOrganizers, setSelectedOrganizers] = useState([]);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await apiRequest('/participants/dashboard');
        if (!ignore) {
          setData(response);
        }
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadOnboardingData() {
      if (user?.role !== 'participant' || user?.onboardingCompleted) {
        if (!ignore) setShowOnboarding(false);
        return;
      }

      setShowOnboarding(true);
      setOnboardingError('');
      setSelectedInterests(user?.preferences?.interests || []);
      setSelectedOrganizers((user?.preferences?.followedOrganizers || []).map(String));

      try {
        const response = await apiRequest('/organizers/list');
        if (!ignore) {
          setOrganizers(response.organizers || []);
        }
      } catch (err) {
        if (!ignore) setOnboardingError(err.message);
      }
    }

    loadOnboardingData();

    return () => {
      ignore = true;
    };
  }, [user]);

  function toggleInterest(item) {
    setSelectedInterests((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  }

  function toggleOrganizer(organizerId) {
    setSelectedOrganizers((prev) =>
      prev.includes(organizerId) ? prev.filter((x) => x !== organizerId) : [...prev, organizerId]
    );
  }

  async function saveOnboarding({ skip = false } = {}) {
    setOnboardingSaving(true);
    setOnboardingError('');

    try {
      await apiRequest('/participants/preferences', {
        method: 'PUT',
        body: {
          interests: skip ? [] : selectedInterests,
          followedOrganizers: skip ? [] : selectedOrganizers
        }
      });
      await refreshMe();
      setShowOnboarding(false);
    } catch (err) {
      setOnboardingError(err.message);
    } finally {
      setOnboardingSaving(false);
    }
  }

  const current = data.history?.[activeTab] || [];

  return (
    <>
      <div className="stack">
        <section className="card">
          <h2>My Events Dashboard</h2>
          <p>Upcoming registered events with quick ticket reference.</p>

          {loading ? <p>Loading...</p> : null}
          {error ? <p className="error-box">{error}</p> : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Organizer</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {data.upcoming?.length ? (
                  data.upcoming.map((item, idx) => (
                    <tr key={`${item.eventName}-${idx}`}>
                      <td>{item.eventName}</td>
                      <td>{item.eventType}</td>
                      <td>{item.organizer}</td>
                      <td>
                        {dayjs(item.schedule.start).format('DD MMM, HH:mm')} to{' '}
                        {dayjs(item.schedule.end).format('DD MMM, HH:mm')}
                      </td>
                      <td>{item.participationStatus}</td>
                      <td>
                        {item.ticketId ? <Link to={`/tickets/${item.ticketId}`}>{item.ticketId}</Link> : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>No upcoming registrations yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>Participation History</h2>
          <div className="tabs">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={activeTab === tab.id ? 'tab active' : 'tab'}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Organizer</th>
                  <th>Status</th>
                  <th>Team</th>
                  <th>Ticket ID</th>
                </tr>
              </thead>
              <tbody>
                {current.length ? (
                  current.map((row, idx) => (
                    <tr key={`${row.eventName}-${idx}`}>
                      <td>{row.eventName}</td>
                      <td>{row.eventType}</td>
                      <td>{row.organizer}</td>
                      <td>{row.participationStatus}</td>
                      <td>{row.teamName || '-'}</td>
                      <td>{row.ticketId ? <Link to={`/tickets/${row.ticketId}`}>{row.ticketId}</Link> : '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>No records in this tab.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showOnboarding ? (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            <h3>Complete your onboarding</h3>
            <p className="small-text">Choose interests and clubs/organizers to follow. You can also skip for now.</p>

            <div className="interests-box">
              <p>Interests</p>
              <div className="chips">
                {participant_interest_options.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={selectedInterests.includes(item) ? 'chip selected' : 'chip'}
                    onClick={() => toggleInterest(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="interests-box">
              <p>Clubs / Organizers to Follow</p>
              <div className="chips">
                {organizers.map((org) => (
                  <button
                    type="button"
                    key={org._id}
                    className={selectedOrganizers.includes(org._id) ? 'chip selected' : 'chip'}
                    onClick={() => toggleOrganizer(org._id)}
                  >
                    {org.organizerName}
                  </button>
                ))}
              </div>
            </div>

            {onboardingError ? <div className="error-box">{onboardingError}</div> : null}

            <div className="onboarding-actions">
              <button type="button" className="btn-secondary" disabled={onboardingSaving} onClick={() => saveOnboarding({ skip: true })}>
                Skip for now
              </button>
              <button type="button" className="btn" disabled={onboardingSaving} onClick={() => saveOnboarding()}>
                {onboardingSaving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
