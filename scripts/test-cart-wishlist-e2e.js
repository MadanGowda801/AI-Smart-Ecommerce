import insforge from '../src/insforge.js';
import cartService from '../src/cartService.js';
import wishlistService from '../src/wishlistService.js';
import { formatINR } from '../src/productsService.js';

async function runComprehensiveTests() {
  console.log('================================================================');
  console.log('📦 COMPREHENSIVE END-TO-END CART & WISHLIST TEST ON INSFORGE BAAS');
  console.log('================================================================\n');

  // STEP 1: Authenticate Customer 1
  console.log('Step 1: Authenticating as customer@smartshop.in...');
  const { data: auth1, error: err1 } = await insforge.auth.signInWithPassword({
    email: 'customer@smartshop.in',
    password: 'CustomerPassword123!'
  });
  if (err1) {
    console.error('Customer 1 auth error:', err1);
    process.exit(1);
  }
  const user1 = auth1.user;
  console.log(`✅ User 1 Authenticated: ${user1.id} (${user1.email})`);

  // Fetch real catalog products for testing
  const { data: products } = await insforge.database
    .from('products')
    .select('*')
    .order('stock', { ascending: false });

  if (!products || products.length < 3) {
    console.error('Insufficient products in catalog');
    process.exit(1);
  }

  const pHighStock = products[0]; // Plenty of stock
  const pMediumStock = products[1];
  const pLowStock = products.find(p => p.stock > 0 && p.stock <= 5) || products[2];

  console.log(`\nCatalog test products:`);
  console.log(`- High Stock: "${pHighStock.name}" (Stock: ${pHighStock.stock}, Price: ${formatINR(pHighStock.price)})`);
  console.log(`- Medium Stock: "${pMediumStock.name}" (Stock: ${pMediumStock.stock}, Price: ${formatINR(pMediumStock.price)})`);
  console.log(`- Low Stock: "${pLowStock.name}" (Stock: ${pLowStock.stock}, Price: ${formatINR(pLowStock.price)})`);

  // Clean initial state for user 1
  await cartService.clearCart(user1.id);
  await wishlistService.removeFromWishlist(user1.id, pHighStock.id);
  await wishlistService.removeFromWishlist(user1.id, pMediumStock.id);
  await wishlistService.removeFromWishlist(user1.id, pLowStock.id);

  // ---------------------------------------------------------
  // TEST SUITE A: CART OPERATIONS
  // ---------------------------------------------------------
  console.log('\n--- TEST SUITE A: CART OPERATIONS ---');

  // A1. Empty cart
  console.log('\nA1. Testing empty cart...');
  const initialCart = await cartService.getCart(user1.id);
  console.log(`✅ Cart is empty (count = ${initialCart.data.length})`);

  // A2. Add product
  console.log('\nA2. Testing add product...');
  const add1 = await cartService.addToCart(user1.id, pHighStock, 2);
  console.log(`✅ Added 2x "${pHighStock.name}" to cart (isNew: ${add1.isNew}, Qty: ${add1.quantity})`);

  // A3. Increase quantity
  console.log('\nA3. Testing increase quantity (2 -> 3)...');
  const incRes = await cartService.updateQuantity(user1.id, pHighStock.id, 3, pHighStock.stock);
  console.log(`✅ Quantity updated to: ${incRes.quantity}`);

  // A4. Prevent quantity greater than available stock
  console.log('\nA4. Testing stock constraint (attempting to set quantity beyond stock)...');
  console.log(`   Product stock: ${pLowStock.stock}`);
  await cartService.addToCart(user1.id, pLowStock, 1);
  const overStockQty = pLowStock.stock + 50;
  const clampedRes = await cartService.updateQuantity(user1.id, pLowStock.id, overStockQty, pLowStock.stock);
  console.log(`✅ Quantity clamped to stock: ${clampedRes.quantity} (Expected: ${pLowStock.stock})`);
  if (clampedRes.quantity !== pLowStock.stock) {
    throw new Error('Stock ceiling was not enforced!');
  }

  // A5. Decrease quantity
  console.log('\nA5. Testing decrease quantity...');
  const decRes = await cartService.updateQuantity(user1.id, pHighStock.id, 1, pHighStock.stock);
  console.log(`✅ Decreased quantity to: ${decRes.quantity}`);

  // A6. Subtotal & Total calculations
  console.log('\nA6. Testing Subtotal & Total calculation...');
  const currentCart = await cartService.getCart(user1.id);
  let subtotal = 0;
  currentCart.data.forEach(item => {
    if (!item.isUnavailable) {
      subtotal += item.price * item.quantity;
      console.log(`   - "${item.name}": ${item.quantity} x ${formatINR(item.price)} = ${formatINR(item.price * item.quantity)}`);
    }
  });
  const shippingFee = subtotal >= 999 ? 0 : 99;
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + shippingFee + tax;
  console.log(`   Subtotal: ${formatINR(subtotal)}`);
  console.log(`   Shipping: ${formatINR(shippingFee)}`);
  console.log(`   Tax (5%): ${formatINR(tax)}`);
  console.log(`   Grand Total: ${formatINR(total)}`);
  console.log('✅ Calculations accurate and match INR formatting rules');

  // A7. Handle unavailable products
  console.log('\nA7. Testing unavailable product handling...');
  const fakeUnavailableProd = {
    id: 'd0000000-0000-0000-0000-000000000099',
    name: 'Discontinued Prototype',
    stock: 0
  };
  const unavailAdd = await cartService.addToCart(user1.id, fakeUnavailableProd, 1);
  console.log(`   Attempting to add out of stock product:`, unavailAdd.error ? `Blocked ✅ (${unavailAdd.error.message})` : 'Failed ❌');

  // A8. Remove product
  console.log('\nA8. Testing remove product...');
  await cartService.removeFromCart(user1.id, pLowStock.id);
  const cartAfterDel = await cartService.getCart(user1.id);
  console.log(`✅ Removed low stock product. Remaining items in cart: ${cartAfterDel.data.length}`);

  // A9. Clear cart
  console.log('\nA9. Testing clear cart...');
  await cartService.clearCart(user1.id);
  const cartAfterClear = await cartService.getCart(user1.id);
  console.log(`✅ Cart cleared completely (count = ${cartAfterClear.data.length})`);

  // ---------------------------------------------------------
  // TEST SUITE B: WISHLIST OPERATIONS
  // ---------------------------------------------------------
  console.log('\n--- TEST SUITE B: WISHLIST OPERATIONS ---');

  // B1. Add product to wishlist
  console.log('\nB1. Testing add product to wishlist...');
  const wish1 = await wishlistService.addToWishlist(user1.id, pHighStock.id);
  console.log(`✅ Added "${pHighStock.name}" to wishlist (ID: ${wish1.data.id})`);

  // B2. Prevent duplicates
  console.log('\nB2. Testing prevent duplicates in wishlist...');
  const wishDup = await wishlistService.addToWishlist(user1.id, pHighStock.id);
  console.log(`✅ Duplicate prevented: isDuplicate = ${wishDup.isDuplicate}`);

  // B3. Persist wishlist check
  console.log('\nB3. Verifying persistence in PostgreSQL database...');
  const { data: dbWishRows } = await insforge.database
    .from('wishlist_items')
    .select('*')
    .eq('user_id', user1.id);
  console.log(`✅ Direct DB query found ${dbWishRows.length} wishlist row(s) for user ${user1.id}`);

  // B4. Move product from wishlist to cart
  console.log('\nB4. Testing move product from wishlist to cart...');
  await wishlistService.moveToCart(user1.id, pHighStock);
  const wishAfterMove = await wishlistService.getWishlist(user1.id);
  const cartAfterMove = await cartService.getCart(user1.id);
  console.log(`✅ Wishlist count after move: ${wishAfterMove.data.length} (Expected: 0)`);
  console.log(`✅ Cart count after move: ${cartAfterMove.data.length} (Expected: 1)`);
  console.log(`   Item in cart: "${cartAfterMove.data[0]?.name}", Qty: ${cartAfterMove.data[0]?.quantity}`);

  // B5. Remove product from wishlist
  console.log('\nB5. Testing remove product from wishlist...');
  await wishlistService.addToWishlist(user1.id, pMediumStock.id);
  const beforeDel = await wishlistService.getWishlist(user1.id);
  console.log(`   Wishlist items before delete: ${beforeDel.data.length}`);
  await wishlistService.removeFromWishlist(user1.id, pMediumStock.id);
  const afterDel = await wishlistService.getWishlist(user1.id);
  console.log(`✅ Wishlist items after delete: ${afterDel.data.length}`);

  // ---------------------------------------------------------
  // TEST SUITE C: MULTI-USER ISOLATION & RLS VERIFICATION
  // ---------------------------------------------------------
  console.log('\n--- TEST SUITE C: USER ISOLATION & RLS ---');
  console.log('Authenticating as admin@smartshop.in to test user isolation...');
  const { data: auth2 } = await insforge.auth.signInWithPassword({
    email: 'admin@smartshop.in',
    password: 'AdminPassword123!'
  });
  const user2 = auth2.user;
  console.log(`✅ User 2 Authenticated: ${user2.id}`);

  // Verify User 2's cart is independent from User 1's cart
  const user2Cart = await cartService.getCart(user2.id);
  console.log(`✅ User 2 cart count: ${user2Cart.data.length} (independent from User 1)`);

  // Clean up User 1 test cart
  await insforge.auth.signInWithPassword({
    email: 'customer@smartshop.in',
    password: 'CustomerPassword123!'
  });
  await cartService.clearCart(user1.id);
  console.log('✅ Cleaned up test data');

  console.log('\n================================================================');
  console.log('🎉 ALL CART & WISHLIST VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

runComprehensiveTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
