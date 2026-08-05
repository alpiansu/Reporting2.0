<template>
  <div class="settings">
    <page-title title="Settings" :include-app-name="true" separator=" | " />
    
    <div class="page-header">
      <h1>Settings</h1>
      <p>Kelola pengaturan aplikasi dan preferensi sistem</p>
    </div>

    <div class="settings-container">
      <!-- General Settings -->
      <div class="card">
        <div class="card-header">
          <h2>General Settings</h2>
        </div>
        <div class="card-body">
          <div class="setting-group">
            <div class="setting-item">
              <label for="appName">Application Name</label>
              <input 
                id="appName" 
                v-model="settings.general.appName" 
                type="text" 
                class="form-input"
                placeholder="Enter application name"
              />
            </div>
            <div class="setting-item">
              <label for="timezone">Timezone</label>
              <select id="timezone" v-model="settings.general.timezone" class="form-select">
                <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
              </select>
            </div>
            <div class="setting-item">
              <label for="language">Language</label>
              <select id="language" v-model="settings.general.language" class="form-select">
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
            <div class="setting-item">
              <label for="dateFormat">Date Format</label>
              <select id="dateFormat" v-model="settings.general.dateFormat" class="form-select">
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Security Settings -->
      <div class="card">
        <div class="card-header">
          <h2>Security Settings</h2>
        </div>
        <div class="card-body">
          <div class="setting-group">
            <div class="setting-item">
              <div class="setting-toggle">
                <label for="twoFactor">Two-Factor Authentication</label>
                <div class="toggle-switch">
                  <input 
                    id="twoFactor" 
                    v-model="settings.security.twoFactorAuth" 
                    type="checkbox" 
                    class="toggle-input"
                  />
                  <span class="toggle-slider"></span>
                </div>
              </div>
              <p class="setting-description">Enable two-factor authentication for enhanced security</p>
            </div>
            <div class="setting-item">
              <label for="sessionTimeout">Session Timeout (minutes)</label>
              <input 
                id="sessionTimeout" 
                v-model="settings.security.sessionTimeout" 
                type="number" 
                class="form-input"
                min="5"
                max="480"
                placeholder="Enter session timeout"
              />
            </div>
            <div class="setting-item">
              <div class="setting-toggle">
                <label for="loginNotification">Login Notifications</label>
                <div class="toggle-switch">
                  <input 
                    id="loginNotification" 
                    v-model="settings.security.loginNotifications" 
                    type="checkbox" 
                    class="toggle-input"
                  />
                  <span class="toggle-slider"></span>
                </div>
              </div>
              <p class="setting-description">Receive notifications for new login attempts</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Notification Settings -->
      <div class="card">
        <div class="card-header">
          <h2>Notification Settings</h2>
        </div>
        <div class="card-body">
          <div class="setting-group">
            <div class="setting-item">
              <div class="setting-toggle">
                <label for="emailNotifications">Email Notifications</label>
                <div class="toggle-switch">
                  <input 
                    id="emailNotifications" 
                    v-model="settings.notifications.email" 
                    type="checkbox" 
                    class="toggle-input"
                  />
                  <span class="toggle-slider"></span>
                </div>
              </div>
              <p class="setting-description">Receive notifications via email</p>
            </div>
            <div class="setting-item">
              <div class="setting-toggle">
                <label for="pushNotifications">Push Notifications</label>
                <div class="toggle-switch">
                  <input 
                    id="pushNotifications" 
                    v-model="settings.notifications.push" 
                    type="checkbox" 
                    class="toggle-input"
                  />
                  <span class="toggle-slider"></span>
                </div>
              </div>
              <p class="setting-description">Receive push notifications in browser</p>
            </div>
            <div class="setting-item">
              <div class="setting-toggle">
                <label for="lowStockAlerts">Low Stock Alerts</label>
                <div class="toggle-switch">
                  <input 
                    id="lowStockAlerts" 
                    v-model="settings.notifications.lowStockAlerts" 
                    type="checkbox" 
                    class="toggle-input"
                  />
                  <span class="toggle-slider"></span>
                </div>
              </div>
              <p class="setting-description">Get notified when inventory is running low</p>
            </div>
          </div>
        </div>
      </div>

      <!-- System Settings -->
      <div class="card">
        <div class="card-header">
          <h2>System Settings</h2>
        </div>
        <div class="card-body">
          <div class="setting-group">
            <div class="setting-item">
              <label for="backupFrequency">Backup Frequency</label>
              <select id="backupFrequency" v-model="settings.system.backupFrequency" class="form-select">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div class="setting-item">
              <div class="setting-toggle">
                <label for="autoUpdate">Auto Updates</label>
                <div class="toggle-switch">
                  <input 
                    id="autoUpdate" 
                    v-model="settings.system.autoUpdate" 
                    type="checkbox" 
                    class="toggle-input"
                  />
                  <span class="toggle-slider"></span>
                </div>
              </div>
              <p class="setting-description">Automatically install system updates</p>
            </div>
            <div class="setting-item">
              <div class="setting-toggle">
                <label for="debugMode">Debug Mode</label>
                <div class="toggle-switch">
                  <input 
                    id="debugMode" 
                    v-model="settings.system.debugMode" 
                    type="checkbox" 
                    class="toggle-input"
                  />
                  <span class="toggle-slider"></span>
                </div>
              </div>
              <p class="setting-description">Enable debug mode for troubleshooting</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button @click="saveSettings" class="btn btn-primary" :disabled="saving">
          <i class="pi pi-save"></i>
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
        <button @click="resetSettings" class="btn btn-secondary">
          <i class="pi pi-refresh"></i>
          Reset to Default
        </button>
        <button @click="exportSettings" class="btn btn-outline">
          <i class="pi pi-download"></i>
          Export Settings
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { PageTitle } from '../../components/transitions';

// State
const saving = ref(false);
const settings = ref({
  general: {
    appName: 'Reporting System',
    timezone: 'Asia/Jakarta',
    language: 'id',
    dateFormat: 'DD/MM/YYYY'
  },
  security: {
    twoFactorAuth: false,
    sessionTimeout: 60,
    loginNotifications: true
  },
  notifications: {
    email: true,
    push: true,
    lowStockAlerts: true
  },
  system: {
    backupFrequency: 'daily',
    autoUpdate: true,
    debugMode: false
  }
});

// Methods
const saveSettings = async () => {
  try {
    saving.value = true;
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Here you would typically call an API to save settings
    console.log('Settings saved:', settings.value);
    
    // Show success message
    alert('Settings saved successfully!');
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('Failed to save settings. Please try again.');
  } finally {
    saving.value = false;
  }
};

const resetSettings = () => {
  if (confirm('Are you sure you want to reset all settings to default values?')) {
    settings.value = {
      general: {
        appName: 'Reporting System',
        timezone: 'Asia/Jakarta',
        language: 'id',
        dateFormat: 'DD/MM/YYYY'
      },
      security: {
        twoFactorAuth: false,
        sessionTimeout: 60,
        loginNotifications: true
      },
      notifications: {
        email: true,
        push: true,
        lowStockAlerts: true
      },
      system: {
        backupFrequency: 'daily',
        autoUpdate: true,
        debugMode: false
      }
    };
  }
};

const exportSettings = () => {
  const dataStr = JSON.stringify(settings.value, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'settings.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

// Load settings on mount
onMounted(async () => {
  try {
    // Here you would typically load settings from API
    console.log('Loading settings...');
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
});
</script>

<style scoped src="./index.style.css"></style>