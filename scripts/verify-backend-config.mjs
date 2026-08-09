import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = process.cwd()
const sourceRoots = ['src']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const approvedConfigFile = 'src/config/luxe-mobility-backend.ts'
const approvedProjectRef = 'cxdqkjvtpilvouwtbgdy'
const failures = []

function collect(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? collect(path) : [path]
  })
}

const sourceFiles = sourceRoots.flatMap((directory) => collect(join(root, directory)))
  .filter((path) => extensions.has(extname(path)))

for (const path of sourceFiles) {
  const text = readFileSync(path, 'utf8')
  const file = relative(root, path)

  if (/\.n8n\.cloud|\/webhook\//i.test(text)) {
    failures.push(`${file}: legacy webhook or n8n integration detected`)
  }
  if (file !== approvedConfigFile && /https:\/\/[a-z]{20}\.supabase\.co/i.test(text)) {
    failures.push(`${file}: hardcoded Supabase project URL detected outside approved binding`)
  }
  if (file !== approvedConfigFile && /sb_publishable_[A-Za-z0-9_-]{20,}/.test(text)) {
    failures.push(`${file}: hardcoded Supabase publishable key detected outside approved binding`)
  }
  if (/service_role|sb_secret_/i.test(text)) {
    failures.push(`${file}: secret or service-role credential detected in browser source`)
  }
}

const mobilityConfig = readFileSync(join(root, approvedConfigFile), 'utf8')
if (!mobilityConfig.includes(`LUXE_MOBILITY_PROJECT_REF = '${approvedProjectRef}'`)) {
  failures.push(`${approvedConfigFile}: approved mobility project reference changed unexpectedly`)
}
if (!/LUXE_MOBILITY_PUBLISHABLE_KEY\s*=\s*'sb_publishable_[A-Za-z0-9_-]{20,}'/.test(mobilityConfig)) {
  failures.push(`${approvedConfigFile}: reviewed public publishable key binding is missing or malformed`)
}
if (!mobilityConfig.includes("LUXE_BACKEND_MODE = 'shared-sos-on-call-project'")) {
  failures.push(`${approvedConfigFile}: shared backend mode is missing or stale`)
}

const mobilityModule = readFileSync(join(root, 'src/lib/luxe-mobility.ts'), 'utf8')
for (const requiredName of [
  'LUXE_MOBILITY_SUPABASE_URL',
  'LUXE_MOBILITY_PUBLISHABLE_KEY',
  'LUXE_BACKEND_MODE',
]) {
  if (!mobilityModule.includes(requiredName)) {
    failures.push(`src/lib/luxe-mobility.ts: missing ${requiredName} binding`)
  }
}

if (failures.length) {
  console.error('LUXE backend isolation verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`LUXE mobility backend isolation verified across ${sourceFiles.length} source files.`)
