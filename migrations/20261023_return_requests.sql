-- ==============================================================================
-- Migration: 20261023_return_requests.sql
-- Description: Create return_requests table with RLS policies, audit tracking,
--              status constraints, and AI defect detection metadata.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  defect_type TEXT DEFAULT 'damaged_in_transit',
  evidence_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'ai_reviewed', 'approved', 'rejected', 'completed')),
  ai_analysis JSONB DEFAULT NULL,
  admin_notes TEXT DEFAULT NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backward-compatible column additions if table already exists
ALTER TABLE public.return_requests ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;
ALTER TABLE public.return_requests DROP CONSTRAINT IF EXISTS return_requests_status_check;
ALTER TABLE public.return_requests ADD CONSTRAINT return_requests_status_check
  CHECK (status IN ('pending', 'under_review', 'ai_reviewed', 'approved', 'rejected', 'completed'));

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_return_requests_order ON public.return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_user ON public.return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON public.return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_created ON public.return_requests(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

-- Drop old policies if any for idempotency
DROP POLICY IF EXISTS "Users can view their own return requests" ON public.return_requests;
DROP POLICY IF EXISTS "Users can submit return requests" ON public.return_requests;
DROP POLICY IF EXISTS "Admins can manage all return requests" ON public.return_requests;

-- 1. Customers can view their own return requests
CREATE POLICY "Users can view their own return requests"
  ON public.return_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Customers can create return requests for their own orders
CREATE POLICY "Users can submit return requests"
  ON public.return_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Authorized staff / administrators can view and manage all return requests
CREATE POLICY "Admins can manage all return requests"
  ON public.return_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE public.return_requests IS 'Customer return requests linked to orders, order items, uploaded private evidence photos, AI defect detection advisory score, and human admin reviews.';
