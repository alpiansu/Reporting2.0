<template>
  <div class="reports-view">
    <div class="content-container">
      <Tabs v-model:value="activeTab">
        <TabList>
          <Tab value="monthly">Laporan Bulanan</Tab>
          <Tab value="daily">Laporan Harian</Tab>
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
