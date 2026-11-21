import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getMessaging} from 'firebase-admin/messaging';
import {config} from '../../config.js';

export type PushMessage={tokens:string[];title:string;body:string;data:Record<string,string>};
export interface PushProvider{readonly name:string;send(message:PushMessage):Promise<void>}
class NoopPushProvider implements PushProvider{readonly name='noop';send():Promise<void>{return Promise.resolve();}}
class FirebasePushProvider implements PushProvider{
  readonly name='fcm';
  constructor(){if(!getApps().length)initializeApp({credential:cert(config.FIREBASE_CREDENTIALS_FILE)});}
  async send(message:PushMessage){if(!message.tokens.length)return;await getMessaging().sendEachForMulticast({tokens:message.tokens,notification:{title:message.title,body:message.body},data:message.data});}
}
let provider:PushProvider|undefined;
export const getPushProvider=()=>provider??=(config.FIREBASE_ENABLED&&config.FIREBASE_CREDENTIALS_FILE?new FirebasePushProvider():new NoopPushProvider());
export const setPushProviderForTests=(value:PushProvider|undefined)=>{provider=value;};
