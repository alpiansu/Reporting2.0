import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from '@/router'

// PrimeVue imports
import PrimeVue from 'primevue/config'
// Menggunakan tema dari @primeuix/themes
import Lara from '@primeuix/themes/lara'
// Tetap mengimpor primeicons
import 'primeicons/primeicons.css'
// Import PrimeVue ToastService
import ToastService from 'primevue/toastservice'
import Button from 'primevue/button'
import Tooltip from 'primevue/tooltip';
import Badge from 'primevue/badge';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';

// Import transitions
import TransitionComponents from '@/components/transitions'

// Create app instance
const app = createApp(App)

// Use plugins
app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  ripple: true,
  inputStyle: 'filled',
  theme: {
    preset: Lara,
    options: {
      darkModeSelector: 'system'
    }
  }
})
// Use PrimeVue ToastService
app.use(ToastService)

// Register global components
app.component('Button', Button)
app.component('Badge', Badge)
app.component('InputText', InputText)
app.component('IconField', IconField)
app.component('InputIcon', InputIcon)
app.directive('tooltip', Tooltip);

// Use transition components
app.use(TransitionComponents)

// Mount app
app.mount('#app')
