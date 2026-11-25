-- ==============================================================================
-- Migration: 20260924100414_fix-rls-select-policies.sql
-- Description: Refine notifications and user_activity select policies so
--              users see their own rows and admins see all rows.
-- ==============================================================================

-- 1. NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
CREATE POLICY "notifications_select_policy" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
CREATE POLICY "notifications_update_policy" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;
CREATE POLICY "notifications_delete_policy" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));

-- 2. USER_ACTIVITY
DROP POLICY IF EXISTS "user_activity_select_policy" ON public.user_activity;
CREATE POLICY "user_activity_select_policy" ON public.user_activity
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));
