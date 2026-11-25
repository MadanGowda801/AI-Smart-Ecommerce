import fs from 'node:fs';
import { createAdminClient } from '@insforge/sdk';

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

const admin = createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeApiKey });

async function verifyTable() {
  console.log('Verifying return_requests table in database...');
  const { data, error } = await admin.database.from('return_requests').select('*').limit(1);
  if (error) {
    console.error('Error selecting from return_requests:', error.message);
  } else {
    console.log('✅ return_requests table is active! Current rows count:', data.length);
  }
}

verifyTable();
