import jwt from 'jsonwebtoken';
import request from 'supertest';
import {describe,expect,it} from 'vitest';
import {createApp} from '../src/app.js';
import {config} from '../src/config.js';

const userId='019a9000-0000-7000-8000-000000000099';
const access=jwt.sign({sub:userId,type:'access'},config.JWT_SECRET,{expiresIn:'5m'});
describe('safety and lifecycle validation',()=>{
  it('rejects self-blocking',async()=>{const response=await request(createApp()).post('/api/v1/safety/blocks').set('authorization',`Bearer ${access}`).send({user_id:userId});expect(response.status).toBe(400);expect(response.body).toHaveProperty('error.code','VALIDATION_ERROR');});
  it('requires explicit deletion confirmation',async()=>{const response=await request(createApp()).delete('/api/v1/account').set('authorization',`Bearer ${access}`).send({confirmation:'not yet'});expect(response.status).toBe(400);expect(response.body).toHaveProperty('error.code','VALIDATION_ERROR');});
});
