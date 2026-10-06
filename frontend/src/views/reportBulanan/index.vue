<template>
  <div class="reports-view">
    <!-- View Header (Modern Single Source of Truth) -->
    <div class="view-header">
      <div class="view-header__left">
        <div class="view-header__icon-badge">
          <i class="pi pi-file-export"></i>
        </div>
        <div>
          <h1 class="view-header__title">Laporan Bulanan & Harian</h1>
          <p class="view-header__subtitle">Pusat ekspor dan rekonsiliasi data operasional cabang (Bulanan & Harian)</p>
        </div>
      </div>
      <div class="view-header__actions">
        <div class="active-tab-badge">
          <i :class="activeTab === 'monthly' ? 'pi pi-calendar' : 'pi pi-clock'"></i>
          <span>Mode: {{ activeTab === 'monthly' ? 'Laporan Bulanan' : 'Laporan Harian' }}</span>
        </div>
      </div>
    </div>

    <div class="content-container">
      <Tabs v-model:value="activeTab">
        <TabList>
          <Tab value="monthly">
            <i class="pi pi-calendar mr-2"></i>Laporan Bulanan
          </Tab>
          <Tab value="daily">
            <i class="pi pi-clock mr-2"></i>Laporan Harian
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="monthly">
            <MonthlyReportsTab />
          </TabPanel>
          <TabPanel value="daily">
            <DailyReportsTab />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import MonthlyReportsTab from './components/MonthlyReportsTab.vue';
import DailyReportsTab from './components/DailyReportsTab.vue';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';

const activeTab = ref('monthly');
</script>

<style src="./index.css" scoped />
