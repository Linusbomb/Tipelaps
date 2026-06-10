require('./ensure-neon-env.cjs')

const { execSync } = require('child_process')

function run(command) {
  execSync(command, { stdio: 'inherit', env: process.env })
}

run('npx prisma generate')
run('npx prisma migrate deploy')
run('npm run build')
