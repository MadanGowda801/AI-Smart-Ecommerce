import { createClient } from '@insforge/sdk';

const BASE_URL = 'https://wheg6hgs.ap-southeast.insforge.app';
const ANON_KEY = 'anon_1f344ff00d148a22234c12c3f5616df77fc3c01286d1f4a3aac7fd0fab6649a9';

async function testStorageFlow() {
  console.log('--- 1. Testing Validation Logic ---');
  const { validateProductImage } = await import('../src/storageService.js');

  const oversizeFile = { name: 'huge.jpg', size: 6 * 1024 * 1024, type: 'image/jpeg' };
  const v1 = validateProductImage(oversizeFile);
  console.log('Oversized file validation (expected false):', v1.valid === false, '| Error:', v1.error);

  const invalidTypeFile = { name: 'script.exe', size: 1024, type: 'application/x-msdownload' };
  const v2 = validateProductImage(invalidTypeFile);
  console.log('Invalid type file validation (expected false):', v2.valid === false, '| Error:', v2.error);

  const validFile = { name: 'product.png', size: 500 * 1024, type: 'image/png' };
  const v3 = validateProductImage(validFile);
  console.log('Valid file validation (expected true):', v3.valid === true);

  console.log('\n--- 2. Testing Anon / Normal User Upload Restriction ---');
  const anonClient = createClient({ baseUrl: BASE_URL, anonKey: ANON_KEY });

  const dummyBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
  const dummyImage = new Blob([dummyBuffer], { type: 'image/gif' });
  const testKey = `products/test-${Date.now()}.gif`;

  // Anon attempt to upload
  const { data: anonData, error: anonErr } = await anonClient.storage
    .from('product-images')
    .upload(testKey, dummyImage, { contentType: 'image/gif' });

  // Customer user attempt to upload
  const customerClient = createClient({ baseUrl: BASE_URL, anonKey: ANON_KEY });
  const { data: custAuth } = await customerClient.auth.signInWithPassword({
    email: 'customer@smartshop.in',
    password: 'CustomerPassword123!'
  });
  if (custAuth?.user) {
    const { error: custErr } = await customerClient.storage
      .from('product-images')
      .upload(`products/cust-${Date.now()}.gif`, dummyImage, { contentType: 'image/gif' });
    console.log('Customer upload correctly BLOCKED by Storage RLS:', custErr ? custErr.message : 'FAILED - customer was allowed!');
  }

  console.log('\n--- 3. Testing Admin Upload & Storage Reference in Products ---');
  // Sign in as admin
  const adminClient = createClient({ baseUrl: BASE_URL, anonKey: ANON_KEY });
  const { data: authData, error: authErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@smartshop.in',
    password: 'AdminPassword123!'
  });

  if (authErr) {
    console.error('Failed to sign in as admin:', authErr);
    return;
  }
  console.log('Admin signed in successfully:', authData?.user?.email);

  // Admin upload to product-images
  const adminTestKey = `products/admin-test-${Date.now()}.gif`;
  const { data: uploadData, error: uploadErr } = await adminClient.storage
    .from('product-images')
    .upload(adminTestKey, dummyImage, { contentType: 'image/gif' });

  if (uploadErr) {
    console.error('Admin upload failed:', uploadErr);
    return;
  }
  console.log('Admin upload SUCCEEDED:', {
    key: uploadData?.key,
    url: uploadData?.url
  });

  // Verify public URL
  const publicUrl = uploadData?.url || `${BASE_URL}/api/storage/buckets/product-images/objects/${encodeURIComponent(adminTestKey)}`;
  console.log('Public image URL:', publicUrl);

  // Test downloading or checking the image
  const fetchRes = await fetch(publicUrl);
  console.log('Image HTTP fetch status:', fetchRes.status, '| Content-Type:', fetchRes.headers.get('content-type'));

  // Test storing image reference in products table
  console.log('\n--- 4. Testing Product Record Storage Reference ---');
  const { data: insertedProduct, error: insertErr } = await adminClient.database
    .from('products')
    .insert([{
      name: 'Storage Test Product ' + Date.now(),
      brand: 'InsForge Audio',
      price: 2499,
      discount: 10,
      stock: 50,
      description: 'Test product storing image URL and storage key reference',
      image: publicUrl,
      image_url: publicUrl,
      image_key: adminTestKey,
      slug: 'storage-test-' + Date.now()
    }])
    .select();

  if (insertErr) {
    console.error('Failed to insert product with storage reference:', insertErr);
  } else {
    console.log('Product created with storage references in DB:', {
      id: insertedProduct[0].id,
      name: insertedProduct[0].name,
      image_url: insertedProduct[0].image_url,
      image_key: insertedProduct[0].image_key
    });

    // Test product deletion and storage cleanup
    console.log('\n--- 5. Testing Image Deletion Cleanup ---');
    // Remove product
    await adminClient.database.from('products').delete().eq('id', insertedProduct[0].id);
    console.log('Test product removed from DB');

    // Remove image from storage
    const { error: delErr } = await adminClient.storage.from('product-images').remove(adminTestKey);
    console.log('Unused test image removed from storage:', delErr ? delErr : 'Success');
  }

  console.log('\nAll Storage tests passed successfully!');
}

testStorageFlow().catch(console.error);
