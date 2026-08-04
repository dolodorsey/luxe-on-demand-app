import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = process.cwd()
const sourceRoots = ['src']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
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
  if (/https:\/\/[a-z]{20}\.supabase\.co/i.test(text)) {
    failures.push(`${file}: hardcoded Supabase project URL detected`)
  }
  if (/sb_publishable_[A-Za-z0-9_-]{20,}/.test(text)) {
    failures.push(`${file}: hardcoded Supabase publishable key detected`)
  }
}

const supabaseModule = readFileSync(join(root, 'src/lib/supabase.ts'), 'utf8')
for (const requiredName of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PROJECT_REF',
]) {
  if (!supabaseModule.includes(requiredName)) {
    failures.push(`src/lib/supabase.ts: missing ${requiredName} guard`)
  }
}

if (/NEXT_PUBLIC_SUPABASE_URL\s*\|\|\s*['"]https:/m.test(supabaseModule)) {
  failures.push('src/lib/supabase.ts: Supabase URL fallback detected')
}
if (/NEXT_PUBLIC_SUPABASE_(?:ANON_KEY|PUBLISHABLE_KEY)[^\n]*\|\|\s*['"]sb_/m.test(supabaseModule)) {
  failures.push('src/lib/supabase.ts: Supabase key fallback detected')
}

if (failures.length) {
  console.error('LUXE backend isolation verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`LUXE backend isolation verified across ${sourceFiles.length} source files.`)
