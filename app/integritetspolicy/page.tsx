import Link from 'next/link'

export const metadata = {
  title: 'Integritetspolicy – TimeLaps',
  description:
    'Hur TimeLaps samlar in, behandlar och skyddar personuppgifter enligt GDPR.',
}

const BG = '#E8E8D8'
const PRIMARY = '#2D5016'

export default function PrivacyPolicyPage() {
  const lastUpdated = '2026-05-08'

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8" style={{ backgroundColor: BG }}>
      <article className="prose mx-auto max-w-3xl rounded-xl bg-white/95 p-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-extrabold" style={{ color: PRIMARY }}>
          Integritetspolicy
        </h1>
        <p className="text-sm text-gray-600">Senast uppdaterad: {lastUpdated}</p>

        <p>
          TimeLaps värnar om din integritet. Den här policyn beskriver hur personuppgifter samlas
          in, används och skyddas i tjänsten, samt vilka rättigheter du har enligt
          dataskyddsförordningen (GDPR / EU 2016/679).
        </p>

        <h2>1. Personuppgiftsansvarig och personuppgiftsbiträde</h2>
        <p>
          När ett företag (kund) använder TimeLaps för att hantera sina anställdas tidrapportering är{' '}
          <strong>kundföretaget personuppgiftsansvarig</strong> för uppgifterna om sina anställda
          och underentreprenörer. <strong>Leverantören av TimeLaps</strong> är personuppgiftsbiträde
          och behandlar uppgifterna enligt instruktion från kunden samt enligt detta avtal.
        </p>
        <p>
          För den som registrerar ett administratörskonto är leverantören personuppgiftsansvarig för
          de kontaktuppgifter som krävs för att ingå avtal och tillhandahålla tjänsten.
        </p>

        <h2>2. Vilka personuppgifter behandlas</h2>
        <ul>
          <li>
            <strong>Konto:</strong> namn, e-postadress, telefonnummer, hashat lösenord, roll
            (administratör, lönesamordnare, personal, superadmin), företagstillhörighet,
            personalkategori.
          </li>
          <li>
            <strong>Tidrapporter:</strong> datum, arbetade timmar, kund, projekt,
            arbetsbeskrivning, fordonstimmar, plats och referensnummer.
          </li>
          <li>
            <strong>Anställningsdokument:</strong> körkort, certifikat, anställningsavtal som
            laddas upp av administratör eller den anställde själv.
          </li>
          <li>
            <strong>Närmsta anhörig:</strong> namn, relation och kontaktuppgifter (frivilligt).
          </li>
          <li>
            <strong>Loggar:</strong> in- och utloggningar, säkerhetshändelser, IP-adress och
            user-agent (revisionslogg).
          </li>
          <li>
            <strong>Tekniska data:</strong> JWT-token i webbläsarens lagring för inloggning.
          </li>
        </ul>

        <h2>3. Ändamål och rättslig grund</h2>
        <ul>
          <li>
            <strong>Tillhandahålla tjänsten</strong> (avtal, art. 6.1.b): kontoadministration,
            tidrapportering, projektplanering, semesterveckor.
          </li>
          <li>
            <strong>Säkerhet och bedrägeribekämpning</strong> (berättigat intresse, art. 6.1.f):
            revisionslogg, hashat lösenord, åtkomstkontroll.
          </li>
          <li>
            <strong>Rättsliga skyldigheter</strong> (art. 6.1.c): bevarande av tidsuppgifter och
            anställningsdokument enligt arbetsrätt och bokföringslag.
          </li>
        </ul>

        <h2>4. Mottagare och underbiträden</h2>
        <p>Uppgifter behandlas av följande underbiträden:</p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> (USA / EU) – hosting av webbapplikationen. DPA finns.
          </li>
          <li>
            <strong>Neon Inc.</strong> (EU/USA) – hostad PostgreSQL-databas. DPA finns.
          </li>
          <li>
            <strong>SMTP-leverantör</strong> som du som kund själv konfigurerar (för utgående
            e-post, t.ex. lösenordslänkar).
          </li>
        </ul>
        <p>
          Personuppgifter delas inte med andra tredje parter utöver vad som krävs för att leverera
          tjänsten eller följa lag.
        </p>

        <h2>5. Lagringstid</h2>
        <ul>
          <li>
            <strong>Aktiva konton:</strong> så länge anställningen pågår och kontot är aktivt.
          </li>
          <li>
            <strong>Avslutade anställningar:</strong> grunddata om personen behålls så länge
            relaterade tidrapporter krävs för bokföring eller arbetsrätt (typiskt 7 år för
            bokföringsunderlag).
          </li>
          <li>
            <strong>Tidrapporter:</strong> minst 7 år enligt bokföringslagen.
          </li>
          <li>
            <strong>Revisionslogg:</strong> minst 12 månader, högst 5 år, för säkerhets- och
            spårbarhetsändamål.
          </li>
          <li>
            När en kund avslutar sin prenumeration raderas eller anonymiseras all kunddata inom 90
            dagar, om inte längre lagring krävs av lag.
          </li>
        </ul>

        <h2>6. Säkerhetsåtgärder</h2>
        <ul>
          <li>Lösenord lagras enbart hashat (bcrypt, kostnad 10).</li>
          <li>All trafik krypteras med TLS (HTTPS).</li>
          <li>JWT-token signeras med hemlig nyckel (`JWT_SECRET`).</li>
          <li>
            Multi-tenant-isolering: varje företags data filtreras på <code>companyId</code> i alla
            API-routes.
          </li>
          <li>Roller och behörigheter kontrolleras serverside för varje förfrågan.</li>
          <li>
            Superadmin-åtgärder loggas i revisionsloggen, inklusive impersonering (kortlivat 1-h
            token).
          </li>
        </ul>

        <h2>7. Dina rättigheter</h2>
        <p>Du har enligt GDPR rätt att:</p>
        <ul>
          <li>
            <strong>Få tillgång till dina uppgifter</strong> – exportera all din data via{' '}
            <em>Mitt konto → Ladda ner mina uppgifter</em>.
          </li>
          <li>
            <strong>Få felaktiga uppgifter rättade.</strong>
          </li>
          <li>
            <strong>Få dina uppgifter raderade</strong> – kontakta din arbetsgivares administratör
            eller, om du registrerat eget administratörskonto, använd raderingsfunktionen i
            superadmin/admin-vyn.
          </li>
          <li>
            <strong>Begränsa eller invända mot behandling.</strong>
          </li>
          <li>
            <strong>Dataportabilitet</strong> – exporterad data levereras i maskinläsbart JSON-format.
          </li>
          <li>
            <strong>Klaga till tillsynsmyndighet</strong> – Integritetsskyddsmyndigheten (IMY),{' '}
            <a href="https://www.imy.se" rel="noopener noreferrer" target="_blank">
              imy.se
            </a>
            .
          </li>
        </ul>

        <h2>8. Kontakt</h2>
        <p>
          Frågor om personuppgiftsbehandling besvaras av din arbetsgivares utsedda kontaktperson
          eller av leverantören av TimeLaps via support-e-posten i ditt avtal.
        </p>

        <h2>9. Ändringar</h2>
        <p>
          Vi kan uppdatera denna policy. Större ändringar meddelas i tjänsten innan de träder i
          kraft. Senaste versionen finns alltid på denna sida.
        </p>

        <p className="mt-8">
          <Link href="/" className="text-sm" style={{ color: PRIMARY }}>
            ← Tillbaka till startsidan
          </Link>
        </p>
      </article>
    </div>
  )
}
