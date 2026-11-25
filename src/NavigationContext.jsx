import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const NavigationContext = createContext(null);

/**
 * Hash-based router supporting deep links, browser back/forward buttons,
 * dynamic parameters (:id), and query parameters (?q=...).
 */
export function NavigationProvider({ children }) {
  // Parse initial route from window.location.hash
  const parseHash = useCallback(() => {
    const rawHash = window.location.hash.replace(/^#\/?/, '');
    if (!rawHash) {
      return { path: 'home', params: {}, query: {} };
    }

    const [pathPart, queryPart] = rawHash.split('?');
    const segments = pathPart.split('/').filter(Boolean);

    // Query parameters
    const query = {};
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      for (const [key, value] of searchParams.entries()) {
        query[key] = value;
      }
    }

    // Route matching
    // Customer routes:
    if (segments.length === 0 || segments[0] === 'home') {
      return { path: 'home', params: {}, query };
    }
    if (segments[0] === 'products') {
      return { path: 'products', params: {}, query };
    }
    if (segments[0] === 'product' && segments[1]) {
      return { path: 'product-details', params: { id: segments[1] }, query };
    }
    if (segments[0] === 'categories') {
      return { path: 'categories', params: {}, query };
    }
    if (segments[0] === 'search') {
      return { path: 'search', params: {}, query };
    }
    if (segments[0] === 'cart') {
      return { path: 'cart', params: {}, query };
    }
    if (segments[0] === 'wishlist') {
      return { path: 'wishlist', params: {}, query };
    }
    if (segments[0] === 'login') {
      return { path: 'login', params: {}, query };
    }
    if (segments[0] === 'register') {
      return { path: 'register', params: {}, query };
    }
    if (segments[0] === 'profile') {
      return { path: 'profile', params: {}, query };
    }
    if (segments[0] === 'checkout') {
      return { path: 'checkout', params: {}, query };
    }
    if (segments[0] === 'orders') {
      return { path: 'orders', params: {}, query };
    }
    if (segments[0] === 'order' && segments[1]) {
      return { path: 'order-details', params: { id: segments[1] }, query };
    }
    if (segments[0] === 'order-tracking') {
      return { path: 'order-tracking', params: { id: segments[1] || '' }, query };
    }
    if (segments[0] === 'order-confirmation') {
      return { path: 'order-confirmation', params: { id: segments[1] || '' }, query };
    }
    if (segments[0] === 'notifications') {
      return { path: 'notifications', params: {}, query };
    }

    // Direct admin-* routes in hash (e.g., #/admin-dashboard, #/admin-returns)
    if (segments[0] && segments[0].startsWith('admin-')) {
      return { path: segments[0], params: {}, query };
    }

    // Admin routes:
    if (segments[0] === 'admin') {
      const sub = segments[1] || 'dashboard';
      if (sub === 'login') return { path: 'admin-login', params: {}, query };
      if (sub === 'dashboard') return { path: 'admin-dashboard', params: {}, query };
      if (sub === 'add-product') return { path: 'admin-add-product', params: {}, query };
      if (sub === 'edit-product') return { path: 'admin-edit-product', params: { id: segments[2] || '', productId: segments[2] || '' }, query };
      if (sub === 'products') {
        if (segments[2] === 'add') return { path: 'admin-add-product', params: {}, query };
        if (segments[2] === 'edit' && segments[3]) return { path: 'admin-edit-product', params: { id: segments[3], productId: segments[3] }, query };
        return { path: 'admin-products', params: {}, query };
      }
      if (sub === 'inventory') return { path: 'admin-inventory', params: {}, query };
      if (sub === 'orders') return { path: 'admin-orders', params: {}, query };
      if (sub === 'users') return { path: 'admin-users', params: {}, query };
      if (sub === 'sales-analytics') return { path: 'admin-sales-analytics', params: {}, query };
      if (sub === 'customer-analytics') return { path: 'admin-customer-analytics', params: {}, query };
      if (sub === 'returns') return { path: 'admin-returns', params: {}, query };
      return { path: 'admin-dashboard', params: {}, query };
    }

    // Default fallback
    return { path: 'home', params: {}, query };
  }, []);

  const [routeInfo, setRouteInfo] = useState(() => parseHash());

  useEffect(() => {
    const handleHashChange = () => {
      setRouteInfo(parseHash());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [parseHash]);

  const navigate = useCallback((targetPath, options = {}) => {
    // Support options as direct params (e.g. { productId: '...' } or { id: '...' }) or { params: {...}, query: {...} }
    const rawParams = options.params || options || {};
    const query = options.query || {};
    const targetId = rawParams.id || rawParams.productId || options.id || options.productId || '';
    let hashUrl = '#/';

    switch (targetPath) {
      case 'home':
        hashUrl = '#/';
        break;
      case 'products':
        hashUrl = '#/products';
        break;
      case 'product-details':
        hashUrl = `#/product/${targetId}`;
        break;
      case 'categories':
        hashUrl = '#/categories';
        break;
      case 'search':
        hashUrl = '#/search';
        break;
      case 'cart':
        hashUrl = '#/cart';
        break;
      case 'wishlist':
        hashUrl = '#/wishlist';
        break;
      case 'login':
        hashUrl = '#/login';
        break;
      case 'register':
        hashUrl = '#/register';
        break;
      case 'profile':
        hashUrl = '#/profile';
        break;
      case 'checkout':
        hashUrl = '#/checkout';
        break;
      case 'orders':
        hashUrl = '#/orders';
        break;
      case 'order-details':
        hashUrl = `#/order/${targetId}`;
        break;
      case 'order-tracking':
        hashUrl = targetId ? `#/order-tracking/${targetId}` : '#/order-tracking';
        break;
      case 'order-confirmation':
        hashUrl = targetId ? `#/order-confirmation/${targetId}` : '#/order-confirmation';
        break;
      case 'notifications':
        hashUrl = '#/notifications';
        break;

      // Admin routes
      case 'admin-login':
        hashUrl = '#/admin/login';
        break;
      case 'admin-dashboard':
        hashUrl = '#/admin/dashboard';
        break;
      case 'admin-products':
        hashUrl = '#/admin/products';
        break;
      case 'admin-add-product':
        hashUrl = '#/admin/products/add';
        break;
      case 'admin-edit-product':
        hashUrl = `#/admin/products/edit/${targetId}`;
        break;
      case 'admin-inventory':
        hashUrl = '#/admin/inventory';
        break;
      case 'admin-orders':
        hashUrl = '#/admin/orders';
        break;
      case 'admin-users':
        hashUrl = '#/admin/users';
        break;
      case 'admin-sales-analytics':
        hashUrl = '#/admin/sales-analytics';
        break;
      case 'admin-customer-analytics':
        hashUrl = '#/admin/customer-analytics';
        break;
      case 'admin-returns':
        hashUrl = '#/admin/returns';
        break;

      default:
        hashUrl = targetPath.startsWith('#') ? targetPath : `#/${targetPath}`;
    }

    // Attach query parameters if provided
    const queryEntries = Object.entries(query);
    if (queryEntries.length > 0) {
      const qParams = new URLSearchParams();
      queryEntries.forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          qParams.append(k, v);
        }
      });
      const qString = qParams.toString();
      if (qString) {
        hashUrl += `?${qString}`;
      }
    }

    if (window.location.hash !== hashUrl) {
      window.location.hash = hashUrl;
    }
    // Update routeInfo immediately with the exact targetPath so React renders the page synchronously
    setRouteInfo({
      path: targetPath,
      params: {
        id: targetId,
        productId: targetId,
        orderId: targetId,
        ...(typeof rawParams === 'object' ? rawParams : {})
      },
      query: query || {}
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const combinedParams = {
    ...(routeInfo.params || {}),
    productId: routeInfo.params?.id || '',
    orderId: routeInfo.params?.id || '',
  };

  return (
    <NavigationContext.Provider
      value={{
        currentPath: routeInfo.path,
        params: combinedParams,
        currentParams: combinedParams,
        query: routeInfo.query || {},
        navigate,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

export default NavigationContext;
