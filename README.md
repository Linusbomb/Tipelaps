# Tidrapporteringsapplikation

En modern webbapplikation där entreprenörer enkelt kan samla in och hantera personalens tidrapporter.

## Funktioner

- 🔐 Säker inloggning för både entreprenörer och personal
- ⏱️ Enkel tidrapportering för personal med flera aktiviteter per dag
- 🚜 Maskintimmar - Markera och spåra maskintimmar separat
- 📦 Buffertsystem - Tidrapporter sparas i buffert tills månadsskiftet
- 📤 Inlämning vid månadsskiftet - Skicka in alla tidrapporter för månaden
- 📊 Dashboard för entreprenörer att se inkomna tidrapporter
- 🔧 Admin-sida för chefer/lönesamordnare att redigera och godkänna tidrapporter
- ✅ Godkännandefunktion - Godkänn och skicka tidrapporter till kund
- 🏢 Företagshantering
- 📅 Filtrering och sökning av tidrapporter
- 👤 Personlig sida för varje användare att se sina buffertade och skickade rapporter

## Teknologi

- **Next.js 14** - React framework
- **TypeScript** - Typad JavaScript
- **Prisma** - ORM för databashantering
- **SQLite** - Databas (kan enkelt bytas till PostgreSQL)
- **Tailwind CSS** - Styling
- **NextAuth.js** - Autentisering

## Installation

1. Installera beroenden:
```bash
npm install
```

2. Skapa databasen:
```bash
npx prisma generate
npx prisma db push
```

3. Starta utvecklingsservern:
```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) i din webbläsare.

## Användning

### För anställda:

1. **Logga in** - Använd ditt konto för att logga in
2. **Skapa tidrapporter** - Lägg till flera aktiviteter per dag (t.ex. maskintimmar och annat arbete)
3. **Rapporter sparas i buffert** - Alla tidrapporter sparas automatiskt i en buffert
4. **Visa dina rapporter** - Gå till "Mina rapporter" för att se alla dina buffertade och skickade rapporter
5. **Skicka in vid månadsskiftet** - När månadsskiftet kommer, skicka in alla tidrapporter för månaden till din chef eller lönesamordnare

### För entreprenörer/chefer/lönesamordnare:

1. **Registrera dig** - Skapa ett konto och företag
2. **Lägg till personal** - Bjud in anställda till ditt företag
3. **Visa inkomna rapporter** - På dashboarden ser du alla tidrapporter som anställda har skickat in
4. **Admin-sida** - Gå till Admin-sidan för att:
   - Se alla inkomna tidrapporter som väntar på granskning
   - Redigera tidrapporter för att korrigera eventuella fel
   - Godkänna och skicka tidrapporter till kund
5. **Filtrera rapporter** - Filtrera efter datum, månad och status för att hitta specifika rapporter

## Arbetsflöde

1. **Daglig rapportering**: Anställda skapar tidrapporter varje dag med flera aktiviteter
2. **Buffert**: Rapporterna sparas automatiskt i en buffert (status: DRAFT)
3. **Månadsskiftet**: När månaden är slut, anställda skickar in alla rapporter för månaden (status: SUBMITTED)
4. **Granskning**: Chefer/lönesamordnare går till Admin-sidan och ser alla inkomna tidrapporter
5. **Redigering**: Chefer/lönesamordnare kan redigera tidrapporter för att korrigera eventuella fel
6. **Godkännande**: När tidrapporterna är korrekta, godkänns de och skickas till kund (status: APPROVED)
