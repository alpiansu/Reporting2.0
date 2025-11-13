<template>
    <div>
        <!-- Modal Backdrop -->
        <Transition name="backdrop-fade">
            <div v-if="show" class="modal-backdrop" @click="handleBackdropClick"></div>
        </Transition>

        <!-- Modal -->
        <Transition name="modal-scale">
            <div class="modal" :class="{ 'show': show }" tabindex="-1" role="dialog" v-if="show"
                @click.self="handleBackdropClick">
                <div class="modal-dialog" :class="modalSizeClass">
                    <div class="modal-content">
                        <!-- Header -->
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i v-if="icon" :class="icon"></i>
                                {{ title }}
                            </h5>
                            <button type="button" class="modal-close" @click="handleClose" :aria-label="closeAriaLabel">
                                <i class="pi pi-times"></i>
                            </button>
                        </div>

                        <!-- Body -->
                        <div class="modal-body">
                            <!-- Header Info Slot -->
                            <div v-if="$slots['header-info']" class="detail-header">
                                <slot name="header-info"></slot>
                            </div>

                            <!-- Loading State Slot -->
                            <div v-if="$slots['loading-state']">
                                <slot name="loading-state"></slot>
                            </div>

                            <!-- Error State Slot -->
                            <div v-else-if="$slots['error-state']">
                                <slot name="error-state"></slot>
                            </div>

                            <!-- Empty State Slot -->
                            <div v-else-if="$slots['empty-state']">
                                <slot name="empty-state"></slot>
                            </div>

                            <!-- Default Content Slot -->
                            <div v-else>
                                <slot name="content"></slot>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="modal-footer" v-if="$slots.footer || showDefaultFooter">
                            <slot name="footer">
                                <button v-if="showDefaultFooter" type="button" class="btn btn-cancel"
                                    @click="handleClose">
                                    <i class="pi pi-times"></i> {{ closeButtonText }}
                                </button>
                            </slot>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    show: {
        type: Boolean,
        default: false
    },
    title: {
        type: String,
        default: 'Detail'
    },
    icon: {
        type: String,
        default: 'pi pi-list'
    },
    size: {
        type: String,
        default: 'full', // 'sm', 'md', 'lg', 'xl', 'full'
        validator: (value) => ['sm', 'md', 'lg', 'xl', 'full'].includes(value)
    },
    closeOnBackdrop: {
        type: Boolean,
        default: true
    },
    closeOnEscape: {
        type: Boolean,
        default: true
    },
    showDefaultFooter: {
        type: Boolean,
        default: true
    },
    closeButtonText: {
        type: String,
        default: 'Tutup'
    },
    closeAriaLabel: {
        type: String,
        default: 'Close modal'
    },
    preventBodyScroll: {
        type: Boolean,
        default: true
    }
});

const emit = defineEmits(['close', 'opened', 'closed']);

// Computed
const modalSizeClass = computed(() => {
    const sizeMap = {
        'sm': 'modal-sm',
        'md': 'modal-md',
        'lg': 'modal-lg',
        'xl': 'modal-xl',
        'full': 'modal-full'
    };
    return sizeMap[props.size] || 'modal-full';
});

// Methods
function handleClose() {
    emit('close');
}

function handleBackdropClick() {
    if (props.closeOnBackdrop) {
        handleClose();
    }
}

function handleEscapeKey(event) {
    if (props.show && props.closeOnEscape && event.key === 'Escape') {
        handleClose();
    }
}

function toggleBodyScroll(lock) {
    if (!props.preventBodyScroll) return;

    if (lock) {
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = `${getScrollbarWidth()}px`;
    } else {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }
}

function getScrollbarWidth() {
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    document.body.appendChild(outer);

    const inner = document.createElement('div');
    outer.appendChild(inner);

    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.parentNode.removeChild(outer);

    return scrollbarWidth;
}

// Watchers
watch(() => props.show, (newValue) => {
    toggleBodyScroll(newValue);

    if (newValue) {
        emit('opened');
    } else {
        emit('closed');
    }
});

// Lifecycle
onMounted(() => {
    document.addEventListener('keydown', handleEscapeKey);
    if (props.show) {
        toggleBodyScroll(true);
    }
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleEscapeKey);
    toggleBodyScroll(false);
});
</script>

<style scoped>
/* Modal Backdrop */
.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1040;
}

/* Modal Container */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
}

.modal-dialog {
    width: 100%;
    max-width: 100%;
    margin: 0;
    display: flex;
    flex-direction: column;
    max-height: 100vh;
    position: relative;
}

/* Modal Sizes */
.modal-dialog.modal-sm {
    max-width: 400px;
    max-height: 90vh;
}

.modal-dialog.modal-md {
    max-width: 600px;
    max-height: 90vh;
}

.modal-dialog.modal-lg {
    max-width: 900px;
    max-height: 90vh;
}

.modal-dialog.modal-xl {
    max-width: 1200px;
    max-height: 90vh;
}

.modal-dialog.modal-full {
    max-width: 98%;
    max-height: 96vh;
}

/* Modal Content */
.modal-content {
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    border-radius: 20px;
    box-shadow:
        0 25px 80px rgba(0, 0, 0, 0.3),
        0 10px 40px rgba(0, 0, 0, 0.2),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 100%;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Modal Header */
.modal-header {
    padding: 1.75rem 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    flex-shrink: 0;
    position: relative;
}

.modal-header::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.5) 50%,
            transparent 100%);
}

.modal-title {
    font-size: 1.375rem;
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.modal-title i {
    font-size: 1.5rem;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.modal-close {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.625rem;
    border-radius: 10px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.modal-close:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: rotate(90deg) scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.modal-close:active {
    transform: rotate(90deg) scale(0.95);
}

/* Modal Body */
.modal-body {
    padding: 1rem;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    background: linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%);
}

/* Custom Scrollbar */
.modal-body::-webkit-scrollbar {
    width: 10px;
}

.modal-body::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
}

.modal-body::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 10px;
    transition: background 0.3s ease;
}

.modal-body::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

/* Detail Header */
/* Detail Header (Redesigned) */
.detail-header {
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border-radius: 18px;
    padding: 1px 1rem;
    margin-bottom: 0.5rem;
    border: 1px solid #e5e7eb;
    box-shadow:
        0 8px 20px rgba(0, 0, 0, 0.05),
        0 0 0 1px rgba(255, 255, 255, 0.6) inset;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease-in-out;
}

.detail-header::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 5px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
    border-top-left-radius: 18px;
    border-top-right-radius: 18px;
}

/* Optional shimmer accent */
.detail-header::after {
    content: "";
    position: absolute;
    top: 0;
    left: -150%;
    width: 50%;
    height: 100%;
    background: linear-gradient(120deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.35) 50%, rgba(255, 255, 255, 0) 100%);
    transform: skewX(-25deg);
    animation: shimmer 4s infinite linear;
}

@keyframes shimmer {
    0% {
        left: -150%;
    }

    100% {
        left: 150%;
    }
}

.detail-header:hover {
    transform: translateY(-2px);
    box-shadow:
        0 12px 28px rgba(0, 0, 0, 0.08),
        0 0 0 1px rgba(255, 255, 255, 0.7) inset;
}

/* Inner content slot layout */
.detail-header>* {
    flex: 1;
    min-width: 220px;
}

/* Typography */
.detail-header h4,
.detail-header h5 {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
    color: #111827;
}

.detail-header p,
.detail-header span {
    font-size: 0.9375rem;
    color: #4b5563;
}

/* Badge style (for custom status/info chips) */
.detail-header .badge {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: 0.8125rem;
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    font-weight: 500;
    box-shadow: 0 3px 10px rgba(99, 102, 241, 0.25);
}

/* Modal Footer */
.modal-footer {
    padding: 1.25rem 2rem;
    border-top: 1px solid #e9ecef;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    background: linear-gradient(to top, #f8f9fa 0%, #ffffff 100%);
    flex-shrink: 0;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.03);
}

/* Button Styles */
.btn {
    padding: 0.625rem 1.5rem;
    border: none;
    border-radius: 10px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    text-decoration: none;
    font-family: inherit;
    letter-spacing: -0.01em;
    position: relative;
    overflow: hidden;
}

.btn::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: width 0.6s, height 0.6s;
}

.btn:hover::before {
    width: 300px;
    height: 300px;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
}

.btn:disabled:hover::before {
    width: 0;
    height: 0;
}

.btn-cancel {
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-cancel:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
    background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
}

.btn-cancel:active:not(:disabled) {
    transform: translateY(0);
}

/* Transitions */
.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
    transition: opacity 0.3s ease;
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
    opacity: 0;
}

.modal-scale-enter-active,
.modal-scale-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-scale-enter-from,
.modal-scale-leave-to {
    opacity: 0;
    transform: scale(0.9);
}

.modal-scale-enter-to,
.modal-scale-leave-from {
    opacity: 1;
    transform: scale(1);
}

/* Responsive Design */
@media (max-width: 768px) {
    .modal {
        padding: 0.5rem;
    }

    .modal-dialog {
        max-width: 100% !important;
        max-height: 98vh !important;
        margin: 0;
    }

    .modal-content {
        border-radius: 16px;
    }

    .modal-header {
        padding: 1.25rem 1.5rem;
    }

    .modal-title {
        font-size: 1.125rem;
    }

    .modal-title i {
        font-size: 1.25rem;
    }

    .modal-close {
        width: 36px;
        height: 36px;
    }

    .modal-body {
        padding: 1.5rem;
    }

    .detail-header {
        padding: 1.25rem;
        margin-bottom: 1.25rem;
    }

    .modal-footer {
        padding: 1rem 1.5rem;
    }

    .btn {
        padding: 0.5rem 1.25rem;
        font-size: 0.875rem;
    }
}

@media (max-width: 480px) {
    .modal {
        padding: 0;
    }

    .modal-dialog {
        border-radius: 0;
        max-height: 100vh !important;
    }

    .modal-content {
        border-radius: 0;
    }

    .modal-header {
        padding: 1rem 1.25rem;
    }

    .modal-title {
        font-size: 1rem;
    }

    .modal-body {
        padding: 1.25rem;
    }

    .detail-header {
        padding: 1rem;
        border-radius: 12px;
    }

    .modal-footer {
        padding: 0.875rem 1.25rem;
    }
}

/* Browser Compatibility */
@supports not (backdrop-filter: blur(8px)) {
    .modal-backdrop {
        background: rgba(0, 0, 0, 0.75);
    }
}

@supports not (-webkit-backdrop-filter: blur(8px)) {
    .modal-backdrop {
        background: rgba(0, 0, 0, 0.75);
    }
}

/* Print Styles */
@media print {

    .modal-backdrop,
    .modal-close {
        display: none;
    }

    .modal-dialog {
        max-width: 100% !important;
        max-height: none !important;
    }

    .modal-content {
        box-shadow: none;
        border: 1px solid #ddd;
    }
}
</style>