# Installationsguide

Appen använder **PostgreSQL** (krävs för t.ex. Vercel och Render). Lokalt enklast med Docker.

## Steg 1: Starta PostgreSQL lokalt

```bash
docker compose up -d
```

Kopiera `.env.example` till `.env` och anpassa vid behov. Postgres exponeras på **värd-port 5433** (inte 5432) om du har en lokal PostgreSQL som redan använder 5432.

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

### Demo-användare (valfritt)

Efter `npx prisma db push` kan du fylla på testkonton (lösenordet kan sättas med miljövariabel):

```bash
npx prisma db seed
```

Standardlösenord: `demo123` (sätt eget med `SEED_PASSWORD=dittLösenord npx prisma db seed`).

| Roll | E-post | Inloggning på sajten |
|------|--------|----------------------|
| Entreprenör (admin) | `demo@admin.se` | **Admin** på startsidan |
| Anställd | `demo@personal.se` | **Personal** på startsidan |

Kör bara seed **en gång** per databas (om `demo@admin.se` redan finns hoppas seed över). I produktion: byt lösenord eller ta bort demo-konton när du är klar.

---

## Deploy: Render (checklista)

Blueprint-filen `render.yaml` skapar **en web service** (`tidrapportering-app`) och **PostgreSQL** (`tidrapportering-db`) i **Frankfurt** (EU). `DATABASE_URL` sätts automatiskt från databasen.

### Första gången (Blueprint från GitHub)

1. [Render Dashboard](https://dashboard.render.com) → logga in → koppla **GitHub**.
2. **New +** → **Blueprint** → välj repot **`Linusbomb/Tipelaps`** (samma repo där `render.yaml` ligger i roten).
3. Granska förslaget (web + Postgres) → **Apply** / skapa resurserna.
4. Vänta tills **första deploy** av webbtjänsten är klar (bygget kör `npm ci`, `prisma generate`, `prisma db push`, `next build`).

### Obligatoriska miljövariabler (efter du har din publika URL)

Öppna webbtjänsten **tidrapportering-app** → **Environment**:

| Nyckel | Värde |
|--------|--------|
| `JWT_SECRET` | Lång slumpmässig sträng (minst ~32 tecken). Exempel i PowerShell: `[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()` |
| `NEXT_PUBLIC_BASE_URL` | Exakt din Render-URL med `https://`, t.ex. `https://tidrapportering-app.onrender.com` (kopiera från webbtjänstens **URL** på översikten). |

Spara → Render startar om tjänsten (eller kör **Manual Deploy** om inget händer).

Utan `JWT_SECRET` fungerar inte inloggning/token säkert. Utan korrekt `NEXT_PUBLIC_BASE_URL` kan länkar i e-post (lösenordsåterställning m.m.) peka fel.

### Valfritt (e-post)

Sätt `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` om du vill skicka riktiga mail från Render.

### Felsökning

- **Bygget faller på `prisma db push`:** kontrollera att Postgres-instansen är skapad och att `DATABASE_URL` finns under Environment (från blueprint ska den vara kopplad automatiskt). Synka om blueprint om du ändrat `render.yaml`.
- **502 / health check:** öppna **Logs** på webbtjänsten. Kontrollera att `npm run start` körs och att startsidan `/` svarar (health check använder `/`).
- **Gratis/avstängd:** Render pausar ibland gratis web services efter inaktivitet; första besök efter paus kan ta en stund.
- **Uppladdade filer:** lagras på webbtjänstens disk och kan **försvinna vid ny deploy** om du inte [lägger till persistent disk](https://docs.render.com/docs/disks) eller flyttar filer till objektlagring.

### Redan skapat tjänster manuellt?

Du kan i stället skapa **Web Service** + **PostgreSQL** för hand och sätta samma build/start-kommandon som i `render.yaml`, samt klistra in **Internal Database URL** som `DATABASE_URL`. Blueprint är bara det snabbaste sättet att få samma setup varje gång.

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
