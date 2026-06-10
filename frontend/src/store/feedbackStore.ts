import { create } from 'zustand';

export type FeedbackType = 'success' | 'error' | null;

interface FeedbackState {
  // Loading Spinner
  isLoading: boolean;
  loadingCount: number;
  showLoading: () => void;
  hideLoading: () => void;

  // Feedback Modal (Success/Error)
  isOpen: boolean;
  type: FeedbackType;
  title: string;
  message: string;
  onConfirm: (() => void) | null;

  showFeedback: (
    type: FeedbackType,
    title: string,
    message?: string,
    onConfirm?: () => void
  ) => void;
  hideFeedback: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  // Initial Loading State
  isLoading: false,
  loadingCount: 0,
  showLoading: () =>
    set((state) => ({
      loadingCount: state.loadingCount + 1,
      isLoading: true,
    })),
  hideLoading: () =>
    set((state) => {
      const newCount = Math.max(0, state.loadingCount - 1);
      return {
        loadingCount: newCount,
        isLoading: newCount > 0,
      };
    }),

  // Initial Feedback State
  isOpen: false,
  type: null,
  title: '',
  message: '',
  onConfirm: null,

  showFeedback: (type, title, message = '', onConfirm = undefined) =>
    set({
      isOpen: true,
      type,
      title,
      message,
      onConfirm: onConfirm || null,
      isLoading: false,
      loadingCount: 0, // Reset counter when showing final feedback
    }),

  hideFeedback: () =>
    set({
      isOpen: false,
      onConfirm: null,
      isLoading: false,
      loadingCount: 0,
    }),
}));
