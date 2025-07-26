import { useToast } from 'primevue/usetoast';

/**
 * Toast utility for displaying notifications
 * @returns {Object} Toast utility methods
 */
export const useToastService = () => {
  const toast = useToast();

  /**
   * Show success toast notification
   * @param {string} summary - Toast title
   * @param {string} detail - Toast message
   * @param {number} life - Duration in milliseconds
   */
  const showSuccess = (summary, detail, life = 3000) => {
    toast.add({
      severity: 'success',
      summary,
      detail,
      life
    });
  };

  /**
   * Show error toast notification
   * @param {string} summary - Toast title
   * @param {string} detail - Toast message
   * @param {number} life - Duration in milliseconds
   */
  const showError = (summary, detail, life = 5000) => {
    toast.add({
      severity: 'error',
      summary,
      detail,
      life
    });
  };

  /**
   * Show info toast notification
   * @param {string} summary - Toast title
   * @param {string} detail - Toast message
   * @param {number} life - Duration in milliseconds
   */
  const showInfo = (summary, detail, life = 3000) => {
    toast.add({
      severity: 'info',
      summary,
      detail,
      life
    });
  };

  /**
   * Show warning toast notification
   * @param {string} summary - Toast title
   * @param {string} detail - Toast message
   * @param {number} life - Duration in milliseconds
   */
  const showWarning = (summary, detail, life = 4000) => {
    toast.add({
      severity: 'warn',
      summary,
      detail,
      life
    });
  };

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning
  };
};