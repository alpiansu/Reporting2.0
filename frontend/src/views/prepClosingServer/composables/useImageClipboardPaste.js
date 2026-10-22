import { ref, watch, onMounted, onUnmounted } from 'vue';

/**
 * Helper to generate a clean timestamped filename for clipboard blobs.
 * @param {Blob} blob 
 * @param {string} [prefix='capture']
 * @returns {File}
 */
export function createFileFromBlob(blob, prefix = 'capture') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  
  let ext = 'png';
  if (blob.type === 'image/jpeg') ext = 'jpg';
  else if (blob.type === 'image/webp') ext = 'webp';
  else if (blob.type === 'image/gif') ext = 'gif';

  const filename = `${prefix}-${timestamp}.${ext}`;
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

/**
 * Composable for capturing images from OS clipboard (Ctrl+V), drag-and-drop, or button click.
 *
 * @param {Object} options
 * @param {import('vue').Ref<boolean> | Function} [options.isActive] - Ref or getter returning boolean if paste listener should be active
 * @param {Function} [options.onImageCaptured] - Callback (file: File, previewUrl: string) => void
 * @param {Object} [options.toast] - Optional PrimeVue Toast instance for user feedback
 * @param {string} [options.filePrefix='capture'] - Prefix for generated file name
 */
export function useImageClipboardPaste(options = {}) {
  const {
    isActive,
    onImageCaptured,
    toast,
    filePrefix = 'capture',
  } = options;

  const isDragging = ref(false);
  const previewUrl = ref('');
  const currentFile = ref(null);

  function revokePreview() {
    if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl.value);
    }
  }

  function setFile(file) {
    if (!file) return;
    revokePreview();
    currentFile.value = file;
    previewUrl.value = URL.createObjectURL(file);

    if (onImageCaptured) {
      onImageCaptured(file, previewUrl.value);
    }
  }

  function reset() {
    revokePreview();
    previewUrl.value = '';
    currentFile.value = null;
    isDragging.value = false;
  }

  // ─── Clipboard Paste Event (Ctrl + V) ────────────────────────────────────────
  function handlePaste(e) {
    const active = typeof isActive === 'function' ? isActive() : isActive?.value;
    // If an activity ref is provided and is currently false, do not intercept
    if (active === false) return;

    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type && item.type.indexOf('image') !== -1) {
        // Prevent pasting binary raw text/characters into active inputs
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const file = createFileFromBlob(blob, filePrefix);
          setFile(file);
          if (toast) {
            toast.add({
              severity: 'info',
              summary: 'Screenshot Ditempel',
              detail: `Gambar ${file.name} berhasil diambil dari clipboard.`,
              life: 3000,
            });
          }
        }
        break;
      }
    }
  }

  // ─── Button Click: Paste from System Clipboard ─────────────────────────────
  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard?.read) {
        if (toast) {
          toast.add({
            severity: 'warn',
            summary: 'Gunakan Ctrl + V',
            detail: 'Browser membatasi akses tombol clipboard. Silakan tekan shortcut Ctrl + V pada keyboard.',
            life: 3500,
          });
        }
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      let found = false;

      for (const clipboardItem of clipboardItems) {
        const imageType = clipboardItem.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await clipboardItem.getType(imageType);
          const file = createFileFromBlob(blob, filePrefix);
          setFile(file);
          found = true;
          if (toast) {
            toast.add({
              severity: 'info',
              summary: 'Screenshot Ditempel',
              detail: `Gambar ${file.name} berhasil diambil dari clipboard.`,
              life: 3000,
            });
          }
          break;
        }
      }

      if (!found && toast) {
        toast.add({
          severity: 'warn',
          summary: 'Clipboard Kosong',
          detail: 'Tidak ada gambar di clipboard. Silakan lakukan screenshot (Win + Shift + S) terlebih dahulu.',
          life: 3500,
        });
      }
    } catch (err) {
      if (toast) {
        toast.add({
          severity: 'info',
          summary: 'Tekan Ctrl + V',
          detail: 'Izin clipboard dibatasi browser. Silakan langsung tekan shortcut Ctrl + V pada keyboard.',
          life: 4000,
        });
      }
    }
  }

  // ─── Drag and Drop Handlers ────────────────────────────────────────────────
  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    isDragging.value = true;
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    isDragging.value = false;
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    isDragging.value = false;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type && files[i].type.startsWith('image/')) {
          setFile(files[i]);
          if (toast) {
            toast.add({
              severity: 'info',
              summary: 'Gambar Dimuat',
              detail: `File ${files[i].name} siap di-upload.`,
              life: 3000,
            });
          }
          break;
        }
      }
    }
  }

  // ─── Listener Lifecycle ────────────────────────────────────────────────────
  if (isActive !== undefined) {
    watch(
      () => (typeof isActive === 'function' ? isActive() : isActive.value),
      (val) => {
        if (val) {
          window.addEventListener('paste', handlePaste);
        } else {
          window.removeEventListener('paste', handlePaste);
          reset();
        }
      },
      { immediate: true }
    );
  } else {
    onMounted(() => {
      window.addEventListener('paste', handlePaste);
    });
  }

  onUnmounted(() => {
    window.removeEventListener('paste', handlePaste);
    reset();
  });

  return {
    isDragging,
    previewUrl,
    currentFile,
    setFile,
    reset,
    pasteFromClipboard,
    onDragOver,
    onDragLeave,
    onDrop,
    handlePaste,
  };
}
