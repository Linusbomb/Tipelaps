const fs = require('fs')
const path = require('path')

const root = process.cwd()
const targets = ['.next', '.next-dev', path.join('node_modules', '.cache')]

for (const rel of targets) {
  const abs = path.join(root, rel)
  try {
    fs.rmSync(abs, { recursive: true, force: true })
    console.log('Removed:', rel)
  } catch (_) {
    // ignore missing paths
  }
}
