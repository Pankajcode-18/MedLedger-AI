/** Shared display formats: dates as 24 Sep 2026, money in Nepali or Indian rupees. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatDate = (value?: string | number | Date | null): string => {
  if (value === undefined || value === null || value === '') return '–';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '–';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** 24 Sep (no year), for charts and recent items. */
export const formatDayMonth = (value?: string | number | Date | null): string => {
  if (value === undefined || value === null || value === '') return '–';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '–' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** Sep '26, for chart axes that span months. */
export const formatMonthYear = (value: string | number | Date): string => {
  const d = new Date(value);
  return `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
};

export const formatTime = (value: string | number | Date): string =>
  new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export const formatDateTime = (value?: string | number | Date | null): string => {
  if (value === undefined || value === null || value === '') return '–';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '–';
  return `${formatDate(d)}, ${formatTime(d)}`;
};

/** "Rs 12,500" for Nepali rupees, "₹12,500" for Indian rupees (Indian digit grouping for both). */
export const formatMoney = (amount?: number | null, currency: 'NPR' | 'INR' = 'NPR'): string => {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) return '–';
  const n = Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return currency === 'INR' ? `₹${n}` : `Rs ${n}`;
};

/** Short "2 hours ago" style text for recent times, the date otherwise. */
export const formatAgo = (value?: string | number | Date | null): string => {
  if (!value) return '–';
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return '–';
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return formatDate(value);
};

/** Error text from an API failure, or the fallback. */
export const errorText = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

/** A report's name as people say it: the title given at upload, or the file name without extension and underscores. */
export const recordTitle = (r: { description?: string | null; fileName?: string | null }): string => {
  if (r.description && r.description.trim()) return r.description.trim();
  const base = (r.fileName || 'Report').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
};

/** "Blood test – 12 May 2026" */
export const recordLabel = (r: { description?: string | null; fileName?: string | null; createdAt?: string | Date | null }): string =>
  r.createdAt ? `${recordTitle(r)} – ${formatDate(r.createdAt)}` : recordTitle(r);
