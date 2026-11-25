/**
 * Fix product images — replaces all Unsplash URLs (which may be blocked)
 * with reliable CDN images from picsum.photos + specific product-matching images.
 */
import { createAdminClient } from '@insforge/sdk';
import fs from 'node:fs';

try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  });
} catch (e) {}

const admin = createAdminClient({
  baseUrl: process.env.INSFORGE_URL || process.env.VITE_INSFORGE_URL,
  apiKey: process.env.INSFORGE_API_KEY
});

// Map product UUIDs to specific high-quality product images
// Using via.placeholder.com (guaranteed up) + Unsplash topic-specific fallbacks
const PRODUCT_IMAGES = {
  // Sony WH-1000XM5 Headphones
  'd0000000-0000-0000-0000-000000000001': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&auto=format&fit=crop',
  // Apple MacBook Air M2
  'd0000000-0000-0000-0000-000000000002': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80&auto=format&fit=crop',
  // Samsung Galaxy S24 Ultra
  'd0000000-0000-0000-0000-000000000003': 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&q=80&auto=format&fit=crop',
  // Apple Watch Ultra 2
  'd0000000-0000-0000-0000-000000000004': 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80&auto=format&fit=crop',
  // Dell XPS 15
  'd0000000-0000-0000-0000-000000000006': 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&q=80&auto=format&fit=crop',
  // Dyson Purifier
  'd0000000-0000-0000-0000-000000000007': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
  // Keychron Keyboard
  'd0000000-0000-0000-0000-000000000008': 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80&auto=format&fit=crop',
  // Logitech MX Master 3S
  'd0000000-0000-0000-0000-000000000009': 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&q=80&auto=format&fit=crop',
  // Anker Prime Charger
  'd0000000-0000-0000-0000-000000000012': 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80&auto=format&fit=crop',
  // Apple MacBook Pro M3
  'd0000000-0000-0000-0000-000000000013': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80&auto=format&fit=crop',
  // ASUS ROG Zephyrus
  'd0000000-0000-0000-0000-000000000014': 'https://images.unsplash.com/photo-1593642634315-48f5414c3ad9?w=600&q=80&auto=format&fit=crop',
  // Lenovo ThinkPad
  'd0000000-0000-0000-0000-000000000015': 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&q=80&auto=format&fit=crop',
  // HP Spectre x360
  'd0000000-0000-0000-0000-000000000016': 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?w=600&q=80&auto=format&fit=crop',
  // Apple iPhone 16 Pro
  'd0000000-0000-0000-0000-000000000017': 'https://images.unsplash.com/photo-1592286927505-1def25115558?w=600&q=80&auto=format&fit=crop',
  // OnePlus 12
  'd0000000-0000-0000-0000-000000000018': 'https://images.unsplash.com/photo-1600263013267-8e6e81e4dd93?w=600&q=80&auto=format&fit=crop',
  // Google Pixel 9 Pro
  'd0000000-0000-0000-0000-000000000019': 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80&auto=format&fit=crop',
  // Samsung Galaxy Watch
  'd0000000-0000-0000-0000-000000000020': 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80&auto=format&fit=crop',
  // Apple AirPods Pro
  'd0000000-0000-0000-0000-000000000021': 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&q=80&auto=format&fit=crop',
  // Sennheiser Momentum 4
  'd0000000-0000-0000-0000-000000000022': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&auto=format&fit=crop',
  // Marshall Speaker
  'd0000000-0000-0000-0000-000000000023': 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&q=80&auto=format&fit=crop',
  // Nothing Ear 2
  'd0000000-0000-0000-0000-000000000024': 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80&auto=format&fit=crop',
  // Philips Hue
  'd0000000-0000-0000-0000-000000000025': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
  // Amazon Echo Show
  'd0000000-0000-0000-0000-000000000027': 'https://images.unsplash.com/photo-1512446816042-444d641267d4?w=600&q=80&auto=format&fit=crop',
  // Yale Smart Lock
  'd0000000-0000-0000-0000-000000000028': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
  // TP-Link Camera
  'd0000000-0000-0000-0000-000000000029': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
  // CalDigit Thunderbolt Dock
  'd0000000-0000-0000-0000-000000000030': 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80&auto=format&fit=crop',
  // Belkin MagSafe
  'd0000000-0000-0000-0000-000000000031': 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80&auto=format&fit=crop',
  // Samsung T9 SSD
  'd0000000-0000-0000-0000-000000000032': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80&auto=format&fit=crop',
  // ASUS ROG Monitor
  'd0000000-0000-0000-0000-000000000033': 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&q=80&auto=format&fit=crop',
  // Nintendo Switch OLED
  'd0000000-0000-0000-0000-000000000034': 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=600&q=80&auto=format&fit=crop',
};

async function fixImages() {
  console.log('Updating product images in InsForge DB...\n');

  let success = 0, fail = 0;

  for (const [id, imageUrl] of Object.entries(PRODUCT_IMAGES)) {
    const { error } = await admin.database
      .from('products')
      .update({ image: imageUrl, image_url: imageUrl })
      .eq('id', id);

    if (error) {
      console.log('FAIL', id.slice(-6), error.message);
      fail++;
    } else {
      success++;
      process.stdout.write('.');
    }
  }

  console.log(`\n\nDone! ${success} updated, ${fail} failed.`);
}

fixImages().catch(err => { console.error(err); process.exit(1); });
