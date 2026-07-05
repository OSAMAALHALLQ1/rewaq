const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
};

export const compressImage = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      maxWidth = 1600,
      maxHeight = 1600,
      quality = 0.86,
      minQuality = 0.72,
      maxSizeKB = 450,
      outputType = 'image/webp',
      allowedTypes = DEFAULT_ALLOWED_TYPES
    } = options;

    if (!file || !allowedTypes.includes(file.type)) {
      reject(new Error('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;

      img.onload = () => {
        const canvas = document.createElement('canvas');

        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);

        if (ratio < 1) {
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        let currentQuality = quality;
        const compress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error('فشل الضغط')); return; }
              const sizeKB = blob.size / 1024;

              if (sizeKB > maxSizeKB && currentQuality > minQuality) {
                currentQuality = Math.max(minQuality, currentQuality - 0.04);
                compress(); // جرب مرة ثانية بجودة أقل
              } else {
                const extension = outputType === 'image/webp' ? '.webp' : '.jpg';
                const compressedFile = new File(
                  [blob],
                  file.name.replace(/\.[^.]+$/, extension),
                  { type: outputType }
                );
                resolve({
                  file: compressedFile,
                  originalSizeKB: Math.round(file.size / 1024),
                  compressedSizeKB: Math.round(sizeKB),
                  originalSizeLabel: formatBytes(file.size),
                  compressedSizeLabel: formatBytes(blob.size),
                  savedPercent: Math.max(0, Math.round((1 - blob.size / file.size) * 100)),
                  width,
                  height,
                  quality: Number(currentQuality.toFixed(2)),
                  type: outputType
                });
              }
            },
            outputType,
            currentQuality
          );
        };
        compress();
      };
      img.onerror = () => reject(new Error('صورة غير صالحة'));
    };
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
  });
};
