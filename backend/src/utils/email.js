import nodemailer from 'nodemailer';

let transporter;
let verify_promise;
let verified = false;
let printed_missing_config = false;

function parse_bool(value, default_value = false) {
  if (value === undefined || value === null || value === '') return default_value;
  return String(value).toLowerCase() === 'true';
}

function should_fallback_to_dev_log() {
  return parse_bool(process.env.EMAIL_DEV_FALLBACK, true);
}

function print_dev_mail({ to, subject, text }) {
  console.log('[MAIL:DEV] To:', to);
  console.log('[MAIL:DEV] Subject:', subject);
  console.log('[MAIL:DEV] Text:', text || '');
}

function build_transport_config() {
  const { SMTP_SERVICE, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_USER || !SMTP_PASS) return null;
  if (!SMTP_SERVICE && (!SMTP_HOST || !SMTP_PORT)) return null;

  const secure_by_port = Number(SMTP_PORT) === 465;
  const secure = parse_bool(process.env.SMTP_SECURE, secure_by_port);
  const require_tls = parse_bool(process.env.SMTP_REQUIRE_TLS, false);
  const tls_reject_unauthorized = parse_bool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true);

  const config = {
    secure,
    requireTLS: require_tls,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    tls: {
      rejectUnauthorized: tls_reject_unauthorized
    }
  };

  if (SMTP_SERVICE) {
    config.service = SMTP_SERVICE;
  } else {
    config.host = SMTP_HOST;
    config.port = Number(SMTP_PORT);
  }

  return config;
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const transport_config = build_transport_config();
  if (transport_config) {
    transporter = nodemailer.createTransport(transport_config);
    return transporter;
  }

  if (!printed_missing_config) {
    printed_missing_config = true;
    console.log('[mail] SMTP is not configured. Falling back to console logs.');
  }

  return null;
}

export async function verifyEmailTransport() {
  const tx = getTransporter();
  if (!tx) {
    return false;
  }

  if (verified) return true;
  if (verify_promise) return verify_promise;

  verify_promise = tx
    .verify()
    .then(() => {
      verified = true;
      console.log('[mail] SMTP connection verified');
      return true;
    })
    .catch((err) => {
      console.error('[mail] SMTP verification failed:', err.message);
      return false;
    })
    .finally(() => {
      verify_promise = null;
    });

  return verify_promise;
}

export async function sendEmail({ to, subject, text, html }) {
  const tx = getTransporter();
  if (!tx) {
    print_dev_mail({ to, subject, text });
    return { ok: false, reason: 'smtp_not_configured' };
  }

  const transport_ready = await verifyEmailTransport();
  if (!transport_ready) {
    if (!should_fallback_to_dev_log()) {
      throw new Error('SMTP verification failed');
    }
    print_dev_mail({ to, subject, text });
    return { ok: false, reason: 'smtp_verify_failed' };
  }

  try {
    const info = await tx.sendMail({
      from: process.env.SMTP_FROM || 'felicity-no-reply@example.com',
      to,
      subject,
      text,
      html
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mail] send failed:', err.message);
    if (!should_fallback_to_dev_log()) {
      throw err;
    }
    print_dev_mail({ to, subject, text });
    return { ok: false, reason: 'smtp_send_failed' };
  }
}

export function mailIsConfigured() {
  const transport_config = build_transport_config();
  return Boolean(transport_config);
}

export function resetMailTransportForTests() {
  transporter = null;
  verify_promise = null;
  verified = false;
  printed_missing_config = false;
}
