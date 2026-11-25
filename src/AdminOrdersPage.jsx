import React, { useState, useEffect, useCallback, useRef } from "react";
import { useOrders } from "./OrdersContext";
import AdminHeader from "./AdminHeader";
import { useNavigation } from "./NavigationContext";
import {
  Search, Eye, RefreshCw, ChevronDown, Package, Truck,
  CheckCircle, XCircle, Clock, AlertCircle, Loader, X
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  { value: "placed",            label: "Pending",              icon: "🕐", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  { value: "payment_confirmed", label: "Payment Confirmed",    icon: "✅", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  { value: "processing",        label: "Processing",           icon: "📦", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  { value: "shipped",           label: "Shipped",              icon: "🚚", color: "#818cf8", bg: "rgba(129,140,248,0.12)" },
  { value: "out_for_delivery",  label: "Out for Delivery",     icon: "🛵", color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
  { value: "delivered",         label: "Delivered",            icon: "📬", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  { value: "cancelled",         label: "Cancelled",            icon: "❌", color: "#f87171", bg: "rgba(239,68,68,0.12)" },
];

const STATUS_MAP = Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s]));

function getStatusStyle(status) {
  return STATUS_MAP[status] || { label: status, icon: "📋", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" };
}

function formatINR(n) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = getStatusStyle(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem",
      fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap"
    }}>
      {s.icon} {s.label}
    </span>
  );
}

// ── Payment Status Badge ───────────────────────────────────────────────────────
function PaymentBadge({ status }) {
  const cfg = {
    paid:      { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Paid" },
    pending:   { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", label: "Pending" },
    failed:    { color: "#f87171", bg: "rgba(239,68,68,0.12)",  label: "Failed" },
    cancelled: { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", label: "Cancelled" },
  }[status] || { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: status || "—" };
  return (
    <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "0.72rem", fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── Status Dropdown ───────────────────────────────────────────────────────────
function StatusDropdown({ order, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const current = getStatusStyle(order.status || order.order_status);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = async (newStatus) => {
    if (newStatus === (order.status || order.order_status)) { setOpen(false); return; }
    setLoading(true);
    setOpen(false);
    await onUpdate(order.id, newStatus);
    setLoading(false);
  };

  // Cannot change delivered or cancelled orders
  const isLocked = ["delivered", "cancelled"].includes(order.status || order.order_status);

  if (loading) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
        <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> Updating…
      </span>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => !isLocked && setOpen(!open)}
        disabled={isLocked}
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          padding: "5px 10px", borderRadius: "8px", fontSize: "0.78rem",
          fontWeight: 700, border: `1px solid ${current.color}40`,
          background: current.bg, color: current.color,
          cursor: isLocked ? "default" : "pointer",
          opacity: isLocked ? 0.7 : 1
        }}
      >
        {current.icon} {current.label}
        {!isLocked && <ChevronDown size={13} />}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "var(--bg-card, #1a1f2e)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "12px", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          minWidth: "200px"
        }}>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => handleSelect(s.value)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", padding: "10px 14px", fontSize: "0.82rem",
                fontWeight: 600, textAlign: "left", border: "none",
                color: s.value === (order.status || order.order_status) ? s.color : "var(--text-primary)",
                cursor: "pointer",
                background: s.value === (order.status || order.order_status) ? s.bg : "transparent"
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main AdminOrdersPage ──────────────────────────────────────────────────────
export default function AdminOrdersPage() {
  const { navigate } = useNavigation();
  const { adminGetAllOrders, adminUpdateOrderStatus } = useOrders();

  const [allOrders, setAllOrders] = useState([]);
  const [baseOrders, setBaseOrders] = useState([]); // Master list for status badge counts
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [toast, setToast] = useState(null);
  const searchTimeout = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadOrders = useCallback(async (statusFilter, searchFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      // Strip leading '#' and extra whitespace so '#EA244476' searches for 'EA244476'
      const cleanSearch = (searchFilter || "").trim().replace(/^[#\s]+|[#\s]+$/g, "");

      const { data, error: fetchErr } = await adminGetAllOrders({
        status: statusFilter === "all" ? null : statusFilter,
        search: cleanSearch || null,
        limit: 200
      });

      if (fetchErr) {
        setError(fetchErr.message || "Failed to load orders");
        setAllOrders([]);
      } else {
        const fetched = data || [];
        setAllOrders(fetched);
        // If this was an unfiltered query, update master base orders for tab counts
        if (statusFilter === "all" && !cleanSearch) {
          setBaseOrders(fetched);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }, [adminGetAllOrders]);

  // Initial load of master orders list
  useEffect(() => {
    adminGetAllOrders({ status: null, search: null, limit: 200 }).then(({ data }) => {
      if (data) setBaseOrders(data);
    });
  }, [adminGetAllOrders]);

  useEffect(() => {
    loadOrders(filterStatus, search);
  }, [filterStatus, search, loadOrders]);

  const handleSearchInput = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val.trim());
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      clearTimeout(searchTimeout.current);
      setSearch(searchInput.trim());
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    const { success, error: updateErr } = await adminUpdateOrderStatus(orderId, newStatus);
    if (success) {
      const st = getStatusStyle(newStatus);
      setAllOrders((prev) => prev.map((o) =>
        o.id === orderId ? { ...o, status: newStatus, order_status: newStatus } : o
      ));
      setBaseOrders((prev) => prev.map((o) =>
        o.id === orderId ? { ...o, status: newStatus, order_status: newStatus } : o
      ));
      showToast(`${st.icon} Order updated to "${st.label}"`, "success");
    } else {
      showToast(`Failed to update: ${updateErr?.message || "Unknown error"}`, "error");
    }
  };

  // Count per status from master baseOrders so tabs stay informative during search
  const countSource = baseOrders.length > 0 ? baseOrders : allOrders;
  const countByStatus = ORDER_STATUSES.reduce((acc, s) => {
    acc[s.value] = countSource.filter((o) => (o.status || o.order_status) === s.value).length;
    return acc;
  }, {});
  countByStatus.all = countSource.length;

  return (
    <div>
      <AdminHeader
        title="Orders & Fulfillment"
        subtitle={`${allOrders.length} order${allOrders.length !== 1 ? "s" : ""} ${search ? `matching "${search}"` : "total"} — update status and track deliveries in real time`}
      />

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          padding: "12px 20px", borderRadius: "12px", fontWeight: 600, fontSize: "0.88rem",
          background: toast.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: toast.type === "success" ? "#10b981" : "#f87171",
          backdropFilter: "blur(12px)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          animation: "fadeInUp 0.3s ease"
        }}>
          {toast.msg}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "20px" }}>
        {[{ value: "all", label: "All", icon: "📋" }, ...ORDER_STATUSES].map((s) => {
          const count = countByStatus[s.value] ?? 0;
          const isActive = filterStatus === s.value;
          return (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              style={{
                padding: "7px 14px", borderRadius: "20px", border: "none",
                fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "5px",
                background: isActive ? "var(--primary-color, #6366f1)" : "rgba(255,255,255,0.05)",
                color: isActive ? "#fff" : "var(--text-secondary)"
              }}
            >
              {s.icon} {s.label} <span style={{ opacity: 0.7, fontWeight: 500 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Search + Refresh */}
      <div className="card-glass" style={{ padding: "14px 16px", borderRadius: "12px", marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: "440px" }}>
          <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
          <input
            type="text"
            placeholder="Search by Order ID (e.g. #EA244476), customer, email, AWB…"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%", padding: "9px 12px 9px 34px", borderRadius: "8px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--text-primary)", fontSize: "0.85rem"
            }}
          />
          {searchInput && (
            <button onClick={clearSearch}
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => loadOrders(filterStatus, search)}
          className="btn btn-secondary"
          style={{ fontSize: "0.8rem", padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="card-glass" style={{ padding: "3rem", textAlign: "center", borderRadius: "16px" }}>
          <Loader size={32} style={{ animation: "spin 1s linear infinite", color: "#818cf8", margin: "0 auto 1rem" }} />
          <p style={{ color: "var(--text-secondary)" }}>Loading orders…</p>
        </div>
      ) : error ? (
        <div className="card-glass" style={{ padding: "3rem", textAlign: "center", borderRadius: "16px" }}>
          <AlertCircle size={32} style={{ color: "#f87171", margin: "0 auto 1rem" }} />
          <p style={{ color: "#f87171", marginBottom: "1rem" }}>{error}</p>
          <button className="btn btn-primary" onClick={() => loadOrders(filterStatus, search)}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : allOrders.length === 0 ? (
        <div className="card-glass" style={{ padding: "3rem", textAlign: "center", borderRadius: "16px" }}>
          <Package size={40} style={{ color: "var(--text-secondary)", margin: "0 auto 1rem" }} />
          <h3 style={{ marginBottom: "0.5rem" }}>
            {search ? "No matching orders found" : "No orders found"}
          </h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: search ? "1.25rem" : 0 }}>
            {search
              ? `No orders matched "${search}". Try searching by order ID without symbols, customer name, or email.`
              : filterStatus !== "all"
              ? `No "${getStatusStyle(filterStatus).label}" orders.`
              : "No orders yet."}
          </p>
          {search && (
            <button
              className="btn btn-secondary"
              onClick={clearSearch}
              style={{ fontSize: "0.82rem" }}
            >
              Clear Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="card-glass" style={{ borderRadius: "16px", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Order ID", "Customer", "Date", "Items", "Total", "Payment", "Status", "Actions"].map((h, i) => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: i === 7 ? "right" : "left", color: "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allOrders.map((order) => {
                  const displayId = order.id.slice(-8).toUpperCase();
                  return (
                    <tr
                      key={order.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {/* Order ID */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#60a5fa", fontSize: "0.88rem" }}>
                          #{displayId}
                        </div>
                        {order.tracking_number && (
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                            AWB: {order.tracking_number}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: "12px 16px", maxWidth: "200px" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {order.customer_name || "—"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {order.customer_email}
                        </div>
                        {order.shipping_address && (() => {
                          try {
                            const addr = typeof order.shipping_address === "string"
                              ? JSON.parse(order.shipping_address) : order.shipping_address;
                            return <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{addr.city || ""}</div>;
                          } catch { return null; }
                        })()}
                      </td>

                      {/* Date */}
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        {formatDate(order.created_at)}
                      </td>

                      {/* Items */}
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)", textAlign: "center" }}>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{order.items_count || 0}</span>
                      </td>

                      {/* Total */}
                      <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: "0.95rem", whiteSpace: "nowrap" }}>
                        {formatINR(order.total_amount)}
                      </td>

                      {/* Payment */}
                      <td style={{ padding: "12px 16px" }}>
                        <PaymentBadge status={order.payment_status} />
                        <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "3px" }}>
                          {order.payment_method}
                        </div>
                      </td>

                      {/* Status Dropdown */}
                      <td style={{ padding: "12px 16px" }}>
                        <StatusDropdown order={order} onUpdate={handleStatusUpdate} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button
                          onClick={() => navigate("order-details", { params: { id: order.id } })}
                          style={{
                            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                            color: "#818cf8", cursor: "pointer", padding: "6px 12px",
                            borderRadius: "8px", fontSize: "0.78rem", display: "inline-flex",
                            alignItems: "center", gap: "5px", fontWeight: 600
                          }}
                        >
                          <Eye size={13} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            Showing {allOrders.length} order{allOrders.length !== 1 ? "s" : ""}
            {filterStatus !== "all" && ` · filtered by "${getStatusStyle(filterStatus).label}"`}
            {search && ` · matching "${search}"`}
          </div>
        </div>
      )}
    </div>
  );
}
