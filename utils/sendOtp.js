// utils/sendOtp.js
import dotenv from 'dotenv';
dotenv.config(); // ✅ Load .env variables

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY); // This will now get the correct value

export const sendOtpEmail = async ({ to, name, otp }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject: 'Your OTP Code',
      html: `
        <div style="font-family: sans-serif;">
          <h2>Hello ${name},</h2>
          <p>Your OTP code is:</p>
          <h1 style="color: #0f172a">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
          <br/>
          <small>If you did not request this, please ignore this email.</small>
        </div>
      `,
    });

    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err) {
    console.error('Error sending OTP:', err);
    return { success: false, message: err.message };
  }
};
