/**
 * Comprehensive Admin Workflow Automated Test Suite
 * Covers:
 * 1. Admin Login
 * 2. Admin Dashboard KPIs
 * 3. Add Product
 * 4. Edit Product
 * 5. Update Inventory
 * 6. View Orders
 * 7. Update Order Status
 * 8. View Analytics
 * 9. Cleanup
 */
import insforge from '../src/insforge.js';
import { fetchDashboardKPIs } from '../src/adminAnalyticsService.js';
import { ordersService } from '../src/ordersService.js';

async function runAdminSuite() {
  console.log('======================================================================');
  console.log('🛠️ ADMIN WORKFLOW AUTOMATED TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  // 1. Admin Login
  total++;
  console.log('[1/8] Testing Admin Authentication...');
  const { data: auth, error: loginErr } = await insforge.auth.signInWithPassword({
    email: 'admin@smartshop.in',
    password: 'AdminPassword123!'
  });

  if (loginErr || !auth?.user) {
    console.error('❌ FAIL: Admin authentication failed:', loginErr);
    process.exit(1);
  }

  // Check admin role in profile
  const { data: profile } = await insforge.database
    .from('profiles')
    .select('role')
    .eq('user_id', auth.user.id)
    .single();

  if (profile?.role === 'admin') {
    console.log(`✅ PASS: Admin authenticated successfully (User ID: ${auth.user.id}, Role: admin)`);
    passed++;
  } else {
    console.error('❌ FAIL: User profile role is not admin:', profile);
  }

  // 2. Dashboard KPIs
  total++;
  console.log('\n[2/8] Testing Admin Dashboard KPIs...');
  const kpis = await fetchDashboardKPIs();
  if (kpis?.data && typeof kpis.data.totalProducts === 'number') {
    console.log(`✅ PASS: Dashboard KPIs loaded:`);
    console.log(`   - Total Products: ${kpis.data.totalProducts}`);
    console.log(`   - Total Orders: ${kpis.data.totalOrders}`);
    console.log(`   - Total Revenue: ₹${kpis.data.totalRevenue}`);
    console.log(`   - Low Stock Count: ${kpis.data.lowStockCount}`);
    console.log(`   - Pending Orders: ${kpis.data.pendingOrders}`);
    passed++;
  } else {
    console.error('❌ FAIL: Failed to load dashboard KPIs:', kpis);
  }

  // 3. Add Product
  total++;
  console.log('\n[3/8] Testing Add Product...');
  const testSlug = `admin-test-product-${Date.now()}`;
  const newProductPayload = {
    name: 'Admin Test Ultra Headphones',
    brand: 'TestBrand',
    price: 12999,
    discount: 10,
    stock: 25,
    description: 'High fidelity audio equipment added during automated admin testing.',
    slug: testSlug,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'
  };

  const { data: createdProd, error: createErr } = await insforge.database
    .from('products')
    .insert([newProductPayload])
    .select()
    .single();

  if (createErr || !createdProd) {
    console.error('❌ FAIL: Failed to add product:', createErr);
  } else {
    console.log(`✅ PASS: Product added successfully: ID ${createdProd.id} ("${createdProd.name}")`);
    passed++;
  }

  // 4. Edit Product
  total++;
  console.log('\n[4/8] Testing Edit Product...');
  const updatedName = 'Admin Test Ultra Headphones (Updated Edition)';
  const updatedPrice = 13999;
  const { data: updatedProd, error: updateErr } = await insforge.database
    .from('products')
    .update({
      name: updatedName,
      price: updatedPrice,
      description: 'Updated description for automated test.'
    })
    .eq('id', createdProd.id)
    .select()
    .single();

  if (updateErr || updatedProd.name !== updatedName || updatedProd.price !== updatedPrice) {
    console.error('❌ FAIL: Product edit failed:', updateErr || updatedProd);
  } else {
    console.log(`✅ PASS: Product edited successfully: Name "${updatedProd.name}", Price ₹${updatedProd.price}`);
    passed++;
  }

  // 5. Update Inventory
  total++;
  console.log('\n[5/8] Testing Update Inventory...');
  const newStockVal = 48;
  const { data: invProd, error: invErr } = await insforge.database
    .from('products')
    .update({ stock: newStockVal })
    .eq('id', createdProd.id)
    .select()
    .single();

  if (invErr || invProd.stock !== newStockVal) {
    console.error('❌ FAIL: Inventory update failed:', invErr || invProd);
  } else {
    console.log(`✅ PASS: Inventory updated successfully: Stock is now ${invProd.stock}`);
    passed++;
  }

  // 6. View Orders
  total++;
  console.log('\n[6/8] Testing View Orders...');
  const { data: adminOrders, count: ordersCount, error: ordersErr } = await ordersService.adminGetAllOrders({ limit: 10 });
  if (ordersErr || !adminOrders || adminOrders.length === 0) {
    console.error('❌ FAIL: Failed to view admin orders:', ordersErr);
  } else {
    console.log(`✅ PASS: Retrieved ${adminOrders.length} orders (Total in system: ${ordersCount})`);
    console.log(`   Sample order: #${adminOrders[0].id.slice(0, 8).toUpperCase()} | Status: ${adminOrders[0].status} | Total: ₹${adminOrders[0].pricing?.total}`);
    passed++;
  }

  // 7. Update Order Status
  total++;
  console.log('\n[7/8] Testing Update Order Status via Admin RPC...');
  const targetOrder = adminOrders[0];
  const originalStatus = targetOrder.status;
  const nextStatus = originalStatus === 'placed' ? 'processing' : 'shipped';

  const { data: statusData, error: statusErr } = await ordersService.adminUpdateOrderStatus(
    targetOrder.id,
    nextStatus,
    'Mumbai Hub',
    'Updated by automated admin testing suite'
  );

  if (statusErr || !statusData) {
    console.error('❌ FAIL: Admin status update failed:', statusErr);
  } else {
    console.log(`✅ PASS: Order status updated from "${originalStatus}" -> "${nextStatus}"`);
    // Verify timeline entry was created
    const { data: timeline } = await ordersService.getOrderTimeline(targetOrder.id);
    const hasStatusInTimeline = timeline?.some(t => t.status === nextStatus);
    if (hasStatusInTimeline) {
      console.log(`✅ PASS: Timeline entry verified for "${nextStatus}" status.`);
    }
    passed++;
  }

  // 8. View Analytics (Customer & Sales)
  total++;
  console.log('\n[8/8] Testing View Analytics...');
  const [salesSummary, profilesCount] = await Promise.all([
    insforge.database.from('payments').select('amount, payment_status'),
    insforge.database.from('profiles').select('id', { count: 'exact' })
  ]);

  if (salesSummary.data && profilesCount.count !== null) {
    const totalCollected = salesSummary.data
      .filter(p => p.payment_status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    console.log(`✅ PASS: Analytics retrieved:`);
    console.log(`   - Registered Profiles: ${profilesCount.count}`);
    console.log(`   - Total Verified Payments: ₹${totalCollected} (${salesSummary.data.length} payment records)`);
    passed++;
  } else {
    console.error('❌ FAIL: Analytics fetch failed');
  }

  // Cleanup: delete test product
  console.log('\n[Cleanup] Removing temporary admin test product...');
  await insforge.database.from('products').delete().eq('id', createdProd.id);
  console.log('✅ Temporary test product cleaned up.');

  console.log('\n======================================================================');
  console.log(`Admin Workflow Summary: ${passed}/${total} Passed`);
  console.log('======================================================================');

  if (passed === total) process.exit(0);
  else process.exit(1);
}

runAdminSuite().catch(err => {
  console.error('Admin test suite fatal error:', err);
  process.exit(1);
});
