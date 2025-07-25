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
.auth-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #FFF;
  overflow: auto;
  margin: 0;
  padding: 0;
  min-height: 100vh;
  width: 100vw;
}
</style>