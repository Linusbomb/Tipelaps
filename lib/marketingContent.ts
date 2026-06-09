export const MARKETING_FEATURES = [
  {
    icon: '⏱️',
    title: 'Daglig tidrapportering',
    description:
      'Personal registrerar timmar, projekt och fordon direkt i mobilen eller datorn — enkelt varje dag.',
  },
  {
    icon: '📊',
    title: 'Överblick för chefen',
    description:
      'Se månadstäckning, frånvaro och godkänn rapporter innan de går vidare till lön eller kund.',
  },
  {
    icon: '🏗️',
    title: 'Projekt & kunder',
    description:
      'Koppla timmar till rätt projekt, samla underlag till kund och följ upp vem som arbetat var.',
  },
  {
    icon: '🚛',
    title: 'Fordon & maskiner',
    description:
      'Registrera fordon i företaget och följ upp maskintimmar per projekt och period.',
  },
  {
    icon: '📢',
    title: 'Nyheter till personalen',
    description:
      'Publicera information till hela teamet eller utvalda personer med start- och slutdatum.',
  },
  {
    icon: '📁',
    title: 'Dokument & personal',
    description:
      'Samla ID06, certifikat och anställningshandlingar — admin och personal kan ladda upp och hålla ordning.',
  },
] as const

export const MARKETING_STEPS = [
  {
    step: '1',
    title: 'Vi tar kontakt',
    description: 'Hör av er till LVtech — vi återkommer med demo och upplägg.',
    icon: '📞',
    details: [
      'Vi går igenom hur ert team jobbar idag och vad ni vill förbättra.',
      'Ni får se TimeLaps i praktiken och få svar på era frågor.',
      'Vi föreslår ett upplägg som passar er storlek och bransch.',
    ],
  },
  {
    step: '2',
    title: 'Ert företag sätts upp',
    description: 'Admin, personal och grundstruktur för projekt skapas åt er.',
    icon: '⚙️',
    details: [
      'Ert företagskonto skapas med admin och behörigheter.',
      'Personal bjuds in och kan logga in direkt.',
      'Projekt, kunder och grundinställningar konfigureras tillsammans med er.',
    ],
  },
  {
    step: '3',
    title: 'Teamet börjar rapportera',
    description: 'Personal loggar in på app.timelaps och ni får kontroll från dag ett.',
    icon: '🚀',
    details: [
      'Personal rapporterar timmar, projekt och fordon i portalen.',
      'Admin följer upp, godkänner och exporterar underlag.',
      'Vi finns tillgängliga om ni behöver hjälp längs vägen.',
    ],
  },
] as const

export const MARKETING_BENEFITS = [
  {
    icon: '📋',
    title: 'Mindre pappersarbete',
    description: 'Slipp Excel, sms och lappar. Allt samlas digitalt och går att följa upp i realtid.',
    detail:
      'Timmar, frånvaro och projektdata samlas automatiskt. Chefen slipper jaga in rapporter — allt finns samlat och sökbart när det behövs.',
  },
  {
    icon: '💰',
    title: 'Tryggare löneunderlag',
    description: 'Godkända timmar, frånvaro och övertid samlas innan månaden stängs.',
    detail:
      'Personal skickar in månadsrapport med ett klick. Admin granskar och godkänner innan underlaget går vidare — färre missförstånd och snabbare avslut.',
  },
  {
    icon: '💬',
    title: 'Bättre kommunikation',
    description: 'Nyheter, projektinfo och kontaktuppgifter finns där personalen redan jobbar.',
    detail:
      'Publicera nyheter till hela teamet eller utvalda personer. Alla ser samma information utan att information försvinner i sms-trådar.',
  },
  {
    icon: '📈',
    title: 'Skalbart för växande team',
    description: 'Lägg till personal, projekt och fordon i takt med att företaget växer.',
    detail:
      'Oavsett om ni är fem eller femtio anställda — strukturen växer med er. Nya projekt, fordon och medarbetare läggs till enkelt.',
  },
] as const

export const MARKETING_HOW_PAGE = {
  title: 'Så funkar det',
  subtitle: 'Från första kontakt till att hela teamet rapporterar — vi guidar er hela vägen.',
  intro:
    'Att komma igång med TimeLaps ska vara enkelt. Vi tar hand om uppsättningen så att ni kan fokusera på ert företag medan personalen snabbt lär sig rapportera timmar digitalt.',
  timelineTitle: 'Tre steg till en smidigare vardag',
  includesTitle: 'Det här ingår',
  includes: [
    'Personlig genomgång och demo anpassad efter ert företag',
    'Uppsättning av admin, personal och projektstruktur',
    'Support vid uppstart så teamet kommer igång',
    'Löpande tillgång till portalen via app.timelaps',
  ],
} as const

export const MARKETING_WHY_PAGE = {
  title: 'Varför ni ska välja oss',
  subtitle:
    'TimeLaps är byggt för entreprenörer och byggteam som vill ha ordning utan krångel.',
  intro:
    'Vi vet hur det ser ut i vardagen — timmar i Excel, sms till chefen och underlag som försvinner. TimeLaps samlar allt på ett ställe så att både personal och admin sparar tid varje vecka.',
  audienceTitle: 'Passar särskilt bra för',
  audience: [
    { icon: '🏗️', label: 'Entreprenad- och byggföretag' },
    { icon: '🔧', label: 'Service- och installationsbolag' },
    { icon: '👷', label: 'Team med personal ute på olika projekt' },
    { icon: '📊', label: 'Chefer som vill ha koll innan månaden stängs' },
  ],
  promiseTitle: 'Vårt löfte',
  promise:
    'En lösning som är enkel att använda från dag ett — utan onödiga funktioner ni inte behöver, men med det som faktiskt gör skillnad i er vardag.',
} as const

/** Sätt till LVtechs URL när hemsidan ska länkas från TimeLaps — null = ingen länk ännu. */
export const LVTECH_WEBSITE_URL: string | null = null

export const MARKETING_ABOUT = {
  heading: 'Om TimeLaps & LVtech',
  lvtechHeading: 'LVtech',
  lvtechIntro:
    'LVtech utvecklar specialanpassade lösningar för företag med fokus på tidseffektivisering och besparing över tid. Vi utgår från hur ert team faktiskt arbetar — inte från generiska mallar — och bygger verktyg som tar bort onödig administration, minskar dubbelarbete och ger er bättre kontroll i vardagen.',
  lvtechMore:
    'Målet är enkelt: mer tid till det som skapar värde, och lösningar som fortsätter att betala sig över tid genom tydligare processer, färre misstag och smartare uppföljning.',
  timelapsHeading: 'TimeLaps — en del av LVtech',
  timelapsIntro:
    'TimeLaps är en av våra produkter, utvecklad för företag inom entreprenad, bygg och service som behöver ordning på timmar, projekt och personal. Portalen samlar tidrapportering, godkännande, projektuppföljning och kommunikation med teamet på ett ställe.',
  timelapsBroader:
    'TimeLaps är en del av LVtech — men vi gör så mycket mer. Utöver tidrapportering arbetar vi med andra skräddarsydda digitala lösningar som effektiviserar flöden, kopplar ihop system och anpassas efter varje kunds behov.',
  timelapsPractical:
    'Vi vet hur det ser ut i praktiken: timmar i Excel, sms till chefen och underlag som försvinner. TimeLaps samlar allt digitalt så att både personal och admin kan jobba smidigare — oavsett om ni är fem eller femtio.',
  lvtechLinkLabel: 'Läs mer om LVtech',
} as const
