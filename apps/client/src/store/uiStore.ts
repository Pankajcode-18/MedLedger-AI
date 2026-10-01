import { create } from 'zustand';
import { settingsApi } from '../api/settingsApi.js';
import { ActivityItem, NotificationItem } from '../types/index.js';

interface UIState {
  isBlocksModalOpen: boolean;
  isActivityModalOpen: boolean;
  selectedActivityItem: ActivityItem | null;
  activeToast: { message: string; type: 'success' | 'error' | 'info' } | null;
  notifications: NotificationItem[];
  activity: ActivityItem[];
  activityLoaded: boolean;

  openBlocksModal: () => void;
  closeBlocksModal: () => void;

  openActivityModal: () => void;
  closeActivityModal: () => void;
  setSelectedActivityItem: (item: ActivityItem | null) => void;

  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;

  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  setNotifications: (items: NotificationItem[]) => void;
  /** Time the user last looked at their notifications (kept on the server). */
  seenAt: string | null;
  setSeenAt: (iso: string) => void;
  setActivity: (items: ActivityItem[]) => void;
}

const READ_KEY = 'medledger_read_notifications';

const loadReadIds = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
};

const saveReadIds = (ids: Set<string>): void => {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    // storage unavailable — read state simply won't persist
  }
};

/**
 * A notification is new until the user opens or clears it. Requests waiting for an answer stay new until
 * clicked; everything else is new only if it happened after the user last looked.
 */
const isRead = (n: NotificationItem, ids: Set<string>, seenAt: string | null): boolean => {
  if (n.read || ids.has(n.id)) return true;
  if (n.type === 'access_request' && n.actionText === 'Answer') return false;
  return Boolean(seenAt && n.at && n.at <= seenAt);
};

export const useUIStore = create<UIState>((set) => ({
  isBlocksModalOpen: false,
  isActivityModalOpen: false,
  selectedActivityItem: null,
  activeToast: null,
  notifications: [],
  seenAt: null,
  activity: [],
  activityLoaded: false,

  openBlocksModal: () => set({ isBlocksModalOpen: true }),
  closeBlocksModal: () => set({ isBlocksModalOpen: false }),

  openActivityModal: () => set({ isActivityModalOpen: true }),
  closeActivityModal: () => set({ isActivityModalOpen: false, selectedActivityItem: null }),
  setSelectedActivityItem: (item) => set({ selectedActivityItem: item, isActivityModalOpen: true }),

  showToast: (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    set({ activeToast: { message, type } });
    setTimeout(() => {
      set((state) => (state.activeToast?.message === message ? { activeToast: null } : state));
    }, 4000);
  },

  hideToast: () => set({ activeToast: null }),

  markNotificationRead: (id: string) => {
    const ids = loadReadIds();
    ids.add(id);
    saveReadIds(ids);
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    }));
  },

  clearNotifications: () => {
    const now = new Date().toISOString();
    // remembered on the server, so the dot stays off on every device
    settingsApi.save('inbox', { seenAt: now }).catch(() => undefined);
    set((state) => {
      const ids = loadReadIds();
      state.notifications.forEach((n) => ids.add(n.id));
      saveReadIds(ids);
      return { seenAt: now, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    });
  },

  setNotifications: (items: NotificationItem[]) => {
    const ids = loadReadIds();
    set((state) => ({ notifications: items.map((n) => ({ ...n, read: isRead(n, ids, state.seenAt) })) }));
  },

  setSeenAt: (iso: string) =>
    set((state) => {
      const ids = loadReadIds();
      return { seenAt: iso, notifications: state.notifications.map((n) => ({ ...n, read: isRead(n, ids, iso) })) };
    }),

  setActivity: (items: ActivityItem[]) => set({ activity: items, activityLoaded: true })
}));
