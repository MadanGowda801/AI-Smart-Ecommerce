import insforge from './insforge.js';

/**
 * Admin Analytics Service — Real data from InsForge PostgreSQL
 * All queries use lean column selection and date-range filters for performance.
 */

// ─── Dashboard KPIs ──────────────────────────────────────────────────────────

export async function fetchDashboardKPIs() {
  const [ordersRes, productsRes, usersRes, soldRes] = await Promise.all([
    insforge.database.from('orders').select('id, total_amount, status, created_at'),
    insforge.database.from('products').select('id, stock'),
    insforge.database.from('profiles').select('id, created_at'),
    insforge.database.from('order_items').select('quantity'),
  ]);

  const orders = ordersRes.data || [];
  const products = productsRes.data || [];
  const users = usersRes.data || [];

  const totalRevenue = orders
    .filter(o => !['cancelled', 'placed'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const totalOrders = orders.length;
  const totalProducts = products.length;
  const totalUsers = users.length;
  const lowStockCount = products.filter(p => Number(p.stock || 0) <= 10).length;
  const pendingOrders = orders.filter(o => ['placed', 'pending', 'payment_confirmed'].includes(o.status)).length;
  const completedOrders = orders.filter(o => o.status === 'delivered').length;
  const totalUnitsSold = (soldRes.data || []).reduce((s, i) => s + Number(i.quantity || 0), 0);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const thisMonthOrders = orders.filter(o => o.created_at >= thisMonthStart);
  const lastMonthOrders = orders.filter(o => o.created_at >= lastMonthStart && o.created_at < thisMonthStart);

  const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const lastMonthRevenue = lastMonthOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const revenueGrowth = lastMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : null;

  const thisMonthUsers = users.filter(u => u.created_at >= thisMonthStart).length;
  const lastMonthUsers = users.filter(u => u.created_at >= lastMonthStart && u.created_at < thisMonthStart).length;
  const userGrowth = lastMonthUsers > 0
    ? Math.round(((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100) : null;

  const ordersGrowth = lastMonthOrders.length > 0
    ? Math.round(((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length) * 100) : null;

  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  return {
    data: {
      totalRevenue, totalOrders, totalUsers, totalProducts,
      lowStockCount, pendingOrders, completedOrders, avgOrderValue,
      revenueGrowth, userGrowth, ordersGrowth,
      thisMonthRevenue, thisMonthOrders: thisMonthOrders.length,
      thisMonthUsers, totalUnitsSold,
    },
    error: ordersRes.error || productsRes.error || usersRes.error
  };
}

// ─── Sales Over Time ──────────────────────────────────────────────────────────

export async function fetchMonthlyRevenue(months = 6) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months + 1);
  cutoff.setDate(1);
  cutoff.setHours(0, 0, 0, 0);

  const { data, error } = await insforge.database
    .from('orders')
    .select('total_amount, status, created_at')
    .gte('created_at', cutoff.toISOString());

  if (error) return { data: [], error };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const buckets = {};
  for (let i = 0; i < months; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (months - 1 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = { month: monthNames[d.getMonth()], amount: 0, orders: 0 };
  }

  (data || []).forEach(order => {
    if (order.status === 'cancelled') return;
    const d = new Date(order.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) { buckets[key].amount += Number(order.total_amount || 0); buckets[key].orders += 1; }
  });

  return { data: Object.values(buckets), error: null };
}

export async function fetchDailyRevenue(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const { data, error } = await insforge.database
    .from('orders')
    .select('total_amount, status, created_at')
    .gte('created_at', cutoff.toISOString())
    .neq('status', 'cancelled');

  if (error) return { data: [], error };

  const buckets = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { date: key, label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), amount: 0, orders: 0 };
  }

  (data || []).forEach(order => {
    const key = new Date(order.created_at).toISOString().slice(0, 10);
    if (buckets[key]) { buckets[key].amount += Number(order.total_amount || 0); buckets[key].orders += 1; }
  });

  return { data: Object.values(buckets), error: null };
}

export async function fetchWeeklyRevenue(weeks = 12) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  cutoff.setHours(0, 0, 0, 0);

  const { data, error } = await insforge.database
    .from('orders')
    .select('total_amount, status, created_at')
    .gte('created_at', cutoff.toISOString())
    .neq('status', 'cancelled');

  if (error) return { data: [], error };

  const getWeekKey = date => {
    const d = new Date(date);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return start.toISOString().slice(0, 10);
  };

  const buckets = {};
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const key = getWeekKey(d);
    if (!buckets[key]) {
      buckets[key] = { week: key, label: `Wk ${new Date(key).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`, amount: 0, orders: 0 };
    }
  }

  (data || []).forEach(order => {
    const key = getWeekKey(order.created_at);
    if (buckets[key]) { buckets[key].amount += Number(order.total_amount || 0); buckets[key].orders += 1; }
  });

  return { data: Object.values(buckets), error: null };
}

// ─── Category Performance ─────────────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#10b981',
  '#f59e0b', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24'
];

export async function fetchCategoryPerformance() {
  const { data, error } = await insforge.database
    .from('order_items')
    .select('quantity, unit_price, product_id, products(categories(name))');

  if (error) return { data: [], error };

  const categoryTotals = {};
  const categoryCounts = {};
  (data || []).forEach(item => {
    const cat = item.products?.categories?.name || 'Other';
    const revenue = Number(item.unit_price || 0) * Number(item.quantity || 1);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + revenue;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + Number(item.quantity || 1);
  });

  const total = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
  return {
    data: Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([category, sales], i) => ({
        category, sales: Math.round(sales),
        units: categoryCounts[category] || 0,
        percentage: total > 0 ? Math.round((sales / total) * 100) : 0,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      })),
    error: null
  };
}

// ─── Order Status Distribution ─────────────────────────────────────────────────

export async function fetchOrderStatusBreakdown() {
  const { data, error } = await insforge.database
    .from('orders')
    .select('status, total_amount, created_at');

  if (error) return { data: {}, error };

  const breakdown = {};
  (data || []).forEach(o => {
    const s = o.status || 'placed';
    if (!breakdown[s]) breakdown[s] = { count: 0, revenue: 0 };
    breakdown[s].count += 1;
    breakdown[s].revenue += Number(o.total_amount || 0);
  });

  return { data: breakdown, error: null };
}

// ─── Top Products ─────────────────────────────────────────────────────────────

export async function fetchTopProducts(limit = 8) {
  const { data, error } = await insforge.database
    .from('order_items')
    .select('quantity, unit_price, product_id, products(id, name, stock, image, image_url, categories(name))');

  if (error) return { data: [], error };

  const productMap = {};
  (data || []).forEach(item => {
    const pid = item.product_id;
    if (!productMap[pid]) {
      productMap[pid] = {
        id: pid,
        name: item.products?.name || 'Unknown Product',
        category: item.products?.categories?.name || '',
        stock: item.products?.stock || 0,
        image: item.products?.image_url || item.products?.image || '',
        revenue: 0, unitsSold: 0,
      };
    }
    productMap[pid].revenue += Number(item.unit_price || 0) * Number(item.quantity || 1);
    productMap[pid].unitsSold += Number(item.quantity || 1);
  });

  return {
    data: Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, limit),
    error: null
  };
}

export async function fetchTopProductsByUnits(limit = 8) {
  const { data, error } = await insforge.database
    .from('order_items')
    .select('quantity, unit_price, product_id, products(id, name, stock, image, image_url, categories(name))');

  if (error) return { data: [], error };

  const productMap = {};
  (data || []).forEach(item => {
    const pid = item.product_id;
    if (!productMap[pid]) {
      productMap[pid] = {
        id: pid,
        name: item.products?.name || 'Unknown Product',
        category: item.products?.categories?.name || '',
        stock: item.products?.stock || 0,
        image: item.products?.image_url || item.products?.image || '',
        revenue: 0, unitsSold: 0,
      };
    }
    productMap[pid].revenue += Number(item.unit_price || 0) * Number(item.quantity || 1);
    productMap[pid].unitsSold += Number(item.quantity || 1);
  });

  return {
    data: Object.values(productMap).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, limit),
    error: null
  };
}

// ─── Low Stock Products ───────────────────────────────────────────────────────

export async function fetchLowStockProducts(threshold = 10, limit = 20) {
  const { data, error } = await insforge.database
    .from('products')
    .select('id, name, stock, image, image_url, price, categories(name)')
    .lte('stock', threshold)
    .order('stock', { ascending: true })
    .limit(limit);

  if (error) return { data: [], error };

  return {
    data: (data || []).map(p => ({
      id: p.id, name: p.name,
      stock: Number(p.stock || 0),
      image: p.image_url || p.image || '',
      price: Number(p.price || 0),
      category: p.categories?.name || 'Unknown',
    })),
    error: null
  };
}

// ─── Inventory History ────────────────────────────────────────────────────────

export async function fetchInventoryHistory(limit = 20) {
  const { data, error } = await insforge.database
    .from('inventory_history')
    .select('id, product_id, quantity_change, reason, created_at, products(name, stock, image, image_url)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error };

  return {
    data: (data || []).map(h => ({
      id: h.id,
      productName: h.products?.name || 'Unknown Product',
      productImage: h.products?.image_url || h.products?.image || '',
      currentStock: h.products?.stock || 0,
      change: Number(h.quantity_change || 0),
      reason: h.reason || 'Manual adjustment',
      createdAt: h.created_at,
    })),
    error: null
  };
}

// ─── User Analytics ───────────────────────────────────────────────────────────

export async function fetchUserGrowth(months = 6) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months + 1);
  cutoff.setDate(1);
  cutoff.setHours(0, 0, 0, 0);

  const { data, error } = await insforge.database
    .from('profiles')
    .select('id, created_at')
    .gte('created_at', cutoff.toISOString());

  if (error) return { data: [], error };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const buckets = {};
  for (let i = 0; i < months; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (months - 1 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = { month: monthNames[d.getMonth()], newUsers: 0 };
  }

  (data || []).forEach(u => {
    const d = new Date(u.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) buckets[key].newUsers += 1;
  });

  return { data: Object.values(buckets), error: null };
}

export async function fetchTopCustomers(limit = 10) {
  const { data, error } = await insforge.database
    .from('orders')
    .select('user_id, total_amount, status, created_at');

  if (error) return { data: [], error };

  const userIds = [...new Set((data || []).map(o => o.user_id).filter(Boolean))];
  const profilesMap = {};
  if (userIds.length > 0) {
    try {
      const { data: profs } = await insforge.database
        .from('profiles')
        .select('user_id, name, email, created_at')
        .in('user_id', userIds);
      (profs || []).forEach(p => {
        profilesMap[p.user_id] = p;
      });
    } catch (e) {
      console.warn('[AdminAnalytics] Could not fetch profiles for top customers:', e);
    }
  }

  const customerMap = {};
  (data || []).forEach(o => {
    const uid = o.user_id;
    if (!customerMap[uid]) {
      const prof = profilesMap[uid];
      customerMap[uid] = {
        id: uid,
        name: prof?.name || prof?.email || 'Customer',
        email: prof?.email || '',
        joinedAt: prof?.created_at,
        totalSpend: 0, orderCount: 0, lastOrderAt: null,
      };
    }
    if (o.status !== 'cancelled') customerMap[uid].totalSpend += Number(o.total_amount || 0);
    customerMap[uid].orderCount += 1;
    if (!customerMap[uid].lastOrderAt || o.created_at > customerMap[uid].lastOrderAt) {
      customerMap[uid].lastOrderAt = o.created_at;
    }
  });

  return {
    data: Object.values(customerMap).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, limit),
    error: null
  };
}

// ─── Search Analytics ─────────────────────────────────────────────────────────

export async function fetchSearchAnalytics(days = 30, limit = 20) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const { data, error } = await insforge.database
    .from('user_activity')
    .select('search_term, user_id, created_at')
    .eq('activity_type', 'search')
    .gte('created_at', cutoff.toISOString())
    .not('search_term', 'is', null);

  if (error) return { data: [], totalSearches: 0, error };

  const termMap = {};
  (data || []).forEach(a => {
    const raw = (a.search_term || '').trim();
    const key = raw.toLowerCase();
    if (key.length < 2) return;
    if (!termMap[key]) {
      termMap[key] = { term: raw, count: 0, users: new Set(), lastSearched: a.created_at };
    }
    termMap[key].count += 1;
    if (a.user_id) termMap[key].users.add(a.user_id);
    if (new Date(a.created_at) > new Date(termMap[key].lastSearched)) {
      termMap[key].lastSearched = a.created_at;
    }
  });

  return {
    data: Object.values(termMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(t => ({
        term: t.term,
        count: t.count,
        uniqueUsers: t.users.size || 1,
        lastSearched: t.lastSearched
      })),
    totalSearches: (data || []).length,
    error: null
  };
}

// ─── User Activity Breakdown ──────────────────────────────────────────────────

export async function fetchActivityBreakdown(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const { data, error } = await insforge.database
    .from('user_activity')
    .select('activity_type, created_at')
    .gte('created_at', cutoff.toISOString());

  if (error) return { data: [], total: 0, error };

  const ACTIVITY_LABELS = {
    product_view:    { label: 'Product Views',   color: '#6366f1' },
    product_click:   { label: 'Product Clicks',  color: '#8b5cf6' },
    category_view:   { label: 'Category Views',  color: '#60a5fa' },
    search:          { label: 'Searches',         color: '#f59e0b' },
    add_to_cart:     { label: 'Add to Cart',      color: '#10b981' },
    wishlist_add:    { label: 'Wishlist Adds',    color: '#ec4899' },
    purchase:        { label: 'Purchases',         color: '#34d399' },
    product_rating:  { label: 'Ratings Given',    color: '#a78bfa' },
  };

  const typeCounts = {};
  (data || []).forEach(a => {
    const t = a.activity_type || 'unknown';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  const total = Object.values(typeCounts).reduce((s, v) => s + v, 0);
  return {
    data: Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type, count,
        label: ACTIVITY_LABELS[type]?.label || type.replace(/_/g, ' '),
        color: ACTIVITY_LABELS[type]?.color || '#94a3b8',
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      })),
    total, error: null
  };
}

// ─── Recommendation Interactions ──────────────────────────────────────────────

export async function fetchRecommendationStats(limit = 15) {
  const { data, error } = await insforge.database
    .from('recommendations')
    .select('product_id, user_id, score, reason, created_at, products(id, name, image, image_url, price, categories(name))')
    .order('score', { ascending: false });

  if (error) return { data: [], summary: { total: 0, avgScore: '0.00', uniqueProducts: 0 }, error };

  const all = data || [];
  const total = all.length;
  const avgScore = total > 0 ? (all.reduce((s, r) => s + Number(r.score || 0), 0) / total).toFixed(2) : '0.00';
  const uniqueProducts = new Set(all.map(r => r.product_id)).size;

  const prodMap = {};
  all.forEach(r => {
    const pid = r.product_id;
    if (!prodMap[pid]) {
      prodMap[pid] = {
        productId: pid,
        name: r.products?.name || 'Unknown Product',
        image: r.products?.image_url || r.products?.image || '',
        price: Number(r.products?.price || 0),
        category: r.products?.categories?.name || '',
        score: Number(r.score || 0),
        reason: r.reason || 'AI recommendation',
        count: 0,
        createdAt: r.created_at
      };
    }
    prodMap[pid].count += 1;
    if (Number(r.score || 0) > prodMap[pid].score) {
      prodMap[pid].score = Number(r.score || 0);
      prodMap[pid].reason = r.reason || prodMap[pid].reason;
    }
  });

  const sorted = Object.values(prodMap)
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, limit)
    .map(p => ({
      ...p,
      score: p.score.toFixed(2),
    }));

  return {
    data: sorted,
    summary: { total, avgScore, uniqueProducts },
    error: null
  };
}

// ─── Recent Orders ────────────────────────────────────────────────────────────

export async function fetchRecentOrders(limit = 5) {
  // Use admin_get_all_orders RPC which securely joins orders, profiles, and auth.users
  try {
    const { data: rpcData, error: rpcErr } = await insforge.database.rpc('admin_get_all_orders', {
      p_limit: limit,
      p_offset: 0
    });

    if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
      return {
        data: rpcData.map(o => ({
          id: `#${(o.id || '').slice(0, 8).toUpperCase()}`,
          fullId: o.id,
          customerName: o.customer_name || o.customer_email || 'Customer',
          customerEmail: o.customer_email || '',
          total: Number(o.total_amount || 0),
          status: o.status || o.order_status || 'placed',
          paymentStatus: o.payment_status || 'pending',
          date: o.created_at,
        })),
        error: null
      };
    }
  } catch (rpcEx) {
    console.warn('[AdminAnalytics] RPC admin_get_all_orders failed, trying direct query:', rpcEx);
  }

  // Fallback query if RPC unavailable
  const { data, error } = await insforge.database
    .from('orders')
    .select('id, total_amount, status, payment_status, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error };

  return {
    data: (data || []).map(o => ({
      id: `#${o.id.slice(0, 8).toUpperCase()}`,
      fullId: o.id,
      customerName: 'Customer',
      total: Number(o.total_amount || 0),
      status: o.status || 'placed',
      paymentStatus: o.payment_status || 'pending',
      date: o.created_at,
    })),
    error: null
  };
}

// ─── Live Activity Feed ───────────────────────────────────────────────────────

export async function fetchActivityFeed(limit = 8) {
  const { data, error } = await insforge.database
    .from('notifications')
    .select('id, type, title, message, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error };

  const typeMap = {
    order_placed:      { icon: '🛒', color: '#a78bfa', actType: 'order' },
    payment_confirmed: { icon: '💳', color: '#10b981', actType: 'order' },
    payment_failed:    { icon: '⚠️', color: '#f87171', actType: 'order' },
    order_processing:  { icon: '⚙️', color: '#60a5fa', actType: 'order' },
    order_shipped:     { icon: '🚚', color: '#f59e0b', actType: 'order' },
    out_for_delivery:  { icon: '📦', color: '#a78bfa', actType: 'order' },
    order_delivered:   { icon: '✅', color: '#10b981', actType: 'order' },
    order_cancelled:   { icon: '❌', color: '#f87171', actType: 'order' },
    registration:      { icon: '👤', color: '#34d399', actType: 'user' },
    low_stock:         { icon: '📦', color: '#f59e0b', actType: 'stock' },
    price_alert:       { icon: '📉', color: '#60a5fa', actType: 'price' },
    system:            { icon: '🔔', color: '#f59e0b', actType: 'system' }
  };

  return {
    data: (data || []).map(n => {
      const meta = typeMap[n.type] || { icon: '📌', color: 'var(--primary-color)', actType: 'system' };
      return {
        id: n.id,
        text: n.message || n.title || 'Activity recorded',
        time: formatTimeAgo(new Date(n.created_at)),
        type: meta.actType,
        icon: meta.icon,
        color: meta.color
      };
    }),
    error: null
  };
}

// ─── Payment Method Distribution ─────────────────────────────────────────────

export async function fetchPaymentMethodDistribution() {
  const { data, error } = await insforge.database
    .from('payments')
    .select('payment_method, payment_status, amount');

  if (error) return { data: [], error };

  const methodMap = {};
  (data || []).forEach(p => {
    const method = normalizePaymentMethod(p.payment_method || 'Other');
    if (!methodMap[method]) methodMap[method] = { name: method, count: 0, amount: 0 };
    methodMap[method].count += 1;
    methodMap[method].amount += Number(p.amount || 0);
  });

  const total = Object.values(methodMap).reduce((s, v) => s + v.count, 0);
  return {
    data: Object.values(methodMap)
      .sort((a, b) => b.count - a.count)
      .map(m => ({ ...m, percentage: total > 0 ? Math.round((m.count / total) * 100) : 0 })),
    error: null
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function normalizePaymentMethod(raw) {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('upi')) return 'UPI';
  if (lower.includes('card') || lower.includes('credit') || lower.includes('debit')) return 'Card';
  if (lower.includes('cod')) return 'Cash on Delivery';
  if (lower.includes('net') || lower.includes('netbanking')) return 'Net Banking';
  if (lower.includes('wallet')) return 'Wallet';
  if (lower.includes('emi')) return 'EMI';
  if (lower.includes('razorpay')) return 'Razorpay';
  return raw || 'Other';
}
