import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { NavigationProvider } from './NavigationContext';
import { AuthProvider } from './AuthContext';
import { ProductsProvider } from './ProductsContext';
import { CartProvider } from './CartContext';
import { WishlistProvider } from './WishlistContext';
import { OrdersProvider } from './OrdersContext';
import { NotificationProvider } from './NotificationContext';
import { RecommendationProvider } from './RecommendationContext';
import { CompareProvider } from './CompareContext';
import './theme.css';
import './main.css';
import './components.css';
import './animations.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <NavigationProvider>
        <AuthProvider>
          <NotificationProvider>
            <ProductsProvider>
              <CompareProvider>
                <CartProvider>
                  <WishlistProvider>
                    <RecommendationProvider>
                      <OrdersProvider>
                        <App />
                      </OrdersProvider>
                    </RecommendationProvider>
                  </WishlistProvider>
                </CartProvider>
              </CompareProvider>
            </ProductsProvider>
          </NotificationProvider>
        </AuthProvider>
      </NavigationProvider>
    </StrictMode>
  );
}

