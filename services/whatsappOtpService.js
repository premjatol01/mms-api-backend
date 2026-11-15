/**
 * WhatsApp OTP Service (Meta Cloud API + Dev Mock Fallback)
 *
 * In Development (No API keys yet):
 * Logs the OTP directly to the terminal for instant testing without waiting for Meta approval.
 *
 * In Production (When keys are provided in .env):
 * Dispatches the official WhatsApp Authentication template via Meta Graph API.
 */

/**
 * Sends OTP via WhatsApp (Meta Cloud API or Dev Mock).
 *
 * @param {string} mobile - 10-digit mobile number
 * @param {string} otpCode - 4 to 6 digit verification code
 * @returns {Promise<{ success: boolean, mode: 'live' | 'mock', devCode?: string, message?: string }>}
 */
async function sendWhatsAppOtp(mobile, otpCode) {
  const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'tablly_otp';

  const isLiveConfigured = Boolean(
    phoneId &&
    accessToken &&
    accessToken.trim() !== '' &&
    accessToken !== 'mock' &&
    !accessToken.startsWith('your_')
  );

  // --------------------------------------------------------------------------
  // DEV MOCK MODE: When keys are not yet configured in .env
  // --------------------------------------------------------------------------
  if (!isLiveConfigured) {
    const divider = '═'.repeat(64);
    console.log('\n' + divider);
    console.log(' 💬 [TABLLY WHATSAPP OTP - DEV MOCK]');
    console.log(` 📱 Recipient : +91 ${cleanMobile}`);
    console.log(` 🔑 OTP Code  : ${otpCode}`);
    console.log(` ⏳ Valid for : 5 minutes`);
    console.log(` 💡 Note      : Meta API keys not set. Update .env when ready.`);
    console.log(divider + '\n');

    const devCode = otpCode;

    return {
      success: true,
      mode: 'mock',
      devCode,
      message: `OTP generated (Test code: ${devCode})`,
    };
  }

  // --------------------------------------------------------------------------
  // LIVE MODE: Send via Meta WhatsApp Cloud API
  // --------------------------------------------------------------------------
  try {
    const formattedPhone = cleanMobile.startsWith('91')
      ? cleanMobile
      : `91${cleanMobile}`;

    const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

    const isHelloWorld = templateName === 'hello_world';

    // Standard Meta Template Payload
    const templateObj = {
      name: templateName,
      language: {
        code: process.env.WHATSAPP_LANGUAGE_CODE || 'en_US',
      },
    };

    // If not hello_world, include body OTP parameter
    if (!isHelloWorld) {
      templateObj.components = [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: String(otpCode),
            },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: String(otpCode),
            },
          ],
        },
      ];
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: templateObj,
    };

    let response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data = await response.json();

    // If button component caused mismatch, retry with body-only
    if (!response.ok && payload.template?.components?.length > 1) {
      payload.template.components = [payload.template.components[0]];
      const retryRes = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (retryRes.ok) {
        data = await retryRes.json();
        response = retryRes;
      }
    }

    if (!response.ok) {
      console.error('[WhatsApp Service Error]:', data);
      return {
        success: false,
        mode: 'live',
        devCode: otpCode,
        error: data.error?.message || 'Meta Cloud API rejected request',
      };
    }

    return {
      success: true,
      mode: 'live',
      devCode: otpCode,
      messageId: data.messages?.[0]?.id,
      message: 'OTP delivered to your WhatsApp',
    };
  } catch (error) {
    console.error('[WhatsApp Service Failure]:', error.message);
    return {
      success: false,
      mode: 'live',
      devCode: otpCode,
      error: error.message,
    };
  }
}

module.exports = { sendWhatsAppOtp };
