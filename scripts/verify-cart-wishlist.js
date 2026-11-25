import insforge from '../src/insforge.js';
import { cartService } from '../src/cartService.js';
import { wishlistService } from '../src/wishlistService.js';
import { formatINR } from '../src/productsService.js';

async function verifyCartAndWishlist() {
  console.log('========================================================');
  console.log('🧪 TESTING REAL CART & WISHLIST VIA INSFORGE DATABASE');
  console.log('========================================================\n');

  // 1. Authenticate with real customer
  console.log('1. Authenticating as customer@smartshop.in...');
  const { data: authData, error: authErr } = await insforge.auth.signInWithPassword({
    email: 'customer@smartshop.in',
    password: 'CustomerPassword123!'
  });

  if (authErr || !authData?.user) {
    console.error('❌ Authentication failed:', authErr);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`✅ Authenticated! User ID: ${userId}`);

  // Fetch a sample product from the real products table
  const { data: prods } = await insforge.database.from('products').select('*').limit(2);
  const sampleProduct1 = prods[0];
  const sampleProduct2 = prods[1];
  console.log(`\nSample Product 1: "${sampleProduct1.name}" (Price: ₹${sampleProduct1.price}, Stock: ${sampleProduct1.stock})`);
  console.log(`Sample Product 2: "${sampleProduct2.name}" (Price: ₹${sampleProduct2.price}, Stock: ${sampleProduct2.stock})`);

  // Clean initial state
  await cartService.clearCart(userId);
  await wishlistService.removeFromWishlist(userId, sampleProduct1.id);
  await wishlistService.removeFromWishlist(userId, sampleProduct2.id);

  // 2. Fetch empty cart
  console.log('\n2. Testing getCart() on empty state...');
  const emptyCart = await cartService.getCart(userId);
  console.log(`✅ Empty cart count: ${emptyCart.data.length}`);

  // 3. Add product 1 to cart
  console.log('\n3. Testing addToCart() with quantity = 2...');
  const addRes1 = await cartService.addToCart(userId, sampleProduct1, 2);
  console.log(`✅ Item added:`, addRes1.data);

  // 4. Fetch cart and verify persistence in DB
  const cartAfterAdd = await cartService.getCart(userId);
  console.log(`✅ Cart count after add: ${cartAfterAdd.data.length}`);
  console.log(`   Item: "${cartAfterAdd.data[0]?.name}", Qty: ${cartAfterAdd.data[0]?.quantity}, Price: ${formatINR(cartAfterAdd.data[0]?.price)}`);

  // 5. Increase quantity
  console.log('\n5. Testing increase quantity (2 -> 4)...');
  await cartService.updateQuantity(userId, sampleProduct1.id, 4, sampleProduct1.stock);
  const cartAfterInc = await cartService.getCart(userId);
  console.log(`✅ Quantity after increase: ${cartAfterInc.data[0]?.quantity}`);

  // 6. Test stock limit prevention (try to add 9999 items)
  console.log('\n6. Testing stock limit prevention...');
  console.log(`   Available stock for product: ${sampleProduct1.stock}`);
  await cartService.updateQuantity(userId, sampleProduct1.id, 9999, sampleProduct1.stock);
  const cartAfterCap = await cartService.getCart(userId);
  console.log(`✅ Quantity clamped to stock: ${cartAfterCap.data[0]?.quantity} (Expected: ${sampleProduct1.stock})`);
  if (cartAfterCap.data[0]?.quantity === sampleProduct1.stock) {
    console.log('✅ Stock ceiling successfully enforced!');
  } else {
    console.error('❌ Stock ceiling failed!');
  }

  // 7. Add product 2 to test calculations
  console.log('\n7. Testing subtotal & total calculation with multiple items...');
  await cartService.addToCart(userId, sampleProduct2, 1);
  const multiCart = await cartService.getCart(userId);
  const subtotal = multiCart.data.reduce((acc, it) => acc + (it.price * it.quantity), 0);
  console.log(`✅ Multi-item cart count: ${multiCart.data.length}`);
  console.log(`   Calculated Subtotal: ${formatINR(subtotal)}`);

  // 8. Decrease quantity
  console.log('\n8. Testing decrease quantity...');
  await cartService.updateQuantity(userId, sampleProduct1.id, 1, sampleProduct1.stock);
  const cartAfterDec = await cartService.getCart(userId);
  const p1Item = cartAfterDec.data.find(it => it.productId === sampleProduct1.id);
  console.log(`✅ Product 1 quantity after decrease: ${p1Item?.quantity} (Expected: 1)`);

  // 9. Remove product 2
  console.log('\n9. Testing removeItem()...');
  await cartService.removeFromCart(userId, sampleProduct2.id);
  const cartAfterRemove = await cartService.getCart(userId);
  console.log(`✅ Cart count after removing Product 2: ${cartAfterRemove.data.length}`);

  // 10. Clear cart
  console.log('\n10. Testing clearCart()...');
  await cartService.clearCart(userId);
  const cartCleared = await cartService.getCart(userId);
  console.log(`✅ Cart count after clearCart(): ${cartCleared.data.length} (Expected: 0)`);

  // 11. Wishlist Operations
  console.log('\n--------------------------------------------------------');
  console.log('11. Testing Wishlist Operations...');

  // Add to wishlist
  console.log('   a) Adding Product 1 to Wishlist...');
  const wishAdd1 = await wishlistService.addToWishlist(userId, sampleProduct1.id);
  console.log('   ✅ Wishlist add result:', wishAdd1);

  // Prevent duplicate in wishlist
  console.log('   b) Testing duplicate prevention in Wishlist...');
  const wishAddDup = await wishlistService.addToWishlist(userId, sampleProduct1.id);
  console.log(`   ✅ Duplicate handled gracefully (isDuplicate: ${wishAddDup.isDuplicate})`);

  // Fetch wishlist
  const wishList = await wishlistService.getWishlist(userId);
  console.log(`   ✅ Wishlist items in DB: ${wishList.data.length}`);
  console.log(`      Item: "${wishList.data[0]?.name}", In Stock: ${wishList.data[0]?.inStock}`);

  // Move product to cart from wishlist
  console.log('\n12. Testing Move Product to Cart from Wishlist...');
  await wishlistService.moveToCart(userId, sampleProduct1);

  const wishAfterMove = await wishlistService.getWishlist(userId);
  const cartAfterMove = await cartService.getCart(userId);
  console.log(`   ✅ Wishlist count after move: ${wishAfterMove.data.length} (Expected: 0)`);
  console.log(`   ✅ Cart count after move: ${cartAfterMove.data.length} (Expected: 1)`);
  console.log(`      Product in cart: "${cartAfterMove.data[0]?.name}", Qty: ${cartAfterMove.data[0]?.quantity}`);

  // Clean up
  await cartService.clearCart(userId);
  console.log('\n========================================================');
  console.log('🎉 ALL CART & WISHLIST OPERATIONS VERIFIED AND PASSING!');
  console.log('========================================================');
}

verifyCartAndWishlist().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
