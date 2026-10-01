import { formatDate } from './format.js';
/** Builds a printable one-page emergency card from the saved profile and downloads it as an HTML file. */
export interface EmergencyProfile {
  name?: string | number | boolean;
  age?: string | number | boolean;
  bloodGroup?: string | number | boolean;
  allergies?: string | number | boolean;
  emergencyContactName?: string | number | boolean;
  emergencyContactPhone?: string | number | boolean;
}

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const show = (v: unknown): string => (v === undefined || v === null || String(v).trim() === '' ? 'Not added' : esc(v));

export function emergencyCardHtml(p: EmergencyProfile, now = new Date()): string {
  const date = formatDate(now);
  const contact = p.emergencyContactName ? `${esc(p.emergencyContactName)}${p.emergencyContactPhone ? ` – ${esc(p.emergencyContactPhone)}` : ''}` : 'Not added';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Emergency card – ${esc(p.name)}</title>
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:24px;color:#111}
.card{max-width:420px;border:2px solid #b91c1c;border-radius:12px;padding:18px}
h1{font-size:18px;margin:0 0 12px;color:#b91c1c}dt{font-size:12px;color:#666;margin-top:10px}dd{margin:2px 0 0;font-size:16px;font-weight:600}
p{font-size:11px;color:#666;margin-top:16px}@media print{body{margin:0}}</style></head>
<body><div class="card"><h1>Emergency medical card</h1><dl>
<dt>Name</dt><dd>${show(p.name)}</dd>
<dt>Age</dt><dd>${show(p.age)}</dd>
<dt>Blood group</dt><dd>${show(p.bloodGroup)}</dd>
<dt>Allergies</dt><dd>${show(p.allergies)}</dd>
<dt>Emergency contact</dt><dd>${contact}</dd>
</dl><p>Made with MedLedger AI on ${date}. Details are as entered by the patient.</p></div></body></html>`;
}

export function downloadEmergencyCard(p: EmergencyProfile): void {
  const blob = new Blob([emergencyCardHtml(p)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'emergency-card.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
