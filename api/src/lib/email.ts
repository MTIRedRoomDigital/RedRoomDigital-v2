import nodemailer from 'nodemailer';

/**
 * Email sender using SMTP (Gmail, SendGrid, Mailgun, etc.)
 *
 * Required env vars:
 *   SMTP_HOST     — e.g. smtp.gmail.com
 *   SMTP_PORT     — e.g. 587
 *   SMTP_USER     — your email or API key
 *   SMTP_PASS     — your password or API secret
 *   SMTP_FROM     — "RedRoomDigital <no-reply@redroomdigital.com>"
 *
 * For Gmail: use an App Password (not your real password).
 * Go to Google Account → Security → 2-Step Verification → App Passwords
 */

const smtpPort = parseInt(process.env.SMTP_PORT || '465');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.resend.com',
  port: smtpPort,
  secure: smtpPort === 465, // true for 465 (SSL), false for 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || 'RedRoomDigital <no-reply@redroomdigital.com>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset your RedRoomDigital password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1e1e2e; color: #e0e0e0; padding: 32px; border-radius: 12px;">
        <h2 style="color: #ef4444; margin-top: 0;">Password Reset</h2>
        <p>You requested a password reset for your RedRoomDigital account.</p>
        <p>Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #ef4444; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #888; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border-color: #333; margin: 24px 0;" />
        <p style="color: #666; font-size: 11px;">RedRoomDigital — AI-powered character creation and roleplaying</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Verify your RedRoomDigital email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1e1e2e; color: #e0e0e0; padding: 32px; border-radius: 12px;">
        <h2 style="color: #ef4444; margin-top: 0;">Welcome to RedRoomDigital!</h2>
        <p>Thanks for signing up. Please verify your email to activate your account.</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #ef4444; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #888; font-size: 12px;">This link expires in 24 hours.</p>
        <hr style="border-color: #333; margin: 24px 0;" />
        <p style="color: #666; font-size: 11px;">RedRoomDigital — AI-powered character creation and roleplaying</p>
      </div>
    `,
  });
}
