import {config} from '../../config.js';

export interface SmsProvider { sendOtp(phoneE164: string, code: string): Promise<void> }

export class ConsoleSmsProvider implements SmsProvider {
  sendOtp(phoneE164: string, code: string): Promise<void> {
    console.info(`[development-otp] ${phoneE164}: ${code}`);
    return Promise.resolve();
  }
}

export class TwilioSmsProvider implements SmsProvider {
  async sendOtp(phoneE164: string, code: string): Promise<void> {
    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_FROM_NUMBER) throw new Error('Twilio credentials are not configured.');
    const body = new URLSearchParams({To: phoneE164, From: config.TWILIO_FROM_NUMBER, Body: `Your Pepper code is ${code}. It expires in 5 minutes.`});
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`, {method: 'POST', headers: {Authorization: `Basic ${Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded'}, body});
    if (!response.ok) throw new Error(`Twilio rejected SMS with status ${response.status}.`);
  }
}

export class AfricasTalkingSmsProvider implements SmsProvider {
  async sendOtp(phoneE164: string, code: string): Promise<void> {
    if (!config.AFRICASTALKING_API_KEY) throw new Error("Africa's Talking credentials are not configured.");
    const body = new URLSearchParams({username: config.AFRICASTALKING_USERNAME, to: phoneE164, from: config.AFRICASTALKING_SENDER_ID, message: `Your Pepper code is ${code}. It expires in 5 minutes.`});
    const response = await fetch('https://api.africastalking.com/version1/messaging', {method: 'POST', headers: {apiKey: config.AFRICASTALKING_API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'}, body});
    if (!response.ok) throw new Error(`Africa's Talking rejected SMS with status ${response.status}.`);
  }
}

export const getSmsProvider = (): SmsProvider => {
  if (config.SMS_PROVIDER === 'twilio') return new TwilioSmsProvider();
  if (config.SMS_PROVIDER === 'africastalking') return new AfricasTalkingSmsProvider();
  return new ConsoleSmsProvider();
};
