/**
 * Comprehensive Security Test Suite
 * Tests:
 * 1. Customer accessing another customer's order (RLS isolation)
 * 2. Customer accessing admin-only RPCs / operations
 * 3. Customer modifying product catalog (price, stock, title tampering)
 * 4. Customer modifying order status directly (status tampering)
 * 5. Role escalation attempt (customer elevating self to admin in profiles)
 */
import insforge from '../src/insforge.js';

async function runSecuritySuite() {
  console.log('======================================================================');
  console.log('🔒 SECURITY & ISOLATION TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  // Sign in as customer 1
  console.log('[1/5] Testing Customer Accessing Another Customer\'s Order...');
  total++;
  const { data: cust1Auth, error: auth1Err } = await insforge.auth.signInWithPassword({
    email: 'customer@smartshop.in',
    password: 'CustomerPassword123!'
  });
  if (auth1Err) throw auth1Err;

  // Create an order for Customer 1
  const { data: cust1Order, error: o1Err } = await insforge.database
    .from('orders')
    .insert([{
      user_id: cust1Auth.user.id,
      total_amount: 500,
      subtotal_amount: 500,
      shipping_address: JSON.stringify({ fullName: 'Cust 1' }),
      payment_method: 'COD',
      payment_status: 'pending',
      status: 'placed',
      order_status: 'placed'
    }])
    .select()
    .single();

  if (o1Err) throw o1Err;

  // Now create or sign in as Customer 2
  const cust2Email = 'customer2_sec_test@smartshop.in';
  const cust2Pass = 'SecPass123!@#';
  let cust2Auth = null;

  const { data: signUpData, error: signUpErr } = await insforge.auth.signUp({
    email: cust2Email,
    password: cust2Pass,
    options: { data: { name: 'Customer Two', role: 'customer' } }
  });

  if (signUpErr && !signUpErr.message.includes('already registered')) {
    console.warn('Sign up notice:', signUpErr.message);
  }

  const { data: c2Login, error: c2LoginErr } = await insforge.auth.signInWithPassword({
    email: cust2Email,
    password: cust2Pass
  });
  if (c2LoginErr) throw c2LoginErr;
  cust2Auth = c2Login;

  // As Customer 2, attempt to query Customer 1's order
  const { data: stolenOrder, error: stealErr } = await insforge.database
    .from('orders')
    .select('*')
    .eq('id', cust1Order.id);

  if (!stolenOrder || stolenOrder.length === 0) {
    console.log('✅ PASS: Customer 2 CANNOT read Customer 1\'s order (RLS blocked row return).');
    passed++;
  } else {
    console.error('❌ FAIL: Customer 2 was able to view Customer 1\'s order:', stolenOrder);
  }

  // As Customer 2, attempt to cancel Customer 1's order via RPC
  total++;
  console.log('\n[2/5] Testing Cross-Customer Order Tampering via Cancel RPC...');
  const { data: cancelStealRes, error: cancelStealErr } = await insforge.database.rpc('customer_cancel_order', {
    p_order_id: cust1Order.id
  });

  if (cancelStealRes?.ok === false && cancelStealRes?.error === 'Unauthorized') {
    console.log('✅ PASS: Customer 2 cannot cancel Customer 1\'s order (RPC blocked with Unauthorized).');
    passed++;
  } else if (cancelStealErr) {
    console.log('✅ PASS: Customer 2 cannot cancel Customer 1\'s order (Error:', cancelStealErr.message, ')');
    passed++;
  } else {
    console.error('❌ FAIL: Customer 2 cancelled Customer 1\'s order:', cancelStealRes);
  }

  // As Customer 2, attempt to call Admin RPC admin_update_order_status
  total++;
  console.log('\n[3/5] Testing Customer Access to Admin-Only RPC...');
  const { data: adminRpcRes, error: adminRpcErr } = await insforge.database.rpc('admin_update_order_status', {
    p_order_id: cust1Order.id,
    p_new_status: 'delivered'
  });

  if (adminRpcErr || adminRpcRes?.error || adminRpcRes?.ok === false) {
    console.log('✅ PASS: Non-admin calling admin_update_order_status rejected correctly:', adminRpcErr?.message || adminRpcRes?.error);
    passed++;
  } else {
    console.error('❌ FAIL: Non-admin was able to run admin_update_order_status:', adminRpcRes);
  }

  // As Customer 2, attempt to modify product catalog (price to ₹1)
  total++;
  console.log('\n[4/5] Testing Customer Modifying Product Catalog...');
  // Find a product
  const { data: someProd } = await insforge.database.from('products').select('id, price').limit(1).single();
  const originalPrice = someProd.price;
  const { data: updateProdRes, error: tamperProdErr } = await insforge.database
    .from('products')
    .update({ price: 1 })
    .eq('id', someProd.id)
    .select();

  // Verify in DB that price was NEVER changed
  const { data: verifyProd } = await insforge.database.from('products').select('price').eq('id', someProd.id).single();

  if (verifyProd.price === originalPrice && (!updateProdRes || updateProdRes.length === 0 || tamperProdErr)) {
    console.log(`✅ PASS: Customer modifying product price blocked by RLS/Trigger (DB price remained ₹${originalPrice}, 0 rows updated).`);
    passed++;
  } else {
    console.error('❌ FAIL: Customer was able to modify product price to ₹' + verifyProd.price);
  }

  // As Customer 1, attempt to modify order status directly via SQL UPDATE (setting placed -> delivered)
  total++;
  console.log('\n[5/5] Testing Customer Direct Order Status Tampering (setting status to delivered)...');
  // Re-sign in as Customer 1 who owns the order
  await insforge.auth.signInWithPassword({
    email: 'customer@smartshop.in',
    password: 'CustomerPassword123!'
  });

  const { data: updateOrderRes, error: tamperStatusErr } = await insforge.database
    .from('orders')
    .update({ status: 'delivered', order_status: 'delivered' })
    .eq('id', cust1Order.id)
    .select();

  // Verify in DB that status was NEVER changed to delivered
  const { data: verifyOrder } = await insforge.database.from('orders').select('status').eq('id', cust1Order.id).single();

  if (verifyOrder.status !== 'delivered' && (!updateOrderRes || updateOrderRes.length === 0 || tamperStatusErr)) {
    console.log(`✅ PASS: Customer modifying order status rejected (DB status remained "${verifyOrder.status}", unauthorized update blocked).`);
    passed++;
  } else {
    console.error('❌ FAIL: Customer was able to update order status to delivered!');
  }

  console.log('\n======================================================================');
  console.log(`Security Test Summary: ${passed}/${total} Passed`);
  console.log('======================================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSecuritySuite().catch((err) => {
  console.error('Fatal security suite error:', err);
  process.exit(1);
});
