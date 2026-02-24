# Felicity Connect (MERN)

This is my Assignment 1 submission for DASS.
I built a full-stack MERN-style event platform for participants, organizers, and admin.

## Directory Structure

```text
assignment2/
|-- backend/
|-- frontend/
|-- README.md
|-- deployment.txt
```

## Quick Stack Summary

- **Frontend**: React (Vite), React Router, Socket.IO client
- **Backend**: Node.js, Express.js, MongoDB + Mongoose, JWT auth, bcrypt
- **Realtime**: Socket.IO (discussion forum notifications/messages)
- **Utility**: QR code ticket generation, CSV exports, calendar `.ics`

## Libraries / Frameworks Used (with justification)

### Backend

- **express**: API routing and middleware pipeline
- **mongoose**: schema-based modeling + validation for users/events/orders/tickets
- **bcryptjs**: secure password hashing for all accounts
- **jsonwebtoken**: role-based JWT auth for protected routes
- **cors**: allow frontend-backend integration in local/deployed environments
- **dotenv**: configurable secrets/URLs per environment
- **multer**: file uploads (used where proof/image uploads are needed)
- **qrcode**: generating QR data for tickets
- **socket.io**: realtime discussion features and notification broadcasts
- **dayjs**: date math/formatting (trending/24h logic, calendar)
- **nanoid**: unique Ticket ID generation
- **nodemailer**: email integration layer (falls back to console in dev)

### Frontend

- **react + react-dom**: component-based UI
- **react-router-dom**: role-based protected routing/navigation
- **socket.io-client**: realtime forum updates
- **dayjs**: consistent date display on dashboards/events
- **jsqr**: decode QR from uploaded images/camera frames (attendance)
- **vite**: fast frontend build/dev server setup

## Data Models (Required + additional attributes)

### Participant (User role = `participant`)
Required fields included:
- firstName, lastName, email (unique), participantType, collegeName, contactNumber, passwordHash

Additional attributes:
- `preferences.interests`: onboarding + recommendations
- `preferences.followedOrganizers`: followed clubs filter
- `onboardingCompleted`: onboarding flow state

### Organizer (User role = `organizer`)
Required fields included:
- organizerName, category, description, contactEmail

Additional attributes:
- `contactNumber`: profile communication
- `discordWebhookUrl`: auto-post new events on publish
- `disabled`, `archived`: admin account lifecycle actions

### Event
Required fields included:
- name, description, type, eligibility, registrationDeadline, startDate, endDate, registrationLimit, registrationFee, organizer, tags

Additional attributes:
- `status`: DRAFT/PUBLISHED/ONGOING/CLOSED/COMPLETED
- `customForm`: dynamic registration builder for normal events
- `formLocked`: locks form after first registration
- `merchandise.items[]`: variants/size/color/stock/purchaseLimit for merchandise events

### Other core models
- `Registration` (normal event registrations + teamName + responses)
- `MerchandiseOrder` (proof upload, pending/approve/reject workflow)
- `Ticket` (unique ID + QR payload/data)
- `AttendanceLog` (scan/duplicate/manual override audit)
- `DiscussionMessage` (threading/reactions/pin/delete)
- `PasswordResetRequest` (organizer-admin reset workflow tracking)
- `ParticipantPasswordResetToken` (single-use, expiring email reset tokens)

## Part 1

### 4. Authentication & Security
- Participant signup with IIIT domain validation for `participantType=IIIT`
- Organizer self-registration blocked (admin creates organizer accounts)
- Admin bootstrap account created in backend startup (`ensureAdmin()`)
- bcrypt password hashing for all accounts
- participant forgot-password via email reset link with token expiry + single-use enforcement
- JWT route protection and role-based middleware
- protected frontend routes (login/signup are public; all others protected)
- session persistence via localStorage token + `/auth/me` bootstrap
- logout clears token

### 5. User Onboarding & Preferences
- interest selection during signup
- profile preference edits later
- follow organizers
- recommendations on browse page based on interests + followed clubs

### 6. User Data Models
- required participant and organizer fields are included in schema
- additional fields justified above

### 7. Event Types
- `NORMAL` event
- `MERCHANDISE` event

### 8. Event Attributes
- all required event fields included
- normal event custom form builder with required/flexible fields and reordering
- custom form supports text/textarea/dropdown/checkbox/file/number/email, with type-aware validation on registration
- merchandise items include size/color/variant/stock/purchaseLimit

### 9. Participant Features & Navigation
- navbar: Dashboard, Browse Events, Clubs/Organizers, Profile, Logout
- My Events Dashboard: upcoming + categorized history tabs
- event records include event type, organizer, status, team, ticket ID
- browse page: partial+fuzzy search, trending top 5 (24h), filters (type/eligibility/date/followed)
- event details: full info + registration/purchase blocking
- normal registration creates ticket + email flow
- merchandise flow supports payment-proof upload and organizer approval before ticket generation
- ticket includes unique ID + QR; visible in history/ticket page
- profile editable/non-editable fields + password change
- clubs list with follow/unfollow
- organizer detail page with upcoming/past events

### 10. Organizer Features & Navigation
- navbar: Dashboard, Create Event, Ongoing Events, Profile, Logout
- dashboard cards + completed event analytics
- organizer event detail: overview + analytics + participant list + search/filter + CSV export
- event create/edit flow with status rules
- status rules enforced: Draft (free edits), Published (description + deadline extension + limit increase + close/ongoing), Ongoing/Completed/CLOSED (status-only updates)
- dynamic form builder and lock after first registration
- organizer profile editable fields + discord webhook integration

### 11. Admin Features & Navigation
- navbar: Dashboard, Manage Clubs/Organizers, Password Reset Requests, Logout
- add organizer: auto-generated login email/password returned to admin
- remove/disable/archive/delete organizer actions
- disabled organizers cannot login

### 12. Deployment
- deployment document included (`deployment.txt`)
- env-based MongoDB URI expected for Atlas in production

## Part 2

### Tier A
1. **Merchandise Payment Approval Workflow** (implemented)
- participant places merchandise order (subject to stock and per-item limits)
- participant uploads payment proof image; order moves to `PENDING_APPROVAL`
- organizer reviews proof and approves/rejects from organizer order panel
- on approval: stock decremented, ticket+QR generated, confirmation email sent
- no ticket/QR while order is in `CREATED` or `REJECTED`

2. **QR Scanner & Attendance Tracking** (implemented)
- scan via raw QR payload, uploaded image decoding, or camera frame capture
- duplicate scans rejected and logged
- timestamped attendance logs
- live dashboard with scanned vs not scanned participants
- attendance CSV export
- manual override with audit note

### Tier B
1. **Real-Time Discussion Forum** (implemented)
- event-specific discussion on event detail page
- registered participants can post
- threading support via parent message link
- reactions on messages
- organizer moderation: pin/delete messages
- organizer announcements
- realtime notifications/message updates via Socket.IO

2. **Organizer Password Reset Workflow** (implemented)
- organizer submits reset request with reason
- admin sees request list with status/history
- admin approve/reject with comment
- on approval, new password auto-generated and returned to admin for sharing

### Tier C
1. **Add to Calendar Integration** (implemented)
- downloadable `.ics` for ticketed events
- Google Calendar link
- Outlook link

## Setup Instructions

## 1) Backend

```bash
cd backend
cp .env.example .env
# set MONGO_URI, JWT_SECRET, ADMIN creds, SMTP if needed
npm install
npm run dev
```

Backend default: `http://localhost:5000`

## 2) Frontend

```bash
cd frontend
cp .env.example .env
# set VITE_API_URL and VITE_SOCKET_URL if different
npm install
npm run dev
```

Frontend default: `http://localhost:5173`

## Main API Groups

- `/api/auth/*`
- `/api/events/*`, `/api/orders/*`, `/api/tickets/*`
- `/api/participants/*`
- `/api/organizers/*`
- `/api/admin/*`
- `/api/discussion/*`
- `/api/attendance/*`

## Notes

- Admin account is backend-provisioned automatically on first startup.
- Organizer accounts are admin-provisioned only.
- Session persists until logout/token removal.
- SMTP is optional in local mode (email content prints to console if SMTP not configured).
- `PARTICIPANT_RESET_TOKEN_TTL_MINUTES` controls participant reset-link validity window (default 30).
