import { apiClient } from './apiClient.js';
import {
  AiSummaryResponse,
  DrugInteractionResponse,
  DrugInfoResponse,
  TrendsResponse,
  ChartSynthesisResponse,
  SoapNoteResponse,
  AiChatMessage,
  AiEngine,
  ChatSource,
  SavedChatMessage,
  DeidentifyPreviewResponse
} from '../types/index.js';

/** Client for the MedLedger AI module (apps/server/src/services/aiService.ts). */
export const aiApi = {
  /** Summarise pasted text, or the patient's stored records when no text is given. */
  summarize: async (reportText?: string, patientId?: string, reportId?: string): Promise<AiSummaryResponse> => {
    const res = await apiClient.post('/api/ai/summarize', { reportText: reportText || undefined, patientId, reportId });
    return res.data.data;
  },

  /** Privacy preview: the report text after personal details are removed (what the AI sees). */
  deidentifyPreview: async (reportText?: string, patientId?: string, reportId?: string): Promise<DeidentifyPreviewResponse> => {
    const res = await apiClient.post('/api/ai/deidentify', { reportText: reportText || undefined, patientId, reportId });
    return res.data.data;
  },

  checkDrugs: async (medications: string[], allergies: string[] = []): Promise<DrugInteractionResponse> => {
    const res = await apiClient.post('/api/ai/drug', { medications, allergies });
    return res.data.data;
  },

  drugInfo: async (name: string): Promise<DrugInfoResponse> => {
    const res = await apiClient.post('/api/ai/drug-info', { name });
    return res.data.data;
  },

  trends: async (patientId?: string): Promise<TrendsResponse> => {
    const res = await apiClient.post('/api/ai/trends', { patientId });
    return res.data.data;
  },

  /** Older style: the caller sends the recent messages itself (nothing is saved). */
  chat: async (messages: AiChatMessage[], patientId?: string): Promise<{ reply: string; engine: string; sources?: ChatSource[] }> => {
    const res = await apiClient.post('/api/ai/chat', { messages, patientId });
    return res.data.data;
  },

  /** Sends one question; the server keeps the (encrypted) conversation and returns the saved messages. */
  ask: async (
    message: string,
    patientId?: string
  ): Promise<{ reply: string; engine: AiEngine; sources: ChatSource[]; messages: SavedChatMessage[] }> => {
    const res = await apiClient.post('/api/ai/chat', { message, patientId });
    return res.data.data;
  },

  chatHistory: async (patientId?: string): Promise<SavedChatMessage[]> => {
    const res = await apiClient.get('/api/ai/chat/history', { params: patientId ? { patientId } : {} });
    return res.data.data.messages;
  },

  clearChat: async (patientId?: string): Promise<void> => {
    await apiClient.delete('/api/ai/chat/history', { params: patientId ? { patientId } : {} });
  },

  chartSynthesis: async (patientId?: string, history?: string): Promise<ChartSynthesisResponse> => {
    const res = await apiClient.post('/api/ai/doctor/chart-synthesis', { patientId, history: history || undefined });
    return res.data.data;
  },

  labTriage: async (labResults: string | Record<string, unknown>, patientId?: string): Promise<Record<string, unknown>> => {
    const res = await apiClient.post('/api/ai/doctor/lab-triage', { labResults, patientId });
    return res.data.data;
  },

  soapNote: async (patientId?: string, reportText?: string): Promise<SoapNoteResponse> => {
    const res = await apiClient.post('/api/ai/doctor/soap-note', { patientId, reportText: reportText || undefined });
    return res.data.data;
  }
};
