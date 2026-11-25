import insforge from './insforge.js';

export const BUCKET_NAME = 'product-images';
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
];
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

/**
 * Validate product image file type and size.
 * Prevents non-images and oversized files before upload.
 * 
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateProductImage(file) {
  if (!file) {
    return { valid: false, error: 'No image file provided.' };
  }

  // Size validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image size (${sizeMb} MB) exceeds maximum allowed size of 5 MB.`
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'Image file is empty.' };
  }

  // MIME type validation
  const mimeType = (file.type || '').toLowerCase();
  const fileName = (file.name || '').toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!ALLOWED_MIME_TYPES.includes(mimeType) && !hasValidExt) {
    return {
      valid: false,
      error: `Invalid file format (${mimeType || 'unknown'}). Please upload a JPEG, PNG, WebP, GIF, or AVIF image.`
    };
  }

  return { valid: true };
}

/**
 * Upload a product image to InsForge Storage (`product-images` bucket).
 * Stores only file references (URL & key) - never saves raw binary in the database.
 * 
 * @param {File} file - Browser File object
 * @param {Object} options - Optional parameters
 * @returns {Promise<{ url: string, key: string }>}
 */
export async function uploadProductImage(file, options = {}) {
  const validation = validateProductImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Create clean, unique file path key: products/<timestamp>-<rand>-<clean-name>
  const cleanName = (file.name || 'product.jpg')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 60);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const key = `products/${Date.now()}-${randomSuffix}-${cleanName}`;

  const { data, error } = await insforge.storage
    .from(BUCKET_NAME)
    .upload(key, file);

  if (error) {
    console.error('[storageService.uploadProductImage] Storage upload failed:', error);
    throw new Error(error.message || 'Failed to upload product image to InsForge Storage.');
  }

  // Resolve public URL
  let publicUrl = data?.url;
  if (!publicUrl) {
    const { data: urlData } = insforge.storage.from(BUCKET_NAME).getPublicUrl(key);
    publicUrl = urlData?.publicUrl;
  }

  return {
    url: publicUrl,
    key: data?.key || key
  };
}

/**
 * Delete a product image from InsForge Storage by its key.
 * Used for cleaning up unused images when products are removed or images replaced.
 * 
 * @param {string} key - Storage object key (e.g., 'products/172778...-item.jpg')
 * @returns {Promise<{ success: boolean, error?: any }>}
 */
export async function deleteProductImage(key) {
  if (!key || typeof key !== 'string') {
    return { success: true };
  }

  // Ignore external URLs (e.g. Unsplash sample URLs) that aren't stored in our bucket
  if (key.startsWith('http://') || key.startsWith('https://')) {
    // If it's a full InsForge URL, try to extract the key
    const marker = `/buckets/${BUCKET_NAME}/objects/`;
    const markerIdx = key.indexOf(marker);
    if (markerIdx !== -1) {
      key = decodeURIComponent(key.substring(markerIdx + marker.length));
    } else {
      // External CDN or unsplash - nothing to delete in InsForge storage
      return { success: true };
    }
  }

  try {
    const { error } = await insforge.storage.from(BUCKET_NAME).remove(key);
    if (error) {
      console.warn(`[storageService.deleteProductImage] Warning deleting ${key}:`, error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.warn(`[storageService.deleteProductImage] Exception deleting ${key}:`, err);
    return { success: false, error: err };
  }
}

/**
 * Replace an existing product image with a new one.
 * Uploads the new file first, then safely removes the old key if different.
 * 
 * @param {string|null} oldKey - Existing storage object key
 * @param {File} newFile - New file to upload
 * @returns {Promise<{ url: string, key: string }>}
 */
export async function replaceProductImage(oldKey, newFile) {
  // 1. Upload new image
  const result = await uploadProductImage(newFile);

  // 2. Delete old image if it existed and is different
  if (oldKey && oldKey !== result.key) {
    deleteProductImage(oldKey).catch((err) => {
      console.warn('[storageService.replaceProductImage] Failed to delete previous image:', err);
    });
  }

  return result;
}

export default {
  BUCKET_NAME,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  validateProductImage,
  uploadProductImage,
  deleteProductImage,
  replaceProductImage
};
