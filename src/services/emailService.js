import nodemailer from 'nodemailer';
import config from '../config/index.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.password
        ? { user: config.mail.username, pass: config.mail.password }
        : undefined,
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  if (!config.mail.password) {
    console.log(`[email stub] To: ${to}, Subject: ${subject}`);
    return;
  }
  await getTransporter().sendMail({
    from: config.mail.from,
    to,
    subject,
    html,
    text: text || html?.replace(/<[^>]+>/g, ''),
  });
}

export async function sendVerificationEmail(user, token) {
  const url = `${config.frontendBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your LandEx account',
    html: `<p>Hello ${user.firstName},</p><p>Please verify your email: <a href="${url}">${url}</a></p>`,
  });
}

export async function sendPasswordResetEmail(user, token) {
  const url = `${config.frontendBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your LandEx password',
    html: `<p>Hello ${user.firstName},</p><p>Reset your password: <a href="${url}">${url}</a></p>`,
  });
}
