import React, { useState } from "react";
import { useNavigation } from "./NavigationContext";
import { useNotifications } from "./NotificationContext";
import {
  Bell, Check, Trash2, ExternalLink, CheckCheck,
  Truck, Package, CreditCard, ShieldCheck, ShieldX,
  UserCheck, RefreshCw, Loader, AlertCircle, Inbox,
  MapPin, ShoppingBag, Star, ShoppingCart, Heart
} from "lucide-react";
import Breadcrumb from "./Breadcrumb";

// ── Icon & colour per notification type / title keyword ────────────────────────
function getNotifMeta(notif) {
  const title = (notif.title || "").toLowerCase();
  const type  = (notif.type  || "system").toLowerCase();

  if (title.includes("added to cart"))
    return { icon: <ShoppingCart size={18} />, color: "#10b981", bg: "rgba(16,185,129,0.12)" };
  if (title.includes("removed from cart") || title.includes("cart cleared") || title.includes("removed from catalog") || title.includes("removed from wishlist"))
    return { icon: <Trash2 size={18} />, color: "#f87171", bg: "rgba(239,68,68,0.12)" };
  if (title.includes("wishlist"))
    return { icon: <Heart size={18} />, color: "#ec4899", bg: "rgba(236,72,153,0.12)" };
  if (title.includes("added to catalog") || title.includes("product details updated") || title.includes("stock updated"))
    return { icon: <Package size={18} />, color: "#10b981", bg: "rgba(16,185,129,0.12)" };
  if (title.includes("welcome") || title.includes("registered") || title.includes("account"))
    return { icon: <UserCheck size={18} />, color: "#818cf8", bg: "rgba(129,140,248,0.12)" };
  if (title.includes("payment confirmed") || title.includes("paid") || title.includes("payment success"))
    return { icon: <CreditCard size={18} />, color: "#10b981", bg: "rgba(16,185,129,0.12)" };
  if (title.includes("payment fail") || title.includes("failed"))
    return { icon: <ShieldX size={18} />, color: "#f87171", bg: "rgba(239,68,68,0.12)" };
  if (title.includes("order placed") || title.includes("order confirmed") || title.includes("order received"))
    return { icon: <ShoppingBag size={18} />, color: "#38bdf8", bg: "rgba(56,189,248,0.12)" };
  if (title.includes("processing") || title.includes("packed"))
    return { icon: <Package size={18} />, color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
  if (title.includes("shipped") || title.includes("dispatched"))
    return { icon: <Truck size={18} />, color: "#818cf8", bg: "rgba(129,140,248,0.12)" };
  if (title.includes("out for delivery") || title.includes("on the way"))
    return { icon: <MapPin size={18} />, color: "#ec4899", bg: "rgba(236,72,153,0.12)" };
  if (title.includes("delivered") || title.includes("delivery success"))
    return { icon: <CheckCheck size={18} />, color: "#10b981", bg: "rgba(16,185,129,0.12)" };
  if (title.includes("cancelled") || title.includes("cancel"))
    return { icon: <AlertCircle size={18} />, color: "#f87171", bg: "rgba(239,68,68,0.12)" };
  if (type === "order")
    return { icon: <Package size={18} />, color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
  if (type === "promotion")
    return { icon: <Star size={18} />, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
  return { icon: <Bell size={18} />, color: "#818cf8", bg: "rgba(129,140,248,0.12)" };
}

const FILTERS = [
  { id: "all",    label: "All" },
  { id: "unread", label: "Unread" },
  { id: "orders", label: "Orders" },
  { id: "system", label: "System" },
];

export default function NotificationsPage() {
  const { navigate } = useNavigation();
  const {
    notifications, unreadCount, isLoading, hasMore,
    markAsRead, markAllAsRead, deleteNotification, clearAll, loadMore, refresh
  } = useNotifications();

  const [filter, setFilter] = useState("all");
  const [clearConfirm, setClearConfirm] = useState(false);

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !n.is_read;
    if (filter === "orders") return n.type === "order";
    if (filter === "system") return n.type === "system";
    return true;
  });

  const handleClearAll = async () => {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 3000); return; }
    await clearAll();
    setClearConfirm(false);
  };

  return (
    <div className="container" style={{ padding: "32px 1rem 64px", maxWidth: "860px" }}>
      <Breadcrumb items={[{ label: "Notifications" }]} />

      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <Bell size={24} color="#818cf8" />
            Notifications
            {unreadCount > 0 && (
              <span style={{ fontSize: "0.78rem", background: "#6366f1", color: "#fff", padding: "3px 10px", borderRadius: "12px", fontWeight: 700 }}>
                {unreadCount} new
              </span>
            )}
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: "6px 0 0", fontSize: "0.88rem" }}>
            Order updates, payment alerts, and account notifications — all from the database.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={refresh} className="btn btn-secondary" style={{ fontSize: "0.8rem", padding: "7px 12px", display: "flex", alignItems: "center", gap: "5px" }}>
            <RefreshCw size={13} /> Refresh
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="btn btn-secondary" style={{ fontSize: "0.8rem", padding: "7px 12px", display: "flex", alignItems: "center", gap: "5px" }}>
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "7px 12px", display: "flex", alignItems: "center", gap: "5px", color: clearConfirm ? "#f87171" : "var(--text-secondary)", borderColor: clearConfirm ? "rgba(239,68,68,0.4)" : undefined }}
            >
              <Trash2 size={13} /> {clearConfirm ? "Confirm clear?" : "Clear all"}
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "20px" }}>
        {FILTERS.map(tab => {
          const count = tab.id === "unread" ? unreadCount
            : tab.id === "orders" ? notifications.filter(n => n.type === "order").length
            : tab.id === "system" ? notifications.filter(n => n.type === "system").length
            : notifications.length;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: "7px 16px", borderRadius: "20px", border: "none",
                fontSize: "0.82rem", fontWeight: filter === tab.id ? 700 : 500,
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                background: filter === tab.id ? "var(--primary-color, #6366f1)" : "rgba(255,255,255,0.05)",
                color: filter === tab.id ? "#fff" : "var(--text-secondary)"
              }}
            >
              {tab.label} {count > 0 && <span style={{ opacity: 0.75 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && notifications.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <Loader size={32} style={{ animation: "spin 1s linear infinite", color: "#818cf8", margin: "0 auto 1rem" }} />
          <p style={{ color: "var(--text-secondary)" }}>Loading notifications…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(129,140,248,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <Inbox size={32} color="#818cf8" />
          </div>
          <h3 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
            {filter === "unread" ? "You're all caught up!" : "No notifications here"}
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
            {filter === "unread" ? "No unread notifications. Great job staying on top of things." : "Notifications for orders, payments, and account events will appear here."}
          </p>
          <button className="btn btn-primary" onClick={() => navigate("products")} style={{ marginTop: "1.5rem", fontSize: "0.875rem" }}>
            Start Shopping
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.map((notif) => {
              const meta = getNotifMeta(notif);
              return (
                <div
                  key={notif.id}
                  style={{
                    padding: "16px 18px",
                    borderRadius: "14px",
                    display: "flex",
                    gap: "14px",
                    alignItems: "flex-start",
                    background: notif.is_read ? "rgba(255,255,255,0.02)" : "rgba(99,102,241,0.06)",
                    border: notif.is_read ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(99,102,241,0.25)",
                    transition: "all 0.2s",
                    cursor: notif.link ? "pointer" : "default"
                  }}
                  onClick={() => {
                    if (notif.link?.page) {
                      markAsRead(notif.id);
                      navigate(notif.link.page, notif.link.params ? { params: notif.link.params } : undefined);
                    }
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
                    background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center",
                    color: meta.color
                  }}>
                    {meta.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "3px" }}>
                      <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: notif.is_read ? 600 : 700, color: notif.is_read ? "var(--text-primary)" : "#fff", lineHeight: 1.3 }}>
                        {notif.title}
                        {!notif.is_read && (
                          <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#6366f1", marginLeft: "8px", verticalAlign: "middle", flexShrink: 0 }} />
                        )}
                      </h4>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {notif.time}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 10px", fontSize: "0.83rem", color: notif.is_read ? "var(--text-secondary)" : "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
                      {notif.message}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      {notif.link?.page && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); navigate(notif.link.page, notif.link.params ? { params: notif.link.params } : undefined); }}
                          style={{ background: "none", border: "none", color: meta.color, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          View details <ExternalLink size={11} />
                        </button>
                      )}
                      {!notif.is_read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                          style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.78rem", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <Check size={12} /> Mark read
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                        style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.78rem", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: "4px", marginLeft: "auto", opacity: 0.6 }}
                        title="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <button onClick={loadMore} className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
                Load more notifications
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
