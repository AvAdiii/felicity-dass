import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';

const organizer_seed = [
  { name: 'TVRQC', category: 'Quiz Club', description: 'Quiz and trivia events', contactEmail: 'tvrqc@iiit.ac.in' },
  { name: 'Chess Club', category: 'Games Club', description: 'Chess and strategy games', contactEmail: 'chess@iiit.ac.in' },
  { name: 'DebSoc', category: 'Debate Club', description: 'MUNs, debates, speaking events', contactEmail: 'debsoc@iiit.ac.in' },
  { name: 'Pentaprism', category: 'Photography Club', description: 'Photography contests and workshops', contactEmail: 'pentaprism@iiit.ac.in' },
  { name: 'Asec', category: 'Sports Club', description: 'Sports competitions and games', contactEmail: 'asec@iiit.ac.in' },
  { name: 'TDC', category: 'Dance Club', description: 'Dance events and competitions', contactEmail: 'tdc@iiit.ac.in' },
  { name: 'LitClub', category: 'Literary Club', description: 'Literature and language events', contactEmail: 'litclub@iiit.ac.in' },
  { name: 'Language Club', category: 'Language Club', description: 'Language and verbal creativity events', contactEmail: 'langclub@iiit.ac.in' },
  { name: 'Cyclorama', category: 'Cultural Club', description: 'Cultural and thematic events', contactEmail: 'cyclorama@iiit.ac.in' },
  { name: 'Adventure Group', category: 'Activity Club', description: 'Adventure and puzzle events', contactEmail: 'adventure@iiit.ac.in' },
  { name: 'Decore', category: 'Design Club', description: 'Design and creativity battles', contactEmail: 'decore@iiit.ac.in' },
  { name: 'TGC', category: 'Gaming Club', description: 'Gaming and co-op events', contactEmail: 'tgc@iiit.ac.in' },
  { name: 'Felicity', category: 'Fest Team', description: 'Main stage and flagship fest events', contactEmail: 'felicity@iiit.ac.in' },
  { name: 'ArtSoc', category: 'Art Club', description: 'Art and creative showcase events', contactEmail: 'artsoc@iiit.ac.in' },
  { name: 'Felicity Team', category: 'Fest Team', description: 'Felicity support and side-stage events', contactEmail: 'team@felicity.iiit.ac.in' },
  { name: 'Queer', category: 'Community Group', description: 'Community-led participant activities', contactEmail: 'queer@iiit.ac.in' },
  { name: 'Rouge - Fashion Club', category: 'Fashion Club', description: 'Fashion and rampwalk events', contactEmail: 'rouge@iiit.ac.in' }
];

const march_events = [
  { name: 'Midnight AV Quiz', organizer: 'TVRQC', venue: 'H105', date: '2026-03-01', start: '00:00', end: '03:00', prize: '', tags: ['quiz', 'night'] },
  {
    name: 'Rapid Rumble',
    organizer: 'Chess Club',
    venue: 'Himalaya 2nd Floor',
    date: '2026-03-02',
    start: '09:00',
    end: '17:00',
    prize: '30000',
    tags: ['chess', 'team'],
    teamBased: true,
    maxTeamSize: 4
  },
  { name: 'IIIT MUN', organizer: 'DebSoc', venue: 'KRB Auditorium', date: '2026-03-03', start: '09:00', end: '17:00', prize: '8000', tags: ['mun', 'debate'] },
  { name: 'Pic-a-Boo', organizer: 'Pentaprism', venue: 'H205', date: '2026-03-04', start: '11:00', end: '13:30', prize: '6000', tags: ['photo', 'competition'] },
  {
    name: 'Futsal',
    organizer: 'Asec',
    venue: 'Football Ground (Half Court)',
    date: '2026-03-05',
    start: '11:00',
    end: '18:00',
    prize: '7800',
    tags: ['sports', 'futsal'],
    teamBased: true,
    maxTeamSize: 7
  },
  {
    name: 'ZEST Western',
    organizer: 'TDC',
    venue: 'Alumni Lounge + Himalaya / Nilgiri Rooms',
    date: '2026-03-06',
    start: '12:00',
    end: '20:00',
    prize: '70000',
    tags: ['dance', 'zest']
  },
  {
    name: 'Treasure Hunt',
    organizer: 'LitClub',
    venue: 'H105',
    date: '2026-03-07',
    start: '14:00',
    end: '17:00',
    prize: '',
    tags: ['hunt', 'team'],
    teamBased: true,
    maxTeamSize: 4
  },
  {
    name: 'Zest Dance Competition',
    organizer: 'Felicity',
    venue: 'Main Stage, Felicity Ground',
    date: '2026-03-08',
    start: '15:00',
    end: '18:30',
    prize: '',
    tags: ['dance', 'competition']
  },
  { name: 'Spray Painting', organizer: 'ArtSoc', venue: 'Kadamba Road', date: '2026-03-09', start: '16:00', end: '19:00', prize: '', tags: ['art', 'spray'] },
  { name: 'Prompt Mayhem', organizer: 'Language Club', venue: 'H103', date: '2026-03-10', start: '17:00', end: '19:00', prize: '8000', tags: ['language', 'prompt'] },
  {
    name: 'Dance Inaugurals',
    organizer: 'Felicity',
    venue: 'Main Stage, Felicity Ground',
    date: '2026-03-11',
    start: '18:30',
    end: '21:00',
    prize: '',
    tags: ['dance', 'inaugural']
  },
  { name: 'DJ Night', organizer: 'Felicity', venue: 'Main Stage, Felicity Ground', date: '2026-03-12', start: '21:00', end: '23:00', prize: '', tags: ['music', 'dj'] },
  { name: 'Co-opium', organizer: 'TGC', venue: 'Bakul Warehouse', date: '2026-03-13', start: '09:00', end: '21:00', prize: '', tags: ['gaming', 'coop'] },
  { name: 'Jamming Session', organizer: 'Felicity Team', venue: 'Felicity Ground', date: '2026-03-13', start: '23:00', end: '23:59', prize: '', tags: ['music', 'jam'] },
  {
    name: 'Futsal',
    organizer: 'Asec',
    venue: 'Football Ground (Half Court)',
    date: '2026-03-14',
    start: '11:00',
    end: '18:00',
    prize: '7800',
    tags: ['sports', 'futsal'],
    teamBased: true,
    maxTeamSize: 7
  },
  { name: 'Ollywood Casino', organizer: 'Cyclorama', venue: 'H105', date: '2026-03-15', start: '14:00', end: '17:00', prize: '2500', tags: ['casino', 'fun'] },
  { name: 'Zest Classical', organizer: 'TDC', venue: 'KRB Auditorium', date: '2026-03-16', start: '13:30', end: '18:00', prize: '', tags: ['dance', 'classical'] },
  { name: 'LitWit', organizer: 'LitClub', venue: 'H103, H104', date: '2026-03-17', start: '14:00', end: '16:00', prize: '1000', tags: ['literature', 'quiz'] },
  {
    name: 'The Guesser Games',
    organizer: 'Adventure Group',
    venue: 'D-101 Thub',
    date: '2026-03-18',
    start: '14:00',
    end: '16:00',
    prize: '5000',
    tags: ['guess', 'team'],
    teamBased: true,
    maxTeamSize: 5
  },
  { name: 'Music Inaugurals', organizer: 'Felicity', venue: 'Main Stage, Felicity Ground', date: '2026-03-19', start: '15:30', end: '17:30', prize: '', tags: ['music', 'inaugural'] },
  { name: 'Photo Date', organizer: 'Pentaprism', venue: 'SH2', date: '2026-03-20', start: '16:00', end: '18:30', prize: '5000', tags: ['photo', 'date'] },
  { name: 'Thank You, Next Friend', organizer: 'Queer', venue: 'H103, H104', date: '2026-03-21', start: '16:30', end: '19:00', prize: '', tags: ['social', 'community'] },
  { name: 'Telugu Band', organizer: 'Felicity', venue: 'Main Stage, Felicity Ground', date: '2026-03-22', start: '19:00', end: '21:00', prize: '', tags: ['music', 'band'] },
  { name: 'College Standups', organizer: 'Felicity', venue: 'Main Stage, Felicity Ground', date: '2026-03-23', start: '19:00', end: '19:30', prize: '', tags: ['comedy', 'standup'] },
  {
    name: 'Vivek Samtani & Pranav Sharma',
    organizer: 'Felicity',
    venue: 'Main Stage, Felicity Ground',
    date: '2026-03-24',
    start: '20:00',
    end: '21:00',
    prize: '',
    tags: ['comedy', 'headliner']
  },
  { name: 'Shreya Baruah', organizer: 'Felicity', venue: 'Main Stage, Felicity Ground', date: '2026-03-24', start: '21:15', end: '22:15', prize: '', tags: ['music', 'artist'] },
  { name: 'Retro DJ Night', organizer: 'Felicity', venue: 'Main Stage, Felicity Ground', date: '2026-03-25', start: '21:45', end: '23:00', prize: '', tags: ['music', 'retro'] },
  { name: 'Co-opium', organizer: 'TGC', venue: 'Bakul Warehouse', date: '2026-03-26', start: '09:00', end: '21:00', prize: '', tags: ['gaming', 'coop'] },
  {
    name: 'Capture the Flag',
    organizer: 'Asec',
    venue: 'Football Ground (Half Court)',
    date: '2026-03-27',
    start: '11:00',
    end: '17:00',
    prize: '',
    tags: ['sports', 'team'],
    teamBased: true,
    maxTeamSize: 6
  },
  {
    name: 'Battle of Brains',
    organizer: 'TVRQC',
    venue: 'KRB Auditorium',
    date: '2026-03-28',
    start: '14:00',
    end: '17:00',
    prize: '17500',
    tags: ['quiz', 'team'],
    teamBased: true,
    maxTeamSize: 4
  },
  { name: 'Face Painting', organizer: 'ArtSoc', venue: 'Kadamba Road', date: '2026-03-29', start: '15:00', end: '19:00', prize: '', tags: ['art', 'facepaint'] },
  {
    name: 'Design Battles',
    organizer: 'Decore',
    venue: 'H105',
    date: '2026-03-30',
    start: '15:00',
    end: '18:00',
    prize: '8000',
    tags: ['design', 'team'],
    teamBased: true,
    maxTeamSize: 4
  },
  { name: 'Felicity Rampwalk', organizer: 'Rouge - Fashion Club', venue: 'Main Stage, Felicity Ground', date: '2026-03-30', start: '19:30', end: '20:00', prize: '', tags: ['fashion', 'rampwalk'] },
  { name: 'College Band', organizer: 'Felicity', venue: 'Main Stage, Felicity Ground', date: '2026-03-30', start: '20:00', end: '20:30', prize: '', tags: ['music', 'college-band'] },
  { name: 'Chaar Diwaari', organizer: 'Felicity', venue: 'Main Stage, Felicity Ground', date: '2026-03-31', start: '20:00', end: '21:30', prize: '', tags: ['music', 'headliner'] },
  { name: 'Anuj Rehan', organizer: 'Felicity', venue: 'Main Stage, Felicity Ground', date: '2026-03-31', start: '21:45', end: '23:00', prize: '', tags: ['music', 'headliner'] },
  { name: 'Co-opium', organizer: 'TGC', venue: 'Bakul Warehouse', date: '2026-03-31', start: '09:00', end: '21:00', prize: '', tags: ['gaming', 'coop'] }
];

function dt(date, time) {
  return new Date(`${date}T${time}:00.000+05:30`);
}

function slug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function organizer_login_email(name) {
  const slugged = slug(name).replace(/-/g, '.');
  return `${slugged || 'organizer'}@org.felicity.local`;
}

async function ensure_organizer(org) {
  let organizer = await User.findOne({ role: 'organizer', organizerName: org.name });
  if (organizer) return organizer;

  const password_hash = await bcrypt.hash('club12345', 10);
  organizer = await User.create({
    role: 'organizer',
    email: organizer_login_email(org.name),
    passwordHash: password_hash,
    organizerName: org.name,
    category: org.category,
    description: org.description,
    contactEmail: org.contactEmail,
    disabled: false,
    archived: false
  });

  return organizer;
}

function build_description(item) {
  const lines = [`${item.name} by ${item.organizer}.`, `Venue: ${item.venue}.`];
  if (item.prize) {
    lines.push(`Prize pool: Rs ${item.prize}.`);
  }
  lines.push('Curated sample data seeded for March 2026.');
  return lines.join(' ');
}

async function upsert_event(item, organizer_id) {
  const start_date = dt(item.date, item.start);
  const end_date = dt(item.date, item.end);
  const registration_deadline = new Date(start_date.getTime() - 48 * 60 * 60 * 1000);

  let event = await Event.findOne({
    organizer: organizer_id,
    name: item.name,
    startDate: start_date
  });

  const payload = {
    organizer: organizer_id,
    name: item.name,
    description: build_description(item),
    type: 'NORMAL',
    eligibility: ['OPEN'],
    registrationDeadline: registration_deadline,
    startDate: start_date,
    endDate: end_date,
    registrationLimit: 300,
    registrationFee: 0,
    teamBased: Boolean(item.teamBased),
    maxTeamSize: item.teamBased ? Number(item.maxTeamSize || 4) : 1,
    tags: item.tags || [],
    customForm: [
      {
        fieldId: 'phone',
        label: 'Phone Number',
        type: 'text',
        required: true,
        order: 0
      },
      {
        fieldId: 'experience',
        label: 'Prior Experience',
        type: 'text',
        required: false,
        order: 1
      }
    ],
    merchandise: { items: [] },
    status: 'PUBLISHED',
    formLocked: false
  };

  if (!event) {
    event = await Event.create(payload);
    return { created: true, event };
  }

  Object.assign(event, payload);
  await event.save();
  return { created: false, event };
}

async function ensure_test_participant(idx, password_hash) {
  const email = `test${idx}@students.iiit.ac.in`;
  let participant = await User.findOne({ role: 'participant', email });

  if (!participant) {
    participant = await User.create({
      role: 'participant',
      email,
      passwordHash: password_hash,
      firstName: `test${idx}`,
      lastName: 'user',
      participantType: 'IIIT',
      collegeName: 'IIIT Hyderabad',
      contactNumber: String(9000000000 + idx),
      preferences: { interests: [], followedOrganizers: [] },
      onboardingCompleted: true
    });
  }

  return participant;
}

function get_first_event(events_by_name, event_name) {
  const list = events_by_name.get(event_name) || [];
  return list[0] || null;
}

async function create_registration_if_missing({ event, participant, team_name }) {
  const existing = await Registration.findOne({
    event: event._id,
    participant: participant._id
  });

  if (existing) {
    return false;
  }

  await Registration.create({
    event: event._id,
    participant: participant._id,
    teamName: team_name || null,
    responses: { phone: participant.contactNumber || '' },
    status: 'REGISTERED'
  });
  return true;
}

function team_name_for(event, index_in_bucket) {
  if (!event.teamBased) return null;
  const size = Number(event.maxTeamSize || 4);
  const team_number = Math.floor(index_in_bucket / size) + 1;
  return `${slug(event.name)}-team-${team_number}`;
}

async function seed_dummy_registrations(participants, events_by_name) {
  const targets = [
    { eventName: 'Rapid Rumble', count: 12 },
    { eventName: 'Battle of Brains', count: 10 },
    { eventName: 'Capture the Flag', count: 9 },
    { eventName: 'Treasure Hunt', count: 8 },
    { eventName: 'IIIT MUN', count: 7 }
  ];

  const fallback_event_names = ['Photo Date', 'Design Battles', 'Ollywood Casino', 'ZEST Western'];

  const participant_ids = participants.map((participant) => participant._id);
  await Registration.deleteMany({ participant: { $in: participant_ids } });

  let created = 0;
  let ptr = 0;
  const touched_events = new Set();

  for (const target of targets) {
    const event = get_first_event(events_by_name, target.eventName);
    if (!event) continue;

    for (let i = 0; i < target.count && ptr < participants.length; i += 1) {
      const participant = participants[ptr];
      const team_name = team_name_for(event, i);
      const made = await create_registration_if_missing({ event, participant, team_name });
      if (made) created += 1;
      touched_events.add(event._id.toString());
      ptr += 1;
    }
  }

  for (const event_name of fallback_event_names) {
    if (ptr >= participants.length) break;
    const event = get_first_event(events_by_name, event_name);
    if (!event) continue;

    while (ptr < participants.length && ptr % 2 === 0) {
      const participant = participants[ptr];
      const team_name = team_name_for(event, ptr);
      const made = await create_registration_if_missing({ event, participant, team_name });
      if (made) created += 1;
      touched_events.add(event._id.toString());
      ptr += 1;
    }
  }

  while (ptr < participants.length) {
    const event = get_first_event(events_by_name, 'Music Inaugurals') || get_first_event(events_by_name, 'IIIT MUN');
    if (!event) break;
    const participant = participants[ptr];
    const team_name = team_name_for(event, ptr);
    const made = await create_registration_if_missing({ event, participant, team_name });
    if (made) created += 1;
    touched_events.add(event._id.toString());
    ptr += 1;
  }

  await Event.updateMany({ _id: { $in: [...touched_events] } }, { $set: { formLocked: true } });
  return created;
}

async function main() {
  const mongo_uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/felicity';
  await mongoose.connect(mongo_uri);

  const event_names = [...new Set(march_events.map((event) => event.name))];
  await Event.deleteMany({
    name: { $in: event_names },
    startDate: {
      $gte: new Date('2026-02-01T00:00:00.000+05:30'),
      $lt: new Date('2026-03-01T00:00:00.000+05:30')
    }
  });

  const organizers = new Map();
  for (const org of organizer_seed) {
    const organizer = await ensure_organizer(org);
    organizers.set(org.name, organizer);
  }

  const events_by_name = new Map();
  let created_events = 0;
  let updated_events = 0;

  for (const item of march_events) {
    const organizer = organizers.get(item.organizer);
    if (!organizer) continue;

    const result = await upsert_event(item, organizer._id);
    if (result.created) created_events += 1;
    else updated_events += 1;

    const list = events_by_name.get(item.name) || [];
    list.push(result.event);
    events_by_name.set(item.name, list);
  }

  const participant_password_hash = await bcrypt.hash('test12345', 10);
  const participants = [];
  for (let i = 1; i <= 50; i += 1) {
    const participant = await ensure_test_participant(i, participant_password_hash);
    participants.push(participant);
  }

  const created_registrations = await seed_dummy_registrations(participants, events_by_name);

  console.log(`Organizers ensured: ${organizers.size}`);
  console.log(`March events created: ${created_events}`);
  console.log(`March events updated: ${updated_events}`);
  console.log(`Participants ensured: ${participants.length}`);
  console.log(`Dummy registrations created: ${created_registrations}`);
  console.log('Seed complete: March 2026 events + test1..test50 participants + trending-ready registrations.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
