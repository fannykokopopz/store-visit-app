-- Dev seed: Wilson (admin) + 1 test CM + 5 SG stores + staff
-- Swap DEV_ADMIN_CHAT_ID and DEV_CM_CHAT_ID with real Telegram chat IDs

-- ── Users ─────────────────────────────────────────────────────────────────────

INSERT INTO users (id, telegram_chat_id, full_name, email, role, market)
VALUES
  ('00000000-0000-0000-0000-000000000001', :admin_chat_id, 'Wilson Tan', 'wilson@tcacoustic.com', 'admin', 'SG'),
  ('00000000-0000-0000-0000-000000000002', :cm_chat_id,    'Test CM',   'testcm@tcacoustic.com',  'cm',    'SG')
ON CONFLICT (email) DO NOTHING;

-- ── Stores ────────────────────────────────────────────────────────────────────

INSERT INTO stores (id, name, chain, market, tier)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Best Denki Vivocity',    'Best Denki', 'SG', 'T1'),
  ('10000000-0000-0000-0000-000000000002', 'Best Denki Jurong Point', 'Best Denki', 'SG', 'T1'),
  ('10000000-0000-0000-0000-000000000003', 'Courts AMK Hub',          'Courts',     'SG', 'T2'),
  ('10000000-0000-0000-0000-000000000004', 'Harvey Norman Millenia',  'Harvey Norman','SG','T1'),
  ('10000000-0000-0000-0000-000000000005', 'Challenger Bugis',        'Challenger', 'SG', 'T2')
ON CONFLICT (name, market) DO NOTHING;

-- ── CM → Store assignments ────────────────────────────────────────────────────

INSERT INTO cm_store_assignments (user_id, store_id)
VALUES
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003')
ON CONFLICT (user_id, store_id) DO NOTHING;

-- ── Staff at stores ───────────────────────────────────────────────────────────

INSERT INTO staff (id, name, role, store_id, is_ally)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Lim Wei',    'Sales Associate', '10000000-0000-0000-0000-000000000001', true),
  ('20000000-0000-0000-0000-000000000002', 'Tan Jia Hui','Sales Associate', '10000000-0000-0000-0000-000000000001', false),
  ('20000000-0000-0000-0000-000000000003', 'Ahmad Razif','Store Manager',   '10000000-0000-0000-0000-000000000001', false),
  ('20000000-0000-0000-0000-000000000004', 'Sarah Ng',   'Sales Associate', '10000000-0000-0000-0000-000000000002', false)
ON CONFLICT DO NOTHING;

-- ── A visit plan for the CM (shows on next /visit to Best Denki Vivocity) ─────

INSERT INTO visit_plans (cm_id, store_id, buzz_plan, notes)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'Demo the new Era 300 wireless speakers to floor staff',
  'Train Lim Wei on Era 300 — he was interested last time'
)
ON CONFLICT DO NOTHING;
