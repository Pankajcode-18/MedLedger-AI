/**
 * Nepali and Hindi for the whole app, without rewriting every page.
 *
 * Pages keep their English text. When another language is chosen, a MutationObserver
 * swaps each visible English text (and placeholder / title / aria-label / alt) for its
 * translation from locales/<lang>.json, and swaps it back when English is chosen again.
 *
 * - "exact" entries match a whole text (surrounding spaces kept).
 * - "templates" match text built from values, e.g. "Shared with {0} doctors".
 * - Dates such as "12 May 2026" get their month translated.
 * - Anything else (names, report text, AI answers) is left as it is.
 * - Mark an element translate="no" or class "notranslate" to leave it alone.
 */

export type Lang = 'en' | 'ne' | 'hi';
export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ne', label: 'नेपाली', short: 'ने' },
  { code: 'hi', label: 'हिन्दी', short: 'हि' },
];

type Locale = { exact: Record<string, string>; templates: Record<string, string> };
type Compiled = { exact: Map<string, string>; templates: { re: RegExp; out: string }[]; months: Record<string, string> };

const STORAGE_KEY = 'medledger_lang';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'svg', 'SVG']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "12 May 2026", "May 2026", "Sep 18, 2026", "12 May 2026, 10:45 AM", "12 May – 3 Jun"
const MONTH_RE = new RegExp(`\\b(${MONTHS.join('|')})\\b`, 'g');
const DATE_RE = new RegExp(`^[\\d\\s,:.–-]*(?:(?:${MONTHS.join('|')})[\\d\\s,:.–-]*)+(?:[AP]M)?$`);

const loaders: Record<Exclude<Lang, 'en'>, () => Promise<Locale>> = {
  ne: () => import('./locales/ne.json').then((m) => (m.default ?? m) as Locale),
  hi: () => import('./locales/hi.json').then((m) => (m.default ?? m) as Locale),
};

let current: Lang = 'en';
let dict: Compiled | null = null;
let observer: MutationObserver | null = null;
const listeners = new Set<(l: Lang) => void>();

// what the page itself wrote (English) and what we last put in its place
const textOriginal = new WeakMap<Text, string>();
const textShown = new WeakMap<Text, string>();
const attrOriginal = new WeakMap<Element, Record<string, string>>();
const attrShown = new WeakMap<Element, Record<string, string>>();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function compile(locale: Locale): Compiled {
  const exact = new Map(Object.entries(locale.exact));
  const templates = Object.entries(locale.templates)
    // a template needs some words of its own, or it would match any text
    .filter(([src]) => src.replace(/\{\d+\}/g, '').replace(/[^A-Za-z]/g, '').length >= 4)
    .map(([src, out]) => {
      const pattern = escapeRe(norm(src)).replace(/\\\{(\d+)\\\}/g, '(?<p$1>.*?)');
      try {
        return { re: new RegExp(`^${pattern}$`), out, len: src.length };
      } catch {
        return null;
      }
    })
    .filter((t): t is { re: RegExp; out: string; len: number } => Boolean(t))
    // most specific (longest) first
    .sort((a, b) => b.len - a.len)
    .map(({ re, out }) => ({ re, out }));
  const months: Record<string, string> = {};
  for (const m of MONTHS) if (exact.has(m)) months[m] = exact.get(m)!;
  return { exact, templates, months };
}

/** Translate one piece of text, or return null to leave it unchanged. */
export function translate(text: string, depth = 0): string | null {
  if (!dict || current === 'en') return null;
  const core = norm(text);
  if (!core || !/[A-Za-z]/.test(core)) return null;
  const hit = dict.exact.get(core);
  if (hit !== undefined) return hit;

  if (DATE_RE.test(core)) {
    const d = dict;
    return core.replace(MONTH_RE, (m) => d.months[m] ?? m).replace(/\bAM\b/, d.exact.get('AM') ?? 'AM').replace(/\bPM\b/, d.exact.get('PM') ?? 'PM');
  }

  if (depth > 1) return null;
  for (const t of dict.templates) {
    const m = core.match(t.re);
    if (!m) continue;
    return t.out.replace(/\{(\d+)\}/g, (_, i) => {
      const v = m.groups?.[`p${i}`] ?? '';
      return translate(v, depth + 1) ?? v;
    });
  }
  return null;
}

const keepSpaces = (orig: string, tr: string) => {
  const lead = orig.match(/^\s*/)![0];
  const trail = orig.match(/\s*$/)![0];
  return lead + tr + trail;
};

function skipped(el: Element | null, forAttrs = false): boolean {
  for (let e = el; e; e = e.parentElement) {
    // a text box's own placeholder is translated; what people type in it is not touched
    if (SKIP_TAGS.has(e.tagName) && !(forAttrs && e === el && e.tagName === 'TEXTAREA')) return true;
    if (e.getAttribute('translate') === 'no' || e.classList?.contains('notranslate')) return true;
    if ((e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

function doText(node: Text) {
  const now = node.nodeValue ?? '';
  if (textShown.get(node) === now) return; // our own change
  textOriginal.set(node, now); // the page wrote something new
  textShown.delete(node);
  if (current === 'en' || skipped(node.parentElement)) return;
  const tr = translate(now);
  if (tr !== null) {
    const shown = keepSpaces(now, tr);
    textShown.set(node, shown);
    node.nodeValue = shown;
  }
}

function doAttrs(el: Element) {
  if (current === 'en' && !attrShown.has(el)) return;
  const orig = attrOriginal.get(el) ?? {};
  const shown = attrShown.get(el) ?? {};
  for (const a of ATTRS) {
    const now = el.getAttribute(a);
    if (now === null) continue;
    if (shown[a] === now) continue;
    orig[a] = now;
    delete shown[a];
    if (current === 'en' || skipped(el, true)) continue;
    const tr = translate(now);
    if (tr !== null) {
      shown[a] = tr;
      el.setAttribute(a, tr);
    }
  }
  attrOriginal.set(el, orig);
  attrShown.set(el, shown);
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (el.tagName === 'TEXTAREA') return doAttrs(el);
  if (SKIP_TAGS.has(el.tagName)) return;
  doAttrs(el);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else doAttrs(n as Element);
  }
}

/** Put every text we changed back to the page's own English. */
function restoreAll() {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n as Text;
      if (textShown.get(t) === t.nodeValue && textOriginal.has(t)) {
        const o = textOriginal.get(t)!;
        textShown.delete(t);
        t.nodeValue = o;
      }
    } else {
      const el = n as Element;
      const shown = attrShown.get(el);
      const orig = attrOriginal.get(el);
      if (!shown || !orig) continue;
      for (const a of Object.keys(shown)) {
        if (el.getAttribute(a) === shown[a] && orig[a] !== undefined) el.setAttribute(a, orig[a]);
      }
      attrShown.delete(el);
    }
  }
}

function startObserver() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((muts) => {
    if (current === 'en') return;
    for (const m of muts) {
      if (m.type === 'characterData') doText(m.target as Text);
      else if (m.type === 'attributes') doAttrs(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });
}

function readSaved(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'ne' || v === 'hi' || v === 'en') return v;
  } catch {
    /* storage blocked: use English */
  }
  return 'en';
}

export const getLang = (): Lang => current;

export async function setLang(lang: Lang): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  if (lang === 'en') {
    current = 'en';
    restoreAll();
  } else {
    const locale = await loaders[lang]();
    if (current !== 'en') restoreAll();
    dict = compile(locale);
    current = lang;
    walk(document.body);
  }
  document.documentElement.lang = lang;
  listeners.forEach((f) => f(lang));
}

export function onLangChange(f: (l: Lang) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Call once before the app renders. */
export function initI18n(): void {
  startObserver();
  const saved = readSaved();
  if (saved !== 'en') void setLang(saved);
}
