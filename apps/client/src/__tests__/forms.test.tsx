import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPatientPage } from '../pages/RegisterPatientPage.js';
import { authApi } from '../api/authApi.js';

const renderPage = () =>
  render(
    <MemoryRouter>
      <RegisterPatientPage />
    </MemoryRouter>
  );

describe('patient registration form', () => {
  test('starts empty', () => {
    renderPage();
    for (const input of Array.from(document.querySelectorAll('input'))) expect((input as HTMLInputElement).value).toBe('');
  });

  test('a weak password is explained and nothing is sent', async () => {
    const register = vi.spyOn(authApi, 'register');
    renderPage();
    const pw = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(pw, { target: { value: 'abcdefgh' } });
    fireEvent.submit(pw.closest('form')!);
    expect(await screen.findByText(/at least one number/)).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  test('the server’s message is shown when registration fails', async () => {
    vi.spyOn(authApi, 'register').mockRejectedValue({ response: { data: { error: 'An account with this email already exists.' } } });
    renderPage();
    const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];
    const byType = (t: string) => inputs.find((i) => i.type === t)!;
    fireEvent.change(inputs.find((i) => i.type === 'text')!, { target: { value: 'Sita Sharma' } });
    fireEvent.change(byType('email'), { target: { value: 'sita@example.com' } });
    fireEvent.change(byType('password'), { target: { value: 'goodpass9' } });
    fireEvent.submit(byType('password').closest('form')!);
    await waitFor(() => expect(screen.getByText('An account with this email already exists.')).toBeTruthy());
  });
});
