/**
 * Seeds verified 3D model URLs to select flagship products in InsForge
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
  console.error('Missing InsForge credentials.');
  process.exit(1);
}

const admin = createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeApiKey });

async function seed3dModels() {
  console.log('Seeding 3D GLB models to flagship products in InsForge DB...');

  const updates = [
    {
      id: 'd0000000-0000-0000-0000-000000000001',
      model_3d_url: 'https://modelviewer.dev/shared-assets/models/glTF-Sample-Assets/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb'
    },
    {
      id: 'd0000000-0000-0000-0000-000000000004',
      model_3d_url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
    }
  ];

  for (const item of updates) {
    const { data, error } = await admin.database
      .from('products')
      .update({ model_3d_url: item.model_3d_url })
      .eq('id', item.id)
      .select('id, name, model_3d_url');

    if (error) {
      console.error(`Failed to update ${item.id}:`, error.message);
    } else {
      console.log(`✅ Seeded 3D model for: ${data?.[0]?.name}`);
    }
  }

  console.log('Done seeding 3D models.');
}

seed3dModels().catch(err => {
  console.error(err);
  process.exit(1);
});
