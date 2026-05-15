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

<style scoped>
.stats-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #ffffff;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  border-left: 4px solid transparent;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 18px -4px rgba(0, 0, 0, 0.1);
}

.stat-card.border-primary { border-left-color: var(--primary-color, #6366f1); }
.stat-card.border-cyan    { border-left-color: #06b6d4; }
.stat-card.border-purple  { border-left-color: #a855f7; }

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.stat-icon--blue   { background: #eff6ff; color: #3b82f6; }
.stat-icon--cyan   { background: #ecfeff; color: #06b6d4; }
.stat-icon--purple { background: #faf5ff; color: #a855f7; }

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.stat-label {
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 500;
}

.stat-value {
  font-size: 1.15rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
}

@media (max-width: 768px) {
  .stats-bar {
    grid-template-columns: 1fr;
  }
}
</style>
