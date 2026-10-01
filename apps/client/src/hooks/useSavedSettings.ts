import { useCallback, useEffect, useState } from 'react';
import { settingsApi, SettingsValues } from '../api/settingsApi.js';

/**
 * Loads one settings section from the server and saves it back.
 * `values` starts from `defaults` and is replaced by what the user saved before.
 * `save()` resolves with a message to show — it only says "saved" when the server stored it.
 */
export function useSavedSettings<T extends SettingsValues>(section: string, defaults: T) {
  const [values, setValues] = useState<T>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    settingsApi
      .get(section)
      .then((res) => {
        if (cancelled) return;
        setValues((prev) => ({ ...prev, ...(res.values as Partial<T>) }));
        setUpdatedAt(res.updatedAt);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const save = useCallback(
    async (next?: T): Promise<{ ok: boolean; message: string }> => {
      setSaving(true);
      try {
        const res = await settingsApi.save(section, (next || values) as SettingsValues);
        setValues((prev) => ({ ...prev, ...(res.values as Partial<T>) }));
        setUpdatedAt(res.updatedAt);
        return { ok: true, message: 'Your changes are saved.' };
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        return { ok: false, message: msg || 'Your changes could not be saved. Please try again.' };
      } finally {
        setSaving(false);
      }
    },
    [section, values]
  );

  return { values, setValues, loaded, saving, updatedAt, save };
}
