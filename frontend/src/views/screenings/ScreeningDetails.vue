<template>
  <div class="screening-details">
    <div class="page-header">
      <div class="header-left">
        <button class="back-button" @click="goBack">
          <i class="pi pi-arrow-left"></i>
        </button>
        <h1 class="page-title">Screening Details</h1>
        <span v-if="screening" class="screening-status" :class="getStatusClass(screening.status)">
          {{ screening.status }}
        </span>
      </div>
      <div class="header-actions">
        <button 
          v-if="screening && screening.status !== 'Completed'"
          class="action-button continue-button" 
          @click="continueScreening"
        >
          <i class="pi pi-pencil"></i>
          Continue Screening
        </button>
        <button class="action-button download-button" @click="downloadReport">
          <i class="pi pi-download"></i>
          Download Report
        </button>
      </div>
    </div>
    
    <div v-if="loading" class="loading-container">
      <i class="pi pi-spin pi-spinner"></i>
      <p>Loading screening details...</p>
    </div>
    
    <div v-else-if="!screening" class="error-container">
      <i class="pi pi-exclamation-triangle"></i>
      <h2>Screening Not Found</h2>
      <p>The screening you're looking for doesn't exist or has been removed.</p>
      <button class="back-to-list" @click="goToScreeningList">
        <i class="pi pi-list"></i>
        Back to Screening List
      </button>
    </div>
    
    <div v-else class="screening-content">
      <div class="screening-summary-card">
        <div class="summary-header">
          <div class="store-info">
            <h2 class="store-name">{{ screening.storeName }}</h2>
            <span class="screening-date">{{ formatDate(screening.date) }}</span>
          </div>
          <div class="overall-score">
            <div class="score-circle" :class="getScoreClass(screening.score)">
              <span class="score-value">{{ screening.score }}%</span>
            </div>
            <span class="score-label">Overall Score</span>
          </div>
        </div>
        
        <div class="summary-details">
          <div class="detail-item">
            <span class="detail-label">Status</span>
            <span class="detail-value status-value" :class="getStatusClass(screening.status)">
              {{ screening.status }}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Conducted By</span>
            <span class="detail-value">{{ screening.conductedBy }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Store</span>
            <span class="detail-value store-link" @click="goToStore(screening.storeId)">
              {{ screening.storeName }}
              <i class="pi pi-external-link"></i>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Date & Time</span>
            <span class="detail-value">{{ formatDateTime(screening.date) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Completion</span>
            <span class="detail-value">
              {{ screening.completedSections }} of {{ screening.totalSections }} sections
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Template</span>
            <span class="detail-value">{{ screening.template }}</span>
          </div>
        </div>
      </div>
      
      <div class="section-scores-card">
        <h2 class="card-title">Section Scores</h2>
        
        <div class="sections-grid">
          <div 
            v-for="section in screening.sections" 
            :key="section.id"
            class="section-item"
          >
            <div class="section-header">
              <h3 class="section-name">{{ section.name }}</h3>
              <span class="section-score" :class="getScoreClass(section.score)">
                {{ section.score }}%
              </span>
            </div>
            
            <div class="score-bar-container">
              <div class="score-bar">
                <div 
                  class="score-progress" 
                  :style="{ width: `${section.score}%` }"
                  :class="getScoreClass(section.score)"
                ></div>
              </div>
            </div>
            
            <div class="section-stats">
              <div class="stat-item">
                <span class="stat-value">{{ section.passedItems }}</span>
                <span class="stat-label">Passed</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ section.failedItems }}</span>
                <span class="stat-label">Failed</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ section.naItems }}</span>
                <span class="stat-label">N/A</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="issues-card">
        <h2 class="card-title">Critical Issues</h2>
        
        <div v-if="criticalIssues.length === 0" class="empty-issues">
          <i class="pi pi-check-circle"></i>
          <p>No critical issues found in this screening.</p>
        </div>
        
        <div v-else class="issues-list">
          <div 
            v-for="issue in criticalIssues" 
            :key="issue.id"
            class="issue-item"
          >
            <div class="issue-header">
              <div class="issue-section-badge">{{ issue.section }}</div>
              <span class="issue-severity high">High Severity</span>
            </div>
            
            <h3 class="issue-title">{{ issue.title }}</h3>
            <p class="issue-description">{{ issue.description }}</p>
            
            <div v-if="issue.images && issue.images.length > 0" class="issue-images">
              <div 
                v-for="(image, index) in issue.images" 
                :key="index"
                class="issue-image"
                :style="{ backgroundImage: `url(${image})` }"
                @click="openImageViewer(issue.images, index)"
              ></div>
            </div>
            
            <div class="issue-footer">
              <div class="issue-meta">
                <span class="issue-date">{{ formatDate(issue.date) }}</span>
                <span class="issue-reporter">Reported by {{ issue.reportedBy }}</span>
              </div>
              
              <div v-if="issue.actionRequired" class="action-required">
                <i class="pi pi-exclamation-circle"></i>
                Action Required
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="comments-card">
        <h2 class="card-title">Comments & Notes</h2>
        
        <div v-if="screening.comments.length === 0" class="empty-comments">
          <i class="pi pi-comments"></i>
          <p>No comments have been added to this screening yet.</p>
          <button class="add-comment-button" @click="openAddCommentDialog">
            <i class="pi pi-plus"></i>
            Add Comment
          </button>
        </div>
        
        <div v-else>
          <div class="comments-list">
            <div 
              v-for="comment in screening.comments" 
              :key="comment.id"
              class="comment-item"
            >
              <div class="comment-header">
                <div class="comment-author">
                  <div class="author-avatar">{{ getInitials(comment.author) }}</div>
                  <div class="author-info">
                    <span class="author-name">{{ comment.author }}</span>
                    <span class="comment-date">{{ formatDateTime(comment.date) }}</span>
                  </div>
                </div>
                
                <button 
                  v-if="isCurrentUserComment(comment)"
                  class="delete-comment-button" 
                  @click="deleteComment(comment.id)"
                >
                  <i class="pi pi-trash"></i>
                </button>
              </div>
              
              <div class="comment-content">
                <p>{{ comment.text }}</p>
              </div>
            </div>
          </div>
          
          <div class="add-comment-section">
            <button class="add-comment-button" @click="openAddCommentDialog">
              <i class="pi pi-plus"></i>
              Add Comment
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Add Comment Dialog -->
    <div v-if="showAddCommentDialog" class="dialog-overlay" @click="closeAddCommentDialog">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h2>Add Comment</h2>
          <button class="close-button" @click="closeAddCommentDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body">
          <form @submit.prevent="addComment" class="comment-form">
            <div class="form-group">
              <label for="commentText">Comment</label>
              <textarea 
                id="commentText" 
                v-model="newComment.text" 
                placeholder="Enter your comment here..."
                rows="4"
                required
              ></textarea>
            </div>
            
            <div class="form-actions">
              <button type="button" class="cancel-button" @click="closeAddCommentDialog">Cancel</button>
              <button type="submit" class="submit-button" :disabled="isSubmitting">
                <span v-if="!isSubmitting">Add Comment</span>
                <i v-else class="pi pi-spin pi-spinner"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    <!-- Image Viewer -->
    <div v-if="showImageViewer" class="image-viewer-overlay" @click="closeImageViewer">
      <div class="image-viewer-content" @click.stop>
        <button class="close-viewer-button" @click="closeImageViewer">
          <i class="pi pi-times"></i>
        </button>
        
        <div class="image-container">
          <img :src="currentImage" alt="Issue image" class="viewer-image" />
        </div>
        
        <div class="image-navigation">
          <button 
            class="nav-button prev-button" 
            @click="prevImage"
            :disabled="currentImageIndex === 0"
          >
            <i class="pi pi-chevron-left"></i>
          </button>
          <div class="image-counter">
            {{ currentImageIndex + 1 }} / {{ viewerImages.length }}
          </div>
          <button 
            class="nav-button next-button" 
            @click="nextImage"
            :disabled="currentImageIndex === viewerImages.length - 1"
          >
            <i class="pi pi-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

// State
const screening = ref(null);
const loading = ref(true);
const showAddCommentDialog = ref(false);
const isSubmitting = ref(false);
const newComment = ref({
  text: ''
});

// Image viewer state
const showImageViewer = ref(false);
const viewerImages = ref([]);
const currentImageIndex = ref(0);

// Computed
const currentImage = computed(() => {
  if (viewerImages.value.length === 0) return '';
  return viewerImages.value[currentImageIndex.value];
});

const criticalIssues = computed(() => {
  if (!screening.value || !screening.value.issues) return [];
  return screening.value.issues.filter(issue => issue.severity === 'high');
});

// Fetch screening details
onMounted(async () => {
  const screeningId = parseInt(route.params.id);
  
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock screening data
    if (screeningId === 101) {
      screening.value = {
        id: 101,
        storeId: 1,
        storeName: 'Store Alpha',
        date: '2023-11-28T09:00:00',
        conductedBy: 'John Doe',
        status: 'Completed',
        score: 92,
        completedSections: 10,
        totalSections: 10,
        template: 'Standard Store Audit',
        sections: [
          {
            id: 1,
            name: 'Exterior',
            score: 95,
            passedItems: 19,
            failedItems: 1,
            naItems: 0
          },
          {
            id: 2,
            name: 'Interior Cleanliness',
            score: 90,
            passedItems: 18,
            failedItems: 2,
            naItems: 0
          },
          {
            id: 3,
            name: 'Product Presentation',
            score: 88,
            passedItems: 22,
            failedItems: 3,
            naItems: 1
          },
          {
            id: 4,
            name: 'Staff Appearance',
            score: 100,
            passedItems: 10,
            failedItems: 0,
            naItems: 0
          },
          {
            id: 5,
            name: 'Customer Service',
            score: 93,
            passedItems: 14,
            failedItems: 1,
            naItems: 0
          },
          {
            id: 6,
            name: 'Health & Safety',
            score: 96,
            passedItems: 24,
            failedItems: 1,
            naItems: 0
          },
          {
            id: 7,
            name: 'Merchandising',
            score: 85,
            passedItems: 17,
            failedItems: 3,
            naItems: 0
          },
          {
            id: 8,
            name: 'Inventory Management',
            score: 92,
            passedItems: 11,
            failedItems: 1,
            naItems: 0
          },
          {
            id: 9,
            name: 'Promotions & Displays',
            score: 90,
            passedItems: 9,
            failedItems: 1,
            naItems: 0
          },
          {
            id: 10,
            name: 'Documentation',
            score: 88,
            passedItems: 7,
            failedItems: 1,
            naItems: 0
          }
        ],
        issues: [
          {
            id: 1,
            section: 'Interior Cleanliness',
            title: 'Restroom cleanliness below standard',
            description: 'The customer restroom was found to have inadequate supplies and cleanliness issues that need immediate attention.',
            severity: 'high',
            date: '2023-11-28T09:30:00',
            reportedBy: 'John Doe',
            actionRequired: true,
            images: [
              'https://placehold.co/600x400/e74c3c/ffffff?text=Restroom+Issue+1',
              'https://placehold.co/600x400/e74c3c/ffffff?text=Restroom+Issue+2'
            ]
          },
          {
            id: 2,
            section: 'Health & Safety',
            title: 'Fire exit partially blocked',
            description: 'The secondary fire exit was partially obstructed by storage boxes. This is a serious safety violation that requires immediate correction.',
            severity: 'high',
            date: '2023-11-28T10:15:00',
            reportedBy: 'John Doe',
            actionRequired: true,
            images: [
              'https://placehold.co/600x400/e74c3c/ffffff?text=Fire+Exit+Blocked'
            ]
          }
        ],
        comments: [
          {
            id: 1,
            author: 'John Doe',
            text: 'Overall, the store was in excellent condition. The staff was well-prepared for the audit and had addressed most of the issues from the previous screening.',
            date: '2023-11-28T11:30:00'
          },
          {
            id: 2,
            author: 'Jane Smith',
            text: 'I reviewed the critical issues and have scheduled maintenance to address the restroom cleanliness and fire exit blockage by end of day.',
            date: '2023-11-28T13:45:00'
          },
          {
            id: 3,
            author: 'Store Manager',
            text: 'All issues have been resolved. The restroom has been deep cleaned and we\'ve implemented a new hourly check system. The fire exit has been cleared and staff has been reminded about proper storage procedures.',
            date: '2023-11-28T16:20:00'
          }
        ]
      };
    } else if (screeningId === 95) {
      screening.value = {
        id: 95,
        storeId: 3,
        storeName: 'Store Gamma',
        date: '2023-11-22T09:30:00',
        conductedBy: 'Jane Smith',
        status: 'In Progress',
        score: 45,
        completedSections: 5,
        totalSections: 10,
        template: 'Standard Store Audit',
        sections: [
          {
            id: 1,
            name: 'Exterior',
            score: 65,
            passedItems: 13,
            failedItems: 7,
            naItems: 0
          },
          {
            id: 2,
            name: 'Interior Cleanliness',
            score: 40,
            passedItems: 8,
            failedItems: 12,
            naItems: 0
          },
          {
            id: 3,
            name: 'Product Presentation',
            score: 55,
            passedItems: 14,
            failedItems: 11,
            naItems: 1
          },
          {
            id: 4,
            name: 'Staff Appearance',
            score: 70,
            passedItems: 7,
            failedItems: 3,
            naItems: 0
          },
          {
            id: 5,
            name: 'Customer Service',
            score: 0,
            passedItems: 0,
            failedItems: 0,
            naItems: 0
          },
          {
            id: 6,
            name: 'Health & Safety',
            score: 0,
            passedItems: 0,
            failedItems: 0,
            naItems: 0
          },
          {
            id: 7,
            name: 'Merchandising',
            score: 0,
            passedItems: 0,
            failedItems: 0,
            naItems: 0
          },
          {
            id: 8,
            name: 'Inventory Management',
            score: 0,
            passedItems: 0,
            failedItems: 0,
            naItems: 0
          },
          {
            id: 9,
            name: 'Promotions & Displays',
            score: 0,
            passedItems: 0,
            failedItems: 0,
            naItems: 0
          },
          {
            id: 10,
            name: 'Documentation',
            score: 0,
            passedItems: 0,
            failedItems: 0,
            naItems: 0
          }
        ],
        issues: [
          {
            id: 1,
            section: 'Exterior',
            title: 'Storefront signage damaged',
            description: 'The main storefront sign has visible damage on the left side with some letters partially missing.',
            severity: 'high',
            date: '2023-11-22T09:45:00',
            reportedBy: 'Jane Smith',
            actionRequired: true,
            images: [
              'https://placehold.co/600x400/e74c3c/ffffff?text=Damaged+Signage'
            ]
          },
          {
            id: 2,
            section: 'Interior Cleanliness',
            title: 'Significant dust accumulation on shelves',
            description: 'Heavy dust accumulation was observed on multiple shelving units, particularly in the electronics section.',
            severity: 'high',
            date: '2023-11-22T10:10:00',
            reportedBy: 'Jane Smith',
            actionRequired: true,
            images: [
              'https://placehold.co/600x400/e74c3c/ffffff?text=Dust+Issue+1',
              'https://placehold.co/600x400/e74c3c/ffffff?text=Dust+Issue+2'
            ]
          },
          {
            id: 3,
            section: 'Product Presentation',
            title: 'Expired products on display',
            description: 'Multiple expired food items were found still on display in the grocery section. This is a serious compliance issue.',
            severity: 'high',
            date: '2023-11-22T10:30:00',
            reportedBy: 'Jane Smith',
            actionRequired: true,
            images: [
              'https://placehold.co/600x400/e74c3c/ffffff?text=Expired+Products'
            ]
          }
        ],
        comments: [
          {
            id: 1,
            author: 'Jane Smith',
            text: 'Screening is currently in progress. The first 5 sections have been completed with several critical issues identified. Will continue the screening tomorrow.',
            date: '2023-11-22T12:30:00'
          },
          {
            id: 2,
            author: 'Regional Manager',
            text: 'I have reviewed the initial findings. Please prioritize the expired products issue immediately. I will be visiting the store tomorrow to follow up on progress.',
            date: '2023-11-22T14:15:00'
          }
        ]
      };
    } else {
      // For other IDs, create a generic completed screening
      screening.value = {
        id: screeningId,
        storeId: screeningId % 5 || 5, // Map to store IDs 1-5
        storeName: `Store ${String.fromCharCode(65 + (screeningId % 5 || 5) - 1)}`, // A, B, C, D, E
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Random date within last 30 days
        conductedBy: Math.random() > 0.5 ? 'John Doe' : 'Jane Smith',
        status: 'Completed',
        score: Math.floor(Math.random() * 20) + 80, // Random score between 80-99
        completedSections: 10,
        totalSections: 10,
        template: 'Standard Store Audit',
        sections: Array.from({ length: 10 }, (_, i) => {
          const score = Math.floor(Math.random() * 30) + 70; // Random score between 70-99
          const total = 20;
          const failed = Math.floor((100 - score) / 100 * total);
          return {
            id: i + 1,
            name: [
              'Exterior', 'Interior Cleanliness', 'Product Presentation', 'Staff Appearance',
              'Customer Service', 'Health & Safety', 'Merchandising', 'Inventory Management',
              'Promotions & Displays', 'Documentation'
            ][i],
            score,
            passedItems: total - failed,
            failedItems: failed,
            naItems: 0
          };
        }),
        issues: [],
        comments: [
          {
            id: 1,
            author: Math.random() > 0.5 ? 'John Doe' : 'Jane Smith',
            text: 'Completed the screening with satisfactory results. No critical issues were identified.',
            date: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString() // Random date within last 5 days
          }
        ]
      };
    }
  } catch (error) {
    console.error('Error fetching screening details:', error);
    screening.value = null;
  } finally {
    loading.value = false;
  }
});

// Methods
const goBack = () => {
  router.back();
};

const goToScreeningList = () => {
  router.push('/screenings');
};

const goToStore = (storeId) => {
  router.push(`/stores/${storeId}`);
};

const getStatusClass = (status) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'status-completed';
    case 'in progress':
      return 'status-in-progress';
    case 'pending':
      return 'status-pending';
    default:
      return '';
  }
};

const getScoreClass = (score) => {
  if (score >= 90) return 'score-excellent';
  if (score >= 80) return 'score-good';
  if (score >= 70) return 'score-average';
  if (score >= 60) return 'score-below-average';
  return 'score-poor';
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleString(undefined, options);
};

const getInitials = (name) => {
  if (!name) return 'NA';
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

const isCurrentUserComment = (comment) => {
  // In a real app, this would check if the comment author is the current user
  return comment.author === 'John Doe';
};

const continueScreening = () => {
  router.push(`/screenings/${screening.value.id}/edit`);
};

const downloadReport = () => {
  // In a real app, this would download a PDF report
  console.log('Downloading report for screening:', screening.value.id);
};

const openAddCommentDialog = () => {
  showAddCommentDialog.value = true;
};

const closeAddCommentDialog = () => {
  showAddCommentDialog.value = false;
  newComment.value.text = '';
};

const addComment = async () => {
  isSubmitting.value = true;
  
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add the new comment to the list
    const comment = {
      id: screening.value.comments.length + 1,
      author: 'John Doe', // In a real app, this would be the current user
      text: newComment.value.text,
      date: new Date().toISOString()
    };
    
    screening.value.comments.push(comment);
    closeAddCommentDialog();
  } catch (error) {
    console.error('Error adding comment:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const deleteComment = async (commentId) => {
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Remove the comment from the list
    screening.value.comments = screening.value.comments.filter(comment => comment.id !== commentId);
  } catch (error) {
    console.error('Error deleting comment:', error);
  }
};

const openImageViewer = (images, index) => {
  viewerImages.value = images;
  currentImageIndex.value = index;
  showImageViewer.value = true;
};

const closeImageViewer = () => {
  showImageViewer.value = false;
};

const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--;
  }
};

const nextImage = () => {
  if (currentImageIndex.value < viewerImages.value.length - 1) {
    currentImageIndex.value++;
  }
};
</script>

<style scoped src="./ScreeningDetails.style.css"></style>