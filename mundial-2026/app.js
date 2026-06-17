/* ============================================================
   ניחוש מונדיאל 2026 — app.js
   חלק 1: דיבאג, חיבור, נתוני בסיס, שכבת נתונים (DB)
   ============================================================ */

/* ---------- 1. מערכת לוגים / דיבאג ---------- */
const DBG = {
  logs: [],
  listeners: [],
  hasError: false,
  push(level, msg, data){
    const entry = {
      level,
      msg: typeof msg === 'string' ? msg : JSON.stringify(msg),
      data: data !== undefined ? (()=>{try{return JSON.stringify(data)}catch(e){return String(data)}})() : null,
      time: new Date().toLocaleTimeString('he-IL', {hour12:false}) + '.' + String(Date.now()%1000).padStart(3,'0')
    };
    this.logs.push(entry);
    if(this.logs.length > 400) this.logs.shift();
    if(level === 'error'){ this.hasError = true; }
    const fab = document.getElementById('dbg-fab');
    if(fab && this.hasError) fab.classList.add('err');
    // הד גם לקונסול הדפדפן
    const c = level==='error'?'error':level==='warn'?'warn':'log';
    console[c]('[מונדיאל]', msg, data!==undefined?data:'');
    this.listeners.forEach(fn=>fn());
  },
  info(m,d){this.push('info',m,d)},
  warn(m,d){this.push('warn',m,d)},
  error(m,d){this.push('error',m,d)},
  clear(){this.logs=[];this.hasError=false;
    const fab=document.getElementById('dbg-fab');if(fab)fab.classList.remove('err');
    this.listeners.forEach(fn=>fn())},
  subscribe(fn){this.listeners.push(fn);return()=>{this.listeners=this.listeners.filter(f=>f!==fn)}}
};
window.DBG = DBG;

// לכידת שגיאות גלובליות
window.addEventListener('error', e=>DBG.error('שגיאת JS גלובלית: '+e.message, {file:e.filename,line:e.lineno}));
window.addEventListener('unhandledrejection', e=>DBG.error('Promise נכשל: '+(e.reason?.message||e.reason)));

DBG.info('האפליקציה נטענת...');

/* ---------- 2. זיהוי מצב חיבור (דמו / חי) ---------- */
const CFG = window.MUNDIAL_CONFIG || {};
const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
let sb = null;

if(LIVE){
  try{
    sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    DBG.info('מצב חי: חובר ל-Supabase', {url: CFG.SUPABASE_URL});
  }catch(e){
    DBG.error('יצירת חיבור Supabase נכשלה: '+e.message);
  }
}else{
  DBG.warn('מצב דמו פעיל — נתונים נשמרים במכשיר זה בלבד. למילוי config.js עבור מצב חי.');
}
const MODE = LIVE ? 'live' : 'demo';

/* ---------- 3. נתוני בסיס (משחקים, חוקי ניקוד, סוגי ניחוש) ---------- */
// משחקי מונדיאל 2026 לדוגמה (מקור: openfootball). אפשר לערוך דרך אזור המנהל.
// מאגר הנבחרות והשחקנים (מתוך data.js)
const WC_TEAMS = window.WC_TEAMS || [];
const WC_SQUADS = window.WC_SQUADS || {};
const WC_ALL_PLAYERS = window.WC_ALL_PLAYERS || [];
const TEAMS_LIST = WC_TEAMS.map(t=>t.name);
const flagOf = name => (WC_TEAMS.find(t=>t.name===name)||{}).flag || '🏳️';
const groupOf = name => (WC_TEAMS.find(t=>t.name===name)||{}).group || '';
// שחקני שתי הקבוצות במשחק (לכובש ראשון)
function matchPlayers(m){
  return [...(WC_SQUADS[m.team1]||[]), ...(WC_SQUADS[m.team2]||[])];
}

// נעילת ניחוש: 5 דקות לפני שריקת הפתיחה
const LOCK_BEFORE_MS = 5 * 60 * 1000;
function kickoffMs(m){ try{ return new Date(m.date.replace(' ','T')).getTime(); }catch(e){ return 0; } }
function matchLocked(m){
  if(m.finished) return true;
  const k = kickoffMs(m);
  return k>0 && Date.now() >= (k - LOCK_BEFORE_MS);
}

// משחקי שלב הבתים (תאריכים עתידיים — פתוחים לניחוש)
const SEED_MATCHES = [
  // 18 ביוני
  {id:'m01', team1:'בלגיה',     team2:'ערב הסעודית', group:'בית H', date:'2026-06-18 19:00'},
  {id:'m02', team1:'גרמניה',    team2:'חוף השנהב',  group:'בית F', date:'2026-06-18 22:00'},
  // 19 ביוני
  {id:'m03', team1:'הולנד',     team2:'קייפ ורדה',  group:'בית G', date:'2026-06-19 19:00'},
  {id:'m04', team1:'ברזיל',     team2:'האיטי',      group:'בית C', date:'2026-06-19 22:00'},
  // 20 ביוני
  {id:'m05', team1:'ספרד',      team2:'קוראסאו',    group:'בית E', date:'2026-06-20 19:00'},
  {id:'m06', team1:'צרפת',      team2:'עיראק',      group:'בית I', date:'2026-06-20 22:00'},
  // 21 ביוני
  {id:'m07', team1:'ארגנטינה',  team2:'אלג׳יריה',   group:'בית J', date:'2026-06-21 19:00'},
  {id:'m08', team1:'אנגליה',    team2:'סנגל',       group:'בית J', date:'2026-06-21 22:00'},
  // 22 ביוני
  {id:'m09', team1:'פורטוגל',   team2:'פנמה',       group:'בית L', date:'2026-06-22 19:00'},
  {id:'m10', team1:'קולומביה',  team2:'ירדן',       group:'בית K', date:'2026-06-22 22:00'},
  // 23 ביוני
  {id:'m11', team1:'יפן',       team2:'שוודיה',     group:'בית G', date:'2026-06-23 19:00'},
  {id:'m12', team1:'נורווגיה',  team2:'קרואטיה',    group:'בית I', date:'2026-06-23 22:00'},
  // 24 ביוני
  {id:'m13', team1:'מקסיקו',    team2:'צ׳כיה',      group:'בית A', date:'2026-06-24 19:00'},
  {id:'m14', team1:'אוסטריה',   team2:'גאנה',       group:'בית K', date:'2026-06-24 22:00'},
].map(m=>({...m, f1:flagOf(m.team1), f2:flagOf(m.team2)}));

// סוגי ניחוש + חוקי ניקוד ברירת מחדל (ניתנים לעריכה במנהל)
const DEFAULT_RULES = {
  exact_score:   {label:'תוצאה מדויקת',     desc:'ניחשת את התוצאה המלאה',              pts:10},
  winner:        {label:'תוצאה כללית',       desc:'מנצחת/תיקו — נגזר אוטומטית מהתוצאה',  pts:4},
  first_scorer:  {label:'כובש ראשון',        desc:'מי יבקיע את השער הראשון במשחק',       pts:6},
  red_card:      {label:'כרטיס אדום',        desc:'האם יורחק שחקן (כשהאדמין מפעיל)',     pts:3},
  // ניחושי-על לכל הטורניר
  champion:      {label:'נבחרת אלופה',        desc:'מי תזכה במונדיאל',                   pts:25},
  runner_up:     {label:'סגנית אלופה',        desc:'מי תסיים במקום השני',                pts:12},
  top_scorer:    {label:'מלך השערים',         desc:'הכובש המוביל בטורניר',               pts:15},
  top_assister:  {label:'מלך הבישולים',       desc:'המבשל המוביל בטורניר',               pts:15},
};

/* ---------- 4. שכבת נתונים (DB) — עובדת בשני המצבים ---------- */
const LS = {
  get(k,def){try{const v=localStorage.getItem('mundial_'+k);return v?JSON.parse(v):def}catch(e){return def}},
  set(k,v){try{localStorage.setItem('mundial_'+k,JSON.stringify(v))}catch(e){DBG.error('שמירה מקומית נכשלה: '+e.message)}}
};

// המרת שם משתמש לדוא"ל פנימי (Supabase auth דורש דוא"ל)
const toEmail = u => `user_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;

const DB = {
  mode: MODE,

  /* ---- אתחול נתוני בסיס במצב דמו ---- */
  initDemo(){
    const DATA_VERSION = 5; // העלאת מספר זה זורעת מחדש משחקים+חוקים
    const cur = LS.get('data_version', 0);
    if(cur !== DATA_VERSION){
      // שדרוג מבנה: זריעה מחדש של משחקים וחוקים, שמירת משתמשים/ניחושים
      LS.set('matches', SEED_MATCHES.map(m=>({...m, status:'open', score1:null, score2:null, first_scorer_result:'', red_card_result:null, finished:false})));
      LS.set('rules', DEFAULT_RULES);
      LS.set('data_version', DATA_VERSION);
      DBG.info('נתוני דמו שודרגו לגרסה ' + DATA_VERSION);
    }
    if(!LS.get('users'))   LS.set('users', []);
    if(!LS.get('preds'))   LS.set('preds', []);
    if(!LS.get('tpreds'))  LS.set('tpreds', []);
  },

  /* ---- אימות ---- */
  async signUp(username, password){
    DBG.info('ניסיון הרשמה', {username, mode:MODE});
    if(!username || username.length<2) throw new Error('שם משתמש קצר מדי (לפחות 2 תווים)');
    if(!password || password.length<4) throw new Error('סיסמה קצרה מדי (לפחות 4 תווים)');
    const isAdmin = username.trim().toLowerCase() === (CFG.ADMIN_USERNAME||'admin').toLowerCase();

    if(LIVE){
      const {data, error} = await sb.auth.signUp({email:toEmail(username), password,
        options:{data:{username, is_admin:isAdmin}}});
      if(error){DBG.error('הרשמה נכשלה: '+error.message);throw new Error(translateAuth(error.message))}
      // יצירת פרופיל
      if(data.user){
        const {error:pe} = await sb.from('profiles').upsert({id:data.user.id, username, is_admin:isAdmin});
        if(pe) DBG.warn('יצירת פרופיל: '+pe.message);
      }
      DBG.info('הרשמה הצליחה (חי)', {username});
      return {id:data.user?.id, username, is_admin:isAdmin};
    }else{
      const users = LS.get('users',[]);
      if(users.find(u=>u.username.toLowerCase()===username.toLowerCase()))
        throw new Error('שם המשתמש כבר תפוס');
      const user = {id:'u'+Date.now(), username, password, is_admin:isAdmin};
      users.push(user); LS.set('users', users);
      LS.set('session', {id:user.id, username, is_admin:isAdmin});
      DBG.info('הרשמה הצליחה (דמו)', {username, is_admin:isAdmin});
      return {id:user.id, username, is_admin:isAdmin};
    }
  },

  async signInWithGoogle(){
  if(!LIVE) throw new Error('Google Sign-In זמין רק במצב חי');
  DBG.info('התחברות עם Google...');
  const {data, error} = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://mundial-2026-202j.onrender.com/'
    }
  });
  if(error) {DBG.error('Google Sign-In נכשל: '+error.message); throw new Error(error.message)}
  DBG.info('הועבר ל-Google...');
},

async handleAuthCallback(){
  try {
    const {data, error} = await sb.auth.getSession();
    if(data?.session){
      this.currentUser = {
        id: data.session.user.id,
        username: data.session.user.email,
        is_admin: false
      };
      DBG.info('משתמש התחבר בהצלחה', this.currentUser);
      return this.currentUser;
    }
  } catch(e) {
    DBG.error('בדיקת session נכשלה: '+e.message);
  }
},
  

  async signIn(username, password){
    DBG.info('ניסיון התחברות', {username, mode:MODE});
    if(LIVE){
      const {data, error} = await sb.auth.signInWithPassword({email:toEmail(username), password});
      if(error){DBG.error('התחברות נכשלה: '+error.message);throw new Error(translateAuth(error.message))}
      const prof = await DB.getMyProfile();
      DBG.info('התחברות הצליחה (חי)', {username});
      return prof;
    }else{
      const users = LS.get('users',[]);
      const u = users.find(x=>x.username.toLowerCase()===username.toLowerCase() && x.password===password);
      if(!u) throw new Error('שם משתמש או סיסמה שגויים');
      LS.set('session', {id:u.id, username:u.username, is_admin:u.is_admin});
      DBG.info('התחברות הצליחה (דמו)', {username});
      return {id:u.id, username:u.username, is_admin:u.is_admin};
    }
  },

  async signOut(){
    DBG.info('התנתקות');
    if(LIVE){await sb.auth.signOut()} else {LS.set('session', null)}
  },

  async getMyProfile(){
    if(LIVE){
      const {data:{user}} = await sb.auth.getUser();
      if(!user) return null;
      const {data, error} = await sb.from('profiles').select('*').eq('id',user.id).single();
      if(error){DBG.warn('טעינת פרופיל: '+error.message);
        return {id:user.id, username:user.user_metadata?.username||'משתמש', is_admin:user.user_metadata?.is_admin||false}}
      return data;
    }else{
      return LS.get('session', null);
    }
  },

  /* ---- משחקים ---- */
  async getMatches(){
    if(LIVE){
      const {data, error} = await sb.from('matches').select('*').order('date');
      if(error){DBG.error('טעינת משחקים: '+error.message);throw new Error(error.message)}
      return data||[];
    }else{
      return LS.get('matches', []);
    }
  },

  async saveMatch(match){
    DBG.info('שמירת משחק', {id:match.id});
    if(LIVE){
      const {error} = await sb.from('matches').upsert(match, {onConflict: 'id'});
      if(error){DBG.error('שמירת משחק: '+error.message);throw new Error(error.message)}
    }else{
      const ms = LS.get('matches',[]);
      const i = ms.findIndex(m=>m.id===match.id);
      if(i>=0) ms[i]=match; else ms.push(match);
      LS.set('matches', ms);
    }
  },

  /* ---- חוקי ניקוד ---- */
  async getRules(){
    if(LIVE){
      const {data, error} = await sb.from('point_rules').select('*');
      if(error || !data || !data.length){
        if(error) DBG.warn('טעינת חוקים: '+error.message);
        return DEFAULT_RULES;
      }
      const r = {...DEFAULT_RULES};
      data.forEach(row=>{if(r[row.bet_type]) r[row.bet_type]={...r[row.bet_type], pts:row.pts}});
      return r;
    }else{
      return LS.get('rules', DEFAULT_RULES);
    }
  },

  async saveRule(betType, pts){
    DBG.info('עדכון חוק ניקוד', {betType, pts});
    if(LIVE){
      const {error} = await sb.from('point_rules').upsert({bet_type:betType, pts}, {onConflict: 'bet_type'});
      if(error){DBG.error('שמירת חוק: '+error.message);throw new Error(error.message)}
    }else{
      const r = LS.get('rules', DEFAULT_RULES);
      r[betType] = {...r[betType], pts};
      LS.set('rules', r);
    }
  },

  /* ---- הגדרות גלובליות (כרטיס אדום, תוצאות-על) ---- */
  async getSettings(){
    if(LIVE){
      const {data, error} = await sb.from('settings').select('*').eq('id','global').single();
      if(error || !data) return {red_card_enabled:true};
      return {red_card_enabled:true, ...(data.value||{})};
    }else{
      return LS.get('settings', {red_card_enabled:true});
    }
  },

  async saveSettings(patch){
    DBG.info('עדכון הגדרות גלובליות', patch);
    const cur = await DB.getSettings();
    const next = {...cur, ...patch};
    if(LIVE){
      const {error} = await sb.from('settings').upsert({id:'global', value:next});
      if(error){DBG.error('שמירת הגדרות: '+error.message);throw new Error(error.message)}
    }else{
      LS.set('settings', next);
    }
    return next;
  },

  /* ---- ניחושים ---- */
  async getMyPredictions(userId){
    if(LIVE){
      const {data, error} = await sb.from('predictions').select('*').eq('user_id',userId);
      if(error){DBG.warn('טעינת ניחושים: '+error.message);return []}
      return data||[];
    }else{
      return LS.get('preds',[]).filter(p=>p.user_id===userId);
    }
  },

  async savePrediction(pred){
    DBG.info('שמירת ניחוש משחק', {match:pred.match_id, user:pred.user_id});
    if(LIVE){
      const {error} = await sb.from('predictions')
        .upsert(pred, {onConflict:'user_id,match_id'});
      if(error){DBG.error('שמירת ניחוש: '+error.message);throw new Error(error.message)}
    }else{
      const ps = LS.get('preds',[]);
      const i = ps.findIndex(p=>p.user_id===pred.user_id && p.match_id===pred.match_id);
      if(i>=0) ps[i]=pred; else ps.push(pred);
      LS.set('preds', ps);
    }
  },

  async getTournamentPredictions(userId){
    if(LIVE){
      const {data, error} = await sb.from('tournament_predictions').select('*').eq('user_id',userId).single();
      if(error) return null;
      return data;
    }else{
      return LS.get('tpreds',[]).find(t=>t.user_id===userId) || null;
    }
  },

  async saveTournamentPrediction(tp){
    DBG.info('שמירת ניחושי-על', {user:tp.user_id});
    if(LIVE){
      const {error} = await sb.from('tournament_predictions').upsert(tp,{onConflict:'user_id'});
      if(error){DBG.error('שמירת ניחושי-על: '+error.message);throw new Error(error.message)}
    }else{
      const ts = LS.get('tpreds',[]);
      const i = ts.findIndex(t=>t.user_id===tp.user_id);
      if(i>=0) ts[i]=tp; else ts.push(tp);
      LS.set('tpreds', ts);
    }
  },

  /* ---- טבלת ניקוד / משתמשים ---- */
  async getAllUsers(){
    if(LIVE){
      const {data} = await sb.from('profiles').select('id,username');
      return data||[];
    }else{
      return LS.get('users',[]).map(u=>({id:u.id, username:u.username}));
    }
  },

  async getMatchPredictions(matchId){
    if(LIVE){
      const {data} = await sb.from('predictions').select('*').eq('match_id',matchId);
      return data||[];
    }else{
      return LS.get('preds',[]).filter(p=>p.match_id===matchId);
    }
  },

  async getLeaderboard(){
    if(LIVE){
      const {data:profiles, error} = await sb.from('profiles').select('*');
      if(error){DBG.error('טבלת ניקוד: '+error.message);return []}
      const {data:preds} = await sb.from('predictions').select('*');
      const {data:tpreds} = await sb.from('tournament_predictions').select('*');
      const {data:matches} = await sb.from('matches').select('*');
      return buildLeaderboard(profiles||[], preds||[], tpreds||[], matches||[]);
    }else{
      const users = LS.get('users',[]).map(u=>({id:u.id, username:u.username, is_admin:u.is_admin}));
      const preds = LS.get('preds',[]);
      const tpreds = LS.get('tpreds',[]);
      const matches = LS.get('matches',[]);
      return buildLeaderboard(users, preds, tpreds, matches);
    }
  },

  /* ---- ניקוד אוטומטי בעת סגירת משחק (מנהל) ---- */
  async scoreMatch(match){
    DBG.info('מחשב ניקוד למשחק', {id:match.id, score:match.score1+'-'+match.score2});
    const rules = await DB.getRules();
    const settings = await DB.getSettings();
    let preds;
    if(LIVE){
      const {data} = await sb.from('predictions').select('*').eq('match_id',match.id);
      preds = data||[];
    }else{
      preds = LS.get('preds',[]).filter(p=>p.match_id===match.id);
    }
    let scored = 0;
    for(const p of preds){
      const pts = computeMatchPoints(p, match, rules, settings.red_card_enabled);
      p.points_awarded = pts;
      if(LIVE){
        await sb.from('predictions').update({points_awarded:pts}).eq('user_id',p.user_id).eq('match_id',match.id);
      }
      scored++;
    }
    if(!LIVE){
      const all = LS.get('preds',[]);
      preds.forEach(p=>{const i=all.findIndex(x=>x.user_id===p.user_id&&x.match_id===p.match_id);if(i>=0)all[i]=p});
      LS.set('preds', all);
    }
    DBG.info('ניקוד הושלם', {match:match.id, predictions_scored:scored});
    return scored;
  }
};

/* ---------- 5. לוגיקת ניקוד ---------- */
function computeMatchPoints(pred, match, rules, redCardEnabled){
  if(match.score1==null || match.score2==null) return 0;
  let pts = 0;
  const v = pred.value || {};

  if(v.s1!=null && v.s2!=null){
    // תוצאה מדויקת
    if(Number(v.s1)===match.score1 && Number(v.s2)===match.score2){
      pts += rules.exact_score.pts;
    }
    // תוצאה כללית (מנצחת/תיקו) — נגזרת אוטומטית מהתוצאה שניחש
    const realW = match.score1>match.score2?'1':match.score1<match.score2?'2':'X';
    const predW = Number(v.s1)>Number(v.s2)?'1':Number(v.s1)<Number(v.s2)?'2':'X';
    if(realW===predW) pts += rules.winner.pts;
  }
  // כובש ראשון
  if(v.first_scorer && match.first_scorer_result &&
     v.first_scorer.trim()===match.first_scorer_result.trim()){
    pts += rules.first_scorer.pts;
  }
  // כרטיס אדום (רק אם האדמין הפעיל את האופציה — הגדרה גלובלית)
  if(redCardEnabled && v.red_card!=null && match.red_card_result!=null &&
     v.red_card===match.red_card_result){
    pts += rules.red_card.pts;
  }
  return pts;
}

function buildLeaderboard(users, preds, tpreds, matches){
  const map = {};
  users.forEach(u=>{map[u.id]={id:u.id, username:u.username, is_admin:u.is_admin,
    points:0, correct:0, total:0, exact:0, first_scorer_hits:0, winner_hits:0}});
  const matchMap = {};
  (matches||[]).forEach(m=>{ matchMap[m.id]=m; });
  preds.forEach(p=>{
    if(!map[p.user_id]) return;
    const u = map[p.user_id];
    u.total++;
    const pa = p.points_awarded||0;
    u.points += pa;
    if(pa>0) u.correct++;
    const v = p.value||{};
    const m = matchMap[p.match_id];
    if(m && m.finished && v.s1!=null && v.s2!=null){
      if(Number(v.s1)===m.score1 && Number(v.s2)===m.score2) u.exact++;
      const realW = m.score1>m.score2?'1':m.score1<m.score2?'2':'X';
      const predW = Number(v.s1)>Number(v.s2)?'1':Number(v.s1)<Number(v.s2)?'2':'X';
      if(realW===predW) u.winner_hits++;
    }
    if(m && m.finished && v.first_scorer && m.first_scorer_result &&
       v.first_scorer.trim()===m.first_scorer_result.trim()) u.first_scorer_hits++;
  });
  tpreds.forEach(t=>{
    if(!map[t.user_id]) return;
    map[t.user_id].points += (t.points_awarded||0);
    map[t.user_id].champion = t.champion||'';
    map[t.user_id].top_scorer = t.top_scorer||'';
  });
  return Object.values(map).sort((a,b)=>b.points-a.points);
}

/* ---------- 6. תרגום שגיאות Supabase ---------- */
function translateAuth(msg){
  const m = (msg||'').toLowerCase();
  if(m.includes('already registered')||m.includes('already exists')) return 'שם המשתמש כבר תפוס';
  if(m.includes('invalid login')) return 'שם משתמש או סיסמה שגויים';
  if(m.includes('password')) return 'בעיה בסיסמה — נסה סיסמה ארוכה יותר';
  if(m.includes('email')) return 'שם המשתמש לא תקין (השתמש באותיות באנגלית/מספרים)';
  return msg;
}

DB.initDemo();
DBG.info('שכבת הנתונים מוכנה', {mode:MODE});

/* ---------- 7. סנכרון משחקים מ-API חיצוני (football-data.org) ---------- */
// מיפוי שמות נבחרות: אנגלית (API) ← עברית (אפליקציה)
const EN2HE = {
  'Mexico':'מקסיקו','South Korea':'דרום קוריאה','Korea Republic':'דרום קוריאה',
  'South Africa':'דרום אפריקה','Czech Republic':'צ׳כיה','Czechia':'צ׳כיה',
  'Canada':'קנדה','Bosnia and Herzegovina':'בוסניה','Bosnia-Herzegovina':'בוסניה',
  'Qatar':'קטאר','Uruguay':'אורוגוואי','Switzerland':'שווייץ','Brazil':'ברזיל',
  'Haiti':'האיטי','Morocco':'מרוקו','Scotland':'סקוטלנד','Australia':'אוסטרליה',
  'Paraguay':'פרגוואי','USA':'ארה״ב','United States':'ארה״ב',
  'Turkey':'טורקיה','Türkiye':'טורקיה','Curaçao':'קוראסאו','Curacao':'קוראסאו',
  'New Zealand':'ניו זילנד','Spain':'ספרד','Ecuador':'אקוודור','Germany':'גרמניה',
  "Côte d'Ivoire":'חוף השנהב','Ivory Coast':'חוף השנהב','Iran':'איראן',
  'Japan':'יפן','Netherlands':'הולנד','Cape Verde':'קייפ ורדה','Cabo Verde':'קייפ ורדה',
  'Sweden':'שוודיה','Tunisia':'תוניסיה','Belgium':'בלגיה','Egypt':'מצרים',
  'Saudi Arabia':'ערב הסעודית','France':'צרפת','Iraq':'עיראק',
  'Norway':'נורווגיה','Croatia':'קרואטיה','Senegal':'סנגל','Algeria':'אלג׳יריה',
  'England':'אנגליה','Argentina':'ארגנטינה','Austria':'אוסטריה',
  'Jordan':'ירדן','Colombia':'קולומביה','Ghana':'גאנה',
  'DR Congo':'קונגו','Congo DR':'קונגו','Portugal':'פורטוגל',
  'Uzbekistan':'אוזבקיסטן','Panama':'פנמה',
};
const HE2EN = {}; Object.entries(EN2HE).forEach(([en,he])=>{ HE2EN[he]=en; });
const toHeb = name => EN2HE[name] || name;
const groupHeb = g => g ? g.replace('GROUP_','בית ') : '';

// תרגום שם שחקן מ-API (אם צריך ניקוי)
const cleanPlayerName = s => (s||'').trim();

// קריאה ל-API וסנכרון עם המשחקים המקומיים
async function syncFromAPI(){
  const apiKey = CFG.FOOTBALL_API_KEY;
  if(!apiKey){ DBG.info('אין מפתח API — דילוג על סנכרון'); return false; }

  try{
    DBG.info('מסנכרן משחקים מ-football-data.org...');
    const res = await fetch('https://cors-anywhere.herokuapp.com/https://api.football-data.org/v4/competitions/WC/matches', {
      headers: {
        'X-Auth-Token': apiKey,
        'Accept': 'application/json'
      }
    });
    if(!res.ok){
      DBG.warn('API שגיאה: ' + res.status + ' ' + res.statusText);
      return false;
    }
    const data = await res.json();
    const apiMatches = (data.matches || []);
    DBG.info('API החזיר ' + apiMatches.length + ' משחקים');

    const existing = await DB.getMatches();
    const existingMap = {}; existing.forEach(m=>{ existingMap[m.id]=m; });

    let updated = 0;
    for(const am of apiMatches){
      const t1 = toHeb(am.homeTeam?.name || am.homeTeam?.shortName || '');
      const t2 = toHeb(am.awayTeam?.name || am.awayTeam?.shortName || '');
      if(!t1 || !t2) continue;

      const id = 'api_' + am.id;
      const dt = am.utcDate ? new Date(am.utcDate) : null;
      const dateStr = dt ? dt.toISOString().slice(0,10)+' '+dt.toTimeString().slice(0,5) : '';
      const grp = groupHeb(am.group || am.stage || '');

      const finished = am.status === 'FINISHED';
      const inPlay = am.status === 'IN_PLAY' || am.status === 'PAUSED';
      const score1 = finished ? am.score?.fullTime?.home : null;
      const score2 = finished ? am.score?.fullTime?.away : null;

      // כובש ראשון — מאירועי המשחק אם יש
      let firstScorer = '';
      if(am.goals && am.goals.length > 0){
        firstScorer = cleanPlayerName(am.goals[0]?.scorer?.name || '');
      }

      const match = {
        id, team1:t1, f1:flagOf(t1), team2:t2, f2:flagOf(t2),
        group:grp, date:dateStr,
        status: finished?'done': inPlay?'live':'open',
        score1, score2,
        first_scorer_result: finished ? firstScorer : (existingMap[id]?.first_scorer_result || ''),
        red_card_result: finished ? (existingMap[id]?.red_card_result ?? null) : null,
        finished
      };

      // לא דורסים תוצאה שהוזנה ידנית (אם המנהל כבר הזין)
      const prev = existingMap[id];
      if(prev && prev.finished && !finished) continue;

      await DB.saveMatch(match);
      updated++;
    }

    DBG.info('סנכרון הסתיים: ' + updated + ' משחקים עודכנו');
    return true;
  }catch(e){
    DBG.warn('סנכרון API נכשל: ' + e.message);
    return false;
  }
}

/* ============================================================
   חלק 2: רכיבי React (htm — ללא Babel, טעינה מהירה)
   ============================================================ */
const {useState, useEffect, useMemo, useRef, useCallback} = React;
const html = htm.bind(React.createElement);
const F = React.Fragment;

/* ---------- Toast ---------- */
let _toastTimer;
function showToast(msg, kind='good'){
  const mount = document.getElementById('toast-mount');
  mount.innerHTML = `<div class="toast ${kind}">${kind==='good'?'✅':kind==='bad'?'⚠️':'ℹ️'} ${msg}</div>`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>{mount.innerHTML=''}, 2800);
}
window.showToast = showToast;

/* ---------- כלי עזר ---------- */
const initials = n => (n||'?').trim().slice(0,2);
function fmtDate(s){
  try{const d=new Date(s.replace(' ','T'));
    return d.toLocaleDateString('he-IL',{day:'numeric',month:'short'})+' · '+
           d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',hour12:false});
  }catch(e){return s}
}

/* ---------- מסך כניסה / הרשמה ---------- */
function AuthScreen({onAuth}){
  const [tab,setTab] = useState('login');
  const [username,setU] = useState('');
  const [password,setP] = useState('');
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState('');

  async function submit(){
    setErr(''); setBusy(true);
    try{
      const user = tab==='login' ? await DB.signIn(username, password) : await DB.signUp(username, password);
      showToast(tab==='login'?'התחברת בהצלחה':'נרשמת בהצלחה! ברוך הבא');
      onAuth(user);
    }catch(e){ setErr(e.message||'משהו השתבש'); showToast(e.message||'שגיאה','bad'); }
    finally{setBusy(false)}
  }

  return html`
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="big-ball">⚽</div>
        <h1>ניחוש <span className="accent">מונדיאל</span></h1>
        <p>נחשו תוצאות, כובשים ומבשלים — ותעלו בטבלה</p>
      </div>
      <div className="tabs">
        <button className=${tab==='login'?'on':''} onClick=${()=>{setTab('login');setErr('')}}>התחברות</button>
        <button className=${tab==='register'?'on':''} onClick=${()=>{setTab('register');setErr('')}}>הרשמה</button>
      </div>
      <div className="card">
        <div className="field">
          <label>שם משתמש</label>
          <input className="input" value=${username} autoCapitalize="off" autoCorrect="off"
            onChange=${e=>setU(e.target.value)} placeholder="לדוגמה: messi10"
            onKeyDown=${e=>e.key==='Enter'&&submit()} />
        </div>
        <div className="field">
          <label>סיסמה</label>
          <input className="input" type="password" value=${password}
            onChange=${e=>setP(e.target.value)} placeholder="לפחות 4 תווים"
            onKeyDown=${e=>e.key==='Enter'&&submit()} />
        </div>
        ${err && html`<div style=${{color:'var(--bad)',fontSize:13,fontWeight:600,marginBottom:12,textAlign:'center'}}>${err}</div>`}
        <button className="btn btn-primary" disabled=${busy||!username||!password} onClick=${submit}>
          ${busy ? 'רגע...' : tab==='login' ? 'כניסה למשחק' : 'יצירת חשבון'}
        </button>
      </div>
      <p className="note" style=${{textAlign:'center',marginTop:18}}>
        ${MODE==='demo' ? '🔸 מצב דמו — הנתונים נשמרים במכשיר זה בלבד' : '🟢 מחובר לשרת — ריבוי משתמשים פעיל'}
      </p>
    </div>`;
}

/* ---------- כותרת עליונה ---------- */
function TopBar({user, onSignOut}){
  return html`
    <div className="topbar">
      <div className="brand">
        <span className="ball">⚽</span>
        <span>ניחוש מונדיאל<small>טורניר 2026</small></span>
      </div>
      <div className="chip-user" onClick=${onSignOut} title="התנתקות">
        <span>${user.username}</span>
        <span className="av">${initials(user.username)}</span>
      </div>
    </div>`;
}

/* ---------- ניווט תחתון ---------- */
function TabBar({tab, setTab, isAdmin}){
  const items = [
    {k:'matches', ic:'⚽', l:'משחקים'},
    {k:'tournament', ic:'🏆', l:'ניחושי-על'},
    {k:'board', ic:'📊', l:'טבלה'},
    {k:'rules', ic:'📜', l:'חוקים'},
  ];
  if(isAdmin) items.push({k:'admin', ic:'⚙️', l:'ניהול'});
  return html`
    <nav className="tabbar">
      ${items.map(it=>html`
        <button key=${it.k} className=${tab===it.k?'on':''} onClick=${()=>setTab(it.k)}>
          <span className="ic">${it.ic}</span>${it.l}
        </button>`)}
    </nav>`;
}

/* ============================================================
   חלק 3: מסך משחקים + מסך ניחוש משחק
   ============================================================ */
function MatchesScreen({user, onPredict, onViewOthers}){
  const [matches,setMatches] = useState(null);
  const [myPreds,setMyPreds] = useState({});

  const load = useCallback(async()=>{
    try{
      const ms = await DB.getMatches();
      const ps = await DB.getMyPredictions(user.id);
      const map = {}; ps.forEach(p=>map[p.match_id]=p);
      setMatches(ms); setMyPreds(map);
    }catch(e){DBG.error('טעינת מסך משחקים: '+e.message)}
  },[user.id]);
  useEffect(()=>{load()},[load]);

  if(!matches) return html`<div className="spinner"></div>`;
  if(!matches.length) return html`
    <div className="empty"><div className="ic">⚽</div>
      <h3>אין משחקים עדיין</h3><p>המנהל יוסיף משחקים בקרוב</p></div>`;

  return html`
    <div>
      <div className="section-title">המשחקים הקרובים</div>
      ${matches.map(m=>{
        const pred = myPreds[m.id];
        const done = m.finished;
        const locked = matchLocked(m);
        const open = !done && !locked;
        return html`
          <div key=${m.id} className="card match-card">
            <div className="meta">
              <span className="grp">${m.group}</span>
              <span>${fmtDate(m.date)}</span>
              <span className=${'status-pill '+(done?'status-done':open?'status-open':'status-locked')}>
                ${done?'הסתיים':open?'פתוח לניחוש':'🔒 נעול'}
              </span>
            </div>
            <div className="match-teams">
              <div className="team"><span className="flag">${m.f1}</span><span className="nm">${m.team1}</span></div>
              <div className="vs">
                ${done ? html`<span className="score-final">${m.score1} : ${m.score2}</span>` : 'נגד'}
              </div>
              <div className="team"><span className="flag">${m.f2}</span><span className="nm">${m.team2}</span></div>
            </div>
            ${pred && pred.value && pred.value.s1!=null && html`
              <div className="pred-summary">
                🎯 ניחשת: <b>${pred.value.s1} : ${pred.value.s2}</b>
                ${pred.value.first_scorer ? html`<span style=${{color:'var(--text-dim)'}}>· כובש: ${pred.value.first_scorer}</span>` : ''}
                ${done && pred.points_awarded!=null && html`
                  <span style=${{marginRight:'auto',color:pred.points_awarded>0?'var(--good)':'var(--text-mut)',fontWeight:700}}>
                    +${pred.points_awarded||0} נק׳</span>`}
              </div>`}
            ${open && html`
              <button className="btn btn-ghost btn-sm" style=${{marginTop:12,width:'100%'}}
                onClick=${()=>onPredict(m)}>
                ${pred?'✏️ עריכת ניחוש':'🎯 הוספת ניחוש'}
              </button>`}
            ${locked && html`
              <button className="btn btn-ghost btn-sm" style=${{marginTop:8,width:'100%'}}
                onClick=${()=>onViewOthers(m)}>
                👥 צפייה בניחושי כולם
              </button>`}
          </div>`;
      })}
    </div>`;
}

/* ---------- צפייה בניחושי אחרים (אחרי נעילה) ---------- */
function OthersPreds({match, onBack}){
  const [preds,setPreds] = useState(null);
  const [users,setUsers] = useState({});

  useEffect(()=>{(async()=>{
    const [ps, us] = await Promise.all([DB.getMatchPredictions(match.id), DB.getAllUsers()]);
    const umap = {}; us.forEach(u=>umap[u.id]=u.username);
    setUsers(umap); setPreds(ps);
  })()},[match.id]);

  if(!preds) return html`<div className="spinner"></div>`;

  return html`
    <div>
      <div className="section-title" style=${{justifyContent:'flex-start'}}>
        <button className="btn btn-ghost btn-sm" onClick=${onBack}>→ חזרה</button>
        <span style=${{marginRight:8}}>ניחושי כולם</span>
      </div>
      <div className="card" style=${{marginBottom:12}}>
        <div className="match-teams">
          <div className="team"><span className="flag">${match.f1}</span><span className="nm">${match.team1}</span></div>
          <div className="vs">${match.finished?html`<span className="score-final">${match.score1}:${match.score2}</span>`:'נגד'}</div>
          <div className="team"><span className="flag">${match.f2}</span><span className="nm">${match.team2}</span></div>
        </div>
      </div>
      ${preds.length===0
        ? html`<div className="note" style=${{textAlign:'center',padding:20}}>אין ניחושים למשחק הזה</div>`
        : preds.map(p=>{
          const v = p.value||{};
          const name = users[p.user_id]||'?';
          return html`
            <div key=${p.user_id} className="card" style=${{padding:'10px 14px',marginBottom:6}}>
              <div style=${{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <b>${name}</b>
                  <span style=${{margin:'0 8px',fontSize:15}}>${v.s1!=null?v.s1:'?'} : ${v.s2!=null?v.s2:'?'}</span>
                  ${v.first_scorer ? html`<span className="note">· ${v.first_scorer}</span>` : ''}
                </div>
                ${p.points_awarded!=null && html`
                  <span style=${{fontWeight:700,color:p.points_awarded>0?'var(--good)':'var(--text-mut)'}}>+${p.points_awarded}</span>`}
              </div>
            </div>`;
        })}
    </div>`;
}

/* ---------- מסך ניחוש משחק בודד ---------- */
function PredictScreen({user, match, onBack}){
  const [val,setVal] = useState({s1:'', s2:'', first_scorer:'', red_card:null});
  const [busy,setBusy] = useState(false);
  const [redCardEnabled,setRedCardEnabled] = useState(false);
  const players = matchPlayers(match);
  const dlId = 'players-'+match.id;

  useEffect(()=>{(async()=>{
    const s = await DB.getSettings(); setRedCardEnabled(!!s.red_card_enabled);
    const ps = await DB.getMyPredictions(user.id);
    const ex = ps.find(p=>p.match_id===match.id);
    if(ex && ex.value) setVal({s1:'',s2:'',first_scorer:'',red_card:null,...ex.value});
  })()},[user.id, match.id]);

  async function save(){
    if(matchLocked(match)){ showToast('הניחוש נעול — לא ניתן לעדכן','bad'); return; }
    setBusy(true);
    try{
      await DB.savePrediction({
        user_id:user.id, match_id:match.id,
        value:{ s1: val.s1===''?null:Number(val.s1), s2: val.s2===''?null:Number(val.s2),
          first_scorer:val.first_scorer, red_card: redCardEnabled ? val.red_card : null },
        points_awarded:null
      });
      showToast('הניחוש נשמר!'); onBack();
    }catch(e){showToast(e.message,'bad')}finally{setBusy(false)}
  }

  const derived = (val.s1!==''&&val.s2!=='')
    ? (Number(val.s1)>Number(val.s2)?'ניצחון '+match.team1 : Number(val.s1)<Number(val.s2)?'ניצחון '+match.team2 : 'תיקו')
    : null;

  return html`
    <div>
      <div className="section-title" style=${{justifyContent:'flex-start'}}>
        <button className="btn btn-ghost btn-sm" onClick=${onBack}>→ חזרה</button>
        <span style=${{marginRight:8}}>ניחוש משחק</span>
      </div>

      <datalist id=${dlId}>
        ${players.map(p=>html`<option key=${p} value=${p}/>`)}
      </datalist>

      <div className="card">
        <div className="meta" style=${{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-mut)',marginBottom:6}}>
          <span className="grp">${match.group}</span><span>${fmtDate(match.date)}</span>
        </div>
        <label style=${{fontSize:13,fontWeight:600,color:'var(--text-dim)',display:'block',margin:'6px 0 8px'}}>תוצאה מדויקת</label>
        <div className="scorebox">
          <div className="team">
            <span className="flag" style=${{fontSize:28}}>${match.f1}</span>
            <input className="score-input" type="number" min="0" inputMode="numeric"
              value=${val.s1} onChange=${e=>setVal(v=>({...v,s1:e.target.value}))} placeholder="0"/>
            <span className="nm" style=${{fontSize:13}}>${match.team1}</span>
          </div>
          <div className="vs">:</div>
          <div className="team">
            <span className="flag" style=${{fontSize:28}}>${match.f2}</span>
            <input className="score-input" type="number" min="0" inputMode="numeric"
              value=${val.s2} onChange=${e=>setVal(v=>({...v,s2:e.target.value}))} placeholder="0"/>
            <span className="nm" style=${{fontSize:13}}>${match.team2}</span>
          </div>
        </div>
        ${derived && html`<div className="pred-summary" style=${{marginTop:10}}>תוצאה כללית: <b>${derived}</b> <span style=${{marginRight:'auto',color:'var(--text-mut)',fontSize:12}}>נגזר אוטומטית</span></div>`}
      </div>

      <div className="card">
        <label style=${{fontSize:14,fontWeight:700,display:'block',marginBottom:8}}>🥇 הכובש הראשון במשחק</label>
        <input className="input" value=${val.first_scorer} list=${dlId}
          onChange=${e=>setVal(v=>({...v,first_scorer:e.target.value}))}
          placeholder="התחל להקליד שם שחקן..." />
        <p className="note" style=${{marginTop:6}}>מתוך סגלי ${match.team1} ו-${match.team2}</p>
      </div>

      ${redCardEnabled && html`
        <div className="card">
          <label style=${{fontSize:14,fontWeight:700,display:'block',marginBottom:8}}>🟥 יורחק שחקן (כרטיס אדום)?</label>
          <div className="seg">
            <button className=${val.red_card===true?'on':''} onClick=${()=>setVal(v=>({...v,red_card:true}))}>כן</button>
            <button className=${val.red_card===false?'on':''} onClick=${()=>setVal(v=>({...v,red_card:false}))}>לא</button>
          </div>
        </div>`}

      <button className="btn btn-primary" style=${{marginTop:14}} disabled=${busy} onClick=${save}>
        ${busy?'שומר...':'💾 שמירת הניחוש'}
      </button>
    </div>`;
}

/* ============================================================
   חלק 4: ניחושי-על + טבלת ניקוד
   ============================================================ */
function tourneyCards(rules){
  return {
    teams: [
      {key:'champion', ic:'🏆', title:'הנבחרת האלופה', desc:'מי תרים את הגביע', pts:rules.champion.pts},
      {key:'runner_up', ic:'🥈', title:'סגנית האלופה', desc:'מי תסיים במקום השני', pts:rules.runner_up.pts},
    ],
    players: [
      {key:'top_scorer', ic:'👑', title:'מלך השערים', desc:'הכובש המוביל בטורניר', pts:rules.top_scorer.pts},
      {key:'top_assister', ic:'🎯', title:'מלך הבישולים', desc:'המבשל המוביל בטורניר', pts:rules.top_assister.pts},
    ],
  };
}

/* ---------- ניחושי-על: מסך הקמה חובה (בהרשמה) ---------- */
function TournamentSetup({user, onDone}){
  const [tp,setTp] = useState({champion:'', runner_up:'', top_scorer:'', top_assister:''});
  const [rules,setRules] = useState(DEFAULT_RULES);
  const [busy,setBusy] = useState(false);

  useEffect(()=>{(async()=>{ setRules(await DB.getRules()); })()},[]);

  const complete = tp.champion && tp.runner_up && tp.top_scorer.trim() && tp.top_assister.trim();

  async function submit(){
    if(!complete){ showToast('יש למלא את כל ארבעת הניחושים','bad'); return; }
    setBusy(true);
    try{
      await DB.saveTournamentPrediction({user_id:user.id, ...tp, locked:true, points_awarded:null});
      showToast('ניחושי-העל נשמרו ונעולים! בהצלחה 🏆');
      onDone({...tp, locked:true});
    }catch(e){showToast(e.message,'bad')}finally{setBusy(false)}
  }

  const c = tourneyCards(rules);
  return html`
    <div className="app-main" style=${{paddingTop:20}}>
      <div className="auth-hero" style=${{marginBottom:18}}>
        <div className="big-ball" style=${{width:54,height:54,fontSize:26}}>🏆</div>
        <h1 style=${{fontSize:26}}>ניחושי-העל שלך</h1>
        <p>לפני שמתחילים — בחר את ניחושי הטורניר. <b style=${{color:'var(--coral)'}}>שים לב: לא ניתן לשנות אותם אחר כך!</b></p>
      </div>

      <datalist id="all-players">
        ${WC_ALL_PLAYERS.map(p=>html`<option key=${p} value=${p}/>`)}
      </datalist>

      ${c.teams.map(cd=>html`
        <div key=${cd.key} className="card">
          <div style=${{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <span style=${{fontSize:26}}>${cd.ic}</span>
            <div style=${{flex:1}}><div style=${{fontFamily:'Rubik',fontWeight:800,fontSize:16}}>${cd.title}</div>
              <div style=${{fontSize:12,color:'var(--text-mut)'}}>${cd.desc}</div></div>
            <span className="badge" style=${{color:'var(--lime)',borderColor:'var(--lime)'}}>${cd.pts} נק׳</span>
          </div>
          <select className="input" value=${tp[cd.key]} onChange=${e=>setTp(v=>({...v,[cd.key]:e.target.value}))}>
            <option value="">בחר נבחרת...</option>
            ${WC_TEAMS.map(t=>html`<option key=${t.name} value=${t.name}>${t.flag} ${t.name}</option>`)}
          </select>
        </div>`)}

      ${c.players.map(cd=>html`
        <div key=${cd.key} className="card">
          <div style=${{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <span style=${{fontSize:26}}>${cd.ic}</span>
            <div style=${{flex:1}}><div style=${{fontFamily:'Rubik',fontWeight:800,fontSize:16}}>${cd.title}</div>
              <div style=${{fontSize:12,color:'var(--text-mut)'}}>${cd.desc}</div></div>
            <span className="badge" style=${{color:'var(--lime)',borderColor:'var(--lime)'}}>${cd.pts} נק׳</span>
          </div>
          <input className="input" value=${tp[cd.key]} list="all-players"
            onChange=${e=>setTp(v=>({...v,[cd.key]:e.target.value}))} placeholder="התחל להקליד שם שחקן..." />
        </div>`)}

      <button className="btn btn-primary" style=${{marginTop:14}} disabled=${busy||!complete} onClick=${submit}>
        ${busy?'שומר...':complete?'🔒 שמירה וכניסה למשחק':'מלא את כל הניחושים כדי להמשיך'}
      </button>
    </div>`;
}

/* ---------- ניחושי-על: צפייה (נעול) ---------- */
function TournamentScreen({user}){
  const [tp,setTp] = useState(undefined);
  const [rules,setRules] = useState(DEFAULT_RULES);

  useEffect(()=>{(async()=>{
    setRules(await DB.getRules());
    setTp(await DB.getTournamentPredictions(user.id) || null);
  })()},[user.id]);

  if(tp===undefined) return html`<div className="spinner"></div>`;
  if(!tp) return html`<div className="empty"><div className="ic">🏆</div><h3>אין ניחושי-על</h3></div>`;

  const c = tourneyCards(rules);
  const all = [...c.teams, ...c.players];
  const isTeam = k => k==='champion'||k==='runner_up';

  return html`
    <div>
      <div className="section-title">ניחושי-העל שלך 🔒</div>
      <p className="note" style=${{margin:'0 4px 14px'}}>הניחושים ננעלו בהרשמה ולא ניתנים לשינוי.</p>
      ${all.map(cd=>html`
        <div key=${cd.key} className="card" style=${{display:'flex',alignItems:'center',gap:12}}>
          <span style=${{fontSize:26}}>${cd.ic}</span>
          <div style=${{flex:1}}>
            <div style=${{fontSize:12,color:'var(--text-mut)',fontWeight:600}}>${cd.title}</div>
            <div style=${{fontFamily:'Rubik',fontWeight:800,fontSize:17}}>
              ${isTeam(cd.key) && tp[cd.key] ? flagOf(tp[cd.key])+' ' : ''}${tp[cd.key]||'—'}
            </div>
          </div>
          <span className="badge" style=${{color:'var(--lime)',borderColor:'var(--lime)'}}>${cd.pts} נק׳</span>
        </div>`)}
    </div>`;
}

/* ---------- טבלת ניקוד ---------- */
function LeaderboardScreen({user}){
  const [rows,setRows] = useState(null);
  const [expanded,setExpanded] = useState(null);
  useEffect(()=>{(async()=>{
    try{ setRows(await DB.getLeaderboard()) }catch(e){DBG.error('טבלת ניקוד: '+e.message); setRows([])}
  })()},[]);

  if(!rows) return html`<div className="spinner"></div>`;
  const me = rows.find(r=>r.id===user.id);
  const myRank = rows.findIndex(r=>r.id===user.id)+1;
  const maxPts = rows.length ? rows[0].points : 1;

  return html`
    <div>
      <div className="section-title">טבלת המנצחים</div>
      ${me && html`
        <div className="stat-grid" style=${{marginBottom:16}}>
          <div className="stat"><div className="v">#${myRank||'—'}</div><div className="l">מיקום</div></div>
          <div className="stat"><div className="v">${me.points}</div><div className="l">נקודות</div></div>
          <div className="stat"><div className="v">${me.exact}</div><div className="l">תוצאות מדויקות</div></div>
          <div className="stat"><div className="v">${me.first_scorer_hits}</div><div className="l">כובש ראשון</div></div>
        </div>`}
      ${rows.length===0
        ? html`<div className="empty"><div className="ic">📊</div><h3>הטבלה ריקה</h3><p>נקודות יופיעו אחרי שהמנהל יזין תוצאות</p></div>`
        : rows.map((r,i)=>html`
          <div key=${r.id}>
            <div className=${'lb-row '+(r.id===user.id?'me ':'')+(i<3?('top'+(i+1)):'')}
                 onClick=${()=>setExpanded(expanded===r.id?null:r.id)} style=${{cursor:'pointer'}}>
              <span className="lb-rank">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
              <span className="lb-av">${initials(r.username)}</span>
              <span className="lb-name">${r.username}${r.is_admin?' 👑':''}
                <small>${r.exact} מדויקות · ${r.winner_hits} תוצאות · ${r.first_scorer_hits} כובשים</small></span>
              <span className="lb-pts">${r.points}<span>נק׳</span></span>
            </div>
            ${expanded===r.id && html`
              <div className="card" style=${{margin:'0 0 8px',padding:12,fontSize:13}}>
                <div style=${{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span>📊 ${r.correct}/${r.total} ניחושים מוצלחים</span>
                </div>
                ${maxPts>0 && html`<div style=${{background:'var(--bg-alt)',borderRadius:6,height:8,marginBottom:10}}>
                  <div style=${{width:Math.round(r.points/maxPts*100)+'%',height:'100%',borderRadius:6,background:'var(--lime)',transition:'width .3s'}}></div>
                </div>`}
                ${r.champion && html`<div>🏆 אלופה: <b>${flagOf(r.champion)} ${r.champion}</b></div>`}
                ${r.top_scorer && html`<div>👑 מלך שערים: <b>${r.top_scorer}</b></div>`}
              </div>`}
          </div>`)}
    </div>`;
}

/* ============================================================
   חלק 5: אזור מנהל
   ============================================================ */
function AdminScreen(){
  const [rules,setRules] = useState(null);
  const [matches,setMatches] = useState(null);
  const [editing,setEditing] = useState(null);
  const [sub,setSub] = useState('rules');
  const [redCardEnabled,setRedCardEnabled] = useState(true);

  const load = useCallback(async()=>{
    setRules(await DB.getRules());
    setMatches(await DB.getMatches());
    const s = await DB.getSettings(); setRedCardEnabled(!!s.red_card_enabled);
  },[]);
  useEffect(()=>{load()},[load]);

  async function changePts(key, pts){
    const p = Math.max(0, parseInt(pts)||0);
    setRules(r=>({...r,[key]:{...r[key],pts:p}}));
    try{await DB.saveRule(key,p); showToast('הניקוד עודכן')}catch(e){showToast(e.message,'bad')}
  }

  async function toggleRedCardGlobal(){
    const next = !redCardEnabled;
    setRedCardEnabled(next);
    try{await DB.saveSettings({red_card_enabled:next}); showToast(next?'ניחוש כרטיס אדום הופעל לכל המשחקים':'ניחוש כרטיס אדום כובה')}
    catch(e){showToast(e.message,'bad'); setRedCardEnabled(!next)}
  }

  if(!rules||!matches) return html`<div className="spinner"></div>`;
  if(editing) return html`<${AdminResult} match=${editing} redCardEnabled=${redCardEnabled} onDone=${()=>{setEditing(null);load()}} />`;

  return html`
    <div>
      <div className="section-title">אזור ניהול</div>
      <div className="tabs" style=${{marginBottom:16}}>
        <button className=${sub==='rules'?'on':''} onClick=${()=>setSub('rules')}>💰 ניקוד</button>
        <button className=${sub==='results'?'on':''} onClick=${()=>setSub('results')}>📥 תוצאות</button>
      </div>
      ${sub==='rules' && html`
        <div>
          <div className="card" style=${{marginBottom:12}}>
            <div style=${{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div><div style=${{fontWeight:700,fontSize:15}}>🟥 ניחוש כרטיס אדום</div>
                <div className="note">חל על כל המשחקים. כשכבוי — האופציה לא מופיעה למשתמשים.</div></div>
              <button className=${'btn btn-sm '+(redCardEnabled?'btn-primary':'btn-ghost')} style=${{width:'auto',flex:'none'}}
                onClick=${toggleRedCardGlobal}>${redCardEnabled?'מופעל ✓':'כבוי'}</button>
            </div>
          </div>
          <div className="card">
            <p className="note" style=${{marginBottom:8}}>קבע כמה נקודות שווה כל סוג ניחוש. השינוי נשמר מיד.</p>
            ${Object.entries(rules).map(([key,r])=>html`
              <div key=${key} className="admin-rule">
                <div className="rl-name">${r.label}<span className="rl-desc">${r.desc}</span></div>
                <input className="pts-input" type="number" min="0" inputMode="numeric"
                  value=${r.pts} onChange=${e=>changePts(key,e.target.value)} />
              </div>`)}
          </div>
        </div>`}
      ${sub==='results' && html`
        <div>
          <p className="note" style=${{margin:'0 4px 12px'}}>הזן את תוצאת המשחק — הנקודות יחושבו אוטומטית לכל המשתמשים.</p>
          ${matches.map(m=>html`
            <div key=${m.id} className="card" style=${{marginBottom:10}}>
              <div className="match-teams" style=${{marginBottom:8}}>
                <div className="team"><span className="flag" style=${{fontSize:26}}>${m.f1}</span><span className="nm" style=${{fontSize:13}}>${m.team1}</span></div>
                <div className="vs">${m.finished?html`<span className="score-final" style=${{fontSize:22}}>${m.score1}:${m.score2}</span>`:'נגד'}</div>
                <div className="team"><span className="flag" style=${{fontSize:26}}>${m.f2}</span><span className="nm" style=${{fontSize:13}}>${m.team2}</span></div>
              </div>
              <button className=${'btn btn-sm '+(m.finished?'btn-ghost':'btn-coral')} style=${{width:'100%'}}
                onClick=${()=>setEditing(m)}>
                ${m.finished?'✏️ עריכת תוצאה':'📥 הזנת תוצאה וחישוב נקודות'}
              </button>
            </div>`)}
        </div>`}
    </div>`;
}

/* ---------- הזנת תוצאת משחק ---------- */
function AdminResult({match, onDone, redCardEnabled}){
  const [s1,setS1] = useState(match.score1??'');
  const [s2,setS2] = useState(match.score2??'');
  const [firstScorer,setFirstScorer] = useState(match.first_scorer_result||'');
  const [redCard,setRedCard] = useState(match.red_card_result??null);
  const [busy,setBusy] = useState(false);
  const players = matchPlayers(match);
  const dlId = 'res-players-'+match.id;

  async function submit(){
    if(s1===''||s2===''){showToast('יש להזין תוצאה','bad');return}
    setBusy(true);
    try{
      const updated = {...match, score1:Number(s1), score2:Number(s2),
        first_scorer_result:firstScorer,
        red_card_result: redCardEnabled ? redCard : null,
        finished:true, status:'done'};
      await DB.saveMatch(updated);
      const n = await DB.scoreMatch(updated);
      showToast(`התוצאה נשמרה — נוקדו ${n} ניחושים`);
      onDone();
    }catch(e){showToast(e.message,'bad')}finally{setBusy(false)}
  }

  return html`
    <div>
      <div className="section-title" style=${{justifyContent:'flex-start'}}>
        <button className="btn btn-ghost btn-sm" onClick=${onDone}>→ חזרה</button>
        <span style=${{marginRight:8}}>הזנת תוצאה</span>
      </div>

      <datalist id=${dlId}>
        ${players.map(p=>html`<option key=${p} value=${p}/>`)}
      </datalist>

      <div className="card">
        <div className="scorebox">
          <div className="team"><span className="flag" style=${{fontSize:26}}>${match.f1}</span>
            <input className="score-input" type="number" min="0" inputMode="numeric" value=${s1} onChange=${e=>setS1(e.target.value)} placeholder="0"/>
            <span className="nm" style=${{fontSize:13}}>${match.team1}</span></div>
          <div className="vs">:</div>
          <div className="team"><span className="flag" style=${{fontSize:26}}>${match.f2}</span>
            <input className="score-input" type="number" min="0" inputMode="numeric" value=${s2} onChange=${e=>setS2(e.target.value)} placeholder="0"/>
            <span className="nm" style=${{fontSize:13}}>${match.team2}</span></div>
        </div>
      </div>

      <div className="card">
        <label style=${{fontSize:14,fontWeight:700,display:'block',marginBottom:8}}>🥇 הכובש הראשון במשחק</label>
        <input className="input" value=${firstScorer} list=${dlId}
          onChange=${e=>setFirstScorer(e.target.value)} placeholder="שם השחקן (אם לא היו שערים — השאר ריק)" />
      </div>

      ${redCardEnabled && html`
        <div className="card">
          <label style=${{fontSize:14,fontWeight:700,display:'block',marginBottom:8}}>🟥 היה כרטיס אדום במשחק?</label>
          <div className="seg">
            <button className=${redCard===true?'on':''} onClick=${()=>setRedCard(true)}>כן</button>
            <button className=${redCard===false?'on':''} onClick=${()=>setRedCard(false)}>לא</button>
          </div>
        </div>`}

      <button className="btn btn-primary" style=${{marginTop:14}} disabled=${busy} onClick=${submit}>
        ${busy?'מחשב נקודות...':'✅ שמירה וחישוב נקודות'}
      </button>
    </div>`;
}

/* ============================================================
   חלק 6: פאנל דיבאג + רכיב ראשי + הרצה
   ============================================================ */
function DebugPanel({open, onClose}){
  const [,force] = useState(0);
  const [filter,setFilter] = useState('all');
  const logEnd = useRef(null);
  useEffect(()=>DBG.subscribe(()=>force(x=>x+1)),[]);
  useEffect(()=>{if(open)logEnd.current?.scrollIntoView()},[open,DBG.logs.length]);
  if(!open) return null;

  const errs = DBG.logs.filter(l=>l.level==='error').length;
  const warns = DBG.logs.filter(l=>l.level==='warn').length;
  const shown = DBG.logs.filter(l=>filter==='all'||l.level===filter);

  function copyAll(){
    const txt = DBG.logs.map(l=>`[${l.time}] ${l.level.toUpperCase()}: ${l.msg}${l.data?' | '+l.data:''}`).join('\n');
    const report = `=== דוח דיבאג ניחוש מונדיאל ===
מצב: ${MODE} ${LIVE?'(Supabase מחובר)':'(דמו מקומי)'}
URL: ${LIVE?CFG.SUPABASE_URL:'—'}
דפדפן: ${navigator.userAgent}
זמן: ${new Date().toLocaleString('he-IL')}
שגיאות: ${errs} | אזהרות: ${warns}
============================
${txt}`;
    navigator.clipboard?.writeText(report)
      .then(()=>showToast('הדוח הועתק — אפשר להדביק ולשלוח'))
      .catch(()=>showToast('העתקה נכשלה','bad'));
  }

  async function testConn(){
    DBG.info('בודק חיבור...');
    if(!LIVE){DBG.warn('מצב דמו — אין שרת לבדוק. הנתונים מקומיים.');return}
    try{
      const t0=performance.now();
      const {error} = await sb.from('profiles').select('id').limit(1);
      if(error) DBG.error('בדיקת חיבור נכשלה: '+error.message);
      else DBG.info(`חיבור תקין ✓ (${Math.round(performance.now()-t0)}ms)`);
    }catch(e){DBG.error('בדיקת חיבור: '+e.message)}
  }

  function resetDemo(){
    if(confirm('לאפס את כל הנתונים המקומיים? (מצב דמו)')){
      Object.keys(localStorage).filter(k=>k.startsWith('mundial_')).forEach(k=>localStorage.removeItem(k));
      location.reload();
    }
  }

  const fLabels = {all:'הכל',info:'מידע',warn:'אזהרה',error:'שגיאה'};

  return html`
    <div className="dbg-panel">
      <div className="dbg-head">
        <h3>🐞 פאנל דיבאג</h3>
        <button className="btn btn-ghost btn-sm" onClick=${onClose}>✕ סגור</button>
      </div>
      <div className="dbg-meta">
        <div className="dbg-kv"><div className="k">מצב</div><div className=${'v '+(LIVE?'ok':'')}>${MODE}${LIVE?' · חי':' · דמו'}</div></div>
        <div className="dbg-kv"><div className="k">חיבור שרת</div><div className=${'v '+(LIVE?'ok':'no')}>${LIVE?'Supabase':'מקומי בלבד'}</div></div>
        <div className="dbg-kv"><div className="k">שגיאות</div><div className=${'v '+(errs?'no':'ok')}>${errs}</div></div>
        <div className="dbg-kv"><div className="k">אזהרות</div><div className="v">${warns}</div></div>
      </div>
      <div className="dbg-actions">
        <button className="btn btn-ghost btn-sm" onClick=${testConn}>🔌 בדיקת חיבור</button>
        <button className="btn btn-ghost btn-sm" onClick=${copyAll}>📋 העתק דוח</button>
        <button className="btn btn-ghost btn-sm" onClick=${()=>DBG.clear()}>🗑️ נקה</button>
        <button className="btn btn-ghost btn-sm" onClick=${resetDemo}>♻️ איפוס דמו</button>
        <div style=${{display:'flex',gap:4,marginRight:'auto'}}>
          ${['all','info','warn','error'].map(f=>html`
            <button key=${f} className="btn btn-ghost btn-sm" style=${{padding:'6px 9px',opacity:filter===f?1:.5}}
              onClick=${()=>setFilter(f)}>${fLabels[f]}</button>`)}
        </div>
      </div>
      <div className="dbg-log">
        ${shown.length===0 && html`<div style=${{color:'var(--text-mut)',padding:20,textAlign:'center'}}>אין רשומות</div>`}
        ${shown.map((l,idx)=>html`
          <div key=${idx} className=${'dbg-line '+l.level}>
            <span className="t">${l.time}</span>
            <span className="lv">${l.level==='error'?'✖':l.level==='warn'?'▲':'•'}</span>
            <span className="msg">${l.msg}${l.data?'\n'+l.data:''}</span>
          </div>`)}
        <div ref=${logEnd}></div>
      </div>
    </div>`;
}

/* ---------- עמוד חוקים וניקוד ---------- */
function RulesScreen(){
  const [rules,setRules] = useState(null);
  const [redCard,setRedCard] = useState(true);
  useEffect(()=>{(async()=>{
    setRules(await DB.getRules());
    const s = await DB.getSettings(); setRedCard(!!s.red_card_enabled);
  })()},[]);
  if(!rules) return html`<div className="spinner"></div>`;

  const matchKeys = ['exact_score','winner','first_scorer','red_card'];
  const tourneyKeys = ['champion','runner_up','top_scorer','top_assister'];
  const row = key => {
    const r = rules[key]; if(!r) return '';
    if(key==='red_card' && !redCard) return '';
    return html`<div key=${key} className="admin-rule">
      <div className="rl-name">${r.label}<span className="rl-desc">${r.desc}</span></div>
      <span className="lb-pts" style=${{fontSize:18}}>${r.pts}<span style=${{display:'block',fontSize:10,textAlign:'center'}}>נק׳</span></span>
    </div>`;
  };

  return html`
    <div>
      <div className="section-title">חוקי המשחק והניקוד</div>
      <p className="note" style=${{margin:'0 4px 14px'}}>כך נצברות הנקודות. הניקוד מתעדכן אוטומטית אם המנהל משנה אותו.</p>
      <div className="card">
        <div style=${{fontFamily:'Rubik',fontWeight:800,fontSize:14,marginBottom:6,color:'var(--lime)'}}>⚽ ניחושי משחק</div>
        ${matchKeys.map(row)}
      </div>
      <div className="card">
        <div style=${{fontFamily:'Rubik',fontWeight:800,fontSize:14,marginBottom:6,color:'var(--gold)'}}>🏆 ניחושי-על (פעם אחת, נעול בהרשמה)</div>
        ${tourneyKeys.map(row)}
      </div>
      <p className="note" style=${{margin:'14px 4px',lineHeight:1.7}}>
        💡 ה"תוצאה הכללית" (ניצחון/תיקו) מחושבת אוטומטית מהתוצאה המדויקת שניחשת — אין צורך לבחור אותה בנפרד.<br/>
        🔒 ניחושי משחק ננעלים 5 דקות לפני שריקת הפתיחה. ניחושי-העל ננעלים בהרשמה.
      </p>
    </div>`;
}

/* ---------- רכיב ראשי ---------- */
function App(){
  const [user,setUser] = useState(undefined);
  const [tourneyPred,setTourneyPred] = useState(undefined); // undefined=טוען, null=אין, object=קיים
  const [tab,setTab] = useState('matches');
  const [predictMatch,setPredictMatch] = useState(null);
  const [viewOthersMatch,setViewOthersMatch] = useState(null);
  const [dbgOpen,setDbgOpen] = useState(false);

  useEffect(()=>{window.__toggleDebug=()=>setDbgOpen(o=>!o);return()=>{delete window.__toggleDebug}},[]);

  async function loadUser(){
    try{
      const p = await DB.getMyProfile(); setUser(p||null);
      DBG.info('בדיקת משתמש קיים', {found:!!p});
      if(p){ setTourneyPred(await DB.getTournamentPredictions(p.id) || null); }
    }catch(e){DBG.error('טעינת משתמש: '+e.message); setUser(null)}
  }
  useEffect(()=>{loadUser()},[]);

  // סנכרון משחקים מ-API (בטעינה + כל 5 דקות)
  useEffect(()=>{
    syncFromAPI();
    const iv = setInterval(syncFromAPI, 5*60*1000);
    return ()=>clearInterval(iv);
  },[]);

  async function onAuth(u){
    setUser(u);
    setTourneyPred(await DB.getTournamentPredictions(u.id) || null);
  }

  async function signOut(){
    if(!confirm('להתנתק מהחשבון?')) return;
    await DB.signOut(); setUser(null); setTourneyPred(undefined); setTab('matches');
  }

  const dbg = html`<${DebugPanel} open=${dbgOpen} onClose=${()=>setDbgOpen(false)} />`;

  if(user===undefined) return html`<${F}><div className="auth-wrap"><div className="spinner"></div></div>${dbg}<//>`;
  if(user===null) return html`<${F}><${AuthScreen} onAuth=${onAuth} />${dbg}<//>`;

  // ניחושי-על חובה לפני כניסה לאתר
  if(tourneyPred===undefined) return html`<${F}><div className="auth-wrap"><div className="spinner"></div></div>${dbg}<//>`;
  if(tourneyPred===null) return html`
    <${F}>
      <${TopBar} user=${user} onSignOut=${signOut} />
      <${TournamentSetup} user=${user} onDone=${(tp)=>setTourneyPred(tp)} />
      ${dbg}
    <//>`;

  let screen;
  if(viewOthersMatch) screen = html`<${OthersPreds} match=${viewOthersMatch} onBack=${()=>setViewOthersMatch(null)} />`;
  else if(predictMatch) screen = html`<${PredictScreen} user=${user} match=${predictMatch} onBack=${()=>setPredictMatch(null)} />`;
  else if(tab==='matches') screen = html`<${MatchesScreen} user=${user} onPredict=${setPredictMatch} onViewOthers=${setViewOthersMatch} />`;
  else if(tab==='tournament') screen = html`<${TournamentScreen} user=${user} />`;
  else if(tab==='board') screen = html`<${LeaderboardScreen} user=${user} />`;
  else if(tab==='rules') screen = html`<${RulesScreen} />`;
  else if(tab==='admin' && user.is_admin) screen = html`<${AdminScreen} />`;
  else screen = html`<${MatchesScreen} user=${user} onPredict=${setPredictMatch} onViewOthers=${setViewOthersMatch} />`;

  return html`
    <${F}>
      <${TopBar} user=${user} onSignOut=${signOut} />
      <main className="app-main">${screen}</main>
      ${!predictMatch && !viewOthersMatch && html`<${TabBar} tab=${tab} setTab=${setTab} isAdmin=${user.is_admin} />`}
      ${dbg}
    <//>`;
}

/* ---------- הרצה ---------- */
try{
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(html`<${App} />`);
  DBG.info('האפליקציה עלתה בהצלחה ✓');
}catch(e){
  DBG.error('כשל בהעלאת האפליקציה: '+e.message);
  document.getElementById('root').innerHTML =
    '<div style="padding:40px;text-align:center;color:#F87171">שגיאה בטעינה — פתח את פאנל הדיבאג (🐞) לפרטים</div>';
}
