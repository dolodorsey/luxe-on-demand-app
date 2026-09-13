import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))

const exact = (actual, expected, label) => {
  if (actual !== expected) throw new Error(`${label} must remain pinned to ${expected}; found ${actual ?? 'missing'}`)
}

exact(pkg.dependencies?.next, '16.3.4', 'Next.js')
exact(pkg.devDependencies?.['eslint-config-next'], '16.3.4', 'eslint-config-next')
exact(pkg.overrides?.sharp, '0.35.4', 'sharp override')
exact(pkg.overrides?.nanoid, '3.3.18', 'nanoid override')
exact(pkg.overrides?.['baseline-browser-mapping'], '2.11.0', 'baseline-browser-mapping override')
exact(pkg.engines?.node, '24.x', 'Node engine')

const root = lock.packages?.[''] || {}
exact(root.dependencies?.next, '16.3.4', 'package-lock root Next.js')
exact(root.devDependencies?.['eslint-config-next'], '16.3.4', 'package-lock root eslint-config-next')

const installed = {
  next: lock.packages?.['node_modules/next']?.version,
  sharp: lock.packages?.['node_modules/sharp']?.version,
  nanoid: lock.packages?.['node_modules/nanoid']?.version,
  baseline: lock.packages?.['node_modules/baseline-browser-mapping']?.version,
}
exact(installed.next, '16.3.4', 'installed Next.js')
exact(installed.sharp, '0.35.4', 'installed sharp')
exact(installed.nanoid, '3.3.18', 'installed nanoid')
exact(installed.baseline, '2.11.0', 'installed baseline-browser-mapping')

console.log('LUXE production dependency security floor verified')
