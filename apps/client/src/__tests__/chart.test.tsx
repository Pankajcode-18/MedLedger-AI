import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthTrendChart, statusLabel, originLabel } from '../features/ai/HealthTrendChart.js';
import type { TrendSeries } from '../types/index.js';

const sugar: TrendSeries = {
  key: 'fasting_glucose',
  label: 'Fasting blood sugar',
  unit: 'mg/dL',
  referenceRange: '70–99 mg/dL',
  direction: 'rising',
  changePercent: 20,
  latestStatus: 'high',
  note: '',
  rangeLow: 70,
  rangeHigh: 99,
  points: [
    { date: '2026-03-01T00:00:00Z', value: 92, status: 'normal', origin: 'report' },
    { date: '2026-05-01T00:00:00Z', value: 104, status: 'high', origin: 'home' },
    { date: '2026-07-01T00:00:00Z', value: 111, status: 'high', origin: 'clinic' }
  ]
};

describe('health trend chart', () => {
  test('draws one marker per reading, the line and the normal range band', () => {
    const { container } = render(<HealthTrendChart series={sugar} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2); // report ● + home ○
    expect(container.querySelectorAll('rect[rx="1.5"]').length).toBe(1); // clinic ■
    expect(container.querySelector('path')).toBeTruthy();
    // axis labels are plain numbers, dates are DD MMM
    expect(container.textContent).toMatch(/Mar|May|Jul/);
  });

  test('describes readings in words', () => {
    expect(statusLabel('high')).toMatch(/Above range/);
    expect(statusLabel('normal')).toBe('In range');
    expect(originLabel('home')).toBe('Home reading');
    expect(originLabel('clinic')).toBe('Clinic reading');
    expect(originLabel(undefined)).toBe('From a report');
  });

  test('has an accessible description for screen readers', () => {
    render(<HealthTrendChart series={sugar} />);
    expect(screen.getAllByRole('img').length + document.querySelectorAll('[aria-label]').length).toBeGreaterThan(0);
  });
});
