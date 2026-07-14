# 📱 Panduan Setup — Janice Collab Scheduler (PWA + Cloud Sync)

App ini bisa dipasang seperti aplikasi di HP dan menyimpan semua data di cloud
sehingga tersinkron di HP + laptop. Ada **3 langkah**. Total sekali setup ± 15 menit.

Kalau kamu **hanya mau install ke HP tanpa sinkron cloud** (data lokal saja), lakukan
Langkah 2 saja, lalu buka appnya dan langsung pakai — lewati Langkah 1 & 3.

---

## Langkah 1 — Siapkan database cloud (Supabase) — GRATIS

1. Buka **https://supabase.com** → klik **Start your project** → daftar (bisa pakai akun Google).
2. Klik **New project**. Isi nama (mis. `janice-collab`), buat password database (simpan),
   pilih region terdekat (Singapore). Klik **Create** — tunggu ± 2 menit sampai siap.
3. Di menu kiri buka **SQL Editor** → **New query** → tempel SQL di bawah ini → klik **Run**:

```sql
create table if not exists collabs (
  id text primary key,
  workspace text not null,
  data jsonb,
  updated_at timestamptz default now(),
  deleted boolean default false
);
alter table collabs enable row level security;
create policy "app access" on collabs
  for all using (true) with check (true);
```

   > Catatan: policy ini membuat tabel bisa diakses siapa saja yang punya key + workspace-mu.
   > Untuk jadwal konten pribadi risikonya kecil selama key & workspace tidak kamu sebar.

4. Ambil 2 nilai config: menu kiri **Project Settings** (ikon gear) → **API**:
   - **Project URL** → contoh `https://abcdxyz.supabase.co`
     (HANYA alamat dasar — JANGAN pakai yang berakhiran `/rest/v1/` dari halaman Data API.
     App otomatis membersihkan jika terlanjur, tapi lebih baru ambil dari Settings → API di sini.)
   - **Project API keys → `anon` `public`** → string panjang diawali `eyJ...`

   Simpan dua nilai ini untuk Langkah 3.

---

## Langkah 2 — Pasang app ke HP (hosting gratis)

App PWA harus dibuka lewat alamat **https://** (bukan file), supaya bisa di-install & offline.
Cara paling mudah: hosting gratis **Netlify Drop**.

1. Buka **https://app.netlify.com/drop** di laptop.
2. **Seret seluruh folder `madeby-janice-app`** (berisi `index.html`, `manifest.webmanifest`,
   `sw.js`, `icon-192.png`, `icon-512.png`) ke area upload. Login singkat bila diminta (gratis).
3. Netlify memberi link, contoh `https://janice-collab.netlify.app`. Ini alamat app-mu.
   (Bisa di-rename di **Site settings → Change site name**.)

**Alternatif hosting gratis lain:** GitHub Pages, Vercel, atau Cloudflare Pages — sama saja,
yang penting hasilnya alamat `https://`.

### Pasang ikon ke Home Screen
- **iPhone (Safari):** buka link → tombol **Share** (kotak panah) → **Add to Home Screen** → **Add**.
- **Android (Chrome):** buka link → menu **⋮** → **Install app** / **Add to Home screen**.

Sekarang ada ikon app di HP, buka fullscreen tanpa address bar, dan tetap jalan saat offline.

---

## Langkah 3 — Nyalakan sinkron cloud di app

1. Buka app (dari ikon HP atau linknya).
2. Tap tombol **☁️ Cloud** di kanan atas.
3. Isi:
   - **Project URL** → dari Langkah 1 no.4
   - **Anon / Public Key** → dari Langkah 1 no.4
   - **Workspace** → kata sandi rahasia bebas, mis. `janice-2026-rahasia`
     (pakai **workspace yang sama persis** di setiap perangkat agar datanya nyambung)
4. Tap **Simpan & Connect**. Titik status berubah **hijau + "Tersinkron ✓"**.

Ulangi Langkah 3 di perangkat lain (laptop/HP kedua) dengan **URL, Key, dan Workspace yang sama**
→ semua data langsung muncul & selalu update di kedua sisi.

---

## Cara kerja & catatan penting

- **Offline-first:** app selalu bisa dibuka & diedit tanpa internet. Perubahan disimpan lokal,
  lalu otomatis dikirim ke cloud saat online. Ada tombol **🔄 Sync** untuk memaksa sinkron.
- **Anti bentrok:** kalau satu collab diedit di dua tempat, versi dengan waktu edit terbaru yang dipakai.
- **Backup manual:** tombol **⬇ CSV** mengekspor semua data ke file (untuk arsip/Excel).
- **Keamanan:** jangan bagikan URL + Key + Workspace ke orang lain. Kalau ingin lebih aman,
  Supabase mendukung login email (Auth) — bisa diaktifkan nanti sebagai peningkatan.
- **Batasan localStorage:** cache lokal bisa terhapus kalau storage HP penuh, tapi **data cloud
  tetap aman** dan akan tertarik lagi saat app dibuka & online.

Selesai. Kamu sekarang punya app collab yang bisa dipasang di HP, jalan offline,
dan datanya tersimpan aman di cloud serta sinkron di semua perangkat.
