import { formatDate } from '../../lib/format.js';
import React, { useState } from 'react';
import { Settings, Check } from 'lucide-react';
import { Card } from './Card.js';
import { Button } from './Button.js';
import { Field } from './PageKit.js';
import { useSavedSettings } from '../../hooks/useSavedSettings.js';

export interface ProfileField {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  hint?: string;
}

/**
 * An organisation or practice profile saved on the server (one settings section per account).
 * Starts empty; says "saved" only after the server stored it.
 */
export const ProfileSettingsCard: React.FC<{
  section: string;
  title: string;
  description: string;
  fields: ProfileField[];
  defaults?: Record<string, string>;
  onMessage: (text: string, ok: boolean) => void;
}> = ({ section, title, description, fields, defaults = {}, onMessage }) => {
  const initial = Object.fromEntries(fields.map((f) => [f.key, defaults[f.key] ?? '']));
  const { values, setValues, save, saving, updatedAt } = useSavedSettings(section, initial);
  const [dirty, setDirty] = useState(false);

  return (
    <Card className="p-6">
      <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
        <Settings className="w-4 h-4 text-slate-500" />
        <span>{title}</span>
      </h3>
      <p className="text-xs text-slate-500 mb-5">{description}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await save();
          setDirty(!result.ok);
          onMessage(result.message, result.ok);
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              type={f.type}
              placeholder={f.placeholder}
              hint={f.hint}
              value={String(values[f.key] ?? '')}
              onChange={(v) => {
                setValues({ ...values, [f.key]: v });
                setDirty(true);
              }}
            />
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          {updatedAt && !dirty && (
            <span className="text-[11px] text-slate-500">
              Last saved {formatDate(updatedAt)}
            </span>
          )}
          <Button type="submit" variant="primary" size="sm" disabled={saving} className="text-xs font-bold flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving…' : 'Save changes'}</span>
          </Button>
        </div>
      </form>
    </Card>
  );
};
