const fs = require('fs')
const path = require('path')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile(path.join(__dirname, '..', '.env.local'))
loadEnvFile(path.join(__dirname, '..', '.env'))

require('./ensure-neon-env.cjs')

const url = process.env.DATABASE_URL || ''
if (!url) {
  console.error('DATABASE_URL saknas')
  process.exit(1)
}

try {
  const parsed = new URL(url)
  console.log('host:', parsed.hostname)
  console.log('port:', parsed.port || '5432')
  console.log('sslmode:', parsed.searchParams.get('sslmode') || '(saknas)')
  console.log('pgbouncer:', parsed.searchParams.get('pgbouncer') || '(saknas)')
  console.log('connect_timeout:', parsed.searchParams.get('connect_timeout') || '(saknas)')
  console.log('pooler:', parsed.hostname.includes('pooler'))
} catch (err) {
  console.error('Kunde inte tolka DATABASE_URL:', err.message)
  process.exit(1)
}

async function main() {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  const started = Date.now()
  try {
    await prisma.$connect()
    const count = await prisma.company.count()
    console.log('connection_ok: true')
    console.log('company_count:', count)
    console.log('elapsed_ms:', Date.now() - started)
  } catch (err) {
    console.log('connection_ok: false')
    console.log('error_code:', err.code || '')
    console.log('error_message:', String(err.message).slice(0, 300))
    process.exitCode = 1
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
