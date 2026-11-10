import OpenAI from 'openai';
import { config } from '../config.js';

let client;
function getClient(){if(!config.CMU_API_GATEWAY_URL||!config.CMU_API_KEY)throw new Error('CMU_API_GATEWAY_URL and CMU_API_KEY must be configured.');return client??=new OpenAI({apiKey:config.CMU_API_KEY,baseURL:config.CMU_API_GATEWAY_URL});}
export async function chatCompletion(messages,{systemPrompt=null,model=null,temperature=0.7,maxTokens=1500}={}){const full=systemPrompt?[{role:'system',content:systemPrompt},...messages]:messages,r=await getClient().chat.completions.create({model:model||config.CMU_LLM_MODEL,messages:full,temperature,max_tokens:maxTokens});return r.choices[0]?.message?.content||'';}
export async function embedding(text){if(!config.CMU_EMBEDDING_MODEL||!config.CMU_API_GATEWAY_URL)return null;try{const r=await getClient().embeddings.create({model:config.CMU_EMBEDDING_MODEL,input:text.slice(0,8000)});return r.data[0]?.embedding??null;}catch{return null;}}
