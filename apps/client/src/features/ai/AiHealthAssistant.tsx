import React, { useState } from 'react';
import { aiApi } from '../../api/aiApi.js';
import { Button } from '../../components/common/Button.js';
import { Card } from '../../components/common/Card.js';
import {
  AiSummaryResponse,
  DrugInteractionResponse,
  ChartSynthesisResponse,
  SoapNoteResponse
} from '../../types/index.js';
import { EngineBadge, AbnormalValuesTable, DrugAlertsList, aiErrorMessage } from './AiResultBlocks.js';
import { PrivacyPreview } from './PrivacyPreview.js';
import { HealthTrendChart, MarkerLegend } from './HealthTrendChart.js';
import { Sparkles, FileText, AlertTriangle, Activity, Pill, ClipboardList, Copy, Check, RotateCcw, Lock } from 'lucide-react';

type Tab = 'summarize' | 'drugs' | 'chart' | 'soap';

const SAMPLE_REPORT = `Patient: John Doe, Age 58, Phone: 9841234567
Fasting Blood Sugar: 142 mg/dL
HbA1c: 7.2 %
Total Cholesterol 236 mg/dL, LDL Cholesterol 158 mg/dL, HDL 38 mg/dL
Serum Creatinine 1.1 mg/dL
BP 146/92 mmHg, Pulse 84 bpm, SpO2 98%
Impression: Sugars and lipids above target.
Rx: Tab Metformin 500 mg BD, Tab Atorvastatin 20 mg HS`;

/** Clinician AI copilot (doctor dashboard). All results come from /api/ai — nothing is pre-written. */
export const AiHealthAssistant: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const [activeTab, setActiveTab] = useState<Tab>('summarize');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportInput, setReportInput] = useState('');
  const [drugsInput, setDrugsInput] = useState('Warfarin, Aspirin');
  const [allergyInput, setAllergyInput] = useState('');
  const [summaryData, setSummaryData] = useState<AiSummaryResponse | null>(null);
  const [drugData, setDrugData] = useState<DrugInteractionResponse | null>(null);
  const [chartData, setChartData] = useState<ChartSynthesisResponse | null>(null);
  const [soapData, setSoapData] = useState<SoapNoteResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = () =>
    run(async () => setSummaryData(await aiApi.summarize(reportInput.trim(), reportInput.trim() ? undefined : patientId)));
  const handleCheckDrugs = () =>
    run(async () => {
      const meds = drugsInput.split(',').map((d) => d.trim()).filter(Boolean);
      const allergies = allergyInput.split(',').map((d) => d.trim()).filter(Boolean);
      setDrugData(await aiApi.checkDrugs(meds, allergies));
    });
  const handleChartSynthesis = () => run(async () => setChartData(await aiApi.chartSynthesis(patientId)));
  const handleSoapNote = () =>
    run(async () => setSoapData(await aiApi.soapNote(reportInput.trim() ? undefined : patientId, reportInput.trim())));

  const copyResults = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'summarize', label: '1. Summarize & Flag', icon: FileText },
    { id: 'drugs', label: '2. Drug Interactions', icon: Pill },
    { id: 'chart', label: '3. Chart Synthesis', icon: Activity },
    { id: 'soap', label: '4. SOAP Note', icon: ClipboardList }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-sky-500/20 border border-sky-400/30 px-3 py-1 rounded-full text-xs font-semibold text-sky-300 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI assistant for doctors</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">AI Health Assistant</h2>
            <p className="text-sm text-slate-300 max-w-xl mt-1 leading-relaxed">
              Summarises reports, flags values outside reference ranges, checks medicines for interactions and drafts
              notes. Personal details are removed before any text is analysed.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs text-slate-200">
            <span className="block text-slate-400 font-medium">Patient context:</span>
            <span className="font-bold text-white">{patientId ? `Patient #${patientId}` : 'None selected'}</span>
          </div>
        </div>
        <div className="mt-6 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3 flex items-center gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
          <span>
            <strong>Clinical safety notice:</strong> AI output is a decision aid only. It does not replace clinical
            judgement, examination or a formal diagnosis.
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px" role="tablist">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => {
                setActiveTab(t.id);
                setError(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
          {/permission/i.test(error) ? <Lock className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{error}</span>
        </div>
      )}

      {/* Tab 1: Summarize */}
      {activeTab === 'summarize' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-base font-bold text-slate-900 mb-2">Report text</h3>
            <p className="text-xs text-slate-500 mb-4">
              Paste a report, or leave this empty to analyse the selected patient's stored records (only if they have shared them with you).
            </p>
            <textarea
              value={reportInput}
              onChange={(e) => setReportInput(e.target.value)}
              placeholder="e.g. Hemoglobin 10.2 g/dL, Fasting Blood Sugar 132 mg/dL, BP 142/94 mmHg…"
              rows={10}
              className="w-full text-xs sm:text-sm p-3.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y font-mono"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setReportInput(SAMPLE_REPORT)}>
                Load sample report
              </Button>
              <Button size="sm" onClick={handleSummarize} isLoading={loading}>
                <Sparkles className="w-4 h-4 mr-1.5" />
                Analyse
              </Button>
            </div>
            <div className="mt-4">
              <PrivacyPreview
                key={reportInput.trim() ? `text:${reportInput.length}` : `patient:${patientId || ''}`}
                reportText={reportInput}
                patientId={reportInput.trim() ? undefined : patientId}
                label="Preview what the AI sees (personal details removed)"
              />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900">AI clinical insights</h3>
              {summaryData && (
                <Button variant="ghost" size="sm" onClick={() => copyResults(JSON.stringify(summaryData, null, 2))}>
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
                </Button>
              )}
            </div>

            {summaryData ? (
              <div className="space-y-4 text-xs sm:text-sm">
                <EngineBadge engine={summaryData.engine} notice={summaryData.privacyNotice} redactions={summaryData.deidentification?.redactions} />
                <p translate="no" className="text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  {summaryData.summary}
                </p>

                {Object.values(summaryData.vitalSigns || {}).some(Boolean) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(summaryData.vitalSigns)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="bg-sky-50/70 border border-sky-200 p-2.5 rounded-xl text-center">
                          <span className="text-[11px] text-sky-700 block font-medium capitalize">
                            {k.replace(/([A-Z])/g, ' $1').replace('sp O2', 'SpO2')}
                          </span>
                          <span className="text-sm font-bold text-sky-900">{v}</span>
                        </div>
                      ))}
                  </div>
                )}

                <div>
                  <span className="text-xs font-bold text-slate-400 block tracking-wider mb-2">Abnormal values</span>
                  <AbnormalValuesTable values={summaryData.abnormalValues} />
                </div>

                {summaryData.medications.length > 0 && (
                  <p className="text-xs text-slate-700">
                    <strong>Medicines mentioned:</strong> {summaryData.medications.join(', ')}
                  </p>
                )}

                {summaryData.keywordFlags.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-400 block tracking-wider mb-1">Lines flagged in the report</span>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {summaryData.keywordFlags.slice(0, 6).map((f, i) => (
                        <li key={i} className="font-mono bg-amber-50 border border-amber-100 rounded px-2 py-1">
                          <strong>{f.flag}</strong> · {f.line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <span className="text-xs font-bold text-slate-400 block tracking-wider mb-1">Questions to discuss</span>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700">
                    {summaryData.questionsForDoctor.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>
                <p className="text-[11px] text-slate-500">{summaryData.safetyDisclaimer}</p>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Paste a report or select a patient, then click "Analyse".</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Drugs */}
      {activeTab === 'drugs' && (
        <Card>
          <div className="max-w-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Prescription safety &amp; allergy check</h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Enter medicines separated by commas (generic or common brand names, e.g. Ecosprin, Dolo, Telma).
            </p>
            <input
              type="text"
              value={drugsInput}
              onChange={(e) => setDrugsInput(e.target.value)}
              aria-label="Medicines"
              placeholder="e.g. Warfarin, Aspirin, Ciprofloxacin"
              className="w-full text-sm p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="text"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              aria-label="Known allergies"
              placeholder="Known allergies (optional), e.g. Penicillin, Sulfa"
              className="w-full text-sm p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <Button onClick={handleCheckDrugs} isLoading={loading}>
              Check safety
            </Button>
            {drugData && (
              <div className="mt-4 space-y-2">
                <EngineBadge engine={drugData.engine} notice={drugData.privacyNotice} />
                <DrugAlertsList data={drugData} />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab 3: Chart synthesis */}
      {activeTab === 'chart' && (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Patient history synthesis</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Combines every stored record of the selected patient into trends, risk flags and active medicines.
                </p>
              </div>
              <Button size="sm" onClick={handleChartSynthesis} isLoading={loading} disabled={!patientId}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Synthesise history
              </Button>
            </div>

            {chartData ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <EngineBadge engine={chartData.engine} notice={chartData.privacyNotice} />
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                    {chartData.recordsReviewed} record{chartData.recordsReviewed === 1 ? '' : 's'} · {chartData.patientStatus}
                  </span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  {chartData.clinicalSummary}
                </p>
                {chartData.vitalTrends.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 text-left">
                        <tr>
                          <th className="p-2.5">Measurement</th>
                          <th className="p-2.5">Latest</th>
                          <th className="p-2.5">Trend</th>
                          <th className="p-2.5">Normal range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.vitalTrends.map((t) => (
                          <tr key={t.parameter} className="border-t border-slate-100">
                            <td className="p-2.5 font-semibold text-slate-900">{t.parameter}</td>
                            <td className={`p-2.5 font-bold ${t.status === 'normal' ? 'text-emerald-700' : 'text-rose-700'}`}>{t.latest}</td>
                            <td className="p-2.5 capitalize">{t.trend}</td>
                            <td className="p-2.5 text-slate-600">{t.range}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(chartData.series || []).some((x) => x.points.length > 1 && x.key !== 'diastolic_bp') && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {(chartData.series || [])
                      .filter((x) => x.points.length > 1 && x.key !== 'diastolic_bp')
                      .slice(0, 6)
                      .map((x) => {
                        const dia = x.key === 'systolic_bp' ? chartData.series?.find((d) => d.key === 'diastolic_bp') : undefined;
                        return (
                          <div key={x.key} className="rounded-xl border border-slate-200 p-3 space-y-1.5">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900">{x.key === 'systolic_bp' ? 'Blood Pressure' : x.label}</span>
                              <span className="text-[10px] text-slate-500">{x.points.length} values · {x.direction}</span>
                            </div>
                            <HealthTrendChart series={x} companion={dia} height={170} />
                          </div>
                        );
                      })}
                    <div className="xl:col-span-2">
                      <MarkerLegend origins={(chartData.series || []).flatMap((x) => x.points.map((p) => p.origin))} band />
                    </div>
                  </div>
                )}
                {chartData.riskFlags.length > 0 && (
                  <ul className="space-y-1.5 text-xs">
                    {chartData.riskFlags.map((r) => (
                      <li key={r.area} className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                        <strong>{r.area}</strong> ({r.level}): {r.reason}
                      </li>
                    ))}
                  </ul>
                )}
                {chartData.activeMedications.length > 0 && (
                  <p className="text-xs text-slate-700">
                    <strong>Medicines on record:</strong> {chartData.activeMedications.join(', ')}
                  </p>
                )}
                <p className="text-[11px] text-slate-500">{chartData.safetyDisclaimer}</p>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">
                  {patientId ? 'Click "Synthesise history" to review this patient\'s records.' : 'Select a patient first.'}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab 4: SOAP */}
      {activeTab === 'soap' && (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">SOAP note draft</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uses the text in the "Summarize & Flag" tab if you pasted any, otherwise the patient's stored records.
                </p>
              </div>
              <Button size="sm" onClick={handleSoapNote} isLoading={loading}>
                Draft SOAP note
              </Button>
            </div>
            {soapData ? (
              <>
                <EngineBadge engine={soapData.engine} notice={soapData.privacyNotice} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(
                    [
                      ['SUBJECTIVE (S)', soapData.subjective, 'text-sky-700'],
                      ['OBJECTIVE (O)', soapData.objective, 'text-emerald-700'],
                      ['ASSESSMENT (A)', soapData.assessment, 'text-amber-700'],
                      ['PLAN (P)', soapData.plan, 'text-indigo-700']
                    ] as const
                  ).map(([title, body, color]) => (
                    <div key={title} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className={`text-xs font-bold block mb-1 ${color}`}>{title}</span>
                      <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-line">{body}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-500">{soapData.safetyDisclaimer}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyResults(`S: ${soapData.subjective}\nO: ${soapData.objective}\nA: ${soapData.assessment}\nP: ${soapData.plan}`)
                    }
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span className="text-xs">{copied ? 'Copied!' : 'Copy note'}</span>
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-slate-400">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Click "Draft SOAP note" to generate structured documentation.</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
