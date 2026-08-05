<template>
  <div class="auth-layout">
    <animated-element animation="fade-in" :duration="800">
      <page-transition name="fade" mode="out-in">
        <router-view />
      </page-transition>
    </animated-element>
  </div>
</template>

<script setup>
/**
 * Layout for authentication pages (login, register)
 */
</script>

<style scoped>
@import './AuthLayout.style.css';
</style>