/**
 * High-performance client-side image compression utility.
 * Downscales images to max dimensions and re-compresses to reduce upload time & Cloudinary storage.
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.85
): Promise<File> {
  // If not an image or is SVG, return original
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  // If already under 800 KB, no heavy compression needed
  if (file.size <= 800 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Determine output mime type (prefer original or image/jpeg)
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compressed size is somehow larger or null, keep original
              resolve(file);
            } else {
              const compressedFile = new File([blob], file.name, {
                type: mimeType,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function compressImages(
  files: File[],
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.85
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, maxWidth, maxHeight, quality)));
}
