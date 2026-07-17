BEGIN;

INSERT INTO categories (id, parent_id, name_ar, name_en, name_zh, slug,
                         icon, sort_order, is_active)
OVERRIDING SYSTEM VALUE
VALUES
(1,  NULL, 'إلكترونيات',    'Electronics',    '电子产品',    'electronics',    '📱', 1,  TRUE),
(2,  NULL, 'المواد الغذائية', 'Food & Beverages', '食品饮料', 'food-beverages', '🍯', 2,  TRUE),
(3,  NULL, 'الأزياء',         'Fashion',         '服装',       'fashion',        '👗', 3,  TRUE),
(4,  NULL, 'المنزل والمطبخ',  'Home & Kitchen',  '家居厨房',  'home-kitchen',   '🏠', 4,  TRUE),
(5,  NULL, 'الجمال والعناية', 'Beauty & Care',    '美容护理',  'beauty-care',    '💄', 5,  TRUE),
(6,  NULL, 'الحرف اليدوية',   'Handicrafts',      '手工艺品',   'handicrafts',    '🧶', 6,  TRUE),
(7,  NULL, 'السيارات',        'Automotive',       '汽车',        'automotive',     '🚗', 7,  TRUE),
(8,  1,    'هواتف',           'Phones',           '手机',         'phones',         '📞', 1,  TRUE),
(9,  1,    'أجهزة لوحية',     'Tablets',          '平板电脑',    'tablets',        '💻', 2,  TRUE),
(10, 1,    'سماعات',           'Headphones',       '耳机',         'headphones',     '🎧', 3,  TRUE),
(11, 2,    'عسل',              'Honey',            '蜂蜜',         'honey',          '🍯', 1,  TRUE),
(12, 2,    'قهوة',             'Coffee',           '咖啡',         'coffee',         '☕', 2,  TRUE),
(13, 2,    'تمور',             'Dates',            '椰枣',         'dates',          '🌴', 3,  TRUE),
(14, 3,    'رجالي',            'Men',              '男装',         'men',            '👔', 1,  TRUE),
(15, 3,    'نسائي',            'Women',            '女装',         'women',          '👗', 2,  TRUE),
(16, 6,    'سلال',             'Baskets',          '篮子',         'baskets',        '🧺', 1,  TRUE),
(17, 6,    'فضيات',            'Silverware',       '银器',         'silverware',     '🥈', 2,  TRUE),
(18, 5,    'عطور',             'Perfumes',          '香水',         'perfumes',        '🌹', 1,  TRUE)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('categories','id'), GREATEST((SELECT MAX(id) FROM categories), 1));

INSERT INTO shipping_methods (id, name_ar, name_en, name_zh, base_cost,
                               per_kg_cost, estimated_days, is_active, sort_order)
OVERRIDING SYSTEM VALUE
VALUES
(1, 'توصيل عادي', 'Standard Delivery', '标准配送', 500.00, 200.00, 3, TRUE, 1),
(2, 'توصيل سريع', 'Express Delivery', '快速配送', 1000.00, 350.00, 1, TRUE, 2),
(3, 'توصيل في اليوم التالي', 'Next-Day Delivery', '次日达', 1500.00, 500.00, 1, TRUE, 3),
(4, 'استلام من المتجر', 'Store Pickup', '门店自提', 0.00, 0.00, 1, TRUE, 4)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('shipping_methods','id'), GREATEST((SELECT MAX(id) FROM shipping_methods), 1));

COMMIT;
