/**
 * FIX: Seeds real 3D model GLB URLs to actual products in InsForge.
 * The previous seeder used hardcoded fake UUIDs. This script:
 *  1. Fetches the top 4 real product IDs from the DB
 *  2. Assigns verified public GLB model URLs from modelviewer.dev
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

const insforgeUrl = process.env.INSFORGE_URL || process.env.VITE_INSFORGE_URL;
const insforgeApiKey = process.env.INSFORGE_API_KEY;

if (!insforgeUrl || !insforgeApiKey) {
  console.error('Missing InsForge credentials. Check .env.local');
  process.exit(1);
}

const admin = createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeApiKey });

// Verified public GLB models from modelviewer.dev (always available, no CORS issues)
const MODEL_POOL = [
  'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
  'https://modelviewer.dev/shared-assets/models/glTF-Sample-Assets/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
  'https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb',
  'https://modelviewer.dev/shared-assets/models/glTF-Sample-Assets/Models/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb',
];

async function seed3dModels() {
  console.log('Fetching real product IDs from InsForge...');

  const { data: products, error: fetchErr } = await admin.database
    .from('products')
    .select('id, name, model_3d_url')
    .order('created_at', { ascending: false })
    .limit(6);

  if (fetchErr) {
    console.error('Could not fetch products:', fetchErr.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.error('No products found in the database.');
    process.exit(1);
  }

  console.log(`Found ${products.length} products. Assigning 3D models...\n`);

  const toUpdate = products.slice(0, MODEL_POOL.length);

  for (let i = 0; i < toUpdate.length; i++) {
    const product = toUpdate[i];
    const modelUrl = MODEL_POOL[i];

    const { data, error } = await admin.database
      .from('products')
      .update({ model_3d_url: modelUrl })
      .eq('id', product.id)
      .select('id, name, model_3d_url');

    if (error) {
      console.error(`  FAIL "${product.name}": ${error.message}`);
    } else {
      console.log(`  OK  ${product.name}`);
      console.log(`      Model: ${modelUrl}\n`);
    }
  }

  console.log('Done! Open any of these products on the site to see the 3D View tab.');
}

seed3dModels().catch(err => {
  console.error(err);
  process.exit(1);
});
