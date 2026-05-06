# Installationsguide

Appen använder **PostgreSQL** (krävs för t.ex. Vercel och Render). Lokalt enklast med Docker.

## Steg 1: Starta PostgreSQL lokalt

```bash
docker compose up -d
```

Kopiera `.env.example` till `.env` och anpassa vid behov. Standard-URL matchar `docker-compose.yml`.

## Steg 2: Installera beroenden

```bash
npm install
```

## Steg 3: Skapa databastabeller

```bash
npx prisma generate
npx prisma db push
```

## Steg 4: Starta utvecklingsservern

```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) i din webbläsare.

---

## Deploy: Render (nytt projekt)

1. Logga in på [Render](https://render.com) och koppla ditt GitHub-konto.
2. **New → Blueprint** (eller *Infrastructure as Code*), välj repot `Linusbomb/Tipelaps` och gren `main`.
3. Render läser `render.yaml`, skapar **PostgreSQL** och **web service**. Efter första deploy: sätt **manuellt** `JWT_SECRET` (stark slumpsträng) och `NEXT_PUBLIC_BASE_URL` till din Render-URL (t.ex. `https://tidrapportering-app.onrender.com`).
4. Valfria SMTP-variabler för e-post.

Bygget kör `prisma db push` så schemat skapas i databasen automatiskt.

---

## Deploy: Vercel (nytt projekt)

1. Logga in på [Vercel](https://vercel.com) → **Add New → Project**, importera `Linusbomb/Tipelaps`.
2. **Environment variables** (Production):
   - `DATABASE_URL` – anslutningssträng till PostgreSQL (t.ex. [Neon](https://neon.tech), [Supabase](https://supabase.com) eller en Render Postgres **External Database URL** om du tillåter extern åtkomst).
   - `JWT_SECRET` – samma typ av hemlighet som på Render (egen för miljön om du kör separata databaser).
   - `NEXT_PUBLIC_BASE_URL` – din Vercel-URL, t.ex. `https://tipelaps.vercel.app`.
3. Vercel använder `vercel.json` **buildCommand** (`prisma db push` + `next build`). Säkerställ att databasen är tom eller kompatibel vid första deploy.

**OBS:** Uppladdade filer (loggor, profilbilder, dokument) sparas på serverns disk; på Vercel är den oftast **tillfällig**. För produktion bör filer ligga i objektlagring (S3, Cloudinary, m.m.) – det är inte konfigurerat i den här mallen.

## Funktioner

### För anställda:
- Logga in med e-post och lösenord
- Skapa tidrapporter med flera aktiviteter per dag
- Markera maskintimmar (t.ex. kört grävmaskin)
- Om du inte når 8 timmar per dag, redovisa vad du gjort de timmar som fattas
- Se dina tidigare tidrapporter

### För entreprenörer:
- Skapa konto och företag
- Se alla tidrapporter från anställda
- Filtrera rapporter efter datum och anställd
- Se totalt antal timmar och antal rapporter
- Se maskintimmar markerade separat

## Exempel på tidrapportering

En anställd kan lägga in:
- Aktivitet 1: 5 timmar - "Kört grävmaskin" (Maskintimmar: Grävmaskin)
- Aktivitet 2: 3 timmar - "Service på grävmaskin"

Totalt: 8 timmar ✅

Eller om det är mindre än 8 timmar:
- Aktivitet 1: 5 timmar - "Kört grävmaskin" (Maskintimmar: Grävmaskin)
- Redovisning av saknade timmar: "3 timmar sjuk"

Totalt: 5 timmar (3 timmar redovisade som sjuk)
