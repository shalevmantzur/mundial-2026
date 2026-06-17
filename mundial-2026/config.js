/* ============================================================
   הגדרות חיבור — ניחוש מונדיאל 2026
   ------------------------------------------------------------
   • השאר ריק כדי לעבוד ב"מצב דמו" (הכל נשמר במכשיר, בלי שרת).
   • למצב חי עם ריבוי משתמשים אמיתי — מלא את שני הערכים מ-Supabase:
       Project Settings → API → Project URL  +  anon public key
   ============================================================ */
window.MUNDIAL_CONFIG = {
  SUPABASE_URL: "https://zyggyztkbzgbjcuznlzr.supabase.co",   // לדוגמה: "https://abcd1234.supabase.co"
  SUPABASE_ANON_KEY: "sb_publishable_fNs94PUmMZQObT_dhBiMig_TLZb1kdo", // המפתח הציבורי (anon public)

  // מפתח חינמי מ-football-data.org (להרשמה: https://www.football-data.org/client/register)
  // בלי מפתח — האתר עובד, אבל בלי עדכון אוטומטי של תוצאות.
  FOOTBALL_API_KEY: "d8b06c8054d444369d3366f2d7a1197c",

  // שם משתמש שיהפוך אוטומטית למנהל בהרשמה הראשונה.
  ADMIN_USERNAME: "admin"
};
