-- ==============================================================================
-- Migration: 20261020_add-model-3d-url.sql
-- Description: Add optional model_3d_url column to products table for
--              browser-based 3D / WebAR viewing via Google model-viewer.
--              Backward-compatible: existing products without a 3D model
--              continue to show the existing 2D image gallery.
-- ==============================================================================

-- Add column (idempotent)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS model_3d_url TEXT DEFAULT NULL;

-- Constraint: if provided, must start with https:// (basic URL safety guard)
-- We do NOT enforce GLTF extension here because trusted CDN URLs may not
-- end in .glb — the frontend validates the URL before passing it to model-viewer.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_model_3d_url_https_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_model_3d_url_https_check
    CHECK (model_3d_url IS NULL OR model_3d_url LIKE 'https://%');

-- Partial index: only index rows that actually have a 3D model (sparse)
CREATE INDEX IF NOT EXISTS idx_products_has_model_3d
  ON public.products (id)
  WHERE model_3d_url IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.products.model_3d_url IS
  'Optional HTTPS URL to a GLB/GLTF 3D model for browser-based WebAR viewing via model-viewer. NULL = display existing 2D image gallery instead.';
