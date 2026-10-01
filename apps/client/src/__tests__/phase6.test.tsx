import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildNotifications } from '../lib/activityFeed.js';
import { EngineBadge } from '../features/ai/AiResultBlocks.js';

vi.mock('../api/recordsApi.js', () => {
  const text = 'Hemoglobln 9.l g/dL';
  return {
    recordErrorMessage: async (e: unknown) => String((e as Error)?.message || e),
    recordsApi: {
      getText: vi.fn(async () => ({
        reportId: 'r1',
        fileName: 'scan.jpg',
        notes: '',
        text,
        extraction: { status: 'done', method: 'ocr', confidence: 42, chars: text.length }
      })),
      reextract: vi.fn(),
      correctText: vi.fn(async (_id: string, t: string) => ({
        reportId: 'r1',
        fileName: 'scan.jpg',
        notes: '',
        text: t,
        extraction: { status: 'done', method: 'ocr', confidence: 42, chars: t.length, corrected: true, correctedAt: '2026-09-25T10:00:00Z' }
      }))
    }
  };
});

describe('emergency override is shown to the patient', () => {
  test('a notification names who changed it and why', () => {
    const list = buildNotifications({
      role: 'patient',
      userId: 'p1',
      records: [],
      consents: [
        {
          status: 'granted',
          doctorId: 'd1',
          doctorName: 'Dr. Anil Sharma',
          patientName: 'Meena',
          patientId: 'p1',
          requestedAt: null,
          decidedAt: '2026-09-25T10:00:00Z',
          override: { byName: 'MedLedger Administrator', reason: 'Unconscious in the emergency ward', at: '2026-09-25T10:00:00Z', change: 'granted' }
        }
      ]
    });
    expect(list[0].title).toBe('An administrator shared your records');
    expect(list[0].message).toContain('Unconscious in the emergency ward');
    expect(list[0].actionHref).toBe('/patient/permissions');
  });
});

describe('AI results say when only the built-in checker was used', () => {
  test('the privacy notice is shown', () => {
    render(<EngineBadge engine="local" notice="“scan.jpg” was read from an unclear image, so only the built-in assistant was used." />);
    expect(screen.getByRole('note').textContent).toContain('unclear image');
  });
});

describe('correcting text read from a scan', () => {
  test('low confidence is explained, and the corrected text is saved', async () => {
    const { FileTextPanel } = await import('../features/ai/FileTextPanel.js');
    const { recordsApi } = await import('../api/recordsApi.js');
    const ready = vi.fn();
    render(<FileTextPanel reportId="r1" onTextReady={ready} />);
    expect(await screen.findByText(/only the built-in checker is used/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Correct the text' }));
    const box = screen.getByLabelText(/compare it with the original file/);
    fireEvent.change(box, { target: { value: 'Hemoglobin 9.1 g/dL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrected text' }));
    await waitFor(() => expect(recordsApi.correctText).toHaveBeenCalledWith('r1', 'Hemoglobin 9.1 g/dL'));
    expect(await screen.findByText(/checked and corrected by a person/)).toBeTruthy();
    expect(screen.queryByText(/only the built-in checker is used/)).toBeNull();
    expect(ready).toHaveBeenCalled();
  });
});
