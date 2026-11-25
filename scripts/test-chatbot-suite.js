/**
 * AI Chatbot and NLP Test Suite
 */
import insforge from '../src/insforge.js';
import { aiChatService } from '../src/aiChatService.js';

async function runChatbotTests() {
  console.log('======================================================================');
  console.log('🤖 AI CHATBOT AUTOMATED TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  // 1. Unauthenticated order status lookup
  total++;
  console.log('[1/4] Testing Chatbot Order Lookup without Auth...');
  const unauthRes = await aiChatService.sendMessage('Where is my order?', [], { user: null });
  if (unauthRes.type === 'auth_required') {
    console.log('✅ PASS: Chatbot correctly requested login for order lookup.');
    passed++;
  } else {
    console.error('❌ FAIL: Expected auth_required, got:', unauthRes);
  }

  // 2. Authenticated order status lookup
  total++;
  console.log('\n[2/4] Testing Authenticated Customer Order Lookup...');
  const { data: auth } = await insforge.auth.signInWithPassword({
    email: 'customer@smartshop.in',
    password: 'CustomerPassword123!'
  });

  const authUser = { id: auth.user.id, name: 'Smart Customer', email: auth.user.email };
  const authRes = await aiChatService.sendMessage('Track my order', [], { user: authUser });
  if (authRes.type === 'orders' && authRes.text.includes('Recent Orders')) {
    console.log('✅ PASS: Chatbot retrieved recent orders with status and totals:\n' + authRes.text.split('\n').slice(0, 5).join('\n'));
    passed++;
  } else {
    console.error('❌ FAIL: Expected orders response, got:', authRes);
  }

  // 3. Product lookup by query + budget
  total++;
  console.log('\n[3/4] Testing Chatbot Product Lookup with Budget Filter...');
  const prodRes = await aiChatService.sendMessage('Show wireless headphones under 30000 rupees');
  if (prodRes.products && prodRes.products.length > 0) {
    const allUnder30k = prodRes.products.every(p => p.price <= 30000);
    if (allUnder30k) {
      console.log(`✅ PASS: Found ${prodRes.products.length} headphones all under ₹30,000:`);
      prodRes.products.forEach(p => console.log(`   - ${p.name} (₹${p.price})`));
      passed++;
    } else {
      console.error('❌ FAIL: Some products exceeded budget limit!');
    }
  } else {
    console.error('❌ FAIL: No products returned for query:', prodRes);
  }

  // 4. Product lookup by category and brand
  total++;
  console.log('\n[4/4] Testing Chatbot Brand/Category Lookup (Apple laptops)...');
  const appleRes = await aiChatService.sendMessage('Show Apple laptops');
  if (appleRes.products && appleRes.products.length > 0) {
    const hasApple = appleRes.products.some(p => p.name.toLowerCase().includes('apple') || p.brand?.toLowerCase() === 'apple');
    if (hasApple) {
      console.log(`✅ PASS: Found ${appleRes.products.length} products including Apple laptops:`);
      appleRes.products.forEach(p => console.log(`   - ${p.name} (₹${p.price})`));
      passed++;
    } else {
      console.error('❌ FAIL: No Apple products returned in list');
    }
  } else {
    console.error('❌ FAIL: No products returned for Apple laptops query');
  }

  console.log('\n======================================================================');
  console.log(`Chatbot Test Summary: ${passed}/${total} Passed`);
  console.log('======================================================================');

  if (passed === total) process.exit(0);
  else process.exit(1);
}

runChatbotTests().catch(err => {
  console.error('Chatbot suite failed:', err);
  process.exit(1);
});
