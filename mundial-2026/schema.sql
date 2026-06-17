-- ============================================================
--  ניחוש מונדיאל 2026 — סכמת בסיס נתונים ל-Supabase
--  ------------------------------------------------------------
--  הוראות: היכנס ל-Supabase → SQL Editor → New query →
--  הדבק את כל הקובץ הזה → Run.  (פעם אחת בלבד)
-- ============================================================

-- ---------- 1. פרופילים (מקושר למשתמשי האימות) ----------
create table if not exists profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  username  text unique not null,
  is_admin  boolean default false,
  created_at timestamptz default now()
);

-- ---------- 2. משחקים ----------
create table if not exists matches (
  id        text primary key,
  team1     text, f1 text, team2 text, f2 text,
  "group"   text,
  date      text,
  status    text default 'open',
  score1    int, score2 int,
  first_scorer_result text,
  red_card_result     boolean,
  finished  boolean default false
);

-- ---------- 3. חוקי ניקוד ----------
create table if not exists point_rules (
  bet_type  text primary key,
  pts       int not null default 0
);

-- ---------- 4. ניחושי משחקים ----------
create table if not exists predictions (
  user_id         uuid references profiles(id) on delete cascade,
  match_id        text references matches(id) on delete cascade,
  value           jsonb default '{}',
  points_awarded  int,
  created_at      timestamptz default now(),
  primary key (user_id, match_id)
);

-- ---------- 5. ניחושי-על (לכל הטורניר) ----------
create table if not exists tournament_predictions (
  user_id         uuid primary key references profiles(id) on delete cascade,
  champion        text,
  runner_up       text,
  top_scorer      text,
  top_assister    text,
  locked          boolean default false,
  points_awarded  int,
  created_at      timestamptz default now()
);

-- ---------- 6. הגדרות גלובליות (כרטיס אדום וכו') ----------
create table if not exists settings (
  id    text primary key,
  value jsonb default '{}'
);

-- ============================================================
--  הרשאות (RLS) — אבטחה: כל אחד רואה הכל, אך עורך רק את שלו
-- ============================================================
alter table profiles               enable row level security;
alter table matches                enable row level security;
alter table point_rules            enable row level security;
alter table predictions            enable row level security;
alter table tournament_predictions enable row level security;
alter table settings               enable row level security;

-- פרופילים: כולם קוראים (לטבלת ניקוד), כל אחד כותב את שלו
create policy "profiles_read"   on profiles for select using (true);
create policy "profiles_write"  on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- משחקים: כולם קוראים; כתיבה רק למנהל
create policy "matches_read"  on matches for select using (true);
create policy "matches_admin" on matches for all
  using (exists(select 1 from profiles p where p.id=auth.uid() and p.is_admin));

-- חוקי ניקוד: כולם קוראים; כתיבה רק למנהל
create policy "rules_read"  on point_rules for select using (true);
create policy "rules_admin" on point_rules for all
  using (exists(select 1 from profiles p where p.id=auth.uid() and p.is_admin));

-- ניחושי משחקים: כולם קוראים (לחישוב טבלה); עריכה רק של עצמך, מנהל יכול לעדכן נקודות
create policy "preds_read"   on predictions for select using (true);
create policy "preds_insert" on predictions for insert with check (auth.uid() = user_id);
create policy "preds_update" on predictions for update using (
  auth.uid() = user_id or
  exists(select 1 from profiles p where p.id=auth.uid() and p.is_admin)
);

-- ניחושי-על: זהה
create policy "tpreds_read"   on tournament_predictions for select using (true);
create policy "tpreds_insert" on tournament_predictions for insert with check (auth.uid() = user_id);
create policy "tpreds_update" on tournament_predictions for update using (
  auth.uid() = user_id or
  exists(select 1 from profiles p where p.id=auth.uid() and p.is_admin)
);

-- הגדרות גלובליות: כולם קוראים; כתיבה רק למנהל
create policy "settings_read"  on settings for select using (true);
create policy "settings_admin" on settings for all
  using (exists(select 1 from profiles p where p.id=auth.uid() and p.is_admin));

-- ============================================================
--  זריעת משחקי הדגמה (אפשר לערוך/למחוק דרך אזור המנהל)
-- ============================================================
insert into matches (id,team1,f1,team2,f2,"group",date,status) values
  ('m1','מקסיקו','🇲🇽','דרום אפריקה','🇿🇦','בית A','2026-06-11 21:00','open'),
  ('m2','דרום קוריאה','🇰🇷','צ׳כיה','🇨🇿','בית A','2026-06-12 04:00','open'),
  ('m3','ארגנטינה','🇦🇷','קנדה','🇨🇦','בית B','2026-06-13 22:00','open'),
  ('m4','ספרד','🇪🇸','אנגליה','🏴','בית C','2026-06-14 19:00','open'),
  ('m5','ברזיל','🇧🇷','גרמניה','🇩🇪','בית D','2026-06-15 22:00','open'),
  ('m6','צרפת','🇫🇷','הולנד','🇳🇱','בית E','2026-06-16 22:00','open')
on conflict (id) do nothing;

-- זריעת חוקי ניקוד ברירת מחדל
insert into point_rules (bet_type,pts) values
  ('exact_score',10),('winner',4),('first_scorer',6),('scorer',3),
  ('assister',3),('btts',2),('champion',25),('top_scorer',15),('top_assister',15)
on conflict (bet_type) do nothing;

-- סוף הסכמה ✓
