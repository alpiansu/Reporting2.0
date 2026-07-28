/**
 * Konstanta untuk analyzer ACOST change
 *
 * FLOAT_EPSILON: toleransi pembulatan desimal SAJA (Rp10),
 * bukan filter materialitas. Item yang di-live-check sudah
 * dipilih user karena SESUAI-nya besar — analyzer tidak boleh
 * menyaring lagi seberapa besar gap harganya.
 */
export const FLOAT_EPSILON = 0.01;
