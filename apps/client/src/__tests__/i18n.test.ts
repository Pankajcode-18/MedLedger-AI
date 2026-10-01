import { afterAll, describe, expect, test } from 'vitest';
import { setLang, translate, getLang } from '../i18n/index.js';

describe('Nepali and Hindi', () => {
  afterAll(async () => {
    await setLang('en');
  });

  test('English is the default and nothing is changed', () => {
    expect(getLang()).toBe('en');
    expect(translate('Sign in')).toBeNull();
  });

  test('whole texts, texts with values and dates are translated', async () => {
    await setLang('ne');
    expect(translate('Stop sharing')).toMatch(/[ऀ-ॿ]/);
    expect(translate('3 days ago')).toMatch(/3/);
    expect(translate('3 days ago')).toMatch(/[ऀ-ॿ]/);
    expect(translate('12 May 2026')).toMatch(/^12 .+ 2026$/);
    expect(translate('Tanmay Shishodia')).toBeNull(); // names stay as written
  });

  test('page text is swapped and restored', async () => {
    document.body.innerHTML = '<main><h1>Stop sharing</h1><input placeholder="Search by name, specialty or hospital"><p translate="no">Stop sharing</p></main>';
    await setLang('hi');
    expect(document.querySelector('h1')!.textContent).toMatch(/[ऀ-ॿ]/);
    expect(document.querySelector('input')!.getAttribute('placeholder')).toMatch(/[ऀ-ॿ]/);
    expect(document.querySelector('p')!.textContent).toBe('Stop sharing');
    expect(document.documentElement.lang).toBe('hi');
    await setLang('en');
    expect(document.querySelector('h1')!.textContent).toBe('Stop sharing');
    expect(document.querySelector('input')!.getAttribute('placeholder')).toBe('Search by name, specialty or hospital');
  });
});
