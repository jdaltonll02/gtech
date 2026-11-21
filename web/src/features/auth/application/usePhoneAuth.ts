import {useMutation} from '@tanstack/react-query';
import {authRepository} from '../data/authRepository';

export const useRequestOtp = () => useMutation({mutationFn: authRepository.requestOtp});
export const useVerifyOtp = () => useMutation({mutationFn: ({challengeId,code}:{challengeId:string;code:string})=>authRepository.verifyOtp(challengeId,code)});
