import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { io } from 'socket.io-client';
import { apiRequest } from '../api';

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function EventDetailsPage() {
  const { eventId } = useParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const [formResponses, setFormResponses] = useState({});
  const [formFiles, setFormFiles] = useState({});
  const [teamAction, setTeamAction] = useState('create');
  const [newTeamName, setNewTeamName] = useState('');
  const [joinTeamName, setJoinTeamName] = useState('');

  const [selectedSku, setSelectedSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [proofFile, setProofFile] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [notice, setNotice] = useState('');

  const socketRef = useRef(null);

  function updateResponse(fieldId, value) {
    setFormResponses((prev) => ({
      ...prev,
      [fieldId]: value
    }));
  }

  function toggleCheckboxOption(fieldId, option) {
    setFormResponses((prev) => {
      const current = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
      return {
        ...prev,
        [fieldId]: current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
      };
    });
  }

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const eventResponse = await apiRequest(`/events/${eventId}`);
        let messagesResponse = { messages: [] };

        try {
          messagesResponse = await apiRequest(`/discussion/${eventId}/messages`);
        } catch (forumErr) {
          // Forum is only for registered users; event page should still open.
          messagesResponse = { messages: [] };
        }

        if (!ignore) {
          setDetails(eventResponse);
          setMessages(messagesResponse.messages || []);
          setProofFile(null);
          const initialResponses = {};
          for (const field of eventResponse.event?.customForm || []) {
            if (field.type === 'checkbox') {
              initialResponses[field.fieldId] = Array.isArray(field.options) && field.options.length ? [] : false;
            } else {
              initialResponses[field.fieldId] = '';
            }
          }
          setFormResponses(initialResponses);
          setFormFiles({});
          if (eventResponse.event?.type === 'MERCHANDISE') {
            setSelectedSku(eventResponse.event.merchandise?.items?.[0]?.sku || '');
          }
          if (eventResponse.event?.type === 'NORMAL' && eventResponse.event?.teamBased) {
            const openTeam = (eventResponse.teamOptions || []).find((team) => !team.isFull);
            setJoinTeamName(openTeam?.teamName || '');
          }
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
  }, [eventId]);

  useEffect(() => {
    const socket = io(socketUrl, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('discussion:join', { eventId });
    socket.on('discussion:new_message', ({ message }) => {
      setMessages((prev) => [...prev, message]);
    });
    socket.on('discussion:notification', ({ text }) => {
      setNotice(text);
      setTimeout(() => setNotice(''), 2500);
    });
    socket.on('discussion:reaction_updated', ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((msg) => (msg._id === messageId ? { ...msg, reactions } : msg)));
    });
    socket.on('discussion:message_pinned', ({ messageId, isPinned }) => {
      setMessages((prev) => prev.map((msg) => (msg._id === messageId ? { ...msg, isPinned } : msg)));
    });
    socket.on('discussion:message_deleted', ({ messageId }) => {
      setMessages((prev) => prev.map((msg) => (msg._id === messageId ? { ...msg, content: '[deleted]' } : msg)));
    });

    return () => {
      socket.emit('discussion:leave', { eventId });
      socket.disconnect();
    };
  }, [eventId]);

  const grouped = useMemo(() => {
    const root = [];
    const childMap = new Map();

    for (const msg of messages) {
      if (msg.parentMessage) {
        const key = String(msg.parentMessage);
        childMap.set(key, [...(childMap.get(key) || []), msg]);
      } else {
        root.push(msg);
      }
    }

    root.sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    return { root, childMap };
  }, [messages]);

  if (loading) return <div className="card">Loading event details...</div>;
  if (error) return <div className="card error-box">{error}</div>;
  if (!details?.event) return <div className="card">Event not found.</div>;

  const event = details.event;
  const canRegister = details.registrationOpen && details.availableSpots > 0;
  const hasOpenMerchOrder = ['CREATED', 'PENDING_APPROVAL'].includes(details.existingOrder?.status);

  async function registerNormal() {
    try {
      setActionMsg('');
      const payload = {
        responses: formResponses
      };

      if (event.teamBased) {
        payload.teamAction = teamAction;
        payload.teamName = teamAction === 'create' ? newTeamName : joinTeamName;
      }

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));

      for (const [fieldId, file] of Object.entries(formFiles)) {
        if (!file) continue;
        formData.append(`file_${fieldId}`, file);
      }

      const response = await apiRequest(`/events/${eventId}/register`, {
        method: 'POST',
        body: formData,
        isFormData: true
      });
      setActionMsg(`Registered successfully. Ticket ID: ${response.ticket.ticketId}`);
      const refreshed = await apiRequest(`/events/${eventId}`);
      setDetails(refreshed);
    } catch (err) {
      setActionMsg(err.message);
    }
  }

  async function createOrder() {
    try {
      setActionMsg('');
      await apiRequest(`/events/${eventId}/purchase`, {
        method: 'POST',
        body: {
          itemSku: selectedSku,
          quantity: Number(quantity)
        }
      });
      setProofFile(null);
      setActionMsg('Order created. Upload payment proof to submit for organizer approval.');
      const refreshed = await apiRequest(`/events/${eventId}`);
      setDetails(refreshed);
    } catch (err) {
      setActionMsg(err.message);
      if (err.status === 409) {
        const refreshed = await apiRequest(`/events/${eventId}`);
        setDetails(refreshed);
      }
    }
  }

  async function uploadProof(orderId) {
    if (!proofFile) {
      setActionMsg('Please choose a payment proof image first.');
      return;
    }

    try {
      setActionMsg('');
      const formData = new FormData();
      formData.append('proof', proofFile);
      await apiRequest(`/orders/${orderId}/upload-proof`, {
        method: 'POST',
        body: formData,
        isFormData: true
      });
      setProofFile(null);
      setActionMsg('Payment proof uploaded. Waiting for organizer approval.');
      const refreshed = await apiRequest(`/events/${eventId}`);
      setDetails(refreshed);
    } catch (err) {
      setActionMsg(err.message);
    }
  }

  async function postMessage() {
    if (!messageText.trim()) return;

    try {
      const response = await apiRequest(`/discussion/${eventId}/messages`, {
        method: 'POST',
        body: {
          content: messageText,
          parentMessage: replyTo || null
        }
      });
      setMessageText('');
      setReplyTo('');

      setMessages((prev) => {
        if (prev.find((m) => m._id === response.message._id)) return prev;
        return [...prev, response.message];
      });
    } catch (err) {
      setActionMsg(err.message);
    }
  }

  async function react(messageId, emoji) {
    try {
      await apiRequest(`/discussion/messages/${messageId}/react`, {
        method: 'POST',
        body: { emoji }
      });
    } catch (err) {
      setActionMsg(err.message);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>
          {event.name} <span className="badge">{event.type}</span>
        </h2>
        <p>{event.description}</p>
        <p>
          Organizer: <strong>{event.organizer?.organizerName}</strong>
        </p>
        <p>
          Eligibility: {(event.eligibility || []).join(', ') || 'Open'} | Fee: {event.registrationFee || 0}
        </p>
        <p>
          Registration Deadline: {dayjs(event.registrationDeadline).format('DD MMM YYYY, HH:mm')} | Event:{' '}
          {dayjs(event.startDate).format('DD MMM, HH:mm')} to {dayjs(event.endDate).format('DD MMM, HH:mm')}
        </p>
        <p>
          Capacity: {details.occupiedSpots}/{event.registrationLimit}
        </p>

        {!canRegister ? (
          <div className="warn-box">{details.blockingReason || 'Registration blocked (limit reached).'}</div>
        ) : null}
      </section>

      <section className="card">
        {event.type === 'NORMAL' ? (
          <>
            <h3>Register for Event</h3>
            {details.alreadyRegistered ? <p>You are already registered for this event.</p> : null}

            {event.teamBased ? (
              <>
                <p className="small-text">This is a team-based event. Max participants per team: {event.maxTeamSize}.</p>

                <label>
                  Team Selection
                  <select value={teamAction} onChange={(e) => setTeamAction(e.target.value)}>
                    <option value="create">Create a team</option>
                    <option value="join" disabled={!(details.teamOptions || []).some((team) => !team.isFull)}>
                      Join an existing team
                    </option>
                  </select>
                </label>

                {teamAction === 'create' ? (
                  <label>
                    Team Name
                    <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                  </label>
                ) : (
                  <label>
                    Existing Teams
                    <select value={joinTeamName} onChange={(e) => setJoinTeamName(e.target.value)}>
                      <option value="">Select a team</option>
                      {(details.teamOptions || []).map((team) => (
                        <option key={team.teamName} value={team.teamName} disabled={team.isFull}>
                          {team.teamName} ({team.memberCount}/{event.maxTeamSize})
                          {team.isFull ? ' - Full' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            ) : null}

            {(event.customForm || []).map((field) => (
              <label key={field.fieldId}>
                {field.label} {field.required ? '*' : ''}
                {field.type === 'dropdown' ? (
                  <select
                    value={formResponses[field.fieldId] || ''}
                    onChange={(e) => updateResponse(field.fieldId, e.target.value)}
                  >
                    <option value="">Select</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={formResponses[field.fieldId] || ''}
                    onChange={(e) => updateResponse(field.fieldId, e.target.value)}
                  />
                ) : field.type === 'checkbox' ? (
                  Array.isArray(field.options) && field.options.length ? (
                    <div className="chips">
                      {(field.options || []).map((opt) => {
                        const selected = Array.isArray(formResponses[field.fieldId]) ? formResponses[field.fieldId] : [];
                        const checked = selected.includes(opt);
                        return (
                          <label key={opt} className="inline-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCheckboxOption(field.fieldId, opt)}
                            />
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={Boolean(formResponses[field.fieldId])}
                        onChange={(e) => updateResponse(field.fieldId, e.target.checked)}
                      />
                      Yes
                    </label>
                  )
                ) : field.type === 'file' ? (
                  <div className="stack">
                    <input
                      type="file"
                      onChange={(e) =>
                        setFormFiles((prev) => ({
                          ...prev,
                          [field.fieldId]: e.target.files?.[0] || null
                        }))
                      }
                    />
                    {formFiles[field.fieldId] ? <small>Selected: {formFiles[field.fieldId].name}</small> : null}
                  </div>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                    value={formResponses[field.fieldId] || ''}
                    onChange={(e) => updateResponse(field.fieldId, e.target.value)}
                  />
                )}
              </label>
            ))}

            <button type="button" className="btn" onClick={registerNormal} disabled={!canRegister || details.alreadyRegistered}>
              Register
            </button>
          </>
        ) : (
          <>
            <h3>Purchase Merchandise</h3>

            <label>
              Item
              <select value={selectedSku} onChange={(e) => setSelectedSku(e.target.value)}>
                {(event.merchandise?.items || []).map((item) => (
                  <option key={item.sku} value={item.sku}>
                    {item.name} ({item.variant || '-'} | {item.color || '-'} | {item.size || '-'}) - Rs {item.price} - stock{' '}
                    {item.stock}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </label>

            <button type="button" className="btn" onClick={createOrder} disabled={!canRegister || hasOpenMerchOrder}>
              Purchase Now
            </button>
            {hasOpenMerchOrder ? <p className="small-text">Complete your current open order before creating a new one.</p> : null}

            <div className="divider" />

            <p>Existing Order Status: {details.existingOrder?.status || 'No previous order'}</p>
            {details.existingOrder?.reviewComment ? <p>Organizer Comment: {details.existingOrder.reviewComment}</p> : null}
            {['CREATED', 'REJECTED'].includes(details.existingOrder?.status) ? (
              <>
                <label>
                  Upload Payment Proof
                  <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                </label>
                <button
                  type="button"
                  className="btn"
                  onClick={() => uploadProof(details.existingOrder._id)}
                  disabled={!proofFile}
                >
                  Submit Proof
                </button>
              </>
            ) : null}
            {details.existingOrder?.status === 'PENDING_APPROVAL' ? (
              <p className="small-text">Your payment proof is pending organizer review.</p>
            ) : null}
            {details.existingOrder?.ticket?.ticketId ? (
              <p>
                Ticket: <a href={`/tickets/${details.existingOrder.ticket.ticketId}`}>{details.existingOrder.ticket.ticketId}</a>
              </p>
            ) : null}
          </>
        )}

        {actionMsg ? <div className="info-box">{actionMsg}</div> : null}
      </section>

      <section className="card">
        <h3>Real-Time Discussion Forum</h3>
        {notice ? <div className="info-box">{notice}</div> : null}

        <div className="discussion-input">
          <textarea
            rows={3}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Ask questions, discuss logistics, or post updates..."
          />

          <div className="forum-actions">
            <select value={replyTo} onChange={(e) => setReplyTo(e.target.value)}>
              <option value="">No Thread (new message)</option>
              {grouped.root.map((msg) => (
                <option key={msg._id} value={msg._id}>
                  Reply to: {msg.content.slice(0, 35)}
                </option>
              ))}
            </select>

            <button type="button" className="btn" onClick={postMessage}>
              Post
            </button>
          </div>
        </div>

        <div className="message-list">
          {grouped.root.map((msg) => (
            <div key={msg._id} className={msg.isPinned ? 'message pinned' : 'message'}>
              <div className="message-meta">
                <strong>
                  {msg.author?.organizerName || `${msg.author?.firstName || ''} ${msg.author?.lastName || ''}`.trim() ||
                    'User'}
                </strong>{' '}
                <small>({msg.authorRole})</small>
                <small>{dayjs(msg.createdAt).format('DD MMM HH:mm')}</small>
              </div>
              <p>{msg.content}</p>
              <div className="forum-actions">
                <button type="button" className="chip" onClick={() => react(msg._id, '👍')}>
                  👍 {(msg.reactions || []).find((r) => r.emoji === '👍')?.users?.length || 0}
                </button>
                <button type="button" className="chip" onClick={() => react(msg._id, '🔥')}>
                  🔥 {(msg.reactions || []).find((r) => r.emoji === '🔥')?.users?.length || 0}
                </button>
              </div>

              {(grouped.childMap.get(String(msg._id)) || []).map((child) => (
                <div key={child._id} className="message reply">
                  <div className="message-meta">
                    <strong>
                      {child.author?.organizerName ||
                        `${child.author?.firstName || ''} ${child.author?.lastName || ''}`.trim() ||
                        'User'}
                    </strong>{' '}
                    <small>({child.authorRole})</small>
                  </div>
                  <p>{child.content}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
