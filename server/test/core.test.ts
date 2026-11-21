import {describe, expect, it} from 'vitest';
import {decryptSensitive, encryptSensitive} from '../src/core/crypto.js';
import {distanceLabel} from '../src/core/distance.js';
import {coveringCells, geoCell} from '../src/core/geo.js';
import {candidateScore,diversify} from '../src/modules/discovery/scoring.js';
import {hasSafetyWarning} from '../src/modules/chat/services.js';
import {decodeCursor, encodeCursor, pageLimit} from '../src/core/pagination.js';

describe('core primitives', () => {
  it('round trips opaque cursors', () => {
    const cursor = {createdAt: '2026-11-16T00:00:00.000Z', id: '019a8a4e-7b4a-7000-8000-000000000001'};
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(pageLimit('20')).toBe(20);
  });

  it('encrypts sensitive values with authenticated encryption', () => {
    const encrypted = encryptSensitive('private-value');
    expect(encrypted?.ciphertext.toString()).not.toContain('private-value');
    expect(decryptSensitive(encrypted)).toBe('private-value');
  });

  it('returns privacy-preserving distance labels', () => {
    const label = distanceLabel(2_200, '019a8a4e-7b4a-7000-8000-000000000001', '019a8a4e-7b4a-7000-8000-000000000002');
    expect(label).toMatch(/^\d+ km away$/);
  });

  it('creates stable level-six S2 cell ids', () => {
    expect(geoCell(6.3156, -10.8074)).toBe(geoCell(6.3156, -10.8074));
    expect(typeof geoCell(6.3156, -10.8074)).toBe('bigint');
  });

  it('covers a discovery radius with level-six S2 cells',()=>{
    const cells=coveringCells(6.3156,-10.8074,50);
    expect(cells).toContain(geoCell(6.3156,-10.8074));
    expect(cells.length).toBeGreaterThan(1);
  });

  it('scores match signals and diversifies repeated bands',()=>{
    const baseline=candidateScore({id:'a',recency:1,proximity:1,completeness:1,desirability:0.5,newUser:0,sharedSignal:0,likedMe:false,boostActive:false,random:0});
    const liked=candidateScore({id:'b',recency:1,proximity:1,completeness:1,desirability:0.5,newUser:0,sharedSignal:0,likedMe:true,boostActive:false,random:0});
    expect(liked-baseline).toBeCloseTo(0.5);
    const result=diversify([{id:'1',desirability:.9,likedMe:false},{id:'2',desirability:.9,likedMe:false},{id:'3',desirability:.9,likedMe:false},{id:'4',desirability:.9,likedMe:false},{id:'5',desirability:.4,likedMe:false}]);
    expect(result[3]?.id).toBe('5');
  });

  it('flags contact and money requests only in the first three messages',()=>{
    expect(hasSafetyWarning('Send me MoMo on +231 77 000 000',0)).toBe(true);
    expect(hasSafetyWarning('Send me MoMo on +231 77 000 000',3)).toBe(false);
    expect(hasSafetyWarning('How was your day?',0)).toBe(false);
  });
});
