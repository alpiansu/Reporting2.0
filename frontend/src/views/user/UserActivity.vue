<template>
  <div class="user-activity-page">
    <div class="page-header">
      <h1>User Activity</h1>
      <p class="page-description">
        View your recent account activities and login history
      </p>
    </div>
    
    <UserActivityList />
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import UserActivityList from '../../components/user/UserActivityList.vue';

export default defineComponent({
  name: 'UserActivity',
  components: {
    UserActivityList,
  },
});
</script>

<style src="./UserActivity.style.css"></style>