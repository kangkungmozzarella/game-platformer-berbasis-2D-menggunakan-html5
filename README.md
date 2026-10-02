# Si Kancil — Petualangan di Kampung

Game platformer 2D berbasis HTML5 Canvas, remake dari game "Frog Adventure" (kode lama tersimpan di [`legacy/`](legacy/)).
Si Kancil berlari dari sawah Pak Tani, menyeberangi sungai lewat punggung buaya, sampai ke candi di atas bukit.

Semua grafis dan suara (musik gamelan bertangga nada slendro) dibuat lewat kode, tanpa file gambar atau audio. Ada dua gaya grafis yang bisa dipilih di **Pengaturan → Gaya grafis**:

- **Modern** (bawaan): ilustrasi vektor halus bergaya "cozy", dirender sesuai resolusi layar.
- **Pixel**: pixel art klasik 384×216.

## Menjalankan

```bash
npm install
npm run dev        # server pengembangan di http://localhost:5173
npm run build      # build statis ke folder dist/
npm run preview    # mencoba hasil build
```

Hasil `dist/` bisa langsung di-host di mana saja, termasuk GitHub Pages.

## Build Android (APK)

Project Android dibuat dengan [Capacitor](https://capacitorjs.com) dan ada di folder `android/`. ID aplikasi `com.sikancil.dev` di [`capacitor.config.ts`](capacitor.config.ts) masih sementara. Ganti sebelum publish ke Play Store.

```bash
npm run android          # build, pasang, dan buka di emulator/HP (tanpa server)

# atau dengan live reload, seperti React Native:
npm start                # terminal 1: server game, biarkan menyala
npm run android:live     # terminal 2: pasang ke emulator; perubahan kode langsung terlihat
```

Gradle memakai JDK 21 bawaan Android Studio (diatur di `android/gradle.properties`), jadi `JAVA_HOME` global tidak perlu diubah. APK debug ada di `android/app/build/outputs/apk/debug/app-debug.apk`.

## Kontrol

| Aksi | Keyboard | Layar sentuh |
|---|---|---|
| Jalan | ← → / A D | Tombol arah kiri bawah |
| Lompat (tahan supaya lebih tinggi) | Spasi / ↑ / W / Z | Tombol ▲ kanan bawah |
| Jeda | Esc / P | Tombol ❚❚ |

## Struktur kode

```
src/
  main.ts            alur game: menu, HUD, jeda, simpan progres, kontrol sentuh
  save.ts            progres & pengaturan di localStorage
  engine/
    loop.ts          game loop fixed-step 60 Hz
    input.ts         keyboard + tombol sentuh
    audio.ts         efek suara & musik gamelan (Web Audio)
    haptics.ts       getaran di HP
    pixel.ts         util pixel art, PRNG, font angka 3x5
  game/
    levels.ts        data level (peta ASCII)
    level.ts         parsing peta, query tabrakan, gambar tile
    world.ts         gameplay: item, musuh, checkpoint, finis, kamera
    player.ts        gerakan Si Kancil (coyote time, jump buffer, dll.)
    enemies.ts       ayam jago & lebah
    buaya.ts         buaya: pijakan di sungai yang bisa menyelam
    background.ts    latar parallax pixel art per tema
    art.ts           pilihan gaya grafis (modern / pixel)
    modern/          gambar versi modern: karakter, item, tile, latar
    sprites.ts       pixel art karakter & item
```

## Membuat atau mengubah level

Level ditulis sebagai peta ASCII di [`src/game/levels.ts`](src/game/levels.ts). Satu karakter mewakili satu tile 16×16:

| Karakter | Arti | Karakter | Arti |
|---|---|---|---|
| `#` | tanah berumput | `P` | posisi awal |
| `B` | batu candi | `o` | timun (+10) |
| `=` | rakit bambu (bisa dilewati dari bawah) | `r` | rambutan (+50) |
| `^` | bambu runcing | `k` | ketupat (+1 nyawa) |
| `~` | air sungai | `a` | ayam jago |
| `f` | pagar bambu (dekorasi) | `l` | lebah |
| `y` | rumpun padi (dekorasi) | `c` | umbul-umbul (checkpoint) |
| `.` | kosong | `G` | gapura (finis) |
| `b` | buaya diam (pijakan, menyelam kalau diinjak terlalu lama) | `v` | buaya berenang |

Patokan jarak lompat: naik maksimal 3 tile, celah datar maksimal 3 tile.
