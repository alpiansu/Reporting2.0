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
            text: 'I've reviewed the initial findings. Please prioritize the expired products issue immediately. I'll be visiting the store tomorrow to follow up on progress.',
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

<style scoped>
.screening-details {
  padding: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-color);
}

.screening-status {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-completed {
  background-color: rgba(40, 167, 69, 0.1);
  color: #28a745;
}

.status-in-progress {
  background-color: rgba(255, 193, 7, 0.1);
  color: #ffc107;
}

.status-pending {
  background-color: rgba(108, 117, 125, 0.1);
  color: #6c757d;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.continue-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
}

.continue-button:hover {
  background-color: var(--primary-color-darken);
}

.download-button {
  background-color: white;
  border: 1px solid #ddd;
  color: var(--text-color);
}

.download-button:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.loading-container, .error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 0;
  text-align: center;
}

.loading-container i, .error-container i {
  font-size: 3rem;
  color: var(--text-color-secondary);
  margin-bottom: 16px;
  opacity: 0.5;
}

.error-container i {
  color: var(--error-color);
}

.error-container h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-color);
}

.error-container p {
  color: var(--text-color-secondary);
  margin-bottom: 24px;
}

.back-to-list {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.back-to-list:hover {
  background-color: var(--primary-color-darken);
}

.screening-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.screening-summary-card, .section-scores-card, .issues-card, .comments-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.store-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.store-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.screening-date {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.overall-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.score-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.score-excellent {
  background-color: #28a745;
}

.score-good {
  background-color: #5cb85c;
}

.score-average {
  background-color: #ffc107;
}

.score-below-average {
  background-color: #fd7e14;
}

.score-poor {
  background-color: #dc3545;
}

.score-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.summary-details {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  padding: 20px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.detail-value {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-color);
}

.status-value {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
}

.store-link {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--primary-color);
  transition: color 0.2s;
}

.store-link:hover {
  color: var(--primary-color-darken);
  text-decoration: underline;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
  padding: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.sections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  padding: 20px;
}

.section-item {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.section-score {
  font-size: 1rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  color: white;
}

.score-bar-container {
  margin-bottom: 12px;
}

.score-bar {
  height: 8px;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  overflow: hidden;
}

.score-progress {
  height: 100%;
  border-radius: 4px;
}

.section-stats {
  display: flex;
  justify-content: space-between;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.empty-issues, .empty-comments {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  text-align: center;
}

.empty-issues i, .empty-comments i {
  font-size: 2.5rem;
  color: var(--text-color-secondary);
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-issues p, .empty-comments p {
  color: var(--text-color-secondary);
  margin-bottom: 0;
}

.issues-list {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.issue-item {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
}

.issue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.issue-section-badge {
  background-color: rgba(var(--primary-color-rgb), 0.1);
  color: var(--primary-color);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.issue-severity {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
}

.issue-severity.high {
  background-color: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.issue-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-color);
}

.issue-description {
  font-size: 0.875rem;
  color: var(--text-color);
  margin-bottom: 16px;
}

.issue-images {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.issue-image {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.issue-image:hover {
  transform: scale(1.05);
}

.issue-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.issue-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.issue-date, .issue-reporter {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.action-required {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #dc3545;
}

.comments-list {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.comment-item {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.comment-author {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
}

.author-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.author-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color);
}

.comment-date {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.delete-comment-button {
  background: none;
  border: none;
  color: var(--text-color-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
}

.delete-comment-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--error-color);
}

.comment-content p {
  font-size: 0.875rem;
  color: var(--text-color);
  margin: 0;
  line-height: 1.5;
}

.add-comment-section {
  padding: 0 20px 20px;
  display: flex;
  justify-content: center;
}

.add-comment-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  color: var(--text-color);
}

.add-comment-button:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog-content {
  background-color: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.dialog-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color-secondary);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.dialog-body {
  padding: 20px;
}

.comment-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
}

.form-group textarea {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.875rem;
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.2s;
}

.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-button {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s;
}

.cancel-button:hover {
  border-color: var(--text-color);
}

.submit-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.submit-button:hover {
  background-color: var(--primary-color-darken);
}

.submit-button:disabled {
  background-color: var(--primary-color-lighten);
  cursor: not-allowed;
}

.image-viewer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.image-viewer-content {
  position: relative;
  width: 90%;
  max-width: 1000px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.close-viewer-button {
  position: absolute;
  top: -40px;
  right: 0;
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-viewer-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.image-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 16px;
}

.viewer-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 4px;
}

.image-navigation {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-button {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.nav-button:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.2);
}

.nav-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-counter {
  color: white;
  font-size: 0.875rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .summary-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .summary-details {
    grid-template-columns: 1fr;
  }
  
  .sections-grid {
    grid-template-columns: 1fr;
  }
  
  .issue-header, .issue-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .action-required {
    margin-top: 8px;
  }
}

@media (max-width: 480px) {
  .header-left {
    flex-wrap: wrap;
  }
  
  .dialog-content {
    width: 90%;
  }
  
  .issue-images {
    justify-content: center;
  }
}
</style>