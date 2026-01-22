export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

const resolve1080pBounds = (width: number, height: number) => {
  if (width >= height) {
    return { maxWidth: 1920, maxHeight: 1080 };
  }
  return { maxWidth: 1080, maxHeight: 1920 };
};

export const compressDataUrl = async (
  dataUrl: string,
  quality = 0.85
): Promise<{ base64: string; mimeType: string; dataUrl: string } | null> => {
  if (!dataUrl || !dataUrl.includes('base64,')) return null;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      const { maxWidth, maxHeight } = resolve1080pBounds(width, height);

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Fill white background for transparency handling (safe for JPEGs)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = 'image/jpeg';
      const outputUrl = canvas.toDataURL(mimeType, quality);
      const base64 = outputUrl.split(',')[1];
      resolve({ base64, mimeType, dataUrl: outputUrl });
    };
    img.onerror = (err) => reject(err);
  });
};

export const compressImage = async (file: File): Promise<{ base64: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as string;
        const compressed = await compressDataUrl(result);
        if (!compressed) {
          reject(new Error('Invalid image data'));
          return;
        }
        resolve({ base64: compressed.base64, mimeType: compressed.mimeType });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
  });
};

export const generateId = () => {
  return Math.random().toString(36).substring(2, 15);
};
