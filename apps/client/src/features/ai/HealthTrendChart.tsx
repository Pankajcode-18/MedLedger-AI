import { formatDate, formatDayMonth, formatMonthYear } from '../../lib/format.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TrendPoint, TrendSeries } from '../../types/index.js';

/**
 * One measurement over time: a 2px line, markers shaped by where the value came from
 * (report ● / home reading ○ / clinic ■), the normal range as a light band, and a
 * crosshair tooltip that snaps to the nearest date (also reachable with ← → keys).
 * Blood pressure passes the diastolic series as `companion` so both lines share one axis.
 *
 * Colours are the validated categorical slots 1 and 2 (blue / orange, CVD ΔE 24.7);
 * text never uses the series colour.
 */

export const SERIES_COLORS = ['#2a78d6', '#eb6834'];
const BAND = '#0ca30c';
const GRID = '#e5e7eb';
const INK = '#0b1220';
const MUTED = '#64748b';

const fmtNum = (n: number): string => (Math.abs(n) >= 1000 ? n.toLocaleString('en-IN') : String(Math.round(n * 100) / 100));
const fmtDate = (t: number, long = false): string =>
  long ? formatDate(t) : formatDayMonth(t);
const fmtMonth = (t: number): string => formatMonthYear(t);

const niceStep = (span: number, count: number): number => {
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
};

export const originLabel = (o?: TrendPoint['origin']): string =>
  o === 'home' ? 'Home reading' : o === 'clinic' ? 'Clinic reading' : 'From a report';

export const statusLabel = (s: TrendPoint['status']): string => (s === 'high' ? 'Above range ▲' : s === 'low' ? 'Below range ▼' : 'In range');

const Marker: React.FC<{ x: number; y: number; color: string; origin?: TrendPoint['origin']; active?: boolean }> = ({ x, y, color, origin, active }) => {
  const r = active ? 6 : 4.5;
  if (origin === 'clinic') {
    return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={1.5} fill={color} stroke="#fff" strokeWidth={2} />;
  }
  if (origin === 'home') {
    return (
      <g>
        <circle cx={x} cy={y} r={r + 1.5} fill="#fff" />
        <circle cx={x} cy={y} r={r - 0.5} fill="#fff" stroke={color} strokeWidth={2.5} />
      </g>
    );
  }
  return <circle cx={x} cy={y} r={r} fill={color} stroke="#fff" strokeWidth={2} />;
};

export const MarkerLegend: React.FC<{ origins: Array<TrendPoint['origin']>; band: boolean }> = ({ origins, band }) => {
  const set = new Set(origins.map((o) => o || 'report'));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
      {(['report', 'home', 'clinic'] as const)
        .filter((o) => set.has(o))
        .map((o) => (
          <span key={o} className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden="true">
              <Marker x={7} y={7} color={MUTED} origin={o} />
            </svg>
            {originLabel(o)}
          </span>
        ))}
      {band && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-2.5 rounded-sm" style={{ background: BAND, opacity: 0.18 }} aria-hidden="true" />
          Normal range
        </span>
      )}
    </div>
  );
};

interface Props {
  series: TrendSeries;
  /** second line on the same axis (diastolic blood pressure) */
  companion?: TrendSeries;
  height?: number;
  /** names for the two lines when a companion is shown */
  names?: [string, string];
}

export const HealthTrendChart: React.FC<Props> = ({ series, companion, height = 240, names }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(260, Math.floor(entries[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lines = useMemo(() => [series, ...(companion ? [companion] : [])], [series, companion]);

  // a different measurement or time range: drop the old crosshair position
  useEffect(() => setActive(null), [series.key, series.points.length]);

  // every distinct date across the lines — the crosshair snaps to these
  const stops = useMemo(() => {
    const ts = new Set<number>();
    lines.forEach((l) => l.points.forEach((p) => ts.add(new Date(p.date).getTime())));
    return [...ts].sort((a, b) => a - b);
  }, [lines]);

  const m = { top: 14, right: 20, bottom: 28, left: 46 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const values = lines.flatMap((l) => l.points.map((p) => p.value));
  const bandLow = series.rangeLow ?? companion?.rangeLow;
  const bandHigh = series.rangeHigh;
  const bandTop = companion ? series.rangeHigh : bandHigh;
  const bandBottom = companion ? companion.rangeLow : bandLow;
  const domainVals = [...values, ...(bandTop !== undefined ? [bandTop] : []), ...(bandBottom !== undefined ? [bandBottom] : [])];
  let yMin = Math.min(...domainVals);
  let yMax = Math.max(...domainVals);
  if (yMin === yMax) {
    yMin -= Math.abs(yMin) * 0.1 || 1;
    yMax += Math.abs(yMax) * 0.1 || 1;
  }
  const pad = (yMax - yMin) * 0.12;
  const step = niceStep(yMax - yMin + 2 * pad, 4);
  yMin = Math.floor((yMin - pad) / step) * step;
  yMax = Math.ceil((yMax + pad) / step) * step;
  if (yMin < 0 && Math.min(...values) >= 0) yMin = 0;

  let tMin = stops[0];
  let tMax = stops[stops.length - 1];
  // values from the same day or two: widen the window so the axis shows real dates
  if (tMax - tMin < 2 * 86_400_000) {
    const mid = (tMin + tMax) / 2;
    tMin = mid - 7 * 86_400_000;
    tMax = mid + 7 * 86_400_000;
  }
  const x = (t: number) => m.left + ((t - tMin) / (tMax - tMin)) * w;
  const y = (v: number) => m.top + h - ((v - yMin) / (yMax - yMin)) * h;

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) yTicks.push(Math.round(v * 1000) / 1000);
  const spanDays = (tMax - tMin) / 86_400_000;
  const xTickCount = Math.max(2, Math.min(5, Math.floor(w / 110)));
  const xTicks = Array.from({ length: xTickCount }, (_, i) => tMin + ((tMax - tMin) * i) / (xTickCount - 1));

  const path = (l: TrendSeries) =>
    l.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(new Date(p.date).getTime()).toFixed(1)},${y(p.value).toFixed(1)}`)
      .join(' ');

  const band =
    bandTop !== undefined || bandBottom !== undefined
      ? {
          y1: y(Math.min(bandTop ?? yMax, yMax)),
          y2: y(Math.max(bandBottom ?? yMin, yMin))
        }
      : null;

  const nearest = (clientX: number): number => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return 0;
    const px = clientX - rect.left;
    let best = 0;
    stops.forEach((t, i) => {
      if (Math.abs(x(t) - px) < Math.abs(x(stops[best]) - px)) best = i;
    });
    return best;
  };

  const activeT = active !== null && active < stops.length ? stops[active] : null;
  const atActive = activeT !== null ? lines.map((l) => l.points.find((p) => new Date(p.date).getTime() === activeT)) : [];
  const lineNames = companion ? names || ['Systolic', 'Diastolic'] : [series.label];
  const last = series.points[series.points.length - 1];

  const onKey = (e: React.KeyboardEvent) => {
    if (!stops.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = active ?? (e.key === 'ArrowRight' ? -1 : stops.length);
      setActive(Math.max(0, Math.min(stops.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Escape') setActive(null);
  };

  // tooltip sits beside the crosshair, on whichever side keeps the points visible
  const tooltipLeft =
    activeT !== null ? (x(activeT) > width / 2 ? Math.max(0, x(activeT) - 192) : Math.min(width - 184, x(activeT) + 12)) : 0;

  return (
    <div ref={wrap} className="relative w-full select-none">
      <svg
        width={width}
        height={height}
        role="img"
        tabIndex={0}
        aria-label={`${series.label.replace(' (systolic)', '')} over time: ${series.note}. Use the left and right arrow keys to read each value.`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
        onPointerMove={(e) => setActive(nearest(e.clientX))}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {band && <rect x={m.left} y={band.y1} width={w} height={Math.max(0, band.y2 - band.y1)} fill={BAND} opacity={0.09} />}

        {yTicks.map((v) => (
          <g key={v}>
            <line x1={m.left} x2={m.left + w} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={m.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtNum(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => {
          const label = spanDays > 120 ? fmtMonth(t) : fmtDate(t);
          const prev = i > 0 ? (spanDays > 120 ? fmtMonth(xTicks[i - 1]) : fmtDate(xTicks[i - 1])) : '';
          return label === prev ? null : (
          <text
            key={t}
            x={x(t)}
            y={height - 8}
            textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            fontSize={11}
            fill={MUTED}
          >
            {label}
          </text>
          );
        })}

        {activeT !== null && <line x1={x(activeT)} x2={x(activeT)} y1={m.top} y2={m.top + h} stroke={MUTED} strokeWidth={1} />}

        {lines.map((l, li) => (
          <g key={l.key}>
            {l.points.length > 1 && (
              <path d={path(l)} fill="none" stroke={SERIES_COLORS[li]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {l.points.map((p, i) => {
              const t = new Date(p.date).getTime();
              return <Marker key={i} x={x(t)} y={y(p.value)} color={SERIES_COLORS[li]} origin={p.origin} active={t === activeT} />;
            })}
          </g>
        ))}

        {/* direct label on the newest value only */}
        {last && activeT === null && (
          <text
            x={Math.min(x(new Date(last.date).getTime()) + 8, m.left + w)}
            y={y(last.value) - 10}
            textAnchor={x(new Date(last.date).getTime()) > m.left + w - 60 ? 'end' : 'start'}
            fontSize={11}
            fontWeight={700}
            fill={INK}
          >
            {fmtNum(last.value)}
            {companion && companion.points.length ? `/${fmtNum(companion.points[companion.points.length - 1].value)}` : ''}
          </text>
        )}
      </svg>

      {activeT !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-1 z-10 w-[180px] rounded-xl border border-slate-200 bg-white/95 shadow-md px-3 py-2 text-[11px]"
          style={{ left: tooltipLeft }}
        >
          <div className="text-slate-500 font-semibold mb-1">{fmtDate(activeT, true)}</div>
          {atActive.map((p, i) =>
            p ? (
              <div key={i} className="flex items-center gap-2">
                <span className="inline-block w-3 h-0.5 rounded" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
                <span className="font-extrabold text-slate-900 text-xs">
                  {fmtNum(p.value)} <span className="font-semibold text-slate-400">{lines[i].unit}</span>
                </span>
                <span className="text-slate-500 truncate">{lineNames[i]}</span>
              </div>
            ) : null
          )}
          {(() => {
            const p = atActive.find(Boolean);
            if (!p) return null;
            const worst = atActive.find((q) => q && q.status !== 'normal') || p;
            return (
              <div className="mt-1 pt-1 border-t border-slate-100 text-slate-500 space-y-0.5">
                <div className={worst.status === 'normal' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>{statusLabel(worst.status)}</div>
                <div className="truncate">{p.origin === 'report' || !p.origin ? p.source || 'Report' : originLabel(p.origin)}</div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
