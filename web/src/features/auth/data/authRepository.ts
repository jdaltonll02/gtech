import {api} from '../../../core/api';

export const authRepository = {
  requestOtp: (phone: string) => api<{challenge_id: string; expires_in: number}>('/auth/otp/request', {method: 'POST', body: JSON.stringify({phone})}),
  verifyOtp: (challengeId: string, code: string) => api<{access: string; refresh: string; is_new_user: boolean}>('/auth/otp/verify', {method: 'POST', body: JSON.stringify({challenge_id: challengeId, code})}),
};
