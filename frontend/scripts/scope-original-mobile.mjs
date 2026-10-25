import { readFile, writeFile } from 'node:fs/promises'
import postcss from 'postcss'

const source = new URL('../src/original-mobile/styles.css', import.meta.url)
const destination = new URL('../src/original-mobile-extras/archive-scoped.css', import.meta.url)
const root = postcss.parse(await readFile(source, 'utf8'), { from: source.pathname })
const names = new Map()
root.walkAtRules(/keyframes$/, (rule) => {
  const renamed = `original-mobile-${rule.params}`
  names.set(rule.params, renamed)
  rule.params = renamed
})
root.walkRules((rule) => {
  let parent = rule.parent
  while (parent) {
    if (parent.type === 'atrule' && /keyframes$/.test(parent.name)) return
    parent = parent.parent
  }
  rule.selector = [...new Set(postcss.list.comma(rule.selector).map((selector) => {
    const value = selector.trim()
    return [':root', 'html', 'body', '#root'].includes(value) ? '.original-mobile' : `.original-mobile ${value}`
  }))].join(', ')
})
root.walkDecls(/^(animation|animation-name)$/, (declaration) => {
  for (const [before, after] of names) {
    declaration.value = declaration.value.replace(new RegExp(`\\b${before}\\b`, 'g'), after)
  }
})
await writeFile(destination, `/* Generated from the unchanged archive styles.css. Run: node frontend/scripts/scope-original-mobile.mjs */\n${root.toString()}`)
console.log('Generated isolated original mobile stylesheet; source file unchanged.')
