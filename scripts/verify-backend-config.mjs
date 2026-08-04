import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = process.cwd()
const sourceRoots = ['src']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const approvedConfigFile = 'src/config/luxe-public-backend.ts'
const approvedProjectRef = 'dzlmtvodpyhetvektfuo'
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
}

const publicConfig = readFileSync(join(root, approvedConfigFile), 'utf8')
if (!publicConfig.includes(`LUXE_APPROVED_PROJECT_REF = '${approvedProjectRef}'`)) {
  failures.push(`${approvedConfigFile}: approved project reference changed unexpectedly`)
}
if (!/LUXE_APPROVED_PUBLISHABLE_KEY\s*=\s*'sb_publishable_[A-Za-z0-9_-]{20,}'/.test(publicConfig)) {
  failures.push(`${approvedConfigFile}: approved publishable key binding is missing or malformed`)
}
if (/service_role|sb_secret_/i.test(publicConfig)) {
  failures.push(`${approvedConfigFile}: secret or service-role credential detected`)
}

const supabaseModule = readFileSync(join(root, 'src/lib/supabase.ts'), 'utf8')
for (const requiredName of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PROJECT_REF',
  'LUXE_APPROVED_PROJECT_REF',
  'LUXE_APPROVED_PUBLISHABLE_KEY',
]) {
  if (!supabaseModule.includes(requiredName)) {
    failures.push(`src/lib/supabase.ts: missing ${requiredName} guard or binding`)
  }
}

if (failures.length) {
  console.error('LUXE backend isolation verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`LUXE backend isolation verified across ${sourceFiles.length} source files.`)
