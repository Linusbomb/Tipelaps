import { prisma } from '@/lib/prisma'
import { sendSecurityAlertEmail } from '@/lib/email'

const FAILURE_WINDOW_MINUTES = 10
const FAILURE_THRESHOLD_PER_EMAIL = 10
const FAILURE_THRESHOLD_PER_IP = 30
const NEW_DEVICE_LOOKBACK_DAYS = 30
const ALERT_COOLDOWN_MINUTES = 60

function getAlertRecipient(): string | null {
  return (
    process.env.SECURITY_ALERT_EMAIL ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    null
  )
}

function ipMaskedHint(ip: string | null): string {
  if (!ip) return 'okänd IP'
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`
  return ip
}

export type LoginRateCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; reason: 'email' | 'ip' }

/**
 * Räknar misslyckade loginförsök i revisionsloggen och blockerar om tröskeln
 * passerats. Skickar varningsmejl första gången (sedan tystas i 60 min).
 */
export async function checkLoginRateLimit(
  email: string,
  ipAddress: string | null
): Promise<LoginRateCheck> {
  // Defensiv: om AuditLog-tabellen inte finns (migration inte deployad) får
  // rate limiting absolut inte blockera inloggning. Då släpper vi alltid igenom.
  try {
    const since = new Date(Date.now() - FAILURE_WINDOW_MINUTES * 60 * 1000)

    const [perEmail, perIp] = await Promise.all([
      prisma.auditLog.count({
        where: {
          action: 'LOGIN_FAILURE',
          actorEmail: email,
          createdAt: { gte: since },
        },
      }),
      ipAddress
        ? prisma.auditLog.count({
            where: {
              action: 'LOGIN_FAILURE',
              ipAddress,
              createdAt: { gte: since },
            },
          })
        : Promise.resolve(0),
    ])

    if (perEmail >= FAILURE_THRESHOLD_PER_EMAIL) {
      void maybeSendBruteForceAlert({
        kind: 'email',
        identifier: email,
        count: perEmail,
        ipAddress,
      }).catch(() => {})
      return {
        allowed: false,
        retryAfterSeconds: FAILURE_WINDOW_MINUTES * 60,
        reason: 'email',
      }
    }
    if (ipAddress && perIp >= FAILURE_THRESHOLD_PER_IP) {
      void maybeSendBruteForceAlert({
        kind: 'ip',
        identifier: ipAddress,
        count: perIp,
        ipAddress,
      }).catch(() => {})
      return {
        allowed: false,
        retryAfterSeconds: FAILURE_WINDOW_MINUTES * 60,
        reason: 'ip',
      }
    }
    return { allowed: true }
  } catch (err) {
    console.error('checkLoginRateLimit failed (allowing login):', err)
    return { allowed: true }
  }
}

async function maybeSendBruteForceAlert(args: {
  kind: 'email' | 'ip'
  identifier: string
  count: number
  ipAddress: string | null
}) {
  const recipient = getAlertRecipient()
  if (!recipient) return

  const cooldownSince = new Date(Date.now() - ALERT_COOLDOWN_MINUTES * 60 * 1000)
  const recent = await prisma.auditLog.findFirst({
    where: {
      action: 'LOGIN_FAILURE',
      createdAt: { gte: cooldownSince },
      ...(args.kind === 'email'
        ? { actorEmail: args.identifier }
        : { ipAddress: args.identifier }),
      details: { path: ['alertSent'], equals: true } as any,
    },
  })
  if (recent) return

  const subject = `Brute-force-försök upptäckt (${args.kind === 'email' ? 'konto' : 'IP'})`
  const html =
    args.kind === 'email'
      ? `<p>Kontot <strong>${args.identifier}</strong> har haft <strong>${args.count}</strong> misslyckade
        inloggningsförsök på ${FAILURE_WINDOW_MINUTES} minuter.</p>
        <p>IP-adress (senaste): ${args.ipAddress ?? 'okänd'}.</p>
        <p>Inloggning från det här kontot är tillfälligt blockerad i ${FAILURE_WINDOW_MINUTES} minuter.</p>`
      : `<p>IP-adressen <strong>${args.identifier}</strong> har gjort <strong>${args.count}</strong> misslyckade
        inloggningsförsök på ${FAILURE_WINDOW_MINUTES} minuter.</p>
        <p>Inloggning från denna IP är tillfälligt blockerad i ${FAILURE_WINDOW_MINUTES} minuter.</p>`
  const text =
    args.kind === 'email'
      ? `${args.count} misslyckade login på ${args.identifier} på ${FAILURE_WINDOW_MINUTES} min. Senaste IP: ${args.ipAddress ?? 'okänd'}.`
      : `${args.count} misslyckade login från IP ${args.identifier} på ${FAILURE_WINDOW_MINUTES} min.`

  await sendSecurityAlertEmail({ to: recipient, subject, bodyHtml: html, bodyText: text })

  // Markera senaste failure med alertSent=true så vi inte spammar.
  await prisma.auditLog.create({
    data: {
      action: 'LOGIN_FAILURE',
      actorEmail: args.kind === 'email' ? args.identifier : null,
      ipAddress: args.kind === 'ip' ? args.identifier : args.ipAddress,
      details: { reason: 'rate_limited', count: args.count, alertSent: true } as any,
    },
  })
}

/**
 * Skickar mejl till en admin/superadmin när de loggar in från en IP de inte
 * sett på 30 dagar. Avser endast känsliga roller — anställda får ingen
 * notifiering (för att undvika spam i fält).
 */
export async function notifyIfNewDeviceForAdmin(args: {
  userId: string
  email: string
  name: string
  role: string
  ipAddress: string | null
  userAgent: string | null
}) {
  if (!args.ipAddress) return
  const sensitiveRoles = ['ENTREPRENEUR', 'PAYROLL_COORDINATOR', 'SUPERADMIN']
  if (!sensitiveRoles.includes(args.role)) return

  const since = new Date(Date.now() - NEW_DEVICE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  let seenBefore: { id: string } | null = null
  try {
    seenBefore = await prisma.auditLog.findFirst({
      where: {
        action: 'LOGIN_SUCCESS',
        actorId: args.userId,
        ipAddress: args.ipAddress,
        createdAt: { gte: since },
      },
      select: { id: true },
    })
  } catch (err) {
    // AuditLog-tabellen saknas eller annan DB-felmeddelande – tysta och hoppa över
    console.error('notifyIfNewDeviceForAdmin lookup failed:', err)
    return
  }

  if (seenBefore) return

  const html = `
    <p>Hej ${args.name},</p>
    <p>Vi noterade en lyckad inloggning på ditt TimeLaps-konto från en ny enhet eller plats:</p>
    <ul>
      <li><strong>Konto:</strong> ${args.email} (${args.role})</li>
      <li><strong>IP:</strong> ${ipMaskedHint(args.ipAddress)}</li>
      <li><strong>Webbläsare:</strong> ${args.userAgent ?? 'okänd'}</li>
      <li><strong>Tid:</strong> ${new Date().toLocaleString('sv-SE')}</li>
    </ul>
    <p>Var det inte du? Byt lösenord direkt och kontakta din administratör.</p>
  `
  const text = `Lyckad inloggning från ny enhet på ditt TimeLaps-konto (${args.email}). IP: ${args.ipAddress}. Var det inte du? Byt lösenord och kontakta admin.`

  await sendSecurityAlertEmail({
    to: args.email,
    subject: 'Ny inloggning på ditt TimeLaps-konto',
    bodyHtml: html,
    bodyText: text,
  })
}

/** Liten hjälpare för att läsa IP konsekvent från en NextRequest. */
export function getRequestIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || null
  return headers.get('x-real-ip') || null
}
