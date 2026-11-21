import {describe, expect, it} from 'vitest';
import {AppError} from '../src/core/errors.js';
import {calculateAge, calculateCompleteness} from '../src/modules/profiles/services.js';

describe('profile rules', () => {
  it('calculates age around the birthday boundary', () => {
    expect(calculateAge('2008-11-16', new Date('2026-11-16T12:00:00Z'))).toBe(18);
    expect(calculateAge('2008-11-17', new Date('2026-11-16T12:00:00Z'))).toBe(17);
  });

  it('rejects invalid birth dates', () => {
    expect(() => calculateAge('invalid')).toThrow(AppError);
  });

  it('computes profile completeness from meaningful fields', () => {
    expect(calculateCompleteness({display_name:'Miatta',birth_date:'1998-01-01',gender:'woman',relationship_goal:'long_term',bio:'Hello',county:'montserrado',languages:['English']}, 3)).toBe(100);
  });
});
