import insforge from '../src/insforge.js';

async function seedBudgetHeadphones() {
  console.log('Seeding budget wireless headphones under ₹3,000...');

  const items = [
    {
      id: 'd0000000-0000-0000-0000-000000000040',
      category_id: 'c0000000-0000-0000-0000-000000000003', // Audio & Headphones
      name: 'boAt Rockerz 450 Wireless Bluetooth On-Ear Headphones with Mic',
      slug: 'boat-rockerz-450-wireless-headphones',
      brand: 'boAt',
      price: 1499.00,
      discount: 25.00,
      stock: 45,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80',
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80',
      rating: 4.4,
      review_count: 512,
      description: '40mm dynamic drivers, up to 15 hours playback, adaptive ear cushions, integrated controls, Bluetooth v5.0 with dual mode (wireless/aux).'
    },
    {
      id: 'd0000000-0000-0000-0000-000000000041',
      category_id: 'c0000000-0000-0000-0000-000000000003', // Audio & Headphones
      name: 'OnePlus Nord Buds 2 TWS Wireless Earbuds (Active Noise Cancellation)',
      slug: 'oneplus-nord-buds-2-tws',
      brand: 'OnePlus',
      price: 2299.00,
      discount: 20.00,
      stock: 38,
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=700&auto=format&fit=crop&q=80',
      image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=700&auto=format&fit=crop&q=80',
      rating: 4.6,
      review_count: 389,
      description: 'Up to 25dB active noise cancellation, BassWave enhancement algorithm, 12.4mm dynamic titanium drivers, 36 hours total playtime, IP55 water resistance.'
    },
    {
      id: 'd0000000-0000-0000-0000-000000000042',
      category_id: 'c0000000-0000-0000-0000-000000000003', // Audio & Headphones
      name: 'boAt Airdopes 141 Bluetooth Truly Wireless in Ear Earbuds',
      slug: 'boat-airdopes-141-tws',
      brand: 'boAt',
      price: 1299.00,
      discount: 30.00,
      stock: 50,
      image: 'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=700&auto=format&fit=crop&q=80',
      image_url: 'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=700&auto=format&fit=crop&q=80',
      rating: 4.3,
      review_count: 674,
      description: '42 hours total playtime, Beast mode for 80ms low latency gaming, ENx environmental noise cancellation for calls, ASAP charge 5 mins = 75 mins.'
    },
    {
      id: 'd0000000-0000-0000-0000-000000000003',
      name: 'Audio & Headphones', // Ensure category exists
      slug: 'audio'
    },
    {
      id: 'd0000000-0000-0000-0000-000000000043',
      category_id: 'c0000000-0000-0000-0000-000000000003', // Audio & Headphones
      name: 'Noise Two Wireless On-Ear Bluetooth Headphones with Dual Pairing',
      slug: 'noise-two-wireless-headphones',
      brand: 'Noise',
      price: 1999.00,
      discount: 22.00,
      stock: 30,
      image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=700&auto=format&fit=crop&q=80',
      image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=700&auto=format&fit=crop&q=80',
      rating: 4.5,
      review_count: 245,
      description: '50 hours battery life, 40mm bass drivers, dual pairing feature, Bluetooth 5.3, ultra-comfortable memory foam ear cushions.'
    },
    {
      id: 'd0000000-0000-0000-0000-000000000044',
      category_id: 'c0000000-0000-0000-0000-000000000003', // Audio & Headphones
      name: 'realme Buds Wireless 3 in-Ear Bluetooth Neckband (30dB ANC)',
      slug: 'realme-buds-wireless-3',
      brand: 'realme',
      price: 1699.00,
      discount: 20.00,
      stock: 40,
      image: 'https://images.unsplash.com/photo-1608156639585-34a0a562a0cf?w=700&auto=format&fit=crop&q=80',
      image_url: 'https://images.unsplash.com/photo-1608156639585-34a0a562a0cf?w=700&auto=format&fit=crop&q=80',
      rating: 4.6,
      review_count: 420,
      description: '30dB Active Noise Cancellation, 360 Spatial Audio Effect, 13.6mm dynamic bass boost driver, 40 hours battery life, magnetic instant connection.'
    }
  ].filter(i => i.price !== undefined); // filter category safety

  const { data, error } = await insforge.database
    .from('products')
    .upsert(items, { onConflict: 'id' });

  if (error) {
    console.error('Error inserting budget headphones:', error);
  } else {
    console.log(`Successfully seeded ${items.length} budget wireless headphones under ₹3,000!`);
  }
}

seedBudgetHeadphones();
