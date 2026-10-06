/**
 * Resilient copy to clipboard utility.
 * Supports both Secure Context (navigator.clipboard) and Non-Secure Context (HTTP Intranet fallback).
 *
 * @param {string} text - The text content to copy.
 * @returns {Promise<boolean>} Resolves to true if copying succeeded, false otherwise.
 */
export async function copyToClipboard(text) {
  if (!text) {
    return false;
  }

  // 1. Try modern async Clipboard API if available and running in a secure context
  if (typeof window !== 'undefined' && window.isSecureContext && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[clipboard] navigator.clipboard.writeText failed, falling back:', err);
    }
  }

  // 2. Fallback using temporary textarea and document.execCommand('copy')
  // This works reliably in non-secure HTTP intranet contexts when triggered by user interaction
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Prevent scrolling and position outside the viewport
    textArea.style.position = 'fixed';
    textArea.style.top = '-999999px';
    textArea.style.left = '-999999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('[clipboard] Fallback execCommand failed:', err);
    return false;
  }
}

export default copyToClipboard;
