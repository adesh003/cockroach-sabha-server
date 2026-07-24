import { logger } from '../config/db.js';

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'your_resend_api_key_here') {
    logger.warn(`No RESEND_API_KEY set. E-mail simulated to: ${to} | Subject: ${subject}`);
    logger.info(`EMAIL PREVIEW CONTENT:\n${html}`);
    return { success: true, simulated: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Cockroach Sabha <onboarding@resend.dev>',
        to,
        subject,
        html
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      logger.info({ emailId: data.id, to }, 'Email sent successfully via Resend');
      return { success: true, id: data.id };
    } else {
      logger.error({ error: data }, 'Resend API error');
      return { success: false, error: data };
    }
  } catch (err) {
    logger.error(err, 'Failed to send email via Resend');
    return { success: false, error: err.message };
  }
}

export async function sendWelcomeEmail(email, anonymousName, recoveryKey) {
  const subject = 'Welcome to Cockroach Sabha - Your Anonymous Pass';
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e6e4df; border-radius: 12px; background-color: #fbfbf9; color: #1c1917;">
      <h2 style="font-size: 20px; font-weight: 800; border-bottom: 2px solid #9a6b32; padding-bottom: 10px; color: #9a6b32; margin-top: 0;">🪳 COCKROACH SABHA</h2>
      <p>Greetings, <strong>${anonymousName}</strong>!</p>
      <p>Your delegate seat has been successfully reserved on the Sabha Floor. Your real identity remains completely anonymous.</p>
      <div style="background-color: #ffffff; border: 1px solid #e6e4df; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <span style="display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #a8a29e; margin-bottom: 5px;">Secret Recovery Key</span>
        <code style="font-family: monospace; font-size: 16px; font-weight: 900; letter-spacing: 2px; color: #9a6b32;">${recoveryKey}</code>
      </div>
      <p style="font-size: 11px; color: #57534e; line-height: 1.5;">
        <strong>IMPORTANT:</strong> Save this key immediately. Since Cockroach Sabha is a zero-trust platform, this secret key is the only way to recover your delegate pass if you ever forget your password.
      </p>
    </div>
  `;
  return sendEmail({ to: email, subject, html });
}

export async function sendResetCodeEmail(email, code) {
  const subject = 'Cockroach Sabha - Passcode Reset Request';
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e6e4df; border-radius: 12px; background-color: #fbfbf9; color: #1c1917;">
      <h2 style="font-size: 20px; font-weight: 800; border-bottom: 2px solid #9a6b32; padding-bottom: 10px; color: #9a6b32; margin-top: 0;">🪳 PASSCODE RESET</h2>
      <p>A password reset request has been initiated for your delegate account.</p>
      <p>Please enter the following 6-digit confirmation passcode on the screen to reclaim your seat:</p>
      <div style="background-color: #ffffff; border: 1px solid #e6e4df; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <span style="display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #a8a29e; margin-bottom: 5px;">Reset Passcode</span>
        <code style="font-family: monospace; font-size: 24px; font-weight: 900; letter-spacing: 4px; color: #9a6b32;">${code}</code>
      </div>
      <p style="font-size: 11px; color: #57534e;">This passcode will expire in 10 minutes. If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
  return sendEmail({ to: email, subject, html });
}
