const nodemailer = require('nodemailer');

/**
 * Creates and returns a nodemailer transporter.
 * If SMTP credentials are configured in .env (or Render), it uses them (e.g. Gmail App Password).
 * Automatically cleans any spaces from 16-letter Google App Passwords.
 * Otherwise, it falls back to console logging simulation in development.
 */
const getTransporter = async () => {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const cleanPass = process.env.SMTP_PASS.replace(/\s+/g, '');
    const cleanUser = process.env.SMTP_USER.trim();
    const host = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : 'smtp.gmail.com';
    const isGmail = host.includes('gmail') || cleanUser.includes('gmail');

    if (isGmail) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: cleanUser,
          pass: cleanPass,
        },
      });
    }

    const port = parseInt(process.env.SMTP_PORT, 10) || 465;
    const secure = port === 465 || process.env.SMTP_SECURE === 'true';

    return nodemailer.createTransport({
      host: host,
      port: port,
      secure: secure,
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
    });
  }

  // Development fallback: mock transporter that logs preview to console
  return {
    isMock: true,
    sendMail: async (options) => {
      console.log('\n──────────────────────────────────────────────────────────');
      console.log('📧 [MOCK EMAIL LOG - Configure SMTP_USER and SMTP_PASS on Render for real delivery]');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log('Preview:\n', options.text ? options.text.slice(0, 200) + '...' : '');
      console.log('──────────────────────────────────────────────────────────\n');
      return { messageId: `mock-${Date.now()}` };
    },
  };
};

const getFromAddress = () => {
  return process.env.EMAIL_FROM || (process.env.SMTP_USER ? `"MentorPlug" <${process.env.SMTP_USER.trim()}>` : '"MentorPlug" <no-reply@mentorplug.me>');
};

const cleanPhoneForWhatsApp = (rawPhone) => {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/[^0-9]/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '254' + digits.slice(1);
  }
  return digits;
};

/**
 * 1. Welcome Email on User Registration
 */
const notifyWelcomeUser = async ({ email, name, role }) => {
  try {
    const mailer = await getTransporter();
    const isMentor = role === 'mentor';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0A1128; margin: 0; font-size: 26px;">Mentor<span style="color: #D4AF37;">plug</span></h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">AI-Driven Semantic Mentorship Platform</p>
        </div>

        <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px;">Welcome to MentorPlug, ${name}! 🎉</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          Your account as a <strong>${isMentor ? 'Mentor' : 'Mentee'}</strong> has been successfully created.
        </p>

        <div style="background-color: #f8fafc; border-left: 4px solid #D4AF37; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <h4 style="margin: 0 0 8px 0; color: #0A1128;">Next Steps:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
            <li>Complete your profile bio, skills, and industry focus areas.</li>
            <li>Verify your WhatsApp contact number for 1-click messaging upon match confirmation.</li>
            <li>${isMentor ? 'Review incoming mentee requests on your dashboard.' : 'Explore your curated Top 6 semantic mentor matches.'}</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="https://mentorplug.me/profile" style="background-color: #D4AF37; color: #0A1128; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block;">
            Complete Your Profile →
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          MentorPlug • Strathmore University Research Project
        </p>
      </div>
    `;

    const textContent = `
Welcome to MentorPlug, ${name}!

Your account as a ${role} has been created.
Visit https://mentorplug.me/profile to complete your profile and begin connecting.

MentorPlug Team
    `.trim();

    await mailer.sendMail({
      from: getFromAddress(),
      to: email,
      subject: `Welcome to MentorPlug, ${name}! 🎉`,
      text: textContent,
      html: htmlContent,
    });
  } catch (err) {
    console.error('notifyWelcomeUser error:', err.message);
  }
};

/**
 * 2. Sign-In Security Alert
 */
const notifySignInAlert = async ({ email, name, ip, userAgent }) => {
  try {
    const mailer = await getTransporter();
    const timestamp = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0A1128; margin: 0;">Mentor<span style="color: #D4AF37;">plug</span></h2>
        </div>

        <h3 style="color: #1e293b; margin-top: 0;">New Sign-In Detected</h3>
        <p style="color: #475569; font-size: 15px; line-height: 1.5;">
          Hello <strong>${name}</strong>, we noticed a new sign-in to your MentorPlug account.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0; color: #475569; font-size: 14px;"><strong>Time:</strong> ${timestamp} (EAT)</p>
          ${ip ? `<p style="margin: 4px 0; color: #475569; font-size: 14px;"><strong>IP Address:</strong> ${ip}</p>` : ''}
          ${userAgent ? `<p style="margin: 4px 0; color: #475569; font-size: 13px;"><strong>Device:</strong> ${userAgent.slice(0, 100)}</p>` : ''}
        </div>

        <p style="color: #64748b; font-size: 13px;">
          If this was you, you can safely ignore this email. If you did not sign in, please update your password immediately.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">MentorPlug Security Alert</p>
      </div>
    `;

    const textContent = `
Hello ${name},

A new sign-in to your MentorPlug account was detected at ${timestamp} (EAT).
${ip ? `IP Address: ${ip}\n` : ''}
If this was you, no action is needed.

MentorPlug Security
    `.trim();

    await mailer.sendMail({
      from: getFromAddress(),
      to: email,
      subject: `🔒 Security Alert: New Sign-In to MentorPlug`,
      text: textContent,
      html: htmlContent,
    });
  } catch (err) {
    console.error('notifySignInAlert error:', err.message);
  }
};

/**
 * 3. Incoming Mentorship Match Request (Sent to Mentor)
 */
const notifyIncomingMatchRequest = async ({ mentorEmail, mentorName, menteeName, introMessage }) => {
  try {
    const mailer = await getTransporter();

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0A1128; margin: 0; font-size: 26px;">Mentor<span style="color: #D4AF37;">plug</span></h1>
        </div>

        <h2 style="color: #D4AF37; margin: 0 0 12px 0; font-size: 20px;">New Mentorship Request!</h2>
        <p style="color: #1e293b; font-size: 16px;">Hello <strong>${mentorName}</strong>,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          <strong>${menteeName}</strong> discovered your profile via our semantic NLP recommendation engine and has requested you as their mentor.
        </p>

        ${introMessage ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #D4AF37; padding: 16px; margin: 20px 0; border-radius: 6px;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold;">Note from ${menteeName}:</p>
            <p style="margin: 0; color: #1e293b; font-size: 14px; font-style: italic; line-height: 1.5;">"${introMessage}"</p>
          </div>
        ` : ''}

        <p style="color: #475569; font-size: 14px;">
          You can review their profile, skills, and background on your Mentor Dashboard to accept or decline the connection.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="https://mentorplug.me/mentor-dashboard" style="background-color: #D4AF37; color: #0A1128; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block;">
            Review Request on Dashboard →
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">MentorPlug • Semantic Mentorship Matching</p>
      </div>
    `;

    const textContent = `
Hello ${mentorName},

You have received a new mentorship request from ${menteeName} on MentorPlug!
${introMessage ? `Note: "${introMessage}"\n` : ''}
Review the request on your dashboard: https://mentorplug.me/mentor-dashboard

MentorPlug
    `.trim();

    await mailer.sendMail({
      from: getFromAddress(),
      to: mentorEmail,
      subject: `✦ New Mentorship Request from ${menteeName}`,
      text: textContent,
      html: htmlContent,
    });
  } catch (err) {
    console.error('notifyIncomingMatchRequest error:', err.message);
  }
};

/**
 * 4. Match Accepted Email (Sent to Mentee)
 */
const notifyMenteeMatchAccepted = async ({ menteeEmail, menteeName, mentorName, mentorEmail, mentorWhatsapp }) => {
  try {
    const mailer = await getTransporter();
    const formattedPhone = cleanPhoneForWhatsApp(mentorWhatsapp);
    const whatsappLink = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(`Hi ${mentorName}, our mentorship match on MentorPlug was accepted! Looking forward to learning from you.`)}`
      : null;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0A1128; margin: 0; font-size: 26px;">Mentor<span style="color: #D4AF37;">plug</span></h1>
        </div>

        <h2 style="color: #25D366; margin: 0 0 12px 0; font-size: 20px;">✓ Connection Confirmed!</h2>
        <p style="color: #1e293b; font-size: 16px;">Hello <strong>${menteeName}</strong>,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          Great news! <strong>${mentorName}</strong> has accepted your mentorship request on MentorPlug!
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 24px 0;">
          <h4 style="margin: 0 0 12px 0; color: #0A1128; font-size: 15px;">Mentor Contact Details:</h4>
          <p style="margin: 6px 0; color: #475569; font-size: 14px;"><strong>Email:</strong> <a href="mailto:${mentorEmail}" style="color: #D4AF37;">${mentorEmail}</a></p>
          ${mentorWhatsapp ? `<p style="margin: 6px 0; color: #475569; font-size: 14px;"><strong>WhatsApp:</strong> ${mentorWhatsapp}</p>` : ''}
        </div>

        ${whatsappLink ? `
          <div style="text-align: center; margin: 28px 0;">
            <a href="${whatsappLink}" style="background-color: #25D366; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block;">
              💬 Start Chat on WhatsApp →
            </a>
          </div>
        ` : ''}

        <p style="color: #64748b; font-size: 13px; text-align: center;">
          Reach out to introduce yourself and schedule your first mentorship meeting!
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">MentorPlug • Empowering Academic & Professional Growth</p>
      </div>
    `;

    const textContent = `
Hello ${menteeName},

Great news! ${mentorName} has accepted your mentorship request on MentorPlug!

Mentor Email: ${mentorEmail}
${mentorWhatsapp ? `Mentor WhatsApp: ${mentorWhatsapp}\n` : ''}
Reach out to schedule your introductory conversation!

MentorPlug
    `.trim();

    await mailer.sendMail({
      from: getFromAddress(),
      to: menteeEmail,
      subject: `🎉 Mentorship Accepted: ${mentorName} is your mentor!`,
      text: textContent,
      html: htmlContent,
    });
  } catch (err) {
    console.error('notifyMenteeMatchAccepted error:', err.message);
  }
};

/**
 * Diagnostic test email helper
 */
const testEmailConfig = async (targetEmail = 'wanjohijoy37@gmail.com') => {
  const mailer = await getTransporter();
  if (mailer.isMock) {
    return {
      configured: false,
      message: 'SMTP credentials (SMTP_USER or SMTP_PASS) are missing on the server environment.',
      env: {
        has_smtp_user: Boolean(process.env.SMTP_USER),
        has_smtp_pass: Boolean(process.env.SMTP_PASS),
        smtp_host: process.env.SMTP_HOST || 'none',
      }
    };
  }

  try {
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to: targetEmail,
      subject: '✦ MentorPlug Test Email Verification',
      text: 'Congratulations! Your MentorPlug automated email notification system is fully operational.',
      html: '<h2 style="color:#D4AF37;">MentorPlug Email Active</h2><p>Your automated notification delivery is fully operational!</p>',
    });
    return {
      configured: true,
      success: true,
      messageId: info.messageId,
      recipient: targetEmail,
      message: `Test email successfully dispatched to ${targetEmail}! Check your inbox.`
    };
  } catch (err) {
    return {
      configured: true,
      success: false,
      error: err.message,
      code: err.code,
    };
  }
};

module.exports = {
  notifyWelcomeUser,
  notifySignInAlert,
  notifyIncomingMatchRequest,
  notifyMenteeMatchAccepted,
  testEmailConfig,
};
