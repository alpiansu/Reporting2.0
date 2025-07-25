/**
 * Utility for managing dynamic page titles
 */

// Default title from environment variable or fallback
const defaultTitle = import.meta.env.VITE_APP_TITLE || 'Reporting 2.0';

/**
 * Set the document title with optional prefix/suffix
 * @param {string} pageTitle - The page specific title
 * @param {Object} options - Configuration options
 * @param {boolean} options.includeAppName - Whether to include the app name
 * @param {string} options.separator - Separator between page title and app name
 * @param {boolean} options.reverse - Whether to put app name first
 */
const setDocumentTitle = (pageTitle, options = {}) => {
  const {
    includeAppName = true,
    separator = ' | ',
    reverse = false
  } = options;

  if (!pageTitle) {
    document.title = defaultTitle;
    return;
  }

  if (includeAppName) {
    document.title = reverse
      ? `${defaultTitle}${separator}${pageTitle}`
      : `${pageTitle}${separator}${defaultTitle}`;
  } else {
    document.title = pageTitle;
  }
};

/**
 * Reset the document title to the default app title
 */
const resetDocumentTitle = () => {
  document.title = defaultTitle;
};

export { setDocumentTitle, resetDocumentTitle, defaultTitle };