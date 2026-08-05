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

<style scoped src="./BaseModalDetail.style.css"></style>