import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AbnormalValuesTable } from '../features/ai/AiResultBlocks.js';

vi.mock('../api/recordsApi.js', () => ({
  recordErrorMessage: async (e: unknown) => String((e as Error)?.message || e),
  recordsApi: {
    getText: vi.fn(async () => ({
      reportId: 'r2',
      fileName: 'photo.jpg',
      notes: '',
      text: 'LDL cholesterol: 88 mg/dL\nTSH: 8.16 mIU/L',
      extraction: { status: 'done', method: 'ocr', confidence: 91, cleanedPhoto: true, uncertainNumbers: ['88', '8.16'] }
    })),
    reextract: vi.fn(),
    correctText: vi.fn()
  }
}));

describe('numbers that were hard to read', () => {
  test('are listed under the recognised text, and a cleaned-up photo asks for a check', async () => {
    const { FileTextPanel } = await import('../features/ai/FileTextPanel.js');
    render(<FileTextPanel reportId="r2" />);
    expect(await screen.findByText(/2 numbers were hard to read: 88, 8\.16/)).toBeTruthy();
    // confidence is 91 %, but the photo needed clean-up, so the full assistant waits for a check
    expect(screen.getByText(/only the built-in checker is used/)).toBeTruthy();
  });

  test('an uncertain abnormal value carries a "check" badge', () => {
    render(
      <AbnormalValuesTable
        values={[
          { test: 'LDL Cholesterol', value: '188 mg/dL', referenceRange: '< 100 mg/dL', status: 'high', severity: 'moderate', explanation: 'Above range', uncertain: true },
          { test: 'Hemoglobin', value: '9.8 g/dL', referenceRange: '13–17 g/dL', status: 'low', severity: 'mild', explanation: 'Below range' }
        ]}
      />
    );
    expect(screen.getAllByText('Check against the report')).toHaveLength(1);
  });
});
