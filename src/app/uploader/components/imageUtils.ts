/**
 * Utility to process, center-crop to 1:1 aspect ratio, and resize any image
 * to Spotify-grade balanced dimensions (640x640) with high perceptual quality.
 */
export async function processSquareImage(
  source: File | string,
  targetSize: number = 640,
  quality: number = 0.92
): Promise<{ file: File; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D context not available'));
        }

        // Enable highest quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Calculate balanced center-crop coordinates
        const { naturalWidth: w, naturalHeight: h } = img;
        let cropX = 0;
        let cropY = 0;
        let cropSize = Math.min(w, h);

        if (w > h) {
          cropX = (w - h) / 2;
          cropY = 0;
        } else if (h > w) {
          cropX = 0;
          cropY = (h - w) / 2;
        }

        // Draw cropped & resized square
        ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, targetSize, targetSize);

        // Export as crisp JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Failed to encode image blob'));
            }
            const processedFile = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
            resolve({ file: processedFile, dataUrl });
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for processing'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
}

