import { readFileSync, writeFileSync } from 'fs'

const path = new URL('../src/index.css', import.meta.url).pathname
const css = readFileSync(path, 'utf8')

const start = css.indexOf('\n/* \u2500\u2500 Bubblegum Theme')
const end   = css.indexOf('\n\n@layer base {')

if (start === -1 || end === -1) {
  console.log('Markers not found – already cleaned?', { start, end })
} else {
  const cleaned = css.slice(0, start) + css.slice(end)
  writeFileSync(path, cleaned)
  console.log(`Removed ${end - start} chars (lines with extra themes)`)
}
