// src/pages/PrepClosing/composables/useScreening.js

import { ref } from "vue";
import prepClosingApi from "@/services/prepClosing.service.js";

export function useScreening() {
  const isScreening = ref(false);
  const screeningResult = ref(null);
  const screeningError = ref(null);

  const screenStore = async (periode, kdtk) => {
    try {
      isScreening.value = true;
      screeningError.value = null;

      const result = await prepClosingApi.screenStore(periode, kdtk);
      screeningResult.value = result;

      return screeningResult.value;
    } catch (err) {
      screeningError.value = err.response?.data?.message || "Gagal melakukan screening toko";
      console.error("Error screening store:", err);
      throw err;
    } finally {
      isScreening.value = false;
    }
  };

  const screenCabang = async (periode, cabang) => {
    try {
      isScreening.value = true;
      screeningError.value = null;
      screeningResult.value = await prepClosingApi.screenCabang(periode, cabang);
      return screeningResult.value;
    } catch (err) {
      screeningError.value = err.response?.data?.message || "Gagal melakukan screening cabang";
      console.error("Error screening cabang:", err);
      throw err;
    } finally {
      isScreening.value = false;
    }
  };

  const screenAllCabang = async periode => {
    try {
      isScreening.value = true;
      screeningError.value = null;
      screeningResult.value = await prepClosingApi.screenAllCabang(periode);
      return screeningResult.value;
    } catch (err) {
      screeningError.value = err.response?.data?.message || "Gagal melakukan screening semua cabang";
      console.error("Error screening all cabang:", err);
      throw err;
    } finally {
      isScreening.value = false;
    }
  };

  const resetScreening = () => {
    isScreening.value = false;
    screeningResult.value = null;
    screeningError.value = null;
  };

  return {
    isScreening,
    screeningResult,
    screeningError,
    screenStore,
    screenCabang,
    screenAllCabang,
    resetScreening,
  };
}
