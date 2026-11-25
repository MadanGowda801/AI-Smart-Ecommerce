import React, { useState, useEffect } from 'react';
import { Truck, Sparkles, Users, Tag, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigation } from './NavigationContext';

const ANNOUNCEMENTS = [
  {
    icon: Truck,
    text: 'Free Express Shipping Across India on Orders Above ₹999',
    badge: 'FREE DELIVERY',
    actionText: 'Shop Now',
    path: 'products'
  },
  {
    icon: Sparkles,
    text: 'TechFest Major Sale: Use Coupon SMART10 for 10% Instant Off',
    badge: 'LIMITED TIME',
    actionText: 'View Deals',
    path: 'products'
  },
  {
    icon: Users,
    text: 'Collaborative Shopping Rooms Live: Invite Friends to Co-Shop in Real-Time',
    badge: 'NEW FEATURE',
    actionText: 'Start Co-Shopping',
    path: null,
    isCoShop: true
  },
  {
    icon: ShieldCheck,
    text: '7-Day AI-Assisted Defect Inspection with Doorstep Replacement Pickup',
    badge: 'BUYER PROTECTION',
    actionText: 'Learn More',
    path: 'products'
  }
];

export function AnnouncementBar({ onOpenCoShopping }) {
  const { navigate } = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ANNOUNCEMENTS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const current = ANNOUNCEMENTS[currentIndex];
  const Icon = current.icon;

  const handleClick = () => {
    if (current.isCoShop) {
      onOpenCoShopping?.();
    } else if (current.path) {
      navigate(current.path);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-banner-gradient)',
      color: '#ffffff',
      fontSize: '0.78rem',
      fontWeight: 600,
      padding: '0.45rem 1rem',
      textAlign: 'center',
      position: 'relative',
      zIndex: 101,
      overflow: 'hidden',
      letterSpacing: '0.01em',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)'
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.65rem',
        flexWrap: 'wrap',
        cursor: 'pointer'
      }} onClick={handleClick}>
        <span style={{
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(4px)',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '0.66rem',
          fontWeight: 800,
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          {current.badge}
        </span>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Icon size={14} />
          {current.text}
        </span>

        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          textDecoration: 'underline',
          fontSize: '0.74rem',
          marginLeft: '4px',
          opacity: 0.95
        }}>
          {current.actionText} <ArrowRight size={12} />
        </span>
      </div>
    </div>
  );
}

export default AnnouncementBar;
