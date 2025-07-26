import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// PrimeVue imports
import PrimeVue from 'primevue/config'
// Menggunakan tema dari @primeuix/themes
import Lara from '@primeuix/themes/lara'
// Tetap mengimpor primeicons
import 'primeicons/primeicons.css'
// Import PrimeVue ToastService
import ToastService from 'primevue/toastservice'

// Import transitions
import TransitionComponents from './components/transitions'

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
      colorScheme: 'light'
    }
  }
})
// Use PrimeVue ToastService
app.use(ToastService)

// Use transition components
app.use(TransitionComponents)

// Mount app
app.mount('#app')
