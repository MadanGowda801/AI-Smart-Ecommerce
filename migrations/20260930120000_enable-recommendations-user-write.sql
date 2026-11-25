-- ==============================================================================
-- Migration: 20260930120000_enable-recommendations-user-write.sql
-- Description: Allow authenticated users to manage their own recommendation records,
--              and enforce uniqueness on (user_id, product_id) for clean upserts.
-- ==============================================================================

-- 1. Recommendations Policies for Authenticated Users
DROP POLICY IF EXISTS "recommendations_insert_policy" ON public.recommendations;
CREATE POLICY "recommendations_insert_policy" ON public.recommendations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "recommendations_update_policy" ON public.recommendations;
CREATE POLICY "recommendations_update_policy" ON public.recommendations
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "recommendations_delete_policy" ON public.recommendations;
CREATE POLICY "recommendations_delete_policy" ON public.recommendations
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));

-- 2. Add Unique Constraint on (user_id, product_id) for safe upserts
ALTER TABLE public.recommendations
  DROP CONSTRAINT IF EXISTS recommendations_user_product_unique;

ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_user_product_unique UNIQUE (user_id, product_id);
