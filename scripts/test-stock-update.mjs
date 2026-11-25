import { createClient } from '@insforge/sdk';

const BASE_URL = 'https://wheg6hgs.ap-southeast.insforge.app';
const ANON_KEY = 'anon_1f344ff00d148a22234c12c3f5616df77fc3c01286d1f4a3aac7fd0fab6649a9';

async function testStockUpdate() {
  const adminClient = createClient({ baseUrl: BASE_URL, anonKey: ANON_KEY });
  const { data: auth, error: authErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@smartshop.in',
    password: 'AdminPassword123!'
  });

  if (authErr) {
    console.error('Sign in failed:', authErr);
    return;
  }
  console.log('Signed in as admin:', auth.user.email);

  // Pick the Roborock product from user screenshot: d0000000-0000-0000-0000-000000000026
  const targetId = 'd0000000-0000-0000-0000-000000000026';
  const { data: prodBefore, error: getErr } = await adminClient.database
    .from('products')
    .select('id, name, stock, price, discount, image, image_url, image_key')
    .eq('id', targetId)
    .single();

  console.log('Product before:', prodBefore, 'Error:', getErr);

  // Test updating stock
  const newStock = (prodBefore.stock || 8) + 5;
  console.log(`Testing stock update to ${newStock}...`);
  const { data: updated, error: updateErr } = await adminClient.database
    .from('products')
    .update({ stock: newStock })
    .eq('id', targetId)
    .select();

  console.log('Update result:', updated, 'Error:', updateErr);

  // Reset back or keep
  console.log('Done!');
}

testStockUpdate().catch(console.error);
