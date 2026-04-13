import { Resend } from 'resend';

/**
 * Email sender using Resend HTTP API
 * (SMTP is blocked by many cloud hosts like Railway — HTTP API works everywhere)
 *
 * Required env vars:
 *   RESEND_API_KEY  — your Resend API key (re_...)
 *   SMTP_FROM       — "RedRoomDigital <support@redroomdigital.com>"
 *   FRONTEND_URL    — "https://redroomdigital.com"
 */

const resend = new Resend(process.env.RESEND_API_KEY || process.env.SMTP_PASS);
const FROM = process.env.SMTP_FROM || 'RedRoomDigital <support@redroomdigital.com>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  try {
    const { error } = await resend.emails.send({
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

    if (error) {
      console.error('Resend error (password reset):', error);
      throw new Error(error.message);
    }
    console.log(`Password reset email sent to ${to}`);
  } catch (err: any) {
    console.error('Failed to send password reset email:', err.message);
    throw err;
  }
}

export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  try {
    const { error } = await resend.emails.send({
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

    if (error) {
      console.error('Resend error (verification):', error);
      throw new Error(error.message);
    }
    console.log(`Verification email sent to ${to}`);
  } catch (err: any) {
    console.error('Failed to send verification email:', err.message);
    throw err;
  }
}
