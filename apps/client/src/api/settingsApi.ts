import { apiClient } from './apiClient.js';

export type SettingsValues = Record<string, string | number | boolean>;

export const settingsApi = {
  get: async (section: string): Promise<{ values: SettingsValues; updatedAt: string | null }> => {
    const res = await apiClient.get(`/api/settings/${encodeURIComponent(section)}`);
    return res.data.data;
  },
  save: async (section: string, values: SettingsValues): Promise<{ values: SettingsValues; updatedAt: string }> => {
    const res = await apiClient.put(`/api/settings/${encodeURIComponent(section)}`, { values });
    return res.data.data;
  }
};
