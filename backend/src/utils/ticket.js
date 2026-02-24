import { nanoid } from 'nanoid';
import QRCode from 'qrcode';

export async function buildTicketPayload({ eventId, participantId, ticketId }) {
  const payload = JSON.stringify({
    t: ticketId,
    e: eventId,
    p: participantId,
    iat: Date.now()
  });

  const qrData = await QRCode.toDataURL(payload);
  return { payload, qrData };
}

export function createTicketId() {
  return `FEL-${nanoid(10).toUpperCase()}`;
}
