-- ==============================================================================
-- Migration: 20261002210000_notification-system.sql
-- Description: Extends the notifications table with link columns for deep-links
--              and adds a send_notification() SECURITY DEFINER function so
--              backend DB events (order status changes, payment events) can
--              safely insert notifications for any user without RLS conflicts.
--              Also adds a PostgreSQL trigger that fires a welcome notification
--              on every new user registration.
-- ==============================================================================

-- 1. Add deep-link columns (idempotent)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link_page   TEXT,
  ADD COLUMN IF NOT EXISTS link_params JSONB;

-- 2. Index for fast unread count per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- 3. SECURITY DEFINER helper so any backend function can create a notification
--    for any user without needing to satisfy the user_id = auth.uid() RLS check.
CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id    UUID,
  p_title      TEXT,
  p_message    TEXT,
  p_type       TEXT DEFAULT 'system',
  p_link_page  TEXT DEFAULT NULL,
  p_link_params JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, is_read, link_page, link_params)
  VALUES (p_user_id, p_title, p_message, p_type, false, p_link_page, p_link_params)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon;

-- 4. Trigger function: send welcome notification on new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, is_read, link_page)
  VALUES (
    NEW.id,
    'Welcome to SmartShop!',
    'Your account has been created successfully. Explore thousands of products and enjoy a seamless shopping experience.',
    'system',
    false,
    'products'
  );
  RETURN NEW;
END;
$$;

-- 5. Attach trigger to auth.users (fires after each new registration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_new_user_send_welcome'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_new_user_send_welcome
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user_notification();
  END IF;
END $$;
