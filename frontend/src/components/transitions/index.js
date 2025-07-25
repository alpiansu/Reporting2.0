/**
 * Export all transition components
 */

import PageTransition from './PageTransition.vue';
import AnimatedElement from './AnimatedElement.vue';
import PageTitle from '../PageTitle.vue';

export {
  PageTransition,
  AnimatedElement,
  PageTitle
};

// Default export for global registration
export default {
  install(app) {
    app.component('PageTransition', PageTransition);
    app.component('AnimatedElement', AnimatedElement);
    app.component('PageTitle', PageTitle);
  }
};