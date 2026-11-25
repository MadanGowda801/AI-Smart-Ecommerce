-- Migration: Add image_key to products and configure Storage RLS for product images
-- Allows public reading of product-images bucket
-- Restricts product image uploads, replacements, and deletions to admin users only

-- 1. Add image_key column to public.products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_key TEXT;

-- 2. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS storage_product_images_select ON storage.objects;
DROP POLICY IF EXISTS storage_product_images_insert ON storage.objects;
DROP POLICY IF EXISTS storage_product_images_update ON storage.objects;
DROP POLICY IF EXISTS storage_product_images_delete ON storage.objects;

-- 4. SELECT Policy: public and authenticated can read product images
CREATE POLICY storage_product_images_select ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (
    bucket = 'product-images'
    OR uploaded_by = (SELECT auth.jwt() ->> 'sub')
  );

-- 5. INSERT Policy: only admins can upload catalog images to product-images
CREATE POLICY storage_product_images_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    (bucket = 'product-images' AND public.is_admin((SELECT auth.uid())))
    OR (bucket != 'product-images' AND uploaded_by = (SELECT auth.jwt() ->> 'sub'))
  );

-- 6. UPDATE Policy: only admins can update objects in product-images
CREATE POLICY storage_product_images_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    (bucket = 'product-images' AND public.is_admin((SELECT auth.uid())))
    OR (bucket != 'product-images' AND uploaded_by = (SELECT auth.jwt() ->> 'sub'))
  )
  WITH CHECK (
    (bucket = 'product-images' AND public.is_admin((SELECT auth.uid())))
    OR (bucket != 'product-images' AND uploaded_by = (SELECT auth.jwt() ->> 'sub'))
  );

-- 7. DELETE Policy: only admins can delete objects from product-images
CREATE POLICY storage_product_images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    (bucket = 'product-images' AND public.is_admin((SELECT auth.uid())))
    OR (bucket != 'product-images' AND uploaded_by = (SELECT auth.jwt() ->> 'sub'))
  );

-- 8. Grants for roles on storage schema and objects table
GRANT USAGE ON SCHEMA storage TO authenticated, anon;
GRANT SELECT ON storage.objects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
