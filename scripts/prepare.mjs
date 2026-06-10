import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

execSync('npx tsup', { stdio: 'inherit' })

if (existsSync('.git')) {
  const husky = await import('husky')
  const output = husky.default()
  if (output) process.stdout.write(`${output}\n`)
}
