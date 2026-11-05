const nodemailer = require('nodemailer');

/**
 * Creates and returns a nodemailer transporter.
 * If SMTP credentials are configured in .env, it uses them (e.g. Gmail App Password, SendGrid, Mailgun).
 * Otherwise, it falls back to console logging simulation in development.
 */
let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development fallback: mock transporter that logs preview to console
    transporter = {
      sendMail: async (options) => {
        console.log('\n──────────────────────────────────────────────────────────');
        console.log('📧 [EMAIL DISPATCHED via MentorPlug]');
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log('Preview:\n', options.text ? options.text.slice(0, 200) + '...' : '');
        console.log('──────────────────────────────────────────────────────────\n');
        return { messageId: `mock-${Date.now()}` };
      },
    };
  }
  return transporter;
};

const getFromAddress = () => {
  return process.env.EMAIL_FROM || '"MentorPlug" <no-reply@mentorplug.me>';
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
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Smart Mentorship Powered by Semantic NLP</p>
        </div>

        <p style="color: #1e293b; font-size: 16px;">Hello <strong>${name}</strong>,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          Welcome to MentorPlug! Your account has been successfully created as a <strong>${isMentor ? 'Mentor (Guide)' : 'Mentee (Learner)'}</strong>.
        </p>

        <div style="background-color: #f8fafc; border-left: 4px solid #D4AF37; padding: 16px 20px; margin: 24px 0; border-radius: 6px;">
          <h4 style="margin: 0 0 8px 0; color: #0A1128; font-size: 15px;">Next step to get started:</h4>
          <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">
            ${isMentor
              ? 'Complete your profile with your expertise, technologies, and mentoring focus areas so mentees can discover you.'
              : 'Add your skills, learning goals, and bio to generate your Top 6 curated mentor recommendations.'}
          </p>
        </div>

        <div style="text-align: center; margin: 32px 0 24px 0;">
          <a href="https://mentorplug.me/profile" style="background-color: #D4AF37; color: #0A1128; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block;">
            Complete Your Profile →
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} MentorPlug • Academic Research Project • Strathmore University
        </p>
      </div>
    `;

    const textContent = `
Hello ${name},

Welcome to MentorPlug! Your account has been registered as a ${role}.

Next Steps:
${isMentor
  ? 'Complete your profile with your technologies and expertise so mentees can discover you.'
  : 'Fill out your profile with your learning goals to generate your Top 6 curated mentor recommendations.'}

Visit your profile: https://mentorplug.me/profile

MentorPlug • Smart Mentorship Platform
    `.trim();

    await mailer.sendMail({
      from: getFromAddress(),
      to: email,
      subject: `🎉 Welcome to MentorPlug, ${name}!`,
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
          If this was you, you can safely ignore this email. If you did not sign in, please update your password immediately or reach out to support.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">MentorPlug Security Alert</p>
      </div>
    `;

    const textContent = `
Hello ${name},

A new sign-in to your MentorPlug account was detected at ${timestamp} (EAT).
${ip ? `IP Address: ${ip}\n` : ''}
If this was you, no action is needed. If you did not sign in, please secure your account immediately.

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

MentorPlug • Semantic Mentorship Matching
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
          Great news! <strong>${mentorName}</strong> has accepted your mentorship request. You are now officially connected.
        </p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #25D366; padding: 16px 20px; margin: 24px 0; border-radius: 6px;">
          <h4 style="margin: 0 0 10px 0; color: #0A1128; font-size: 15px;">Mentor Contact Information</h4>
          <p style="margin: 6px 0; color: #334155; font-size: 14px;"><strong>Email:</strong> <a href="mailto:${mentorEmail}" style="color: #0284c7; text-decoration: none;">${mentorEmail}</a></p>
          ${mentorWhatsapp ? `<p style="margin: 6px 0; color: #334155; font-size: 14px;"><strong>WhatsApp:</strong> ${mentorWhatsapp}</p>` : ''}
        </div>

        <p style="color: #475569; font-size: 14px; margin-bottom: 8px;"><strong>Suggested next steps:</strong></p>
        <ul style="color: #475569; font-size: 14px; line-height: 1.6; margin-top: 0; padding-left: 20px;">
          <li>Reach out via email or WhatsApp to introduce yourself and your learning goals.</li>
          <li>Agree on a convenient time for your introductory 30-minute discussion.</li>
        </ul>

        ${whatsappLink ? `
          <div style="margin-top: 28px; text-align: center;">
            <a href="${whatsappLink}" style="background-color: #25D366; color: white; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block;">
              💬 Open WhatsApp Chat
            </a>
          </div>
        ` : ''}

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          MentorPlug • Semantic Mentorship Matching Platform
        </p>
      </div>
    `;

    const textContent = `
Hello ${menteeName},

Great news! ${mentorName} has accepted your mentorship request on MentorPlug!

Mentor Contact Information:
- Email: ${mentorEmail}
${mentorWhatsapp ? `- WhatsApp: ${mentorWhatsapp}\n- Chat Link: ${whatsappLink}\n` : ''}

Reach out to schedule your introductory conversation!

MentorPlug • Semantic Mentorship Platform
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

module.exports = {
  notifyWelcomeUser,
  notifySignInAlert,
  notifyIncomingMatchRequest,
  notifyMenteeMatchAccepted,
};
