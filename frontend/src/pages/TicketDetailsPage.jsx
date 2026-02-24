import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { apiRequest, getApiBase } from '../api';

export default function TicketDetailsPage() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [calendarLinks, setCalendarLinks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [ticketRes, linksRes] = await Promise.all([
          apiRequest(`/tickets/${ticketId}`),
          apiRequest(`/tickets/${ticketId}/calendar-links`)
        ]);

        if (!ignore) {
          setTicket(ticketRes.ticket);
          setCalendarLinks(linksRes);
        }
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [ticketId]);

  if (error) return <div className="card error-box">{error}</div>;
  if (!ticket) return <div className="card">Loading ticket...</div>;

  async function downloadIcs() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBase()}/tickets/${ticket.ticketId}/calendar.ics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) throw new Error('Could not download .ics file');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ticket.ticketId}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Ticket: {ticket.ticketId}</h2>
        <p>Event: {ticket.event?.name}</p>
        <p>
          Participant: {ticket.participant?.firstName} {ticket.participant?.lastName}
        </p>
        <p>
          Schedule: {dayjs(ticket.event?.startDate).format('DD MMM YYYY, HH:mm')} to{' '}
          {dayjs(ticket.event?.endDate).format('DD MMM YYYY, HH:mm')}
        </p>
        <p>Status: {ticket.status}</p>
        <img src={ticket.qrData} alt="ticket qr" className="ticket-qr" />
      </section>

      <section className="card">
        <h3>Add to Calendar</h3>
        <div className="forum-actions">
          <button type="button" className="btn-link" onClick={downloadIcs}>
            Download .ics
          </button>
          <a className="btn-link" href={calendarLinks?.googleLink} target="_blank" rel="noreferrer">
            Open in Google Calendar
          </a>
          <a className="btn-link" href={calendarLinks?.outlookLink} target="_blank" rel="noreferrer">
            Open in Outlook
          </a>
        </div>
      </section>
    </div>
  );
}
