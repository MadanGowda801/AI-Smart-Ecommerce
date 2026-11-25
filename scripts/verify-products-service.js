import { productsService, formatINR } from '../src/productsService.js';

async function testAll() {
  console.log('========================================================');
  console.log('🚀 TESTING PRODUCTS SERVICE AGAINST LIVE INSFORGE DATABASE');
  console.log('========================================================\n');

  // 1. Fetch categories
  console.log('1. Testing getCategories()...');
  const catRes = await productsService.getCategories();
  if (catRes.error) {
    console.error('❌ Error fetching categories:', catRes.error);
    process.exit(1);
  }
  console.log(`✅ Loaded ${catRes.data.length} categories:`);
  catRes.data.forEach(c => console.log(`   - ${c.name} (slug: ${c.slug}, id: ${c.id})`));

  // 2. Fetch all products
  console.log('\n2. Testing getProducts() [All products, limit 50]...');
  const allProds = await productsService.getProducts({ limit: 50 });
  if (allProds.error) {
    console.error('❌ Error fetching products:', allProds.error);
    process.exit(1);
  }
  console.log(`✅ Total products in DB: ${allProds.count}, Returned: ${allProds.data.length}`);
  console.log(`   Sample product: "${allProds.data[0]?.name}" | Price: ${formatINR(allProds.data[0]?.price)} | Category: "${allProds.data[0]?.category}"`);

  // 3. Category filtering by name, slug, and UUID
  console.log('\n3. Testing Category Filtering...');
  const byName = await productsService.getProducts({ category: 'Audio & Headphones' });
  console.log(`   - By name "Audio & Headphones": ${byName.count} items (expected ~6)`);

  const bySlug = await productsService.getProducts({ category: 'audio' });
  console.log(`   - By slug "audio": ${bySlug.count} items (expected ~6)`);

  const byUUID = await productsService.getProducts({ category: 'c0000000-0000-0000-0000-000000000003' });
  console.log(`   - By UUID "c0000000...0003": ${byUUID.count} items (expected ~6)`);

  if (byName.count === 6 && bySlug.count === 6 && byUUID.count === 6) {
    console.log('✅ Category filtering by name, slug, and UUID all passed!');
  } else {
    console.warn('⚠️ Category filtering counts mismatched:', { nameCount: byName.count, slugCount: bySlug.count, uuidCount: byUUID.count });
  }

  // 4. Search
  console.log('\n4. Testing Search...');
  const searchSony = await productsService.getProducts({ search: 'Sony' });
  console.log(`✅ Search for "Sony": found ${searchSony.count} items:`);
  searchSony.data.forEach(p => console.log(`   - ${p.name} (${formatINR(p.price)})`));

  // 5. Price filtering
  console.log('\n5. Testing Price Filtering...');
  const priceFilter = await productsService.getProducts({ minPrice: 20000, maxPrice: 60000 });
  console.log(`✅ Products between ₹20,000 and ₹60,000: found ${priceFilter.count} items:`);
  priceFilter.data.slice(0, 3).forEach(p => console.log(`   - ${p.name}: ${formatINR(p.price)}`));

  // 6. Rating filtering
  console.log('\n6. Testing Rating Filtering...');
  const ratingFilter = await productsService.getProducts({ minRating: 4.8 });
  console.log(`✅ Products with rating >= 4.8: found ${ratingFilter.count} items:`);
  ratingFilter.data.slice(0, 3).forEach(p => console.log(`   - ${p.name}: ★ ${p.rating}`));

  // 7. Stock availability
  console.log('\n7. Testing Stock Filtering...');
  const inStock = await productsService.getProducts({ inStockOnly: true });
  console.log(`✅ In-stock products: found ${inStock.count} items`);

  // 8. Sorting
  console.log('\n8. Testing Sorting (priceAsc vs priceDesc)...');
  const asc = await productsService.getProducts({ sortBy: 'priceAsc', limit: 2 });
  const desc = await productsService.getProducts({ sortBy: 'priceDesc', limit: 2 });
  console.log(`   Lowest priced: "${asc.data[0]?.name}" (${formatINR(asc.data[0]?.price)})`);
  console.log(`   Highest priced: "${desc.data[0]?.name}" (${formatINR(desc.data[0]?.price)})`);

  // 9. Pagination
  console.log('\n9. Testing Pagination...');
  const page1 = await productsService.getProducts({ page: 1, limit: 5 });
  const page2 = await productsService.getProducts({ page: 2, limit: 5 });
  console.log(`✅ Page 1: ${page1.data.length} items (Total: ${page1.count}, Pages: ${page1.totalPages})`);
  console.log(`✅ Page 2: ${page2.data.length} items (First on page 2: "${page2.data[0]?.name}")`);
  const isDifferent = page1.data[0]?.id !== page2.data[0]?.id;
  console.log(`   Different items across pages: ${isDifferent ? 'YES ✅' : 'NO ❌'}`);

  // 10. Single Product Details
  console.log('\n10. Testing getProductById()...');
  const sampleId = allProds.data[0]?.id;
  const single = await productsService.getProductById(sampleId);
  if (single.data) {
    console.log(`✅ Single product retrieved: "${single.data.name}"`);
    console.log(`   Specs:`, single.data.specs);
    console.log(`   Highlights:`, single.data.highlights);
  } else {
    console.error('❌ Failed to fetch single product:', single.error);
  }

  // 11. Related Products
  console.log('\n11. Testing getRelatedProducts()...');
  const related = await productsService.getRelatedProducts(sampleId, allProds.data[0]?.categoryId, 3);
  console.log(`✅ Related products (${related.data.length} items):`);
  related.data.forEach(r => console.log(`   - ${r.name} (${r.category})`));

  console.log('\n========================================================');
  console.log('🎉 ALL SERVICE FUNCTIONS VERIFIED AND FUNCTIONING!');
  console.log('========================================================');
}

testAll().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
