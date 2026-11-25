import insforge from '../src/insforge.js';

async function seedVoiceProducts() {
  console.log('Seeding products for voice commands test...');

  const items = [
    {
      id: 'd0000000-0000-0000-0000-000000000037',
      category_id: 'c0000000-0000-0000-0000-000000000001', // Electronics & Laptops
      name: 'ASUS Vivobook 15 Intel Core i5 12th Gen Thin & Light Laptop',
      slug: 'asus-vivobook-15-intel-i5',
      brand: 'ASUS',
      price: 48990.00,
      discount: 15.00,
      stock: 24,
      image: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=700&auto=format&fit=crop&q=80',
      image_url: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=700&auto=format&fit=crop&q=80',
      rating: 4.6,
      review_count: 230,
      description: '15.6-inch Full HD anti-glare display, 12th Gen Intel Core i5 processor, 16GB DDR4 RAM, 512GB NVMe SSD, Windows 11 Home, fingerprint sensor.'
    },
    {
      id: 'd0000000-0000-0000-0000-000000000038',
      category_id: 'c0000000-0000-0000-0000-000000000001', // Electronics & Laptops
      name: 'Lenovo IdeaPad Slim 3 15.6-inch FHD Thin & Light Laptop',
      slug: 'lenovo-ideapad-slim-3-ryzen-5',
      brand: 'Lenovo',
      price: 41990.00,
      discount: 18.00,
      stock: 19,
      image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=700&auto=format&fit=crop&q=80',
      image_url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=700&auto=format&fit=crop&q=80',
      rating: 4.5,
      review_count: 184,
      description: 'AMD Ryzen 5 7520U processor, 16GB LPDDR5 RAM, 512GB SSD, 15.6" FHD display, Dolby Audio speakers, Rapid Charge, Arctic Grey finish.'
    },
    {
      id: 'd0000000-0000-0000-0000-000000000039',
      category_id: 'c0000000-0000-0000-0000-000000000006', // Gaming & Displays
      name: 'Razer BlackWidow V4 RGB Mechanical Gaming Keyboard',
      slug: 'razer-blackwidow-v4-gaming-keyboard',
      brand: 'Razer',
      price: 13999.00,
      discount: 12.00,
      stock: 35,
      image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=700&auto=format&fit=crop&q=80',
      image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=700&auto=format&fit=crop&q=80',
      rating: 4.7,
      review_count: 310,
      description: 'Mechanical gaming keyboard featuring Razer Green clicky switches, 2-side underglow RGB lighting, 6 dedicated macro keys, and magnetic wrist rest.'
    }
  ];

  const { data, error } = await insforge.database
    .from('products')
    .upsert(items, { onConflict: 'id' });

  if (error) {
    console.error('Error inserting products:', error);
  } else {
    console.log('Successfully seeded 3 demonstration products for voice commands!');
  }
}

seedVoiceProducts();
