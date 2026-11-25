import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import ordersService, { addressService } from "./ordersService";

const OrdersContext = createContext(null);

export function OrdersProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === "admin@smartshop.in";

  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!userId) { setOrders([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await ordersService.getUserOrders(userId);
      if (fetchErr) { setError(fetchErr.message || "Failed to load orders"); }
      else { setOrders(data || []); }
    } catch (err) {
      setError(err.message || "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const fetchAddresses = useCallback(async () => {
    if (!userId) { setAddresses([]); return; }
    const { data } = await addressService.getSavedAddresses(userId);
    setAddresses(data || []);
  }, [userId]);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const getOrderById = useCallback(async (orderId) => {
    const cached = orders.find((o) => o.id === orderId);
    if (cached) return cached;
    const { data } = await ordersService.getOrderById(orderId);
    return data || null;
  }, [orders]);

  const getOrderTimeline = useCallback(async (orderId) => {
    const { data, error: tlErr } = await ordersService.getOrderTimeline(orderId);
    if (tlErr) console.warn("[OrdersContext] timeline error:", tlErr);
    return data || [];
  }, []);

  const placeOrder = useCallback(async (orderParams) => {
    if (!userId) throw new Error("Must be logged in to place an order");
    setIsPlacingOrder(true);
    try {
      const { data, error: createErr } = await ordersService.createOrder({ userId, ...orderParams });
      if (createErr) throw createErr;
      if (data) await fetchOrders();
      return data;
    } finally {
      setIsPlacingOrder(false);
    }
  }, [userId, fetchOrders]);

  const cancelOrder = useCallback(async (orderId) => {
    const { data, error: cancelErr } = await ordersService.cancelOrder(orderId);
    if (cancelErr) return { success: false, error: cancelErr };
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o)));
    return { success: true, data };
  }, []);

  const adminUpdateOrderStatus = useCallback(async (orderId, newStatus, location = null, notes = null) => {
    const { data, error: updateErr } = await ordersService.adminUpdateOrderStatus(orderId, newStatus, location, notes);
    if (updateErr) return { success: false, error: updateErr };
    await fetchOrders();
    return { success: true, data };
  }, [fetchOrders]);

  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    return adminUpdateOrderStatus(orderId, newStatus);
  }, [adminUpdateOrderStatus]);

  const adminGetAllOrders = useCallback(async (filters = {}) => {
    return ordersService.adminGetAllOrders(filters);
  }, []);

  const saveAddress = useCallback(async (addressData) => {
    const { data, error: saveErr } = await addressService.saveAddress(userId, addressData);
    if (!saveErr) await fetchAddresses();
    return { data, error: saveErr };
  }, [userId, fetchAddresses]);

  const deleteAddress = useCallback(async (addressId) => {
    const { error: delErr } = await addressService.deleteAddress(addressId);
    if (!delErr) setAddresses((prev) => prev.filter((a) => a.id !== addressId));
    return { error: delErr };
  }, []);

  const setDefaultAddress = useCallback(async (addressId) => {
    await addressService.setDefaultAddress(userId, addressId);
    await fetchAddresses();
  }, [userId, fetchAddresses]);

  const updateLocalOrderPayment = useCallback((orderId, updates) => {
    const updated = ordersService.updateLocalOrderPayment(orderId, updates);
    if (updated) {
      setOrders((prev) => {
        const exists = prev.some((o) => String(o.id) === String(orderId));
        return exists
          ? prev.map((o) => (String(o.id) === String(orderId) ? updated : o))
          : [updated, ...prev];
      });
    }
    return updated;
  }, []);

  const value = {
    orders, addresses, isLoading, isPlacingOrder, error, isAdmin,
    fetchOrders, fetchAddresses,
    getOrderById, getOrderTimeline,
    placeOrder, cancelOrder, updateLocalOrderPayment,
    adminUpdateOrderStatus, updateOrderStatus, adminGetAllOrders,
    saveAddress, deleteAddress, setDefaultAddress
  };

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error("useOrders must be used within an OrdersProvider");
  return context;
}

export default OrdersContext;
