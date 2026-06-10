/**
 * Säkerställ Neon-kompatibla Prisma-variabler innan migrate/build.
 * - DATABASE_URL: pooler + pgbouncer + längre timeout (serverless)
 * - DIRECT_URL: direktanslutning för prisma migrate (krävs med pooler)
 */
function ensureQueryParams(urlString, params) {
  const url = new URL(urlString)
  for (const [key, value] of Object.entries(params)) {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

function deriveDirectUrl(pooledUrl) {
  const url = new URL(pooledUrl)
  url.hostname = url.hostname.replace('-pooler', '')
  url.searchParams.delete('pgbouncer')
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require')
  }
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', '30')
  }
  return url.toString()
}

function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
    return
  }

  process.env.DATABASE_URL = ensureQueryParams(databaseUrl, {
    sslmode: 'require',
    pgbouncer: 'true',
    connect_timeout: '30',
    pool_timeout: '30',
  })

  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = deriveDirectUrl(process.env.DATABASE_URL)
  } else {
    process.env.DIRECT_URL = ensureQueryParams(process.env.DIRECT_URL, {
      sslmode: 'require',
      connect_timeout: '30',
    })
  }
}

main()
