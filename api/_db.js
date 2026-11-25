import { createAdminClient } from '@insforge/sdk';

const insforgeUrl = process.env.INSFORGE_URL || process.env.VITE_INSFORGE_URL || 'https://wheg6hgs.ap-southeast.insforge.app';
const insforgeApiKey = process.env.INSFORGE_API_KEY || '';

export const admin = (insforgeUrl && insforgeApiKey)
  ? createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeApiKey })
  : null;

export const razorpayKeyId = process.env.VITE_RAZORPAY_KEY_ID || '';
export const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || '';
export const paymentMode = process.env.PAYMENT_GATEWAY_MODE || 'test';

export async function dbSelect(table, matchColumn, matchValue, selectCols = '*') {
  if (!admin) return null;
  try {
    const { data, error } = await admin.database
      .from(table)
      .select(selectCols)
      .eq(matchColumn, matchValue);
    if (error) console.error(`[DB] select ${table} error:`, error.message);
    return data;
  } catch (err) {
    console.error(`[DB] select ${table}:`, err.message);
    return null;
  }
}

export async function dbPatch(table, matchColumn, matchValue, data) {
  if (!admin) return null;
  try {
    const { data: updated, error } = await admin.database
      .from(table)
      .update(data)
      .eq(matchColumn, matchValue)
      .select();
    if (error) console.error(`[DB] patch ${table} error:`, error.message);
    return updated;
  } catch (err) {
    console.error(`[DB] patch ${table}:`, err.message);
    return null;
  }
}

export async function dbInsert(table, row) {
  if (!admin) return null;
  try {
    const { data, error } = await admin.database
      .from(table)
      .insert([row])
      .select();
    if (error) console.error(`[DB] insert ${table} error:`, error.message);
    return data;
  } catch (err) {
    console.error(`[DB] insert ${table}:`, err.message);
    return null;
  }
}

export async function dbRpc(fnName, args) {
  if (!admin) return null;
  try {
    const { data, error } = await admin.database.rpc(fnName, args);
    if (error) console.warn(`[DB] rpc ${fnName} notice:`, error.message);
    return data;
  } catch (err) {
    console.error(`[DB] rpc ${fnName}:`, err.message);
    return null;
  }
}
