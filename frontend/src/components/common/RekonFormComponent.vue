<template>
    <div class="rekon-form-container">
        <div class="form-card card" :class="{ 'processing': isProcessing }">
            <!-- Header Section dengan Animasi -->
            <div class="form-header">
                <div class="header-icon" :class="{ 'pulse': isProcessing }">
                    <slot name="icon">
                        <div class="default-icon">
                            <i class="pi" :class="isProcessing ? 'pi-spin pi-spinner' : 'pi-filter-slash'"></i>
                        </div>
                    </slot>
                </div>
                <div class="header-content">
                    <h2 class="form-title">
                        <slot name="title"></slot>
                    </h2>
                    <p class="form-description">
                        <slot name="description"></slot>
                    </p>
                </div>
            </div>

            <!-- Form Section dengan Layout Horizontal -->
            <form @submit.prevent="submitForm" class="rekon-form">
                <div class="form-row">
                    <!-- Cabang Input dengan Animasi -->
                    <div class="form-group form-group-cabang">
                        <label for="cab" class="form-label">
                            <span class="label-text">Cabang</span>
                            <span class="required-asterisk">*</span>
                        </label>
                        <div class="input-container" :class="{ 'has-value': hasCabangValue, 'focused': cabangFocused }">
                            <slot name="cab" @focus="cabangFocused = true" @blur="cabangFocused = false">
                                <!-- Default slot content -->
                            </slot>
                            <div class="input-ripple" v-if="cabangFocused"></div>
                        </div>
                        <small v-if="errors?.cab" class="error-text">
                            <i class="pi pi-exclamation-circle"></i>
                            {{ errors.cab }}
                        </small>
                    </div>

                    <!-- Periode Input dengan Animasi -->
                    <div class="form-group form-group-periode">
                        <label for="periode" class="form-label">
                            <span class="label-text">Periode</span>
                            <span class="required-asterisk">*</span>
                        </label>
                        <div class="input-container"
                            :class="{ 'has-value': hasPeriodeValue, 'focused': periodeFocused, 'calendar-open': calendarOpen }">
                            <slot name="periode" @focus="periodeFocused = true" @blur="periodeFocused = false"
                                @calendar-open="calendarOpen = true" @calendar-close="calendarOpen = false">
                            </slot>
                            <div class="input-ripple" v-if="periodeFocused"></div>
                            <div class="calendar-animation" v-if="calendarOpen">
                                <div class="calendar-particles">
                                    <div class="particle" v-for="i in 6" :key="i" :style="particleStyle(i)"></div>
                                </div>
                            </div>
                        </div>
                        <small v-if="errors?.periode" class="error-text">
                            <i class="pi pi-exclamation-circle"></i>
                            {{ errors.periode }}
                        </small>
                    </div>

                    <!-- Actions Button dengan Animasi -->
                    <div class="form-group form-group-actions">
                        <div class="actions-container">
                            <slot name="actions"></slot>
                        </div>
                    </div>
                </div>

                <!-- Additional Fields Row -->
                <div class="form-row-additional" v-if="$slots['additional-fields']" style="margin-top: 1.5rem; border-top: 1px solid rgba(226, 232, 240, 0.6); padding-top: 1.5rem;">
                    <slot name="additional-fields"></slot>
                </div>
            </form>

            <!-- Status Indicator -->
            <div class="status-indicator" v-if="isProcessing">
                <div class="processing-animation">
                    <div class="scan-line"></div>
                    <div class="data-points">
                        <div class="data-point" v-for="i in 8" :key="i" :style="dataPointStyle(i)"></div>
                    </div>
                </div>
                <p class="status-text">Analisis data rekonsiliasi sedang berjalan...</p>
            </div>

            <!-- Footer Slot -->
            <div class="form-footer" v-if="!isProcessing">
                <slot name="footer">
                    <div class="default-footer">
                        <div class="footer-info">
                            <i class="pi pi-info-circle"></i>
                            <span>Pastikan data yang dipilih sudah sesuai sebelum memproses</span>
                        </div>
                    </div>
                </slot>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "RekonFormComponent",
    props: {
        errors: {
            type: Object,
            default: () => ({})
        },
        isProcessing: {
            type: Boolean,
            default: false
        },
        formData: {
            type: Object,
            default: () => ({
                cab: null,
                periode: null
            })
        }
    },
    data() {
        return {
            cabangFocused: false,
            periodeFocused: false,
            calendarOpen: false,
            cabangDisplayValue: 'Cabang Terpilih',
            periodeDisplayValue: 'Periode Terpilih'
        }
    },
    computed: {
        hasCabangValue() {
            return !!this.formData.cab;
        },
        hasPeriodeValue() {
            return !!this.formData.periode;
        },
        isFormValid() {
            return this.hasCabangValue && this.hasPeriodeValue;
        }
    },
    methods: {
        submitForm() {
            this.$emit("submit");
        },
        triggerCabangFocus() {
            this.cabangFocused = true;
            this.$emit('cab-focus');
        },
        triggerPeriodeFocus() {
            this.periodeFocused = true;
            this.$emit('periode-focus');
        },
        particleStyle(index) {
            const angle = (index / 6) * Math.PI * 2;
            const distance = 40;
            return {
                transform: `rotate(${angle}rad) translateY(${distance}px)`
            };
        },
        dataPointStyle(index) {
            const delay = index * 0.1;
            return {
                animationDelay: `${delay}s`
            };
        }
    }
};
</script>

<style scoped src="./RekonFormComponent.style.css"></style>
