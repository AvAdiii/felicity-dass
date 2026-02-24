import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
    return transporter;
  }

  return null;
}

export async function sendEmail({ to, subject, text, html }) {
  const tx = getTransporter();
  if (!tx) {
    console.log('[MAIL:DEV] To:', to);
    console.log('[MAIL:DEV] Subject:', subject);
    console.log('[MAIL:DEV] Text:', text || '');
    return;
  }

  await tx.sendMail({
    from: process.env.SMTP_FROM || 'felicity-no-reply@example.com',
    to,
    subject,
    text,
    html
  });
}
