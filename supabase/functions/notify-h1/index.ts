// Supabase Edge Function: notify-h1
// Dijalankan tiap hari jam 12.00 WIB oleh pg_cron (lihat PANDUAN.md langkah 4).
// Mencari jadwal masak / kirim draft / posting untuk BESOK di setiap workspace yang
// punya HP terdaftar, lalu mengirim notifikasi push ke HP-HP tersebut.
//
// Secrets yang dibutuhkan (Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah tersedia otomatis.
//
// Data memakai tabel `collabs` yang sama dengan app:
//   workspace "<ws>"         = collab
//   workspace "<ws>::push"   = langganan push per HP (data.sub)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const TZ = "Asia/Jakarta";
const STATUSES = ["Brief Received", "Draft Sent", "Approved", "Posted"];
const STATUS_MIG = {
  Inquiry: "Brief Received", Cooking: "Brief Received", Editing: "Brief Received",
  Revision: "Draft Sent", Scheduled: "Approved", Paid: "Posted", Completed: "Posted",
};
const LBL = { masak: "Masak", draft: "Kirim draft", posting: "Posting" };
const PUSH_SUFFIX = "::push";

/** Tanggal besok (YYYY-MM-DD) menurut jam WIB */
export function tomorrowISO(now = new Date()) {
  const t = new Date(now.getTime() + 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

function statusIdx(st) {
  const s = STATUS_MIG[st] || st;
  const i = STATUSES.indexOf(s);
  return i < 0 ? 0 : i;
}

/** Daftar tugas besok dari isi collab. Sama dengan app: tugas yang sudah beres tidak diingatkan
 *  (masak & draft selesai begitu status Draft Sent, posting selesai begitu Posted). */
export function tasksFor(collabs, day) {
  const out = [];
  for (const c of collabs) {
    if (!c) continue;
    const si = statusIdx(c.status);
    const done = { masak: si >= 1, draft: si >= 1, posting: si >= 3 };
    for (const k of ["masak", "draft", "posting"]) {
      if (c[k] === day && !done[k]) out.push({ type: k, brand: c.brand || "Tanpa nama", menu: c.menu || "" });
    }
  }
  const order = { masak: 0, draft: 1, posting: 2 };
  return out.sort((a, b) => order[a.type] - order[b.type]);
}

/** Kalimat per jenis tugas, dipakai di judul (satu tugas) dan di daftar (beberapa tugas) */
const PHRASE = {
  masak: (b) => `masak buat ${b}`,
  draft: (b) => `kirim draft ke ${b}`,
  posting: (b) => `posting konten ${b}`,
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Isi notifikasi: satu tugas = judul spesifik, beberapa tugas = ringkasan per baris */
export function buildPayload(tasks, day) {
  if (!tasks.length) return null;
  let title, body;
  if (tasks.length === 1) {
    const t = tasks[0];
    title = `Besok ${PHRASE[t.type](t.brand)}`;
    body = t.menu ? `${t.menu}. Jangan lupa ya, Beb` : "Jangan lupa ya, Beb";
  } else {
    title = `Besok ada ${tasks.length} jadwal, Beb`;
    body = tasks.map((t) => cap(PHRASE[t.type](t.brand))).join("\n");
  }
  return JSON.stringify({ title, body, url: "./index.html#jadwal", tag: "janice-h1-" + day });
}

async function handler() {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return json({ error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY belum diisi di Secrets" }, 500);
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "https://github.com/andrewjevon2000/janice-collab", pub, priv);

  const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const day = tomorrowISO();

  const { data: subs, error } = await db.from("collabs").select("id,workspace,data")
    .like("workspace", "%" + PUSH_SUFFIX).eq("deleted", false);
  if (error) return json({ error: error.message }, 500);

  // kelompokkan HP per workspace
  const byWs = new Map();
  for (const s of subs || []) {
    if (!s.data || !s.data.sub) continue;
    const ws = s.workspace.slice(0, -PUSH_SUFFIX.length);
    if (!byWs.has(ws)) byWs.set(ws, []);
    byWs.get(ws).push(s);
  }

  let sent = 0, failed = 0, removed = 0, workspaces = 0;
  for (const [ws, list] of byWs) {
    const { data: rows, error: e2 } = await db.from("collabs").select("data").eq("workspace", ws).eq("deleted", false);
    if (e2) { failed += list.length; continue; }
    const payload = buildPayload(tasksFor((rows || []).map((r) => r.data), day), day);
    if (!payload) continue;
    workspaces++;
    for (const s of list) {
      try {
        await webpush.sendNotification(s.data.sub, payload, { TTL: 6 * 3600, urgency: "normal" });
        sent++;
      } catch (err) {
        // 404/410 = HP sudah mencabut izin atau langganannya kedaluwarsa: tandai terhapus
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await db.from("collabs").update({ deleted: true, updated_at: new Date().toISOString() }).eq("id", s.id);
          removed++;
        } else failed++;
      }
    }
  }
  return json({ day, devices: (subs || []).length, workspaces, sent, failed, removed });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

// Error apa pun dikembalikan sebagai pesan yang terbaca, supaya mudah dicek di hasil Test
Deno.serve(async () => {
  try {
    return await handler();
  } catch (err) {
    return json({ error: String((err && err.message) || err) }, 500);
  }
});
