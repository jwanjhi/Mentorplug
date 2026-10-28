const nodemailer = require('nodemailer');

/**
 * Creates and returns a nodemailer transporter.
 * If SMTP credentials are configured in .env, it uses them.
 * Otherwise, it falls back to console logging / ethereal simulation in local dev.
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
        console.log('📧 [MOCK EMAIL DISPATCHED via MentorPlug]');
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log('Text preview:\n', options.text);
        console.log('──────────────────────────────────────────────────────────\n');
        return { messageId: `mock-${Date.now()}` };
      },
    };
  }
  return transporter;
};

/**
 * Sends an email notification to the mentee when a mentor accepts their request.
 */
const notifyMenteeMatchAccepted = async ({ menteeEmail, menteeName, mentorName, mentorEmail, mentorWhatsapp }) => {
  try {
    const mailer = await getTransporter();
    const cleanPhone = mentorWhatsapp ? mentorWhatsapp.replace(/[^0-9]/g, '') : null;
    const whatsappLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(mentorName)},%20I'm%20${encodeURIComponent(menteeName)}.%20Our%20mentorship%20match%20was%20accepted%20on%20MentorPlug!` : null;

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #D4AF37; margin-bottom: 8px;">MentorPlug Connection Confirmed!</h2>
        <p style="color: #475569; font-size: 16px;">Hello <strong>${menteeName}</strong>,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.5;">
          Great news! <strong>${mentorName}</strong> has accepted your mentorship request. You are now officially connected.
        </p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #D4AF37; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0; color: #1e293b;">Mentor Contact Information</h4>
          <p style="margin: 4px 0; color: #334155;"><strong>Email:</strong> <a href="mailto:${mentorEmail}" style="color: #0284c7;">${mentorEmail}</a></p>
          ${mentorWhatsapp ? `<p style="margin: 4px 0; color: #334155;"><strong>WhatsApp:</strong> ${mentorWhatsapp}</p>` : ''}
        </div>

        <p style="color: #475569; font-size: 14px;">Next steps:</p>
        <ul style="color: #475569; font-size: 14px; line-height: 1.6;">
          <li>Reach out to schedule an introductory video call or chat.</li>
          <li>Share your current learning goals or projects you'd like guidance on.</li>
        </ul>

        ${whatsappLink ? `
          <div style="margin-top: 24px; text-align: center;">
            <a href="${whatsappLink}" style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Message on WhatsApp
            </a>
          </div>
        ` : ''}

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">MentorPlug • Strathmore University</p>
      </div>
    `;

    const textContent = `
Hello ${menteeName},

Great news! ${mentorName} has accepted your mentorship request on MentorPlug!

Mentor Contact Information:
- Email: ${mentorEmail}
${mentorWhatsapp ? `- WhatsApp: ${mentorWhatsapp}\n- Direct Chat: ${whatsappLink}` : ''}

Reach out to schedule your first introductory conversation!

MentorPlug • Strathmore University
    `;

    await mailer.sendMail({
      from: process.env.EMAIL_FROM || '"MentorPlug" <no-reply@mentorplug.com>',
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
  notifyMenteeMatchAccepted,
};
