<template>
  <div class="stats-bar">
    <div class="stat-card border-primary">
      <div class="stat-icon stat-icon--blue">
        <i class="pi pi-building"></i>
      </div>
      <div class="stat-content">
        <span class="stat-label">Total Monitoring</span>
        <strong class="stat-value">{{ totalCabang }} Cabang</strong>
      </div>
    </div>

    <div class="stat-card border-cyan">
      <div class="stat-icon stat-icon--cyan">
        <i class="pi pi-calendar"></i>
      </div>
      <div class="stat-content">
        <span class="stat-label">Backup Harian Terakhir</span>
        <strong class="stat-value">{{ latestHarian }}</strong>
      </div>
    </div>

    <div class="stat-card border-purple">
      <div class="stat-icon stat-icon--purple">
        <i class="pi pi-briefcase"></i>
      </div>
      <div class="stat-content">
        <span class="stat-label">Backup Bulanan Terakhir</span>
        <strong class="stat-value">{{ latestBulanan }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  totalCabang:   { type: Number, default: 0 },
  latestHarian:  { type: String, default: '-' },
  latestBulanan: { type: String, default: '-' },
});
</script>

<style scoped src="./RbStatsBar.style.css"></style>
