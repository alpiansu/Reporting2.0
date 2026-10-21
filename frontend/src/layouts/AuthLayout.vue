<template>
  <div class="auth-layout">
    <!--
      Transisi route tidak lagi dibungkus PageTransition/AnimatedElement di sini.
      App.vue sudah membungkus <router-view /> dengan PageTransition zoom-fade,
      sehingga menumpukkannya lagi hanya memperlambat render tanpa manfaat visual.
    -->
    <router-view />
  </div>
</template>

<script setup>
/**
 * Layout for authentication pages (login, register).
 * Menyediakan kanvas full-bleed (lihat AuthLayout.style.css) tempat
 * halaman auth me-render card melayang-nya.
 */
</script>

<style scoped>
@import './AuthLayout.style.css';
</style>
