import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

function escapeText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildICS({ uid, title, description, location, startDate, endDate }) {
  const dtStart = dayjs(startDate).utc().format('YYYYMMDDTHHmmss[Z]');
  const dtEnd = dayjs(endDate).utc().format('YYYYMMDDTHHmmss[Z]');
  const dtStamp = dayjs().utc().format('YYYYMMDDTHHmmss[Z]');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Felicity Connect//Event System//EN',
    'BEGIN:VEVENT',
    `UID:${escapeText(uid)}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(location || 'IIIT')}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

export function buildGoogleCalendarLink({ title, description, startDate, endDate, location }) {
  const fmt = (d) => dayjs(d).utc().format('YYYYMMDDTHHmmss[Z]');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: description,
    location: location || 'IIIT',
    dates: `${fmt(startDate)}/${fmt(endDate)}`
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookCalendarLink({ title, description, startDate, endDate, location }) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    body: description,
    startdt: new Date(startDate).toISOString(),
    enddt: new Date(endDate).toISOString(),
    location: location || 'IIIT'
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
