import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import authRoutes from './routes/auth.routes.js';
import eventRoutes from './routes/event.routes.js';
import participantRoutes from './routes/participant.routes.js';
import organizerRoutes from './routes/organizer.routes.js';
import adminRoutes from './routes/admin.routes.js';
import discussionRoutes from './routes/discussion.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import { notFound, errorHandler } from './middleware/error.js';
import { verifyEmailTransport, mailIsConfigured } from './utils/email.js';

const app = express();
const server = http.createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || '*',
    credentials: true
  }
});

app.locals.io = io;

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || '*',
    credentials: true
  })
);
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'felicity-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api', eventRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/organizers', organizerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/discussion', discussionRoutes);
app.use('/api/attendance', attendanceRoutes);

app.use(notFound);
app.use(errorHandler);

io.on('connection', (socket) => {
  socket.on('discussion:join', ({ eventId }) => {
    if (!eventId) return;
    socket.join(`event:${eventId}`);
  });

  socket.on('discussion:leave', ({ eventId }) => {
    if (!eventId) return;
    socket.leave(`event:${eventId}`);
  });

  socket.on('disconnect', () => {
    // Keeping default disconnect flow.
  });
});

async function ensureAdmin() {
  const existing = await User.findOne({ role: 'admin' });
  if (existing) return;

  const email = (process.env.ADMIN_EMAIL || 'admin@felicity.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    role: 'admin',
    email,
    passwordHash,
    firstName: 'System',
    lastName: 'Admin'
  });

  console.log(`[bootstrap] Admin created with email ${email}`);
}

const port = Number(process.env.PORT || 5000);
const mongo_uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/felicity';

(async function start() {
  try {
    await connectDB(mongo_uri);
    await ensureAdmin();
    if (mailIsConfigured()) {
      await verifyEmailTransport();
    } else {
      console.log('[mail] SMTP env is missing, emails will be logged in dev mode.');
    }

    server.listen(port, () => {
      console.log(`Backend listening on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
})();
