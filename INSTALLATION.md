# Installationsguide

## Steg 1: Installera beroenden

```bash
npm install
```

## Steg 2: Skapa databasen

```bash
npx prisma generate
npx prisma db push
```

## Steg 3: Starta utvecklingsservern

```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) i din webbläsare.

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
