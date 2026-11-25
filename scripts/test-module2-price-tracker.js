/**
 * Test Suite: Module 2 — Smart Price Tracker
 * 
 * Verifies:
 * 1. Historical price fetching for products with existing price_history records
 * 2. High/low/current price metrics calculation & timestamp formatting
 * 3. Handling of products with insufficient/no price history (< 2 records)
 * 4. Validation rules: Reject target_price <= 0 and target_price >= currentPrice
 * 5. Price alert creation & retrieval for authenticated customer
 * 6. Alert triggering logic: verified price drop triggers notification and marks alert triggered
 * 7. Alert cleanup / deletion
 */

import { insforge } from '../src/insforge.js';
import priceTrackerService from '../src/priceTrackerService.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

async function runModule2Tests() {
  console.log('=====================================================');
  console.log(' TrustCart AI: Running Module 2 (Price Tracker) Tests');
  console.log('=====================================================\n');

  try {
    let customer = null;
    try {
      const { data: authData } = await insforge.auth.signInWithPassword({
        email: 'customer@smartshop.in',
        password: 'CustomerPassword123!',
      });
      if (authData?.user) customer = authData.user;
    } catch {}

    if (!customer) {
      console.log('[Setup] Remote auth offline, initializing verified test customer session...');
      customer = {
        id: 'usr-customer-test-001',
        email: 'customer@smartshop.in',
        name: 'Aditya Sharma',
        role: 'customer',
      };
    }
    localStorage.setItem('smartshop_active_user', JSON.stringify(customer));
    console.log(`Active customer session: ${customer.email} (ID: ${customer.id})\n`);

    // Clean up any pre-existing alerts for this user to ensure isolated test environment
    try {
      await insforge.database.from('price_alerts').delete().eq('user_id', customer.id);
    } catch {}
    localStorage.removeItem('smartshop_price_alerts');

    // ----------------------------------------------------
    // TEST 1: Retrieve products and check price history
    // ----------------------------------------------------
    console.log('--- TEST GROUP 1: Price History Query & Aggregation ---');
    
    let testProductId = 'prod-1';
    try {
      const { data: phRows } = await insforge.database
        .from('price_history')
        .select('product_id')
        .limit(10);
      if (phRows && phRows.length > 0) testProductId = phRows[0].product_id;
    } catch {}

    console.log(`Using product ID with history: ${testProductId}`);

    const { data: historyData, error: histErr } = await priceTrackerService.getPriceHistory(testProductId);
    assert(!histErr && historyData !== null, 'priceTrackerService.getPriceHistory returns successful response');
    assert(Array.isArray(historyData.records), 'History data returns array of records');
    assert(historyData.count >= 1, `History record count is accurate (${historyData.count} records)`);
    assert(typeof historyData.hasSufficientData === 'boolean', 'hasSufficientData flag is boolean');
    assert(historyData.lowestPrice !== null && historyData.highestPrice !== null, 'Lowest and highest prices computed');
    assert(historyData.lowestPrice <= historyData.highestPrice, 'Lowest price is <= highest price');
    assert(typeof historyData.formattedLowest === 'string' && historyData.formattedLowest.includes('₹'), 'Formatted lowest price contains ₹ symbol');

    // ----------------------------------------------------
    // TEST 2: Empty / Insufficient price history handling
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 2: Insufficient / No History State ---');
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const { data: emptyHistory } = await priceTrackerService.getPriceHistory(fakeUuid);
    assert(emptyHistory !== null, 'Handled empty product gracefully');
    assert(emptyHistory.hasSufficientData === false, 'hasSufficientData is false when no records exist');
    assert(emptyHistory.count === 0, 'Record count is 0 for non-existent history');
    assert(typeof emptyHistory.message === 'string', 'Helpful message returned for no verified records');

    // Test missing productId
    const { error: missingIdErr } = await priceTrackerService.getPriceHistory(null);
    assert(missingIdErr !== null, 'getPriceHistory rejects null product ID');

    // ----------------------------------------------------
    // TEST 3: Target Price Alert Validation
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 3: Target Price Alert Validation ---');

    let currentPrice = 29990;
    try {
      const { data: product } = await insforge.database
        .from('products')
        .select('id, name, price')
        .eq('id', testProductId)
        .single();
      if (product && product.price > 0) currentPrice = Number(product.price);
    } catch {}

    console.log(`Using base price ₹${currentPrice} for validation tests`);

    // Negative or 0 target price
    const { error: zeroErr } = await priceTrackerService.setPriceAlert({
      productId: testProductId,
      targetPrice: 0,
      currentPrice,
    });
    assert(zeroErr !== null, 'Rejects target price of 0');

    // Target price higher than or equal to current price
    const { error: highErr } = await priceTrackerService.setPriceAlert({
      productId: testProductId,
      targetPrice: currentPrice + 500,
      currentPrice,
    });
    assert(highErr !== null, 'Rejects target price greater than current price');

    const { error: eqErr } = await priceTrackerService.setPriceAlert({
      productId: testProductId,
      targetPrice: currentPrice,
      currentPrice,
    });
    assert(eqErr !== null, 'Rejects target price equal to current price');

    // ----------------------------------------------------
    // TEST 4: Set Valid Target Price Alert & Fetch
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 4: Create and Fetch Price Alert ---');
    const validTargetPrice = Math.round(currentPrice * 0.9); // 10% lower

    const { data: alertRes, error: setErr } = await priceTrackerService.setPriceAlert({
      productId: testProductId,
      targetPrice: validTargetPrice,
      currentPrice,
    });

    assert(!setErr && alertRes !== null, `Successfully created price alert for target ₹${validTargetPrice}`);
    assert(Number(alertRes.target_price) === validTargetPrice, 'Created alert stores correct target price');
    assert(alertRes.is_triggered === false, 'New alert has is_triggered = false');

    const createdAlertId = alertRes.id;

    // Fetch user alerts
    const { data: userAlerts, error: fetchAlertsErr } = await priceTrackerService.getUserAlerts(customer.id);
    assert(!fetchAlertsErr && Array.isArray(userAlerts), 'getUserAlerts returns array');
    const foundAlert = userAlerts.find((a) => a.id === createdAlertId);
    assert(foundAlert !== undefined, 'Created alert is present in customer alerts list');
    assert(foundAlert.product && foundAlert.product.name, 'Alert includes joined product details');
    assert(foundAlert.percentAway > 0, `Calculated distance percentage correctly (${foundAlert.percentAway}%)`);

    // Test upsert: Updating target price on existing alert
    const newTargetPrice = Math.round(currentPrice * 0.85); // 15% lower
    const { data: updatedAlertRes, updated } = await priceTrackerService.setPriceAlert({
      productId: testProductId,
      targetPrice: newTargetPrice,
      currentPrice,
    });
    assert(updated === true, 'Successfully updated existing alert without duplicate key error');
    assert(Number(updatedAlertRes.target_price) === newTargetPrice, 'Updated alert reflects new target price');

    // Clean up created alert before testing trigger flow on a dedicated second product
    await priceTrackerService.deletePriceAlert(createdAlertId);

    // ----------------------------------------------------
    // TEST 5: Alert Triggering Logic & In-App Notification
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 5: Alert Triggering & Notifications ---');
    
    // Pick another product for testing price drop trigger
    const triggerProductId = 'prod-2';
    const triggerCurrentPrice = 134900;
    const triggerTargetPrice = 135000; // price reached (catalog price 134900 <= target 135000)

    // Add alert with target price already reached
    const stored = JSON.parse(localStorage.getItem('smartshop_price_alerts') || '[]');
    const triggerAlertRecord = {
      id: `alert-trigger-test-${Date.now()}`,
      user_id: customer.id,
      product_id: triggerProductId,
      target_price: triggerTargetPrice,
      initial_price: triggerCurrentPrice + 1000,
      is_triggered: false,
      triggered_at: null,
      created_at: new Date().toISOString(),
    };
    stored.push(triggerAlertRecord);
    localStorage.setItem('smartshop_price_alerts', JSON.stringify(stored));

    // Run trigger check
    const triggerResult = await priceTrackerService.checkAndTriggerPriceAlerts({
      userId: customer.id,
      productId: triggerProductId,
    });

    assert(triggerResult.triggeredCount >= 1, `Trigger check detected price target reached (${triggerResult.triggeredCount} triggered)`);
    
    // Verify in local storage that alert is now is_triggered = true
    const updatedStored = JSON.parse(localStorage.getItem('smartshop_price_alerts') || '[]');
    const triggeredStoredAlert = updatedStored.find((a) => a.id === triggerAlertRecord.id);
    assert(triggeredStoredAlert?.is_triggered === true, 'Alert marked as triggered');

    // ----------------------------------------------------
    // TEST 6: Cleanup Test Alerts
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 6: Alert Deletion & Cleanup ---');
    const { success: del2 } = await priceTrackerService.deletePriceAlert(triggerAlertRecord.id);
    assert(del2 === true, 'Successfully deleted triggered test alert');

    console.log('\n=====================================================');
    console.log(`Module 2 Test Results: ${passedTests}/${totalTests} Passed`);
    console.log('=====================================================');

    if (passedTests === totalTests) {
      console.log('🎉 ALL MODULE 2 TESTS PASSED PERFECTLY!\n');
      process.exit(0);
    } else {
      console.error('❌ SOME TESTS FAILED!\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error running Module 2 tests:', err);
    process.exit(1);
  }
}

runModule2Tests();
