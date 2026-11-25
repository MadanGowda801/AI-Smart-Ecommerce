-- ==============================================================================
-- Migration: 20260930110000_seed-expanded-catalog.sql
-- Description: Seed realistic 36 demonstration products with INR prices,
--              ratings, stock (in-stock, low-stock, out-of-stock), and category relations.
-- ==============================================================================

-- 1. Ensure Categories exist with icon, slug, image
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

-- 2. Insert 36 Diverse Demonstration Products with Realistic INR Prices
INSERT INTO public.products (
  id, category_id, name, slug, brand, price, discount, stock, image, image_url, rating, review_count, description
)
VALUES
  -- 1. Audio & Headphones
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
  -- 2. Electronics & Laptops
  (
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'Apple MacBook Air M2 (13.6-inch, 16GB, 512GB SSD, Midnight)',
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
  -- 3. Smartphones & Wearables
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
  -- 4. Smartphones & Wearables
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
  -- 5. Gaming & Displays
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
  -- 6. Electronics & Laptops
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
  -- 7. Smart Home & IoT
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
  -- 8. Accessories & Gadgets
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
  -- 9. Accessories & Gadgets
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
  -- 10. Audio & Headphones
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
  -- 11. Gaming & Displays
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
  -- 12. Accessories & Gadgets
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
  ),
  -- 13. Electronics & Laptops
  (
    'd0000000-0000-0000-0000-000000000013',
    'c0000000-0000-0000-0000-000000000001',
    'Apple MacBook Pro 14-inch M3 Pro (18GB, 512GB SSD, Space Black)',
    'apple-macbook-pro-14-m3-pro',
    'Apple',
    199900.00,
    6.00,
    12,
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=700&auto=format&fit=crop&q=80',
    4.9,
    280,
    'Pushes the limits of pro laptop performance. Featuring hardware-accelerated ray tracing, 120Hz ProMotion XDR display, and up to 22 hours battery.'
  ),
  -- 14. Electronics & Laptops
  (
    'd0000000-0000-0000-0000-000000000014',
    'c0000000-0000-0000-0000-000000000001',
    'ASUS ROG Zephyrus G16 OLED (Core Ultra 9, 32GB, RTX 4080)',
    'asus-rog-zephyrus-g16',
    'ASUS',
    214990.00,
    8.00,
    7,
    'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=700&auto=format&fit=crop&q=80',
    4.8,
    115,
    'Precision CNC milled aluminum chassis with 2.5K 240Hz ROG Nebula OLED display, NVIDIA GeForce RTX 4080, and intelligent liquid metal cooling.'
  ),
  -- 15. Electronics & Laptops
  (
    'd0000000-0000-0000-0000-000000000015',
    'c0000000-0000-0000-0000-000000000001',
    'Lenovo ThinkPad X1 Carbon Gen 11 (Intel Core i7, 16GB, 1TB SSD)',
    'lenovo-thinkpad-x1-carbon-gen11',
    'Lenovo',
    144500.00,
    12.00,
    3,
    'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=700&auto=format&fit=crop&q=80',
    4.7,
    94,
    'Legendary business ultrabook weighing just 1.12kg. Features carbon fiber lid, iconic TrackPoint, MIL-STD 810H durability, and Dolby Atmos audio.'
  ),
  -- 16. Electronics & Laptops
  (
    'd0000000-0000-0000-0000-000000000016',
    'c0000000-0000-0000-0000-000000000001',
    'HP Spectre x360 2-in-1 OLED Laptop (14-inch, Intel Core Ultra 7)',
    'hp-spectre-x360-14',
    'HP',
    132990.00,
    10.00,
    19,
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=700&auto=format&fit=crop&q=80',
    4.6,
    130,
    'Gem-cut design convertible laptop with 2.8K 120Hz IMAX Enhanced OLED touch display, rechargeable MPP 2.0 tilt pen, and AI presence detection.'
  ),
  -- 17. Smartphones & Wearables
  (
    'd0000000-0000-0000-0000-000000000017',
    'c0000000-0000-0000-0000-000000000002',
    'Apple iPhone 16 Pro (Natural Titanium, 256GB, A18 Pro)',
    'apple-iphone-16-pro',
    'Apple',
    129900.00,
    0.00,
    26,
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=700&auto=format&fit=crop&q=80',
    4.9,
    640,
    'Grade 5 titanium design with Camera Control button, 4K 120 fps Dolby Vision, and groundbreaking A18 Pro power built for Apple Intelligence.'
  ),
  -- 18. Smartphones & Wearables
  (
    'd0000000-0000-0000-0000-000000000018',
    'c0000000-0000-0000-0000-000000000002',
    'OnePlus 12 5G (Flowy Emerald, 16GB RAM, 512GB Storage)',
    'oneplus-12-5g',
    'OnePlus',
    64999.00,
    11.00,
    45,
    'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=700&auto=format&fit=crop&q=80',
    4.7,
    410,
    '4th Gen Hasselblad camera for mobile with periscope telephoto, 2K 120Hz ProXDR display with 4500 nits peak, and 100W SUPERVOOC charging.'
  ),
  -- 19. Smartphones & Wearables
  (
    'd0000000-0000-0000-0000-000000000019',
    'c0000000-0000-0000-0000-000000000002',
    'Google Pixel 9 Pro XL (Obsidian, 16GB RAM, 256GB, Tensor G4)',
    'google-pixel-9-pro-xl',
    'Google',
    124999.00,
    5.00,
    16,
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=700&auto=format&fit=crop&q=80',
    4.8,
    290,
    'Engineered for Google Gemini AI with pro triple camera system, Super Actua display, and 7 years of OS updates and Feature Drops.'
  ),
  -- 20. Smartphones & Wearables
  (
    'd0000000-0000-0000-0000-000000000020',
    'c0000000-0000-0000-0000-000000000002',
    'Samsung Galaxy Watch6 Classic (47mm Bluetooth, Rotating Bezel)',
    'samsung-galaxy-watch6-classic',
    'Samsung',
    36999.00,
    15.00,
    24,
    'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=700&auto=format&fit=crop&q=80',
    4.6,
    315,
    'Timeless design with physical rotating bezel, sapphire crystal glass, advanced sleep coaching, ECG, and body composition analysis.'
  ),
  -- 21. Audio & Headphones
  (
    'd0000000-0000-0000-0000-000000000021',
    'c0000000-0000-0000-0000-000000000003',
    'Apple AirPods Pro (2nd Generation, MagSafe Case USB-C)',
    'apple-airpods-pro-2',
    'Apple',
    24900.00,
    5.00,
    38,
    'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=700&auto=format&fit=crop&q=80',
    4.9,
    810,
    'Up to 2x more Active Noise Cancellation, Adaptive Audio, Transparency mode, and Personalized Spatial Audio with dynamic head tracking.'
  ),
  -- 22. Audio & Headphones
  (
    'd0000000-0000-0000-0000-000000000022',
    'c0000000-0000-0000-0000-000000000003',
    'Sennheiser Momentum 4 Wireless ANC Headphones (60hr Battery)',
    'sennheiser-momentum-4',
    'Sennheiser',
    29990.00,
    18.00,
    17,
    'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=700&auto=format&fit=crop&q=80',
    4.7,
    220,
    'Audiophile-grade 42mm transducer system delivering incredible dynamics and clarity with outstanding 60-hour battery life on a single charge.'
  ),
  -- 23. Audio & Headphones
  (
    'd0000000-0000-0000-0000-000000000023',
    'c0000000-0000-0000-0000-000000000003',
    'Marshall Stanmore III Bluetooth Home Speaker (Vintage Brass)',
    'marshall-stanmore-3',
    'Marshall',
    37999.00,
    8.00,
    11,
    'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=700&auto=format&fit=crop&q=80',
    4.8,
    195,
    'Wider soundstage filling the room with heavy home audio. Bluetooth 5.2, 3.5mm input, RCA input for turntables, and iconic script logo.'
  ),
  -- 24. Audio & Headphones
  (
    'd0000000-0000-0000-0000-000000000024',
    'c0000000-0000-0000-0000-000000000003',
    'Nothing Ear (2) Hi-Res Dual Driver ANC Earbuds',
    'nothing-ear-2',
    'Nothing',
    9999.00,
    23.00,
    42,
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=700&auto=format&fit=crop&q=80',
    4.6,
    420,
    'Iconic transparent engineering with LHDC 5.0 Hi-Res audio, personalized sound profile, and dual connection switching.'
  ),
  -- 25. Smart Home & IoT
  (
    'd0000000-0000-0000-0000-000000000025',
    'c0000000-0000-0000-0000-000000000004',
    'Philips Hue White & Color Ambiance Smart Starter Kit (3 Bulbs + Bridge)',
    'philips-hue-starter-kit',
    'Philips',
    12499.00,
    10.00,
    20,
    'https://images.unsplash.com/photo-1550525811-e5869dd03032?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550525811-e5869dd03032?w=700&auto=format&fit=crop&q=80',
    4.8,
    310,
    'Transform your home lighting with 16 million colors and shades of white. Sync with movies, music, and gaming via Hue Sync Box.'
  ),
  -- 26. Smart Home & IoT
  (
    'd0000000-0000-0000-0000-000000000026',
    'c0000000-0000-0000-0000-000000000004',
    'Roborock S8 Pro Ultra Robot Vacuum & Mop with Auto-Empty Dock',
    'roborock-s8-pro-ultra',
    'Roborock',
    89999.00,
    12.00,
    8,
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=700&auto=format&fit=crop&q=80',
    4.9,
    85,
    'RockDock Ultra all-in-one dock auto-washes, auto-dries, and auto-refills. DuoRoller Riser brush and VibraRise 2.0 mopping system.'
  ),
  -- 27. Smart Home & IoT
  (
    'd0000000-0000-0000-0000-000000000027',
    'c0000000-0000-0000-0000-000000000004',
    'Amazon Echo Show 10 (3rd Gen) HD Smart Display with Motion Tracking',
    'amazon-echo-show-10',
    'Amazon',
    24999.00,
    14.00,
    22,
    'https://images.unsplash.com/photo-1543512214-318c7553f230?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1543512214-318c7553f230?w=700&auto=format&fit=crop&q=80',
    4.7,
    410,
    '10.1-inch HD screen moves automatically to stay in view during video calls, recipes, and shows. 13MP camera with auto-framing and Zigbee smart hub.'
  ),
  -- 28. Smart Home & IoT
  (
    'd0000000-0000-0000-0000-000000000028',
    'c0000000-0000-0000-0000-000000000004',
    'Yale Assure Lock 2 Smart Keyless Deadbolt (Wi-Fi + Biometric)',
    'yale-assure-lock-2',
    'Yale',
    21500.00,
    10.00,
    14,
    'https://images.unsplash.com/photo-1558002038-1055907df827?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1558002038-1055907df827?w=700&auto=format&fit=crop&q=80',
    4.6,
    125,
    'Never carry house keys again. Unlock via fingerprint, keypad, Apple Watch, or Auto-Unlock as you approach with door sensor security.'
  ),
  -- 29. Smart Home & IoT (Out of stock demonstration product)
  (
    'd0000000-0000-0000-0000-000000000029',
    'c0000000-0000-0000-0000-000000000004',
    'TP-Link Tapo C320WS 2K QHD Outdoor Smart Security Camera',
    'tp-link-tapo-c320ws',
    'TP-Link',
    4299.00,
    20.00,
    0,
    'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=700&auto=format&fit=crop&q=80',
    4.5,
    580,
    'Full-color night vision with high-resolution 2K QHD clarity, IP66 weatherproof housing, and two-way audio siren alarm. (Currently Sold Out).'
  ),
  -- 30. Accessories & Gadgets
  (
    'd0000000-0000-0000-0000-000000000030',
    'c0000000-0000-0000-0000-000000000005',
    'CalDigit TS4 Thunderbolt 4 Dock (18 Ports, 98W Charging)',
    'caldigit-ts4-dock',
    'CalDigit',
    38990.00,
    5.00,
    8,
    'https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=700&auto=format&fit=crop&q=80',
    4.9,
    145,
    'The king of Thunderbolt 4 docks. 18 ports including 2.5GbE LAN, DisplayPort 1.4, SD/microSD 4.0 slots, and up to 98W host charging.'
  ),
  -- 31. Accessories & Gadgets
  (
    'd0000000-0000-0000-0000-000000000031',
    'c0000000-0000-0000-0000-000000000005',
    'Belkin 3-in-1 MagSafe Wireless Charging Stand (15W Fast Charge)',
    'belkin-3-in-1-magsafe',
    'Belkin',
    13999.00,
    15.00,
    30,
    'https://images.unsplash.com/photo-1586816879360-004f5b0c51e5?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1586816879360-004f5b0c51e5?w=700&auto=format&fit=crop&q=80',
    4.8,
    312,
    'Official Apple MagSafe certified 15W wireless charging stand for iPhone 16/15, Apple Watch Ultra/Series 9, and AirPods Pro simultaneously.'
  ),
  -- 32. Accessories & Gadgets
  (
    'd0000000-0000-0000-0000-000000000032',
    'c0000000-0000-0000-0000-000000000005',
    'Samsung T9 2TB Shield Portable SSD (USB 3.2 Gen 2x2, 2000MB/s)',
    'samsung-t9-2tb-ssd',
    'Samsung',
    19499.00,
    12.00,
    40,
    'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=700&auto=format&fit=crop&q=80',
    4.8,
    275,
    'Blazing sequential read/write speeds up to 2000 MB/s. Heavy-duty rubberized drop-resistant exterior up to 3 meters with Dynamic Thermal Guard.'
  ),
  -- 33. Gaming & Displays
  (
    'd0000000-0000-0000-0000-000000000033',
    'c0000000-0000-0000-0000-000000000006',
    'ASUS ROG Swift 32-inch 4K OLED Gaming Monitor (240Hz, 0.03ms)',
    'asus-rog-swift-pg32ucdm',
    'ASUS',
    134999.00,
    6.00,
    5,
    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=700&auto=format&fit=crop&q=80',
    4.9,
    72,
    '32-inch 4K QD-OLED panel with instantaneous 0.03ms response time, custom heatsink, graphene film, Dolby Vision, and 90W USB-C PD.'
  ),
  -- 34. Gaming & Displays
  (
    'd0000000-0000-0000-0000-000000000034',
    'c0000000-0000-0000-0000-000000000006',
    'Nintendo Switch OLED Model (Neon Red & Neon Blue Joy-Con)',
    'nintendo-switch-oled',
    'Nintendo',
    31990.00,
    8.00,
    25,
    'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=700&auto=format&fit=crop&q=80',
    4.8,
    950,
    '7-inch vibrant OLED display with vivid colors and crisp contrast. Wide adjustable stand, dock with wired LAN port, and 64GB internal storage.'
  ),
  -- 35. Gaming & Displays
  (
    'd0000000-0000-0000-0000-000000000035',
    'c0000000-0000-0000-0000-000000000006',
    'Xbox Wireless Controller – Carbon Black (Series X/S, Windows, Android)',
    'xbox-wireless-controller-black',
    'Microsoft',
    5690.00,
    10.00,
    60,
    'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=700&auto=format&fit=crop&q=80',
    4.7,
    1400,
    'Sculpted surfaces and refined geometry for enhanced comfort. Textured grip on triggers, bumpers, and back-case with dedicated Share button.'
  ),
  -- 36. Gaming & Displays
  (
    'd0000000-0000-0000-0000-000000000036',
    'c0000000-0000-0000-0000-000000000006',
    'SteelSeries Arctis Nova Pro Wireless Multi-System Gaming Headset',
    'steelseries-arctis-nova-pro',
    'SteelSeries',
    34999.00,
    12.00,
    18,
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=700&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=700&auto=format&fit=crop&q=80',
    4.8,
    260,
    'Nova Pro Acoustic System with Active Noise Cancellation, multi-system connect base station, and infinity power system with hot-swap batteries.'
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
