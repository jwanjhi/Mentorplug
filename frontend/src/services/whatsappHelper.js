/**
 * MentorPlug WhatsApp URL & Contact Resolver
 *
 * Seamlessly supports both:
 * 1. International & local phone numbers:
 *    - "+254 712 345 678", "0712345678", "254712345678" -> https://wa.me/254712345678
 * 2. WhatsApp usernames & handles (Meta beta / username rollout):
 *    - "@mentor_joy", "mentor_joy" -> https://wa.me/mentor_joy
 * 3. Direct wa.me links:
 *    - "https://wa.me/mentor_joy"
 */

/**
 * Normalizes a raw phone number, username, or custom link into a universal WhatsApp direct chat URL.
 *
 * @param {string} rawInput - Phone number or WhatsApp username
 * @param {string} [messageText] - Optional pre-filled greeting message
 * @returns {string} Fully qualified https://wa.me/... link
 */
export function getWhatsAppUrl(rawInput, messageText = '') {
  if (!rawInput || typeof rawInput !== 'string') return '';
  const trimmed = rawInput.trim();

  // If already a full URL, append message query parameter
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (messageText) {
        url.searchParams.set('text', messageText);
      }
      return url.toString();
    } catch {
      return trimmed;
    }
  }

  let target = '';

  // If input contains letters or starts with '@', treat as WhatsApp username/handle
  if (trimmed.startsWith('@') || /[a-zA-Z]/.test(trimmed)) {
    target = trimmed.replace(/^@/, '').replace(/[^a-zA-Z0-9._-]/g, '');
  } else {
    // Treat as phone number: strip non-digits and normalize Kenyan 07/01 to 254
    let digits = trimmed.replace(/[^0-9]/g, '');
    if (digits.startsWith('0') && digits.length === 10) {
      digits = '254' + digits.slice(1);
    }
    target = digits;
  }

  if (!target) return '';

  const query = messageText ? `?text=${encodeURIComponent(messageText)}` : '';
  return `https://wa.me/${target}${query}`;
}

