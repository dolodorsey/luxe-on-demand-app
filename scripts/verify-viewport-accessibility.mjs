import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Regression gate: iOS/Android web views and the public driver-apply funnel
// must not prevent users from pinch-zooming text and form controls.
const layout = readFileSync('src/app/layout.tsx', 'utf8')
const viewportMatch = layout.match(/export const viewport:\s*Viewport\s*=\s*\{([\s\S]*?)\n\};/)

assert.ok(viewportMatch, 'LUXE root viewport declaration not found')
const viewport = viewportMatch[1]
assert.doesNotMatch(viewport, /\bmaximumScale\s*:/, 'Viewport must not cap user zoom')
assert.doesNotMatch(viewport, /\buserScalable\s*:\s*false\b/, 'Viewport must not disable user zoom')
assert.match(viewport, /\binitialScale\s*:\s*1\b/, 'Keep the original initial scale')
assert.match(viewport, /\bviewportFit\s*:\s*"cover"/, 'Keep safe-area viewport behavior')

console.log('LUXE zoom accessibility viewport contract verified')
