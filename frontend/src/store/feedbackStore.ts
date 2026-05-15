import { create } from 'zustand';

export type FeedbackType = 'success' | 'error' | null;

interface FeedbackState {
  // Loading Spinner
  isLoading: boolean;
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
  showLoading: () => set((state) => (state.isLoading ? {} : { isLoading: true })),
  hideLoading: () => set((state) => (!state.isLoading ? {} : { isLoading: false })),

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
      isLoading: false, // Ensure loading is hidden when showing feedback
    }),

  hideFeedback: () =>
    set({
      isOpen: false,
      onConfirm: null,
      // We don't clear type/title/message immediately to allow for exit animations
    }),
}));
