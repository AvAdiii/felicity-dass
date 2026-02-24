import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { apiRequest, getApiBase } from '../api';

export default function OrganizerEventDetailPage() {
  const { eventId } = useParams();

  const [eventData, setEventData] = useState(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [participants, setParticipants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState('PENDING_APPROVAL');
  const [messages, setMessages] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState('');
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadAll() {
      try {
        const [detailRes, ordersRes, msgRes] = await Promise.all([
          apiRequest(`/organizers/me/events/${eventId}`),
          apiRequest(`/organizers/me/events/${eventId}/orders?status=${orderFilter}`),
          apiRequest(`/discussion/${eventId}/messages`)
        ]);

        if (!ignore) {
          setEventData(detailRes);
          setParticipants(detailRes.participants || []);
          setOrders(ordersRes.orders || []);
          setMessages(msgRes.messages || []);
        }
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }

    loadAll();
    return () => {
      ignore = true;
    };
  }, [eventId, orderFilter]);

  async function searchParticipants() {
    try {
      const response = await apiRequest(
        `/organizers/me/events/${eventId}/participants?search=${encodeURIComponent(participantSearch)}`
      );
      setParticipants(response.participants || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function exportParticipants() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${getApiBase()}/organizers/me/events/${eventId}/participants/export?search=${encodeURIComponent(participantSearch)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      if (!res.ok) {
        throw new Error('Failed to export participants CSV');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event_${eventId}_participants.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function reviewOrder(orderId, action) {
    try {
      await apiRequest(`/organizers/me/orders/${orderId}/review`, {
        method: 'PATCH',
        body: {
          action,
          comment: messageText
        }
      });
      setMessageText('');
      const response = await apiRequest(`/organizers/me/events/${eventId}/orders?status=${orderFilter}`);
      setOrders(response.orders || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function postAnnouncement() {
    if (!announcement.trim()) return;
    try {
      await apiRequest(`/discussion/${eventId}/messages`, {
        method: 'POST',
        body: {
          content: announcement,
          isAnnouncement: true
        }
      });
      setAnnouncement('');
      const response = await apiRequest(`/discussion/${eventId}/messages`);
      setMessages(response.messages || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function togglePin(messageId) {
    try {
      await apiRequest(`/discussion/messages/${messageId}/pin`, { method: 'PATCH' });
      const response = await apiRequest(`/discussion/${eventId}/messages`);
      setMessages(response.messages || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteMessage(messageId) {
    try {
      await apiRequest(`/discussion/messages/${messageId}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    } catch (err) {
      setError(err.message);
    }
  }

  const orderStats = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'PENDING_APPROVAL').length;
    const approved = orders.filter((o) => o.status === 'APPROVED').length;
    const rejected = orders.filter((o) => o.status === 'REJECTED').length;
    return { pending, approved, rejected };
  }, [orders]);

  if (!eventData) return <div className="card">Loading organizer event details...</div>;

  const { event, analytics } = eventData;

  return (
    <div className="stack">
      <section className="card">
        <h2>Organizer Event View: {event.name}</h2>
        <p>
          <strong>Type:</strong> {event.type} | <strong>Status:</strong> {event.status}
        </p>
        <p>
          <strong>Dates:</strong> {dayjs(event.startDate).format('DD MMM HH:mm')} to {dayjs(event.endDate).format('DD MMM HH:mm')}
        </p>
        <p>
          <strong>Eligibility:</strong> {(event.eligibility || []).join(', ') || 'Open'} | <strong>Fee:</strong>{' '}
          {event.registrationFee || 0}
        </p>
        <p>
          <strong>Team Based:</strong> {event.teamBased ? 'Yes' : 'No'} | <strong>Max Team Size:</strong>{' '}
          {event.teamBased ? event.maxTeamSize : '-'}
        </p>
        <p>{event.description}</p>

        <div className="analytics-row">
          <div className="stat-card">
            <h4>Registrations/Sales</h4>
            <p>{analytics.registrations + analytics.sales}</p>
          </div>
          <div className="stat-card">
            <h4>Attendance</h4>
            <p>{analytics.attendance}</p>
          </div>
          <div className="stat-card">
            <h4>Team Completion</h4>
            <p>{analytics.teamCompletion}</p>
          </div>
          <div className="stat-card">
            <h4>Revenue</h4>
            <p>{analytics.revenue}</p>
          </div>
        </div>

        <div className="forum-actions">
          <Link className="btn-link" to={`/organizer/events/${event._id}/edit`}>
            Edit Event
          </Link>
          <Link className="btn-link" to={`/organizer/attendance/${event._id}`}>
            Attendance Scanner
          </Link>
        </div>
      </section>

      <section className="card">
        <h3>Participants</h3>
        <div className="forum-actions">
          <input
            placeholder="Search by name/email"
            value={participantSearch}
            onChange={(e) => setParticipantSearch(e.target.value)}
          />
          <button type="button" className="btn" onClick={searchParticipants}>
            Search
          </button>
          <button type="button" className="btn" onClick={exportParticipants}>
            Export CSV
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Reg Date</th>
                <th>Payment</th>
                <th>Team</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {participants.length ? (
                participants.map((row, idx) => (
                  <tr key={`${row.email}-${idx}`}>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>{row.regDate ? dayjs(row.regDate).format('DD MMM HH:mm') : '-'}</td>
                    <td>{row.payment}</td>
                    <td>{row.team || '-'}</td>
                    <td>{row.attendance}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No participants found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {event.type === 'MERCHANDISE' ? (
        <section className="card">
          <h3>Payment Approval Workflow</h3>

          <div className="forum-actions">
            <label>
              Status Filter
              <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}>
                <option value="PENDING_APPROVAL">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CREATED">Created</option>
              </select>
            </label>
            <div className="mini-stats">
              <span>Pending: {orderStats.pending}</span>
              <span>Approved: {orderStats.approved}</span>
              <span>Rejected: {orderStats.rejected}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Proof</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.length ? (
                  orders.map((order) => (
                    <tr key={order._id}>
                      <td>
                        {order.participant?.firstName} {order.participant?.lastName}
                        <br />
                        <small>{order.participant?.email}</small>
                      </td>
                      <td>{order.itemSku}</td>
                      <td>{order.quantity}</td>
                      <td>{order.amount}</td>
                      <td>{order.status}</td>
                      <td>
                        {order.paymentProofUrl ? (
                          <a
                            href={`${getApiBase().replace('/api', '')}/${order.paymentProofUrl}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Proof
                          </a>
                        ) : (
                          'No proof'
                        )}
                      </td>
                      <td>
                        {order.status === 'PENDING_APPROVAL' ? (
                          <div className="forum-actions">
                            <button type="button" className="chip" onClick={() => reviewOrder(order._id, 'approve')}>
                              Approve
                            </button>
                            <button type="button" className="chip" onClick={() => reviewOrder(order._id, 'reject')}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>No orders for this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <label>
            Optional review comment (used for next approve/reject click)
            <input value={messageText} onChange={(e) => setMessageText(e.target.value)} />
          </label>
        </section>
      ) : null}

      <section className="card">
        <h3>Discussion Moderation</h3>
        <div className="forum-actions">
          <textarea
            rows={2}
            placeholder="Post announcement"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
          />
          <button type="button" className="btn" onClick={postAnnouncement}>
            Post Announcement
          </button>
        </div>

        <div className="message-list">
          {messages.map((msg) => (
            <div key={msg._id} className={msg.isPinned ? 'message pinned' : 'message'}>
              <div className="message-meta">
                <strong>{msg.author?.organizerName || `${msg.author?.firstName || ''} ${msg.author?.lastName || ''}`}</strong>
                <small>{msg.authorRole}</small>
                <small>{dayjs(msg.createdAt).format('DD MMM HH:mm')}</small>
              </div>
              <p>{msg.content}</p>
              <div className="forum-actions">
                <button type="button" className="chip" onClick={() => togglePin(msg._id)}>
                  {msg.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button type="button" className="chip" onClick={() => deleteMessage(msg._id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!messages.length ? <p>No discussion messages yet.</p> : null}
        </div>
      </section>

      {error ? <div className="error-box">{error}</div> : null}
    </div>
  );
}
