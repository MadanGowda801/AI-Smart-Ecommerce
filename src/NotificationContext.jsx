import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2, Trash2, ShoppingCart, Heart, Package, Bell, X, ExternalLink, AlertCircle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useNavigation } from "./NavigationContext";
import insforge from "./insforge";

/**
 * Real Notification & Live Confirmation Toast Context
 * - Reads notifications from InsForge DB with resilient localStorage fallback for guest/offline sessions
 * - Realtime subscription: new notifications appear instantly without refresh
 * - Live floating confirmation toast notifications on product add / remove / update actions
 * - markAsRead / markAllAsRead / deleteNotification write back to DB and local storage
 */
const NotificationContext = createContext(null);

const PAGE_SIZE = 50;
const LOCAL_NOTIF_PREFIX = "smartshop_notifications_";

function getStorageKey(userId) {
  return `${LOCAL_NOTIF_PREFIX}${userId || "guest"}`;
}

function loadLocalNotifications(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalNotifications(userId, list) {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify((list || []).slice(0, 100)));
  } catch {
    // ignore storage quota errors
  }
}

function formatRelativeTime(ts) {
  if (!ts) return "Just now";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const userId = user?.id || null;

  const [notifications, setNotificationsState] = useState(() => loadLocalNotifications(userId));
  const [toasts, setToasts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const realtimeRef = useRef(null);

  const setNotifications = useCallback((updater) => {
    setNotificationsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const safeNext = Array.isArray(next) ? next : [];
      saveLocalNotifications(userId, safeNext);
      return safeNext;
    });
  }, [userId]);

  // ── Toast helpers ─────────────────────────────────────────────────────────
  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const showToast = useCallback(({
    title,
    message,
    variant = "added", // 'added' | 'removed' | 'wishlist' | 'catalog' | 'info'
    image = null,
    actionLabel = null,
    link_page = null,
    link_params = null,
    duration = 4000
  }) => {
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast = {
      id: toastId,
      title,
      message,
      variant,
      image,
      actionLabel,
      link_page,
      link_params,
      createdAt: Date.now()
    };

    setToasts((prev) => [newToast, ...prev.slice(0, 3)]);

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(toastId);
      }, duration);
    }

    return toastId;
  }, [dismissToast]);

  // ── Fetch notifications from DB ───────────────────────────────────────────
  const fetchNotifications = useCallback(async (offset = 0) => {
    const localCached = loadLocalNotifications(userId);
    if (!userId) {
      setNotificationsState(localCached);
      return;
    }

    if (offset === 0) setIsLoading(true);
    try {
      const { data, error } = await insforge.database
        .from("notifications")
        .select("id, title, message, type, is_read, link_page, link_params, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        if (offset === 0 && localCached.length > 0) {
          setNotificationsState(localCached);
        }
        return;
      }

      const dbRows = data || [];
      setHasMore(dbRows.length === PAGE_SIZE);

      if (offset === 0) {
        // Merge any local-only notifications not yet in DB
        const dbIds = new Set(dbRows.map((r) => r.id));
        const unsyncedLocal = localCached.filter((l) => l.isLocalOnly && !dbIds.has(l.id));
        const merged = [...unsyncedLocal, ...dbRows].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setNotifications(merged);
      } else {
        setNotifications((prev) => [...prev, ...dbRows]);
      }
    } catch {
      if (offset === 0 && localCached.length > 0) {
        setNotificationsState(localCached);
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId, setNotifications]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const localCached = loadLocalNotifications(userId);
    setNotificationsState(localCached);

    if (!userId) return;

    fetchNotifications(0);

    let channel = null;
    try {
      channel = insforge.realtime
        ?.channel(`notifications:${userId}`)
        ?.on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          if (payload?.new) {
            setNotifications((prev) => {
              if (prev.some((n) => n.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          }
        })
        ?.on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          if (payload?.new) {
            setNotifications((prev) =>
              prev.map((n) => (n.id === payload.new.id ? payload.new : n))
            );
          }
        })
        ?.on("postgres_changes", {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          if (payload?.old?.id) {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
          }
        })
        ?.subscribe();
      realtimeRef.current = channel;
    } catch (e) {
      console.warn("[NotificationContext] realtime unavailable:", e.message);
    }

    return () => {
      try { realtimeRef.current?.unsubscribe?.(); } catch {}
      realtimeRef.current = null;
    };
  }, [userId, fetchNotifications, setNotifications]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // ── Mark single as read ───────────────────────────────────────────────────
  const markAsRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    if (!userId || String(id).startsWith("local-")) return;
    try {
      await insforge.database
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", userId);
    } catch {}
  }, [userId, setNotifications]);

  // ── Mark all as read ──────────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    if (!userId) return;
    try {
      await insforge.database
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
    } catch {}
  }, [userId, setNotifications]);

  // ── Delete single notification ────────────────────────────────────────────
  const deleteNotification = useCallback(async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!userId || String(id).startsWith("local-")) return;
    try {
      await insforge.database
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
    } catch {}
  }, [userId, setNotifications]);

  // ── Clear all notifications ───────────────────────────────────────────────
  const clearAll = useCallback(async () => {
    setNotifications([]);
    if (!userId) return;
    try {
      await insforge.database
        .from("notifications")
        .delete()
        .eq("user_id", userId);
    } catch {}
  }, [userId, setNotifications]);

  // ── Send a notification + show confirmation toast ─────────────────────────
  const sendNotification = useCallback(async ({
    title,
    message,
    type = "system",
    link_page = null,
    link_params = null,
    variant = null,
    image = null,
    actionLabel = null,
    toast = true
  }) => {
    const inferredVariant = variant || (
      (title || "").toLowerCase().includes("remove") || (title || "").toLowerCase().includes("delete") || (title || "").toLowerCase().includes("clear")
        ? "removed"
        : (title || "").toLowerCase().includes("wishlist")
        ? "wishlist"
        : "added"
    );

    if (toast) {
      showToast({
        title,
        message,
        variant: inferredVariant,
        image,
        actionLabel: actionLabel || (link_page === "cart" ? "View Cart" : link_page === "wishlist" ? "View Wishlist" : link_page === "admin-products" ? "View Catalog" : null),
        link_page,
        link_params
      });
    }

    const fallbackNotif = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId || "guest",
      title,
      message,
      type,
      is_read: false,
      link_page,
      link_params,
      created_at: new Date().toISOString(),
      isLocalOnly: true
    };

    // Optimistic insert into notification list immediately
    setNotifications((prev) => [fallbackNotif, ...prev]);

    if (!userId) return fallbackNotif;

    try {
      const { data, error } = await insforge.database
        .from("notifications")
        .insert([{ user_id: userId, title, message, type, is_read: false, link_page, link_params }])
        .select()
        .single();
      if (!error && data) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === fallbackNotif.id ? data : n))
        );
        return data;
      }
    } catch {
      // Keep local notification on network/DB error
    }
    return fallbackNotif;
  }, [userId, showToast, setNotifications]);

  const addNotification = sendNotification;

  const loadMore = useCallback(() => {
    fetchNotifications(notifications.length);
  }, [fetchNotifications, notifications.length]);

  const normalised = notifications.map((n) => ({
    ...n,
    read: n.is_read,
    time: formatRelativeTime(n.created_at),
    link: n.link_page ? { page: n.link_page, params: n.link_params } : null
  }));

  // Render toast icon and accent colors based on variant
  const getToastStyle = (variant) => {
    switch (variant) {
      case "removed":
        return {
          border: "1px solid rgba(239, 68, 68, 0.45)",
          accent: "#ef4444",
          iconBg: "rgba(239, 68, 68, 0.15)",
          icon: <Trash2 size={18} color="#f87171" />
        };
      case "wishlist":
        return {
          border: "1px solid rgba(236, 72, 153, 0.45)",
          accent: "#ec4899",
          iconBg: "rgba(236, 72, 153, 0.15)",
          icon: <Heart size={18} color="#f472b6" fill="#f472b6" />
        };
      case "catalog":
        return {
          border: "1px solid rgba(99, 102, 241, 0.45)",
          accent: "#6366f1",
          iconBg: "rgba(99, 102, 241, 0.15)",
          icon: <Package size={18} color="#818cf8" />
        };
      case "warning":
        return {
          border: "1px solid rgba(245, 158, 11, 0.45)",
          accent: "#f59e0b",
          iconBg: "rgba(245, 158, 11, 0.15)",
          icon: <AlertCircle size={18} color="#fbbf24" />
        };
      case "added":
      default:
        return {
          border: "1px solid rgba(16, 185, 129, 0.45)",
          accent: "#10b981",
          iconBg: "rgba(16, 185, 129, 0.15)",
          icon: <CheckCircle2 size={18} color="#10b981" />
        };
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications: normalised,
      unreadCount,
      isLoading,
      hasMore,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      clearNotification: deleteNotification,
      sendNotification,
      addNotification,
      showToast,
      dismissToast,
      loadMore,
      refresh: () => fetchNotifications(0)
    }}>
      {children}

      {/* Global Live Confirmation Notification Toasts */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            top: "82px",
            right: "20px",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxWidth: "380px",
            width: "calc(100vw - 40px)",
            pointerEvents: "none"
          }}
        >
          {toasts.map((t) => {
            const styleMeta = getToastStyle(t.variant);
            return (
              <div
                key={t.id}
                style={{
                  pointerEvents: "auto",
                  background: "rgba(15, 20, 35, 0.96)",
                  backdropFilter: "blur(16px)",
                  border: styleMeta.border,
                  borderLeft: `4px solid ${styleMeta.accent}`,
                  borderRadius: "14px",
                  padding: "12px 14px",
                  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.55)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  color: "#fff",
                  animation: "fadeIn 0.22s ease-out"
                }}
              >
                {/* Product Thumbnail or Icon */}
                {t.image ? (
                  <div style={{ position: "relative", width: "44px", height: "44px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <img
                      src={t.image}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                    <div style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      background: "#0f1423",
                      borderRadius: "50%",
                      padding: "2px",
                      display: "flex"
                    }}>
                      {styleMeta.icon}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    background: styleMeta.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    {styleMeta.icon}
                  </div>
                )}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#f8fafc", lineHeight: 1.3, marginBottom: "2px" }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#cbd5e1", lineHeight: 1.4, wordBreak: "break-word" }}>
                    {t.message}
                  </div>

                  {t.actionLabel && t.link_page && (
                    <button
                      onClick={() => {
                        dismissToast(t.id);
                        navigate(t.link_page, t.link_params ? { params: t.link_params } : undefined);
                      }}
                      style={{
                        marginTop: "7px",
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        color: styleMeta.accent,
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <span>{t.actionLabel}</span>
                      <ExternalLink size={11} />
                    </button>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => dismissToast(t.id)}
                  aria-label="Close notification"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "2px",
                    flexShrink: 0
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}

export default NotificationContext;
