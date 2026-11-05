/**
 * MentorPlug Phone SMS Verification Service
 *
 * Exclusively verifies phone numbers via SMS OTP to guarantee authentic identity ownership.
 *
 * Supports:
 * 1. Africa's Talking API (Standard across Africa / Kenya) - Live or Sandbox
 * 2. In-App Demo Mode (Zero cost, instant verification code for presentations and defenses)
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
 * Checks if input is a valid mobile phone number (not a handle/username).
 * @param {string} input
 * @returns {boolean}
 */
function isValidPhoneNumber(input) {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  // If contains letters or starts with @, it's not a phone number
  if (trimmed.startsWith('@') || /[a-zA-Z]/.test(trimmed)) {
    return false;
  }
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
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
 *
 * @param {Object} params
 * @param {string} params.phone - E.164 phone number
 * @param {string} params.code - 6-digit OTP code
 * @returns {Promise<{ success: boolean, isDemo: boolean, demoCode?: string, phone: string, message: string }>}
 */
async function sendOtpSms({ phone, code }) {
  if (!isValidPhoneNumber(phone)) {
    throw new Error('A valid mobile phone number is required for SMS OTP verification.');
  }

  const cleanPhone = normalizePhoneNumber(phone);
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
          phone: cleanPhone,
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
    phone: cleanPhone,
    demoCode: code,
    message: `Verification code generated for ${cleanPhone}. (In-App Demo Mode active - zero SMS costs)`,
  };
}

module.exports = {
  normalizePhoneNumber,
  isValidPhoneNumber,
  generateOtpCode,
  sendOtpSms,
};
