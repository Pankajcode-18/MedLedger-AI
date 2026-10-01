import { describe, expect, test } from 'vitest';
import { formatDate, formatMoney, recordLabel, recordTitle } from '../lib/format.js';
import { passwordStrength, validatePassword } from '../lib/password.js';
import { friendlyError } from '../api/apiClient.js';

describe('dates and names people read', () => {
  test('dates are written DD MMM YYYY', () => {
    expect(formatDate('2026-05-12T10:00:00Z')).toBe('12 May 2026');
    expect(formatDate('2026-09-03T12:00:00Z')).toBe('03 Sep 2026');
    expect(formatDate(null)).toBe('–');
    expect(formatDate('not a date')).toBe('–');
  });

  test('a report gets a friendly name, and a date when it has one', () => {
    expect(recordTitle({ description: 'Blood test', fileName: 'scan_001.pdf' })).toBe('Blood test');
    expect(recordTitle({ fileName: 'blood_panel_march.pdf' })).toBe('Blood panel march');
    expect(recordLabel({ description: 'Blood test', createdAt: '2026-05-12T08:00:00Z' })).toBe('Blood test – 12 May 2026');
  });

  test('money is shown in rupees', () => {
    expect(formatMoney(125000)).toBe('Rs 1,25,000');
    expect(formatMoney(500, 'INR')).toBe('₹500');
  });
});

describe('password form rules', () => {
  test('explains exactly what is missing', () => {
    expect(validatePassword('short1')).toMatch(/at least 8/);
    expect(validatePassword('longenough')).toMatch(/number/);
    expect(validatePassword('12345678')).toMatch(/letter/);
    expect(validatePassword('goodpass9')).toBeNull();
  });

  test('strength grows with length and variety', () => {
    expect(passwordStrength('').label).toBe('Too short');
    expect(passwordStrength('abcdefg1').score).toBeLessThan(passwordStrength('Abcdefgh1234!').score);
    expect(passwordStrength('Abcdefgh1234!').label).toBe('Strong');
  });
});

describe('error messages', () => {
  test('never show raw status codes', () => {
    expect(friendlyError(undefined)).toMatch(/internet connection/);
    expect(friendlyError(500, 'TypeError: x is undefined')).toMatch(/Something went wrong/);
    expect(friendlyError(403, 'Forbidden')).toBe("You don't have permission to do that.");
    expect(friendlyError(403, 'Only doctors can write prescriptions.')).toBe('Only doctors can write prescriptions.');
    expect(friendlyError(404, 'Cannot GET /x')).toMatch(/could not find/);
    expect(friendlyError(400, 'Email is required.')).toBeNull();
  });
});
