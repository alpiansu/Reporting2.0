/**
 * Page transition utilities
 * This file provides a centralized way to manage page transitions
 */

// Default transition options
const defaultTransition = {
  name: 'page',
  mode: 'out-in'
};

// Available transitions
const transitions = {
  fade: {
    name: 'fade',
    mode: 'out-in'
  },
  slide: {
    name: 'slide',
    mode: 'out-in'
  },
  scale: {
    name: 'scale',
    mode: 'out-in'
  },
  none: {
    name: '',
    mode: ''
  }
};

/**
 * Get transition by name
 * @param {string} name - Transition name
 * @returns {Object} - Transition options
 */
function getTransition(name) {
  return transitions[name] || defaultTransition;
}

/**
 * Apply transition to element
 * @param {HTMLElement} element - Element to apply transition
 * @param {string} transitionName - Transition name
 */
function applyTransition(element, transitionName) {
  const transition = getTransition(transitionName);
  element.style.transition = `all ${transition.duration || '0.3s'} ${transition.timing || 'ease'}`;
}

/**
 * Apply animation to element
 * @param {HTMLElement} element - Element to apply animation
 * @param {string} animationName - Animation name
 */
function applyAnimation(element, animationName) {
  // Remove any existing animation classes
  element.classList.remove('fade-in', 'slide-in-left', 'slide-in-right', 'slide-in-top', 'slide-in-bottom', 'bounce', 'pulse', 'shake');
  
  // Add the new animation class
  if (animationName) {
    element.classList.add(animationName);
  }
}

export { getTransition, applyTransition, applyAnimation, transitions };