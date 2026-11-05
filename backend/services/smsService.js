/**
 * MentorPlug SMS & WhatsApp Contact Verification Service
 *
 * Supports:
 * 1. Africa's Talking API (Standard across Africa / Kenya) - Live or Sandbox
 * 2. In-App Demo Mode (Zero cost, instant verification code for presentations and defenses)
 * 3. WhatsApp Username Verification (@username / handles)
 */

/**
 * Normalizes phone numbers to E.164 international format (+254...).
 * @param {string} rawPhone
 * @returns {string} E.164 formatted phone number
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, '');

  // Local Kenyan format e.g. 0712345678 or 0112345678
  if (/^0[17]\d{8}$/.test(cleaned)) {
    return '+254' + cleaned.slice(1);
  }

  // 254712345678 without leading plus
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  // If already starts with '+', return
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  return '+' + cleaned;
}

/**
 * Inspects contact string and normalizes to either phone (+254...) or username (@handle).
 * @param {string} rawContact
 * @returns {{ type: 'phone'|'username', value: string }}
 */
function normalizeWhatsAppContact(rawContact) {
  if (!rawContact || typeof rawContact !== 'string') {
    return { type: 'phone', value: '' };
  }
  const trimmed = rawContact.trim();

  // If starts with '@' or contains alphabet characters, treat as WhatsApp username
  if (trimmed.startsWith('@') || /[a-zA-Z]/.test(trimmed)) {
    const handle = trimmed.replace(/^@/, '').replace(/[^a-zA-Z0-9._-]/g, '');
    return {
      type: 'username',
      value: handle ? `@${handle}` : '',
    };
  }

  // Otherwise treat as phone number
  return {
    type: 'phone',
    value: normalizePhoneNumber(trimmed),
  };
}

/**
 * Generates a secure 6-digit numeric OTP.
 * @returns {string} 6-digit OTP code
 */
function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Sends OTP via Africa's Talking SMS or provides In-App Demo code.
 * Supports both Phone Numbers and WhatsApp Usernames (@handle).
 *
 * @param {Object} params
 * @param {string} params.contact - E.164 phone number OR @username
 * @param {string} params.code - 6-digit OTP code
 * @returns {Promise<{ success: boolean, isDemo: boolean, isUsername: boolean, demoCode?: string, contact: string, message: string }>}
 */
async function sendVerificationOtp({ contact, code }) {
  const normalized = normalizeWhatsAppContact(contact);

  // 1. If it's a WhatsApp Username (@handle)
  if (normalized.type === 'username') {
    console.log(`\n========================================`);
    console.log(`💬 [MentorPlug WhatsApp Username Verification]`);
    console.log(`Target Handle: ${normalized.value}`);
    console.log(`Verification Token: ${code}`);
    console.log(`Expires in: 5 minutes`);
    console.log(`Direct Link: https://wa.me/${normalized.value.replace(/^@/, '')}?text=MentorPlug%20Verification%20Code:%20${code}`);
    console.log(`========================================\n`);

    return {
      success: true,
      isDemo: true,
      isUsername: true,
      contact: normalized.value,
      demoCode: code,
      message: `Verification code generated for WhatsApp handle ${normalized.value}. Click to test your handle or enter the code.`,
    };
  }

  // 2. If it's a Phone Number
  const cleanPhone = normalized.value;
  const atApiKey = process.env.AT_API_KEY;
  const atUsername = process.env.AT_USERNAME || 'sandbox';
  const messageText = `Your MentorPlug verification code is ${code}. Valid for 5 minutes. Do not share this code.`;

  // If Africa's Talking credentials exist, attempt real SMS dispatch
  if (atApiKey && atUsername) {
    try {
      const isSandbox = atUsername.toLowerCase() === 'sandbox';
      const endpoint = isSandbox
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

      const bodyParams = new URLSearchParams();
      bodyParams.append('username', atUsername);
      bodyParams.append('to', cleanPhone);
      bodyParams.append('message', messageText);
      if (process.env.AT_SENDER_ID && !isSandbox) {
        bodyParams.append('from', process.env.AT_SENDER_ID);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apiKey': atApiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      const responseData = await response.json();
      console.log('Africa Talking SMS Response:', responseData);

      const recipientInfo = responseData?.SMSMessageData?.Recipients?.[0];
      const status = recipientInfo?.status;

      if (status === 'Success' || status === 'Sent') {
        return {
          success: true,
          isDemo: false,
          isUsername: false,
          contact: cleanPhone,
          message: `SMS OTP successfully sent to ${cleanPhone}.`,
        };
      } else {
        console.warn('Africa Talking returned non-success status:', status, 'Falling back to demo mode.');
      }
    } catch (err) {
      console.error('Failed to dispatch SMS via Africa Talking:', err.message);
    }
  }

  // Fallback / In-App Demo OTP for Phone
  console.log(`\n========================================`);
  console.log(`📱 [MentorPlug In-App SMS Verification]`);
  console.log(`Target Phone: ${cleanPhone}`);
  console.log(`Security OTP: ${code}`);
  console.log(`Expires in: 5 minutes`);
  console.log(`========================================\n`);

  return {
    success: true,
    isDemo: true,
    isUsername: false,
    contact: cleanPhone,
    demoCode: code,
    message: `Verification code generated for ${cleanPhone}. (In-App Demo Mode active - zero SMS costs)`,
  };
}

module.exports = {
  normalizePhoneNumber,
  normalizeWhatsAppContact,
  generateOtpCode,
  sendVerificationOtp,
};
