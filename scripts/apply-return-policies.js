import { execSync } from 'node:child_process';

const statements = [
  'CREATE INDEX IF NOT EXISTS idx_return_requests_order ON public.return_requests(order_id);',
  'CREATE INDEX IF NOT EXISTS idx_return_requests_user ON public.return_requests(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_return_requests_status ON public.return_requests(status);',
  'ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;',
  'DROP POLICY IF EXISTS "Users can view their own return requests" ON public.return_requests;',
  'CREATE POLICY "Users can view their own return requests" ON public.return_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);',
  'DROP POLICY IF EXISTS "Users can submit return requests" ON public.return_requests;',
  'CREATE POLICY "Users can submit return requests" ON public.return_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);',
  'DROP POLICY IF EXISTS "Admins can manage all return requests" ON public.return_requests;',
  `CREATE POLICY "Admins can manage all return requests" ON public.return_requests FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));`
];

for (const stmt of statements) {
  try {
    console.log('Running:', stmt.slice(0, 50) + '...');
    const out = execSync(`npx -y @insforge/cli db query "${stmt.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      shell: 'cmd.exe'
    });
    console.log(' -> OK');
  } catch (err) {
    console.error(' -> Error:', err.message);
  }
}

console.log('Done applying return_requests indexes and RLS policies.');
