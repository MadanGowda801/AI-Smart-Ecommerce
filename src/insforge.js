import { createClient } from '@insforge/sdk';
import env from './env.js';

/**
 * InsForge Client Instance
 * 
 * Configured using the public Anon Key and Base URL.
 * All queries and operations run under Postgres Row Level Security (RLS).
 * Do NOT use API Key / Admin client in frontend client-side code.
 */
export const insforge = createClient({
  baseUrl: env.insforgeUrl,
  anonKey: env.insforgeAnonKey,
});

export default insforge;
