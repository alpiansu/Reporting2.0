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

<style>
.user-activity-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 1.8rem;
  color: #333;
  margin-bottom: 10px;
}

.page-description {
  color: #666;
  font-size: 1rem;
}

@media (max-width: 768px) {
  .user-activity-page {
    padding: 15px;
  }
  
  .page-header h1 {
    font-size: 1.5rem;
  }
}
</style>