import {readFile} from 'node:fs/promises';
import {Environment,NotificationTypeV2,SignedDataVerifier} from '@apple/app-store-server-library';
import {GoogleAuth,OAuth2Client} from 'google-auth-library';
import {config} from '../../config.js';
import {AppError} from '../../core/errors.js';

export type StorePaymentEvent={
  provider:'apple'|'google';
  eventId:string;
  providerRef:string;
  status:'succeeded'|'failed'|'refunded'|'expired';
  expiresAt?:string;
  autoRenew?:boolean;
  grantProduct:boolean;
  payload:unknown;
};

export interface StoreNotificationVerifier{
  verify(body:unknown,authorization?:string):Promise<StorePaymentEvent>;
}

const invalidNotification=()=>new AppError(401,'INVALID_STORE_NOTIFICATION','The store notification could not be verified.');
const notConfigured=(provider:string)=>new AppError(503,'PROVIDER_NOT_CONFIGURED',`${provider} store notifications are not configured.`);

let appleVerifierPromise:Promise<SignedDataVerifier>|undefined;
const appleVerifier=()=>{
  if(!config.APPLE_ROOT_CA_FILES||!config.APPLE_BUNDLE_ID)throw notConfigured('Apple');
  appleVerifierPromise??=Promise.all(config.APPLE_ROOT_CA_FILES.split(',').map(path=>readFile(path.trim()))).then(roots=>new SignedDataVerifier(roots,true,config.APPLE_ENVIRONMENT==='production'?Environment.PRODUCTION:Environment.SANDBOX,config.APPLE_BUNDLE_ID,config.APPLE_APP_ID));
  return appleVerifierPromise;
};

export const appleNotificationStatus=(type:string|undefined):StorePaymentEvent['status']=>{
  if(type===NotificationTypeV2.REFUND||type===NotificationTypeV2.REVOKE)return'refunded';
  if(type===NotificationTypeV2.EXPIRED||type===NotificationTypeV2.GRACE_PERIOD_EXPIRED)return'expired';
  if(type===NotificationTypeV2.DID_FAIL_TO_RENEW)return'failed';
  return'succeeded';
};

const appleNotificationVerifier:StoreNotificationVerifier={verify:async body=>{
  const signedPayload=(body as {signedPayload?:unknown}|null)?.signedPayload;
  if(typeof signedPayload!=='string'||!signedPayload)throw invalidNotification();
  const verifier=await appleVerifier();
  try{
    const notification=await verifier.verifyAndDecodeNotification(signedPayload);
    if(!notification.notificationUUID||!notification.data?.signedTransactionInfo)throw invalidNotification();
    const transaction=await verifier.verifyAndDecodeTransaction(notification.data.signedTransactionInfo);
    const providerRef=transaction.originalTransactionId??transaction.transactionId;
    if(!providerRef||transaction.bundleId!==config.APPLE_BUNDLE_ID)throw invalidNotification();
    const renewal=notification.data.signedRenewalInfo?await verifier.verifyAndDecodeRenewalInfo(notification.data.signedRenewalInfo):undefined;
    const grantProduct=[NotificationTypeV2.SUBSCRIBED,NotificationTypeV2.DID_RENEW,NotificationTypeV2.ONE_TIME_CHARGE].includes(notification.notificationType as NotificationTypeV2);
    return{provider:'apple',eventId:notification.notificationUUID,providerRef,status:appleNotificationStatus(notification.notificationType),...(transaction.expiresDate?{expiresAt:new Date(transaction.expiresDate).toISOString()}:{}),...(renewal?.autoRenewStatus===undefined?{}:{autoRenew:renewal.autoRenewStatus===1}),grantProduct,payload:notification};
  }catch(error){if(error instanceof AppError)throw error;throw invalidNotification();}
}};

type GoogleDeveloperNotification={packageName?:string;subscriptionNotification?:{purchaseToken?:string;notificationType?:number};oneTimeProductNotification?:{purchaseToken?:string;sku?:string;notificationType?:number}};
type GooglePush={message?:{messageId?:string;data?:string}};

export const decodeGoogleNotification=(body:unknown)=>{
  const push=body as GooglePush|null;
  if(!push?.message?.messageId||!push.message.data)throw invalidNotification();
  try{return{eventId:push.message.messageId,notification:JSON.parse(Buffer.from(push.message.data,'base64').toString('utf8')) as GoogleDeveloperNotification};}catch{throw invalidNotification();}
};

const googleNotificationVerifier:StoreNotificationVerifier={verify:async(body,authorization)=>{
  if(!config.GOOGLE_PUBSUB_AUDIENCE||!config.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL||!config.GOOGLE_SERVICE_ACCOUNT_FILE)throw notConfigured('Google');
  const token=/^Bearer\s+(.+)$/i.exec(authorization??'')?.[1];
  if(!token)throw invalidNotification();
  const auth=new GoogleAuth({keyFile:config.GOOGLE_SERVICE_ACCOUNT_FILE,scopes:['https://www.googleapis.com/auth/androidpublisher']});
  try{
    const ticket=await new OAuth2Client().verifyIdToken({idToken:token,audience:config.GOOGLE_PUBSUB_AUDIENCE});
    const claims=ticket.getPayload();
    if(claims?.email!==config.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL||claims.email_verified!==true)throw invalidNotification();
    const{eventId,notification}=decodeGoogleNotification(body);
    if(notification.packageName!==config.GOOGLE_PACKAGE_NAME)throw invalidNotification();
    const subscription=notification.subscriptionNotification;
    const oneTime=notification.oneTimeProductNotification;
    const purchaseToken=subscription?.purchaseToken??oneTime?.purchaseToken;
    if(!purchaseToken)throw invalidNotification();
    if(oneTime?.notificationType===2)return{provider:'google',eventId,providerRef:purchaseToken,status:'refunded',grantProduct:false,payload:notification};
    if(oneTime&&!oneTime.sku)throw invalidNotification();
    const client=await auth.getClient();
    const root=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.GOOGLE_PACKAGE_NAME)}/purchases`;
    const url=subscription?`${root}/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`:`${root}/products/${encodeURIComponent(oneTime?.sku??'')}/tokens/${encodeURIComponent(purchaseToken)}`;
    const response=await client.request<Record<string,unknown>>({url});
    const data=response.data;
    const items=Array.isArray(data.lineItems)?data.lineItems as Array<Record<string,unknown>>:[];
    const item=items[0];
    const expiry=typeof item?.expiryTime==='string'?item.expiryTime:undefined;
    const subscriptionState=typeof data.subscriptionState==='string'?data.subscriptionState:undefined;
    const purchaseState=typeof data.purchaseState==='number'?data.purchaseState:undefined;
    const status:StorePaymentEvent['status']=subscriptionState?(subscriptionState==='SUBSCRIPTION_STATE_EXPIRED'?'expired':subscriptionState==='SUBSCRIPTION_STATE_ACTIVE'||subscriptionState==='SUBSCRIPTION_STATE_IN_GRACE_PERIOD'||subscriptionState==='SUBSCRIPTION_STATE_CANCELED'?'succeeded':'failed'):purchaseState===0?'succeeded':purchaseState===1?'refunded':'failed';
    const grantProduct=oneTime?.notificationType===1||[2,4].includes(subscription?.notificationType??-1);
    return{provider:'google',eventId,providerRef:purchaseToken,status,...(expiry?{expiresAt:expiry}:{}),...(subscription?{autoRenew:Boolean((item?.autoRenewingPlan as Record<string,unknown>|undefined)?.autoRenewEnabled)}:{}),grantProduct,payload:{notification,purchase:data}};
  }catch(error){if(error instanceof AppError)throw error;throw invalidNotification();}
}};

export const storeNotificationVerifiers={apple:appleNotificationVerifier,google:googleNotificationVerifier} satisfies Record<'apple'|'google',StoreNotificationVerifier>;
