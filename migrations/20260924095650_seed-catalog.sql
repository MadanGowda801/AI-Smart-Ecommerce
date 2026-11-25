-- ==============================================================================
-- Migration: 20260924095650_seed-catalog.sql
-- Description: Seed initial categories and rich product catalog with images,
--              ratings, stock, and descriptions.
-- ==============================================================================

-- 1. Insert Categories
INSERT INTO public.categories (id, name, slug, description, icon, image)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Electronics & Laptops', 'electronics', 'High-performance laptops, ultrabooks, monitors, and computing accessories.', 'Laptop', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80'),
  ('c0000000-0000-0000-0000-000000000002', 'Smartphones & Wearables', 'smartphones', 'Flagship 5G smartphones, smartwatches, fitness bands, and trackers.', 'Smartphone', 'https://images.unsplash.com/photo-1511707171634-5f897ff02560?w=600&auto=format&fit=crop&q=80'),
  ('c0000000-0000-0000-0000-000000000003', 'Audio & Headphones', 'audio', 'Active noise cancellation headphones, TWS earbuds, and Bluetooth speakers.', 'Headphones', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'),
  ('c0000000-0000-0000-0000-000000000004', 'Smart Home & IoT', 'smart-home', 'Intelligent security cameras, smart lighting, automated assistants, and sensors.', 'Home', 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop&q=80'),
  ('c0000000-0000-0000-0000-000000000005', 'Accessories & Gadgets', 'accessories', 'GaN fast chargers, ergonomic mice, mechanical keyboards, and power banks.', 'Cpu', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80'),
  ('c0000000-0000-0000-0000-000000000006', 'Gaming & Displays', 'gaming', 'High-refresh rate monitors, mechanical controllers, gaming headsets, and desks.', 'Gamepad2', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80')
ON CONFLICT (name) DO UPDATE SET
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  image = EXCLUDED.image;

-- 2. Insert Products
INSERT INTO public.products (
  id, category_id, name, slug, brand, price, discount, stock, image, image_url, rating, review_count, description
)
VALUES
  (
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003',
    'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    'sony-wh-1000xm5',
    'Sony',
    29990.00,
    14.00,
    28,
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80',
    4.8,
    342,
    'Industry-leading noise cancellation powered by two processors and 8 microphones. Specially engineered 30mm driver unit with carbon fiber composite material.'
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'Apple MacBook Air M2 (13.6-inch, 16GB, 512GB SSD)',
    'apple-macbook-air-m2',
    'Apple',
    99900.00,
    10.00,
    15,
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=700&auto=format&fit=crop&q=80',
    4.9,
    512,
    'Strikingly thin design with all-day battery life up to 18 hours. Stunning Liquid Retina display with 500 nits of brightness and P3 wide color.'
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000002',
    'Samsung Galaxy S24 Ultra 5G (Titanium Gray, 256GB)',
    'samsung-galaxy-s24-ultra',
    'Samsung',
    129999.00,
    8.00,
    22,
    'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=700&auto=format&fit=crop&q=80',
    4.8,
    420,
    'Titanium exterior shield with Corning Gorilla Armor. Galaxy AI features live translate, note assist, and photo assist with 200MP quad telephoto system.'
  ),
  (
    'd0000000-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000002',
    'Apple Watch Ultra 2 (Titanium Case with Alpine Loop)',
    'apple-watch-ultra-2',
    'Apple',
    89900.00,
    5.00,
    18,
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&auto=format&fit=crop&q=80',
    4.9,
    185,
    'Rugged 49mm titanium case with 3000-nit Always-On Retina display. Precision dual-frequency GPS and up to 36 hours of normal battery life.'
  ),
  (
    'd0000000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000000006',
    'Sony PlayStation 5 Slim Console (Disc Edition, 1TB)',
    'sony-ps5-slim',
    'Sony',
    54990.00,
    5.00,
    14,
    'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=700&auto=format&fit=crop&q=80',
    4.9,
    730,
    'Experience lightning-fast loading with an ultra-high speed SSD, deeper immersion with haptic feedback, adaptive triggers, and 3D Audio.'
  ),
  (
    'd0000000-0000-0000-0000-000000000006',
    'c0000000-0000-0000-0000-000000000001',
    'Dell XPS 15 9530 (13th Gen i9, 32GB, 1TB SSD, RTX 4070)',
    'dell-xps-15',
    'Dell',
    189990.00,
    7.00,
    9,
    'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=700&auto=format&fit=crop&q=80',
    4.7,
    98,
    'Immersive 3.5K OLED touchscreen display in an aluminum chassis with carbon-fiber palm rest. Studio sound with 4-speaker design.'
  ),
  (
    'd0000000-0000-0000-0000-000000000007',
    'c0000000-0000-0000-0000-000000000004',
    'Dyson Purifier Cool Gen1 TP10 Smart Air Purifier',
    'dyson-purifier-cool-gen1',
    'Dyson',
    32900.00,
    12.00,
    16,
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=700&auto=format&fit=crop&q=80',
    4.6,
    154,
    'Automatically senses and captures pollutants. HEPA H13 filter captures 99.95% of particles as small as 0.1 microns with Air Multiplier technology.'
  ),
  (
    'd0000000-0000-0000-0000-000000000008',
    'c0000000-0000-0000-0000-000000000005',
    'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
    'keychron-q1-pro',
    'Keychron',
    17499.00,
    10.00,
    35,
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=700&auto=format&fit=crop&q=80',
    4.9,
    89,
    'CNC aluminum body, QMK/VIA programmable, double-gasket design with hot-swappable K Pro mechanical switches and South-facing RGB.'
  ),
  (
    'd0000000-0000-0000-0000-000000000009',
    'c0000000-0000-0000-0000-000000000005',
    'Logitech MX Master 3S Wireless Performance Mouse',
    'logitech-mx-master-3s',
    'Logitech',
    8995.00,
    15.00,
    45,
    'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=700&auto=format&fit=crop&q=80',
    4.8,
    620,
    'Quiet clicks with 8K DPI track-on-glass sensor. MagSpeed electromagnetic scrolling wheel scrolls 1,000 lines per second with ergonomic thumb rest.'
  ),
  (
    'd0000000-0000-0000-0000-000000000010',
    'c0000000-0000-0000-0000-000000000003',
    'Bose QuietComfort Ultra Earbuds with Spatial Audio',
    'bose-quietcomfort-ultra',
    'Bose',
    25900.00,
    8.00,
    25,
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=700&auto=format&fit=crop&q=80',
    4.7,
    210,
    'Breakthrough Bose Immersive Audio pushes boundaries of what it means to listen. World-class CustomTune noise cancellation personalized to your ears.'
  ),
  (
    'd0000000-0000-0000-0000-000000000011',
    'c0000000-0000-0000-0000-000000000006',
    'LG C3 55-inch 4K OLED evo Smart TV with Dolby Vision',
    'lg-c3-55-oled',
    'LG',
    119990.00,
    20.00,
    11,
    'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=700&auto=format&fit=crop&q=80',
    4.9,
    310,
    'Self-lit OLED evo technology with Brightness Booster. α9 AI Processor Gen6 with 0.1ms response time, 120Hz refresh rate, G-Sync and FreeSync support.'
  ),
  (
    'd0000000-0000-0000-0000-000000000012',
    'c0000000-0000-0000-0000-000000000005',
    'Anker Prime 200W 6-Port GaN Desktop Charging Station',
    'anker-prime-200w',
    'Anker',
    11999.00,
    15.00,
    50,
    'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=700&auto=format&fit=crop&q=80',
    4.8,
    140,
    'Ultra-powerful 200W total output across 4 USB-C and 2 USB-A ports. Powers 2 laptops at full speed with active heat monitoring and GaNPrime safety.'
  )
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  brand = EXCLUDED.brand,
  price = EXCLUDED.price,
  discount = EXCLUDED.discount,
  stock = EXCLUDED.stock,
  image = EXCLUDED.image,
  image_url = EXCLUDED.image_url,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  description = EXCLUDED.description;
