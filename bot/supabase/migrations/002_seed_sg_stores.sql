-- Seed 24 Singapore stores from existing prototype data

INSERT INTO stores (name, chain, market, tier) VALUES
  ('Harvey Norman @ West Gate',       'Harvey Norman', 'SG', 'T1'),
  ('Harvey Norman @ Parkway Parade',  'Harvey Norman', 'SG', 'T1'),
  ('Harvey Norman @ Millenia Walk',   'Harvey Norman', 'SG', 'T2'),
  ('Harvey Norman @ Northpoint',      'Harvey Norman', 'SG', 'T2'),
  ('Harvey Norman @ Suntec City',     'Harvey Norman', 'SG', 'T1'),
  ('Harvey Norman @ Jurong Point',    'Harvey Norman', 'SG', 'T2'),
  ('Best Denki @ Vivocity',           'Best Denki',    'SG', 'T1'),
  ('Best Denki @ Ngee Ann City',      'Best Denki',    'SG', 'T1'),
  ('Best Denki @ Plaza Singapura',    'Best Denki',    'SG', 'T2'),
  ('Sprint-Cass @ T1 (#02-52)',       'Sprint-Cass',   'SG', 'T3'),
  ('Sprint-Cass @ T1 (#02-36)',       'Sprint-Cass',   'SG', 'T3'),
  ('Sprint-Cass @ T2 (#02-186)',      'Sprint-Cass',   'SG', 'T3'),
  ('Sprint-Cass @ T2 (#02-150)',      'Sprint-Cass',   'SG', 'T3'),
  ('Sprint-Cass @ T3 (#02-30)',       'Sprint-Cass',   'SG', 'T3'),
  ('Sprint-Cass @ T3 (#02-61/62)',    'Sprint-Cass',   'SG', 'T3'),
  ('Sprint-Cass @ T4 (#02-51)',       'Sprint-Cass',   'SG', 'T4'),
  ('Challenger @ ION',                'Challenger',    'SG', 'T1'),
  ('Challenger @ Plaza Singapura',    'Challenger',    'SG', 'T1'),
  ('Challenger @ Vivocity',           'Challenger',    'SG', 'T1'),
  ('Challenger @ Bugis B1',           'Challenger',    'SG', 'T2'),
  ('Challenger @ JEM',                'Challenger',    'SG', 'T2'),
  ('Challenger @ NEX',                'Challenger',    'SG', 'T2'),
  ('Challenger @ Jurong Point',       'Challenger',    'SG', 'T2'),
  ('Challenger @ Causeway Point',     'Challenger',    'SG', 'T2')
ON CONFLICT (name, market) DO NOTHING;
