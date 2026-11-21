import {config} from './config';
import {tokenStore} from './storage';

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly details: unknown) { super(message); }
}

let refreshing:Promise<void>|undefined;
const refresh=async()=>{const token=tokenStore.refresh();if(!token)throw new ApiError('AUTHENTICATION_REQUIRED','Sign in to continue.',{});const response=await fetch(`${config.apiBaseUrl}/api/v1/auth/refresh`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh:token})});if(!response.ok){tokenStore.clear();throw new ApiError('AUTHENTICATION_REQUIRED','Your session expired.',{})}const body=await response.json() as {access:string;refresh:string};tokenStore.write(body.access,body.refresh)};
export async function api<T>(path: string, options?: RequestInit,retried=false): Promise<T> {
  const access=tokenStore.access();const response = await fetch(`${config.apiBaseUrl}/api/v1${path}`, {headers: {'Content-Type': 'application/json',...(access?{Authorization:`Bearer ${access}`} : {}), ...options?.headers}, ...options});
  if(response.status===401&&!retried&&!path.startsWith('/auth/')){refreshing??=refresh().finally(()=>{refreshing=undefined});await refreshing;return api<T>(path,options,true)}
  const body = response.status===204?{}:await response.json();
  if (!response.ok) throw new ApiError(body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'Request failed', body.error?.details);
  return body as T;
}
