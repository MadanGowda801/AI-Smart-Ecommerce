import React, { useState } from 'react';
import { Bot, Mic, Store, Users } from 'lucide-react';
import { useNavigation } from './NavigationContext';

// Customer Pages (15)
import HomePage from './HomePage';
import ProductsPage from './ProductsPage';
import ProductDetailsPage from './ProductDetailsPage';
import CategoriesPage from './CategoriesPage';
import SearchResultsPage from './SearchResultsPage';
import CartPage from './CartPage';
import WishlistPage from './WishlistPage';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ProfilePage from './ProfilePage';
import CheckoutPage from './CheckoutPage';
import OrdersPage from './OrdersPage';
import OrderDetailsPage from './OrderDetailsPage';
import OrderTrackingPage from './OrderTrackingPage';
import OrderConfirmationPage from './OrderConfirmationPage';
import NotificationsPage from './NotificationsPage';

// Admin Pages (10)
import AdminLoginPage from './AdminLoginPage';
import AdminDashboardPage from './AdminDashboardPage';
import AdminProductsPage from './AdminProductsPage';
import AdminAddProductPage from './AdminAddProductPage';
import AdminEditProductPage from './AdminEditProductPage';
import AdminInventoryPage from './AdminInventoryPage';
import AdminOrdersPage from './AdminOrdersPage';
import AdminUsersPage from './AdminUsersPage';
import AdminSalesAnalyticsPage from './AdminSalesAnalyticsPage';
import AdminCustomerAnalyticsPage from './AdminCustomerAnalyticsPage';
import AdminReturnsPage from './AdminReturnsPage';
import AdminDeliveryPage from './AdminDeliveryPage';
import DeliveryDashboardPage from './DeliveryDashboardPage';
import DeliveryRoute from './DeliveryRoute';

// Components & Route Guards
import Navbar, { NotificationBell } from './Navbar';
import AnnouncementBar from './AnnouncementBar';
import Footer from './Footer';
import AdminSidebar from './AdminSidebar';
import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';
import ChatbotModal from './ChatbotModal';
import VoiceAssistantModal from './VoiceAssistantModal';
import CoShoppingModal from './CoShoppingModal';
import CompareFloatingWidget from './CompareFloatingWidget';

export function App() {
  const { currentPath, navigate } = useNavigation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isCoShoppingOpen, setIsCoShoppingOpen] = useState(false);

  const isAdminRoute = currentPath.startsWith('admin-');
  const isAdminLogin = currentPath === 'admin-login';

  // Customer page router
  const renderCustomerPage = () => {
    switch (currentPath) {
      case 'products':
        return <ProductsPage />;
      case 'product-details':
        return <ProductDetailsPage />;
      case 'categories':
        return <CategoriesPage />;
      case 'search':
        return <SearchResultsPage />;
      case 'cart':
        return <CartPage />;
      case 'wishlist':
        return <WishlistPage />;
      case 'login':
        return <LoginPage />;
      case 'register':
        return <RegisterPage />;
      case 'profile':
        return (
          <ProtectedRoute title="Sign In to Access Profile" message="View and manage your verified account details, addresses, and order invoices.">
            <ProfilePage />
          </ProtectedRoute>
        );
      case 'checkout':
        return (
          <ProtectedRoute title="Sign In to Checkout" message="Please sign in to your SmartShop account to complete payment and delivery details.">
            <CheckoutPage />
          </ProtectedRoute>
        );
      case 'orders':
        return (
          <ProtectedRoute title="Sign In to View Orders" message="Please sign in to track your current purchases and access historical invoices.">
            <OrdersPage />
          </ProtectedRoute>
        );
      case 'order-details':
        return (
          <ProtectedRoute title="Sign In to View Order Details" message="Secure invoice access requires verified customer authentication.">
            <OrderDetailsPage />
          </ProtectedRoute>
        );
      case 'order-tracking':
        return <OrderTrackingPage />;
      case 'order-confirmation':
        return <OrderConfirmationPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'home':
      default:
        return (
          <HomePage
            onOpenChat={() => setIsChatOpen(true)}
            onOpenVoice={() => setIsVoiceOpen(true)}
          />
        );
    }
  };

  // Admin page router (protected by AdminRoute)
  const renderAdminPage = () => {
    const adminComponent = (() => {
      switch (currentPath) {
        case 'admin-products':
          return <AdminProductsPage />;
        case 'admin-add-product':
          return <AdminAddProductPage />;
        case 'admin-edit-product':
          return <AdminEditProductPage />;
        case 'admin-inventory':
          return <AdminInventoryPage />;
        case 'admin-orders':
          return <AdminOrdersPage />;
        case 'admin-delivery':
          return <AdminDeliveryPage />;
        case 'admin-users':
          return <AdminUsersPage />;
        case 'admin-sales-analytics':
          return <AdminSalesAnalyticsPage />;
        case 'admin-customer-analytics':
          return <AdminCustomerAnalyticsPage />;
        case 'admin-returns':
          return <AdminReturnsPage />;
        case 'admin-dashboard':
        default:
          return <AdminDashboardPage />;
      }
    })();

    return adminComponent;
  };

  // 1. Admin Login (Dedicated Full-Screen View)
  if (isAdminLogin) {
    return <AdminLoginPage />;
  }

  // 1b. Delivery Personnel Dashboard (Dedicated Role-Protected View)
  if (currentPath === 'delivery-dashboard') {
    return (
      <DeliveryRoute>
        <DeliveryDashboardPage />
      </DeliveryRoute>
    );
  }

  // 2. Admin Portal with Sidebar Layout
  if (isAdminRoute) {
    return (
      <AdminRoute>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
          {/* Admin Navigation Topbar */}
          <header style={{
            background: 'var(--bg-navbar)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '0.75rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 40,
            backdropFilter: 'blur(16px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span
                onClick={() => navigate('admin-dashboard')}
                style={{
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  cursor: 'pointer',
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                SmartShop Admin
              </span>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontWeight: 600 }}>
                InsForge Protected
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <NotificationBell navigate={navigate} />
              <button
                onClick={() => navigate('home')}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-secondary, #94a3b8)',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Store size={14} /> Back to Customer Store
              </button>
            </div>
          </header>

          {/* Admin Body with Sidebar */}
          <div style={{
            maxWidth: '1440px',
            width: '100%',
            margin: '0 auto',
            padding: '1.5rem',
            display: 'flex',
            gap: '1.5rem',
            alignItems: 'flex-start',
            flex: 1
          }}>
            <AdminSidebar />
            <main style={{ flex: 1, minWidth: 0 }}>
              {renderAdminPage()}
            </main>
          </div>
        </div>
      </AdminRoute>
    );
  }

  // 3. Customer Storefront
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AnnouncementBar onOpenCoShopping={() => setIsCoShoppingOpen(true)} />
      <Navbar
        onOpenChat={() => setIsChatOpen(true)}
        onOpenVoice={() => setIsVoiceOpen(true)}
        onOpenCoShopping={() => setIsCoShoppingOpen(true)}
      />

      <main style={{ flex: 1, minHeight: '80vh' }}>
        {renderCustomerPage()}
      </main>

      {/* Floating Assistant & Co-Shopping Triggers */}
      <div className="floating-assistant-triggers">
        <button
          className="trigger-btn coshop"
          onClick={() => setIsCoShoppingOpen((prev) => !prev)}
          title="Open Co-Shop Live Room"
          aria-label="Co-Shop Live Room"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        >
          <Users size={22} />
        </button>
        <button
          className="trigger-btn voice"
          onClick={() => setIsVoiceOpen(true)}
          title="Open Voice Shopping Assistant"
          aria-label="Voice Shopping Assistant"
        >
          <Mic size={22} />
        </button>
        <button
          className="trigger-btn chatbot"
          onClick={() => setIsChatOpen((prev) => !prev)}
          title="Open AI Shopping Chatbot"
          aria-label="AI Shopping Chatbot"
        >
          <Bot size={24} />
        </button>
      </div>

      {/* Modals */}
      <ChatbotModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onOpenVoice={() => {
          setIsChatOpen(false);
          setIsVoiceOpen(true);
        }}
      />
      <VoiceAssistantModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onNavigate={(target) => {
          navigate(target);
          setIsVoiceOpen(false);
        }}
      />
      <CoShoppingModal
        isOpen={isCoShoppingOpen}
        onClose={() => setIsCoShoppingOpen(false)}
      />
      <CompareFloatingWidget />

      <Footer />
    </div>
  );
}

export default App;
