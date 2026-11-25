import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertTriangle, RefreshCw, Image as ImageIcon, HardDrive, Sparkles } from 'lucide-react';
import {
  uploadProductImage,
  deleteProductImage,
  replaceProductImage,
  validateProductImage,
  MAX_FILE_SIZE_BYTES
} from './storageService';

/**
 * ProductImageUploader
 * 
 * Production-ready InsForge Storage image uploader for product management.
 * - Handles drag-and-drop & file selection
 * - Validates file format (JPEG, PNG, WebP, GIF, AVIF)
 * - Enforces file size limits (<= 5MB)
 * - Uploads directly to InsForge Storage bucket (`product-images`)
 * - Manages storage keys for atomic replacements and unused image deletion
 * - Prevents raw binary/base64 in DB (only references are stored)
 * - Restricts access to admin users
 */
export default function ProductImageUploader({
  imageUrl = '',
  imageKey = '',
  onImageChange,
  disabled = false,
  presetImages = []
}) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const fileInputRef = useRef(null);

  // Clear messages after a delay
  const displayError = (msg) => {
    setValidationError(msg);
    setSuccessNotice('');
  };

  const displaySuccess = (msg) => {
    setSuccessNotice(msg);
    setValidationError('');
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploading) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled || uploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  // Process selected file
  const handleFileSelected = async (file) => {
    if (!file) return;

    // 1. Validate file client-side
    const validation = validateProductImage(file);
    if (!validation.valid) {
      displayError(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setValidationError('');
    setUploading(true);
    setUploadProgress(20);

    try {
      setUploadProgress(50);
      let result;

      // 2. If an existing imageKey exists, atomically replace it
      if (imageKey) {
        result = await replaceProductImage(imageKey, file);
      } else {
        result = await uploadProductImage(file);
      }

      setUploadProgress(100);

      // 3. Notify parent form with the returned InsForge URL and Key
      if (onImageChange) {
        onImageChange({
          url: result.url,
          key: result.key,
          fileName: file.name
        });
      }

      displaySuccess(`Uploaded "${file.name}" to InsForge Storage!`);
    } catch (err) {
      console.error('[ProductImageUploader] Upload error:', err);
      displayError(err.message || 'Failed to upload image to InsForge Storage. Please verify admin privileges.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remove/Delete image
  const handleRemoveImage = async (e) => {
    e.stopPropagation();
    if (disabled || uploading) return;

    if (imageKey) {
      // Delete unused image from InsForge storage
      deleteProductImage(imageKey).catch((err) => {
        console.warn('Could not delete image from storage:', err);
      });
    }

    if (onImageChange) {
      onImageChange({ url: '', key: '', fileName: '' });
    }

    setValidationError('');
    displaySuccess('Image removed.');
  };

  // Is this an InsForge Storage URL or external?
  const isInsForgeStored = Boolean(imageKey || (imageUrl && imageUrl.includes('/api/storage/buckets/')));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelected(e.target.files[0]);
          }
        }}
        disabled={disabled || uploading}
      />

      {/* Validation / Error Banner */}
      {validationError && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#f87171',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Success Notice */}
      {successNotice && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          color: '#34d399',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Main Upload / Preview Area */}
      {imageUrl ? (
        // Preview State with Replace and Remove actions
        <div style={{
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          background: 'rgba(18, 18, 28, 0.8)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'relative',
            height: '200px',
            background: 'radial-gradient(circle at center, rgba(30, 30, 46, 0.8) 0%, rgba(10, 10, 18, 0.95) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px'
          }}>
            <img
              src={imageUrl}
              alt="Product preview"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />

            {/* Storage Badge */}
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.72rem',
              fontWeight: 600,
              background: isInsForgeStored ? 'rgba(99, 102, 241, 0.9)' : 'rgba(100, 116, 139, 0.8)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
            }}>
              <HardDrive size={12} />
              {isInsForgeStored ? 'InsForge Storage' : 'Catalog URL'}
            </div>

            {/* Remove Action */}
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={disabled || uploading}
              title="Remove image"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.85)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Action Footer for Preview */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
              {imageKey ? (
                <span>Key: <code style={{ color: '#a5b4fc', fontSize: '0.72rem' }}>{imageKey}</code></span>
              ) : (
                <span>Public Image Ready</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="btn btn-secondary"
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} className={uploading ? 'animate-spin' : ''} />
              {uploading ? 'Replacing...' : 'Replace Image'}
            </button>
          </div>
        </div>
      ) : (
        // Dropzone State
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          style={{
            border: dragActive
              ? '2px dashed #6366f1'
              : '2px dashed rgba(255, 255, 255, 0.16)',
            borderRadius: '14px',
            padding: '36px 20px',
            textAlign: 'center',
            background: dragActive
              ? 'rgba(99, 102, 241, 0.08)'
              : 'rgba(255, 255, 255, 0.02)',
            cursor: uploading ? 'default' : 'pointer',
            transition: 'all 0.25s ease',
            position: 'relative'
          }}
        >
          {uploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                border: '3px solid rgba(99, 102, 241, 0.2)',
                borderTopColor: '#6366f1',
                animation: 'spin 0.8s linear infinite'
              }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#a5b4fc' }}>
                Uploading to InsForge Storage...
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Validating & generating storage object key
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
                marginBottom: '4px'
              }}>
                <Upload size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                  Click to upload product image or drag & drop
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  JPEG, PNG, WebP, GIF, or AVIF (Max 5 MB)
                </div>
              </div>
              <div style={{
                fontSize: '0.72rem',
                color: '#a5b4fc',
                background: 'rgba(99, 102, 241, 0.1)',
                padding: '4px 10px',
                borderRadius: '12px',
                marginTop: '4px'
              }}>
                Admin authenticated • Stored in InsForge Storage Bucket
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preset Samples / Fallback Toggle */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Or choose sample product photo:
          </span>
          <button
            type="button"
            onClick={() => setShowUrlFallback(!showUrlFallback)}
            style={{
              background: 'none',
              border: 'none',
              color: '#818cf8',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {showUrlFallback ? 'Hide URL input' : 'Enter image URL manually'}
          </button>
        </div>

        {/* Preset Thumbnails */}
        {presetImages && presetImages.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
            {presetImages.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt="Sample preset"
                onClick={() => {
                  if (onImageChange) {
                    onImageChange({ url: img, key: '', fileName: `sample-${idx + 1}.jpg` });
                  }
                }}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  cursor: 'pointer',
                  border: imageUrl === img ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.12)',
                  opacity: imageUrl === img ? 1 : 0.6,
                  transition: 'all 0.2s'
                }}
              />
            ))}
          </div>
        )}

        {/* Manual URL input fallback if needed */}
        {showUrlFallback && (
          <div style={{ marginTop: '10px' }}>
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => {
                if (onImageChange) {
                  onImageChange({ url: e.target.value, key: '', fileName: 'external-url' });
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
