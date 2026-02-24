# Felicity Connect - Full Testing Guide (Indexed by Assignment PDF)

This guide is indexed to the same requirement numbering used in the PDF.
Use it as a pass/fail checklist during self-evaluation and viva prep.

## 0) Pre-Test Setup

1. Start MongoDB.
2. Start backend (`http://localhost:5000`).
3. Start frontend (`http://localhost:5173`).
4. Verify backend is up:
```bash
curl -s http://localhost:5000/api/health
```
Expected: `{"ok":true,"service":"felicity-backend"}`.

Optional seeded dataset for demo/testing (March 2026 events + test participants):
```bash
cd backend
npm run seed:sample
```

To receive actual emails (instead of `[MAIL:DEV]` logs), configure SMTP in `backend/.env`:
```env
SMTP_HOST=<your_smtp_host>
SMTP_PORT=<your_smtp_port>
SMTP_USER=<your_smtp_user>
SMTP_PASS=<your_smtp_password>
SMTP_FROM=<sender_email>
PARTICIPANT_RESET_TOKEN_TTL_MINUTES=30
```

### Test Accounts

1. Admin
- Email: `admin@felicity.local`
- Password: `admin123`

2. Organizer (sample seeded)
- Example Email: `chess.club@org.felicity.local`
- Password: `club12345`

3. Participant
- Create from signup page (`/signup`).

4. Seeded Participants (for trending/top-5 and bulk checks)
- Emails: `test1@students.iiit.ac.in` ... `test50@students.iiit.ac.in`
- Password: `test12345`

## 3) User Roles

### 3.1 Participant (IIIT / Non-IIIT)

1. Sign up as IIIT participant (`participantType=IIIT`) with `@iiit.ac.in` or single-level subdomain email (`@students.iiit.ac.in`).
2. Sign up as Non-IIIT participant with normal email.
3. Login both accounts.

Expected:
1. Both can login.
2. IIIT account stores `participantType=IIIT`.
3. Non-IIIT account stores `participantType=NON_IIIT`.

### 3.2 Organizer

1. Login organizer account created by admin.
2. Confirm organizer dashboard is shown.

Expected:
1. Organizer account works only if pre-provisioned.

### 3.3 Admin

1. Login as `admin@felicity.local`.
2. Confirm admin dashboard is shown.

Expected:
1. Admin has access to admin-only pages.

## 4) Authentication & Security

### 4.1 Registration & Login

#### 4.1.1 Participant Registration

1. Try IIIT signup with invalid email domain (`abc@gmail.com`) and `participantType=IIIT`.
2. Try IIIT signup with `abc@iiit.ac.in`.
3. Try IIIT signup with `abc@students.iiit.ac.in`.
4. Try IIIT signup with deep subdomain `abc@x.y.iiit.ac.in`.
5. Try NON_IIIT signup with normal email.
6. Ensure contact number is exactly 10 digits numeric.

Expected:
1. Invalid IIIT domain is rejected.
2. IIIT base domain and exactly one subdomain are accepted.
3. Deep/multi-level subdomains are rejected.
4. For IIIT signup, college name is auto-set to `IIIT Hyderabad`.
5. NON_IIIT signup succeeds with email+password.
6. Non-10-digit phone is rejected.

#### 4.1.2 Organizer Authentication

1. Try calling nonexistent self-signup for organizer:
```bash
curl -s -X POST http://localhost:5000/api/auth/signup-organizer -H 'Content-Type: application/json' -d '{}'
```
2. Create organizer from Admin UI (`Manage Clubs/Organizers`).
3. Login organizer with generated credentials.
4. Submit organizer password reset request from organizer profile.
5. Approve/reject it from admin reset requests page.

Expected:
1. Organizer self-signup is not available.
2. Organizer is created only by admin.
3. Organizer can login using admin-shared credentials.
4. Password reset flows through admin approval workflow.

#### 4.1.3 Admin Account Provisioning

1. Start backend on clean DB.
2. Login as `admin@felicity.local` with env/default password.
3. Verify no admin signup page exists.
4. In admin UI, create and remove/disable organizer.

Expected:
1. Admin is auto-created as first system user.
2. Admin credentials come from backend env/default.
3. Admin has exclusive create/remove organizer privileges.

#### 4.1.4 Participant Password Recovery (Email Reset)

1. Open `/forgot-password`, submit a participant email.
2. Check backend logs (`[MAIL:DEV]`) or mailbox (if SMTP configured) for reset link.
3. Open `/reset-password` from the link, submit new password.
4. Login using old password (should fail).
5. Login using new password (should succeed).

Expected:
1. Reset link is generated and sent by email flow.
2. Reset token is single-use and time-limited.
3. Password updates only after valid token submission.
4. Existing sessions are invalidated after password reset.

### 4.2 Security Requirements

1. Check password storage in DB is hashed, not plaintext.
2. Call protected route without token:
```bash
curl -i http://localhost:5000/api/events
```
3. Call same route with valid token.
4. Try accessing admin endpoint with organizer token.
5. Try opening protected frontend routes while logged out (`/events`, `/admin/organizers`).

Expected:
1. Only `passwordHash` exists and looks like bcrypt hash.
2. Without token: `401`.
3. With token: success.
4. Wrong role: `403`.
5. Frontend redirects to login or role-appropriate page.
6. Forgot-password response does not disclose whether participant email exists.

### 4.3 Session Management

1. Login as participant/organizer/admin.
2. Confirm redirect to role dashboard.
3. Refresh browser tab.
4. Close and reopen browser.
5. Click logout.
6. Change password from profile, then try any API call without re-login.

Expected:
1. Redirect lands on correct dashboard.
2. Session persists across refresh/restart.
3. Logout clears token and protected routes become inaccessible.
4. After password change/reset, old session token is rejected and user must login again.

## 5) User Onboarding & Preferences

1. Complete signup without interests on the signup form.
2. After first login/dashboard load, onboarding popup appears for interests and followed organizers.
3. Save or skip onboarding popup.
4. Open profile and edit interests/followed organizers.
5. Follow/unfollow organizers from Clubs page.
6. Open Browse Events and verify recommendation ordering changes with interests/follows.

Expected:
1. Interests are not captured on signup form.
2. Post-signup onboarding popup captures preferences or allows skip.
3. Preferences are editable later from profile.
4. Follow state updates correctly.
5. Recommendations reflect interests/followed organizers.

## 6) User Data Models

### 6.1 Participant details

1. Create participant account.
2. Verify presence of fields via profile API/UI (`firstName`, `lastName`, `email`, `participantType`, `collegeName`, `contactNumber`).

Expected:
1. All required participant fields are present.
2. Password is not exposed and is hashed in DB.

### 6.2 Organizer details

1. Create organizer from admin panel.
2. Open organizer profile/details.

Expected:
1. Required organizer fields exist (`organizerName`, `category`, `description`, `contactEmail`).

## 7) Event Types

1. As organizer, create one `NORMAL` event.
2. Create one `MERCHANDISE` event with item variants.

Expected:
1. Both event types are supported and visible in browse/details.

## 8) Event Attributes

1. For each created event, fill all required core attributes.
2. For NORMAL event, add custom form fields (text, textarea, dropdown, checkbox, file upload, number, email), mark required/non-required, and reorder.
3. For MERCHANDISE event, add item size/color/variant/stock/purchaseLimit.

Expected:
1. Required attributes are stored and shown in detail pages.
2. Form builder works for normal events across all supported field types.
3. Merchandise metadata and stock controls work.

## 9) Participant Features & Navigation

### 9.1 Navigation Menu

1. Login as participant.
2. Check navbar entries.

Expected:
1. `Dashboard`, `Browse Events`, `Clubs/Organizers`, `Profile`, `Logout`.

### 9.2 My Events Dashboard

1. Register in at least one normal event.
2. Place at least one merchandise order.
3. Open participant dashboard.

Expected:
1. Upcoming events visible with name/type/organizer/schedule.
2. History tabs present: `Normal`, `Merchandise`, `Completed`, `Cancelled/Rejected`.
3. Records include status/team/ticket ID.

### 9.3 Browse Events Page

1. Search by partial event/organizer name.
2. Try typo/fuzzy-like query.
3. Apply filters: event type, eligibility, date range, followed clubs.
4. Check trending section.

Expected:
1. Search and filters work together.
2. Trending shows top events in last 24h.

### 9.4 Event Details Page

1. Open event details.
2. Try registration after deadline or with full capacity/out-of-stock.

Expected:
1. Full details shown.
2. Registration/purchase blocked with reason when invalid.

### 9.5 Event Registration Workflows

1. NORMAL event: submit registration form.
   - Include dropdown, checkbox, and file upload answers if present.
2. Confirm ticket appears in history and ticket page shows QR + ticket ID.
3. MERCHANDISE event: place an order from event page.
4. Upload payment proof image for that order.
5. As organizer, approve the pending order from organizer order workflow.
6. Confirm ticket appears only after approval.

Expected:
1. Normal registration creates ticket.
2. Custom form responses are validated by field type; invalid dropdown/checkbox/email/number values are rejected.
3. File upload responses are accepted for file fields and required file fields are enforced.
4. Merchandise order enters pending-review flow after proof upload.
5. Ticket + QR are generated only after organizer approval.
6. Stock decrements on approval (not while pending/rejected).
7. Out-of-stock purchase attempts are blocked.

### 9.6 Profile Page

1. Edit allowed fields.
2. Verify non-editable fields stay locked.
3. Change password using old+new password.

Expected:
1. Editable fields save.
2. Email and participantType remain read-only.
3. Password change succeeds with valid current password.

### 9.7 Clubs / Organizers Listing Page

1. Open list page.
2. Follow and unfollow organizer.

Expected:
1. Organizers show name/category/description.
2. Follow state updates correctly.

### 9.8 Organizer Detail Page (Participant View)

1. Open one organizer detail page.

Expected:
1. Organizer info shown.
2. Upcoming and past events sections shown.

## 10) Organizer Features & Navigation

### 10.1 Navigation Menu

1. Login as organizer.

Expected:
1. `Dashboard`, `Create Event`, `Profile`, `Logout`, `Ongoing Events`.

### 10.2 Organizer Dashboard

1. Open organizer dashboard.

Expected:
1. Event cards/carousel-style list with name/type/status.
2. Completed-event analytics visible (registrations/sales/revenue/attendance).

### 10.3 Event Detail Page (Organizer View)

1. Open organizer event detail.
2. Use participant search/filter.
3. Export participant CSV.

Expected:
1. Overview + analytics are shown.
2. Participant list includes required columns.
3. CSV export works.

### 10.4 Event Creation & Editing

1. Create event as draft.
2. Publish when required fields are complete.
3. For published event, try allowed updates (description/deadline extension/limit increase/close).
4. Mark ongoing/completed.
5. After first normal registration, try editing custom form.
6. Create a `NORMAL` event without adding merchandise items.
7. Try invalid timeline combinations:
   - `startDate >= endDate`
   - `registrationDeadline >= startDate`
8. In create/edit event form, verify eligibility is selected from dropdown (OPEN/IIIT/NON_IIIT), not free text.
9. Create a team-based `NORMAL` event and set max team size (>=2).
10. On participant event page for that event, verify flow starts with:
   - create team / join existing team choice
   - create path asks for team name
   - join path shows existing team dropdown
11. Fill one team to max size and try joining with another participant.

Expected:
1. Draft->Publish flow works.
2. Published restrictions enforced (only description update, deadline extension, registration limit increase, close/ongoing actions).
3. Ongoing/completed edit restrictions enforced.
4. Form locks after first registration.
5. `NORMAL` event save/publish does not fail on merchandise `sku/name` validation.
6. Invalid timeline requests are rejected with date-order validation message.
7. Eligibility is selected via dropdown and saved.
8. Team-based register flow enforces create/join logic.
9. Joining a full team is blocked by max team size validation.

### 10.5 Organizer Profile Page

1. Update organizer profile fields.
2. Add Discord webhook URL.
3. Publish new event.

Expected:
1. Editable fields save; login email remains fixed.
2. Webhook post attempt is made on publish.

## 11) Admin Features & Navigation

### 11.1 Navigation Menu

1. Login as admin.

Expected:
1. `Dashboard`, `Manage Clubs/Organizers`, `Password Reset Requests`, `Logout`.

### 11.2 Club/Organizer Management

1. Create organizer and note generated credentials.
2. Login with generated organizer credentials.
3. Disable organizer and try login.
4. Enable and login again.
5. Archive organizer.
6. Permanently delete organizer.

Expected:
1. Credentials are auto-generated and returned.
2. Disabled organizers cannot login.
3. Archive/delete actions work as expected.

## 12) Deployment

### 12.1 Hosting Requirements

1. Check `deployment.txt` exists.
2. Confirm frontend URL and backend URL are filled with actual deployment links before final submission.
3. Confirm backend uses env-based Mongo URI.

Expected:
1. Deployment file present.
2. URLs valid and reachable (for final evaluation).

### 12.2 Links for Evaluation

1. Verify root-level `deployment.txt` format.

Expected:
1. Contains required URLs.

## 13) Advanced Features

Important: Assignment requires selected features from each tier, not all options.
Implemented choices in this project are:
1. Tier A: A2, A3
2. Tier B: B1, B2
3. Tier C: C2

### 13.1 Tier A (Chosen 2)

#### A2 Merchandise Payment Approval Workflow

1. Participant places merchandise order from event page.
2. Upload payment proof image and verify status becomes `PENDING_APPROVAL`.
3. Open organizer event detail payment workflow and review pending orders with proof links.
4. Approve one pending order and reject another.
5. Confirm approved order gets ticket+QR and email; rejected/pending orders do not get ticket.
6. Confirm stock is reduced only on approval.
7. Repeat purchase attempts until stock is exhausted and try one more.

Expected:
1. Payment-proof upload drives pending approval workflow.
2. Organizer can approve/reject from dedicated merchandise order section.
3. Ticket + QR are generated only for approved orders.
4. Out-of-stock purchase attempts are blocked.

#### A3 QR Scanner & Attendance Tracking

1. Open organizer attendance scanner page.
2. Scan valid ticket payload/QR image/camera capture.
3. Scan same ticket again.
4. Check dashboard scanned vs not scanned.
5. Use manual override.
6. Export attendance CSV.

Expected:
1. First scan marks attendance with timestamp.
2. Duplicate scan is rejected/logged.
3. Live summary updates.
4. Manual override appears in logs.
5. CSV export works.

### 13.2 Tier B (Chosen 2)

#### B1 Real-Time Discussion Forum

1. Open event discussion as registered participant.
2. Post message, thread reply, add reaction.
3. Organizer posts announcement.
4. Organizer pins/deletes message.

Expected:
1. Messages appear in real-time.
2. Threading/reactions function.
3. Moderator actions reflect live.

#### B2 Organizer Password Reset Workflow

1. Organizer submits reset request with reason.
2. Admin views pending requests.
3. Admin approve/reject with comment.
4. On approve, use generated password to login organizer.

Expected:
1. Request statuses tracked (`PENDING/APPROVED/REJECTED`).
2. Approval generates new password and updates organizer login.

### 13.3 Tier C (Chosen 1)

#### C2 Add to Calendar Integration

1. Open ticket details page.
2. Download `.ics`.
3. Open Google Calendar link.
4. Open Outlook link.

Expected:
1. `.ics` downloads and imports correctly.
2. Google/Outlook links open prefilled event details.

## Not Selected (Optional Features)

These are optional tier features not chosen in this implementation:
1. Tier A: A1 Hackathon Team Registration (not selected)
2. Tier B: B3 Team Chat (not selected)
3. Tier C: C1 Anonymous Feedback, C3 Bot Protection (not selected)

## 14) Deliverables

### 14.1 Submission Structure

1. Verify root contains:
`backend/`, `frontend/`, `README.md`, `deployment.txt`.
2. Confirm ZIP export keeps this structure exactly.

Expected:
1. Folder structure matches assignment format.
2. ZIP is valid and not corrupt.

## 15) README Requirements

1. Open `README.md`.
2. Verify it documents frontend/backend libraries and why they were chosen.
3. Verify it clearly lists chosen Tier A/B/C features.
4. Verify setup steps are present for local run.
5. Verify technical/design choices are described.

Expected:
1. README includes all required documentation for evaluation.

## 16) Instruction Compliance (Self-check)

1. Ensure you can explain each major module during viva.
2. Keep short notes linking each feature to route/page files.

Expected:
1. You can explain logic without reading code line-by-line during eval.

## Final Pass/Fail Summary Sheet (Quick Use)

Create a final checklist table with columns:
1. Requirement ID (e.g., `9.5`)
2. Status (`PASS/FAIL`)
3. Evidence (screenshot/API response)
4. Notes

This makes viva and grading discussion much easier.
