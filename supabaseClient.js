import { createClient } from "@supabase/supabase-js";

// Az adatbazis cime es nyilvanos kulcsa. Ezek a Vercel beallitasaibol jonnek,
// de ha ott nincsenek megadva, akkor az alabbi ertekek lepnek eletbe, hogy az
// app akkor is mukodjon. A nyilvanos ("anon") kulcs szandekosan publikus:
// onmagaban csak azt engedi, amit az adatbazis szabalyai megengednek, a
// fizetesi adatokhoz nem fer hozza.
const FALLBACK_URL = "https://piypaifuajsncvwgehar.supabase.co";
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpeXBhaWZ1YWpzbmN2d2dlaGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzg1MjYsImV4cCI6MjA5OTk1NDUyNn0.Cf6vjM1O9JeV054gfDkRxy5DCjoX4CBdqwvskle9AQ0";

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

// Az edzoi belepes egy kozos fiokkal tortenik. A felhasznalo csak a jelszot
// irja be, az e-mail cimet az app teszi hozza.
export const COACH_EMAIL = import.meta.env.VITE_COACH_EMAIL || "edzo@razarskating.hu";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
