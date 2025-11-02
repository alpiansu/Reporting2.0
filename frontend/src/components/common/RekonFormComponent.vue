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

<style scoped>
.rekon-form-container {
    width: 100%;
    margin: 0;
    animation: slideInUp 0.6s ease-out;
    margin-bottom: 25px !important;
}

@keyframes slideInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.form-card {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 20px;
    padding: 2rem;
    box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.08),
        0 4px 16px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.form-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--primary-color, #0ea5e9), #38bdf8, #60a5fa, var(--primary-color, #0ea5e9));
    background-size: 200% 100%;
    animation: shimmer 3s ease-in-out infinite;
}

.form-card.processing::before {
    animation: processingShimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {

    0%,
    100% {
        background-position: -200% 0;
    }

    50% {
        background-position: 200% 0;
    }
}

@keyframes processingShimmer {

    0%,
    100% {
        background-position: -200% 0;
    }

    50% {
        background-position: 200% 0;
    }
}

/* Header Styles dengan Animasi */
.form-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(226, 232, 240, 0.6);
}

.header-icon {
    flex-shrink: 0;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, var(--primary-color, #0ea5e9), #38bdf8);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 8px 20px rgba(14, 165, 233, 0.3);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
}

.header-icon::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transform: rotate(45deg);
    transition: all 0.6s ease;
}

.header-icon:hover::before {
    animation: iconShine 1.5s ease-in-out;
}

.header-icon.pulse {
    animation: iconPulse 2s ease-in-out infinite;
}

@keyframes iconShine {
    0% {
        transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }

    100% {
        transform: translateX(100%) translateY(100%) rotate(45deg);
    }
}

@keyframes iconPulse {

    0%,
    100% {
        transform: scale(1);
        box-shadow: 0 8px 20px rgba(14, 165, 233, 0.3);
    }

    50% {
        transform: scale(1.05);
        box-shadow: 0 12px 30px rgba(14, 165, 233, 0.5);
    }
}

.default-icon i {
    font-size: 1.75rem;
}

.header-content {
    flex: 1;
}

.form-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
    line-height: 1.3;
    background: linear-gradient(135deg, #1e293b, #475569);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    transition: all 0.4s ease;
}

.form-description {
    font-size: 1rem;
    color: #64748b;
    margin: 0;
    line-height: 1.5;
    transition: all 0.4s ease;
}

/* Form Row Layout */
.rekon-form {
    width: 100%;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 1.5rem;
    align-items: end;
    margin-bottom: 1.5rem;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.form-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
}

.required-asterisk {
    color: #ef4444;
    font-weight: 700;
}

/* Input Container dengan Animasi */
.input-container {
    position: relative;
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 0.75rem 1rem;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
}

.input-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(14, 165, 233, 0.05), transparent);
    transition: left 0.6s ease;
}

.input-container:hover::before {
    left: 100%;
}

.input-container.focused {
    border-color: var(--primary-color, #0ea5e9);
    box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1);
    transform: translateY(-2px);
}

.input-container.has-value {
    border-color: #10b981;
    background: linear-gradient(135deg, #ffffff, #f0fdf4);
}

.input-container.calendar-open {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
}

.input-ripple {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(14, 165, 233, 0.3);
    transform: translate(-50%, -50%);
    animation: ripple 0.6s ease-out;
}

@keyframes ripple {
    to {
        width: 100%;
        height: 100%;
        opacity: 0;
    }
}

/* Calendar Animation */
.calendar-animation {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    overflow: hidden;
}

.calendar-particles {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.particle {
    position: absolute;
    width: 4px;
    height: 4px;
    background: var(--primary-color, #0ea5e9);
    border-radius: 50%;
    animation: particleFloat 1.5s ease-in-out infinite;
}

@keyframes particleFloat {

    0%,
    100% {
        transform: rotate(var(--angle)) translateY(40px) scale(1);
        opacity: 0;
    }

    50% {
        transform: rotate(var(--angle)) translateY(20px) scale(1.5);
        opacity: 1;
    }
}

.default-slot-placeholder {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #64748b;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
}

.default-slot-placeholder i {
    color: #94a3b8;
    font-size: 1rem;
    transition: all 0.3s ease;
}

.input-container.focused .default-slot-placeholder i {
    color: var(--primary-color, #0ea5e9);
}

.selected-value {
    color: #1e293b;
    font-weight: 500;
}

.error-text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #ef4444;
    font-size: 0.8rem;
    font-weight: 500;
    margin-top: 0.25rem;
    animation: shake 0.5s ease-in-out;
}

/* Submit Button dengan Animasi Mind Blowing */
.actions-container {
    display: flex;
    align-items: center;
    height: 100%;
}

.submit-button {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: linear-gradient(135deg, var(--primary-color, #0ea5e9), #0384c7);
    color: white;
    border: none;
    padding: 1rem 1.5rem;
    border-radius: 14px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 25px rgba(14, 165, 233, 0.3);
    min-width: 180px;
    overflow: hidden;
}

.submit-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.6s ease;
}

.submit-button:hover:not(:disabled)::before {
    left: 100%;
}

.submit-button:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 12px 35px rgba(14, 165, 233, 0.4);
}

.submit-button:active {
    transform: translateY(-1px) scale(1.01);
}

.submit-button.pulse-glow {
    animation: buttonPulse 2s ease-in-out infinite;
}

@keyframes buttonPulse {

    0%,
    100% {
        box-shadow: 0 8px 25px rgba(14, 165, 233, 0.3);
    }

    50% {
        box-shadow: 0 8px 30px rgba(14, 165, 233, 0.6), 0 0 20px rgba(14, 165, 233, 0.4);
    }
}

.submit-button.processing {
    background: linear-gradient(135deg, #10b981, #34d399);
    transform: scale(0.98);
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.button-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: relative;
    z-index: 2;
}

.button-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
}

.button-icon i {
    font-size: 1rem;
}

.button-text {
    font-weight: 600;
}

.button-shine {
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transform: rotate(45deg);
    animation: buttonShine 3s ease-in-out infinite;
}

@keyframes buttonShine {
    0% {
        transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }

    100% {
        transform: translateX(100%) translateY(100%) rotate(45deg);
    }
}

.progress-wave {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
    animation: progressWave 1.5s ease-in-out infinite;
}

@keyframes progressWave {
    0% {
        transform: translateX(-100%);
    }

    100% {
        transform: translateX(100%);
    }
}

.submit-button:disabled {
    background: linear-gradient(135deg, #9ca3af, #6b7280);
    transform: none;
    box-shadow: 0 4px 12px rgba(156, 163, 175, 0.2);
    cursor: not-allowed;
}

.submit-button:disabled::before,
.submit-button:disabled .button-shine {
    display: none;
}

/* Status Indicator */
.status-indicator {
    margin-top: 2rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
    border-radius: 16px;
    border: 1px solid rgba(14, 165, 233, 0.2);
    animation: statusSlideIn 0.6s ease-out;
}

@keyframes statusSlideIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.processing-animation {
    position: relative;
    height: 60px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 1rem;
}

.scan-line {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--primary-color, #0ea5e9), transparent);
    animation: scan 2s ease-in-out infinite;
}

@keyframes scan {
    0% {
        top: 0;
    }

    100% {
        top: 100%;
    }
}

.data-points {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

.data-point {
    position: absolute;
    width: 6px;
    height: 6px;
    background: var(--primary-color, #0ea5e9);
    border-radius: 50%;
    animation: dataPointPulse 1.5s ease-in-out infinite;
}

.data-point:nth-child(1) {
    top: 20%;
    left: 10%;
}

.data-point:nth-child(2) {
    top: 40%;
    left: 25%;
}

.data-point:nth-child(3) {
    top: 60%;
    left: 40%;
}

.data-point:nth-child(4) {
    top: 30%;
    left: 55%;
}

.data-point:nth-child(5) {
    top: 70%;
    left: 70%;
}

.data-point:nth-child(6) {
    top: 50%;
    left: 85%;
}

.data-point:nth-child(7) {
    top: 80%;
    left: 30%;
}

.data-point:nth-child(8) {
    top: 10%;
    left: 65%;
}

@keyframes dataPointPulse {

    0%,
    100% {
        transform: scale(1);
        opacity: 0.7;
    }

    50% {
        transform: scale(1.5);
        opacity: 1;
    }
}

.status-text {
    text-align: center;
    color: #0ea5e9;
    font-weight: 500;
    margin: 0;
    font-size: 0.9rem;
}

/* Footer Styles */
.form-footer {
    margin-top: 1.5rem;
    padding-top: 1rem;
}

.default-footer {
    display: flex;
    align-items: center;
    justify-content: center;
}

.footer-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(241, 245, 249, 0.7);
    border-radius: 8px;
    color: #64748b;
    font-size: 0.8rem;
    border: 1px solid rgba(226, 232, 240, 0.5);
}

.footer-info i {
    color: #0ea5e9;
    font-size: 0.9rem;
}

/* Responsive Design */
@media (max-width: 1024px) {
    .form-row {
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
    }

    .form-group-actions {
        grid-column: span 2;
        justify-self: center;
    }
}

@media (max-width: 768px) {
    .rekon-form-container {
        margin: 0;
    }

    .form-card {
        padding: 1.5rem;
        border-radius: 16px;
    }

    .form-header {
        flex-direction: column;
        text-align: center;
        gap: 1rem;
    }

    .header-icon {
        align-self: center;
    }

    .form-title {
        font-size: 1.25rem;
    }

    .form-description {
        font-size: 0.9rem;
    }

    .form-row {
        grid-template-columns: 1fr;
        gap: 1.25rem;
    }

    .form-group-actions {
        grid-column: span 1;
    }

    .submit-button {
        width: 100%;
        min-width: auto;
        justify-content: center;
    }
}

@media (max-width: 480px) {
    .form-card {
        padding: 1.25rem;
        margin: 0;
    }

    .form-title {
        font-size: 1.125rem;
    }

    .form-description {
        font-size: 0.85rem;
    }

    .submit-button {
        padding: 0.875rem 1.25rem;
    }
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
    .form-card {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-color: rgba(255, 255, 255, 0.1);
    }

    .form-title {
        background: linear-gradient(135deg, #f1f5f9, #cbd5e1);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .form-description {
        color: #94a3b8;
    }

    .form-label,
    .label-text {
        color: #e2e8f0;
    }

    .input-container {
        background: #334155;
        border-color: #475569;
    }

    .default-slot-placeholder {
        color: #cbd5e1;
    }

    .selected-value {
        color: #f1f5f9;
    }

    .status-indicator {
        background: linear-gradient(135deg, #1e3a5f, #1e40af);
        border-color: rgba(14, 165, 233, 0.3);
    }

    .processing-animation {
        background: rgba(30, 41, 59, 0.5);
    }
}

/* Print Styles */
@media print {
    .form-card {
        box-shadow: none;
        border: 1px solid #ddd;
        background: white;
    }

    .submit-button,
    .status-indicator {
        display: none;
    }
}
</style>