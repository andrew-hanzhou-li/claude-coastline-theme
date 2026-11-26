// register.tsx imports the host's 'claude-code' module and uses JSX, so it can't be imported here.
// These tests read the palette and the meter cutoffs straight out of its source instead.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as nodeModule from 'node:module'
import { describe, test } from 'node:test'

import { makeColors } from '../hooks/make-colors.js'

const source = readFileSync(new URL('../hooks/register.tsx', import.meta.url), 'utf8')

// The text from `open` (a `{` or `(`) to its matching close.
function balanced(text, open) {
  const pairs = { '{': '}', '(': ')' }
  const close = pairs[text[open]]
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === text[open]) depth++
    else if (text[i] === close && --depth === 0) return text.slice(open, i + 1)
  }
  throw Error(`No match for ${text[open]} at ${open} in register.tsx`)
}

function after(marker) {
  const at = source.indexOf(marker)
  assert.notEqual(at, -1, `register.tsx no longer has ${JSON.stringify(marker)}`)
  return at + marker.length
}

const definition = Function(`return ${balanced(source, after('makeColors(') - 1)}`)()

describe('Coastline palette', () => {
  test('builds without throwing and is dark only', () => {
    const { theme } = makeColors(definition)

    assert.deepEqual(Object.keys(theme.inputs), ['dark'])
    assert.equal(theme.label, 'Coastline')
  })

  test('has no "Desktop won\'t paint" problem, so the desktop app paints it', () => {
    const { problems } = makeColors(definition)

    assert.deepEqual(
      problems.filter(line => line.startsWith("Desktop won't paint")),
      [],
    )
  })

  test('keeps the sand and cream anchors as given', () => {
    const { theme } = makeColors(definition)

    assert.equal(theme.inputs.dark['gray-900'], definition.dark.gray.anchors['surface-0'])
    assert.equal(theme.inputs.dark['gray-50'], definition.dark.gray.anchors['text-primary'])
  })
})

describe('meterColor', { skip: !nodeModule.stripTypeScriptTypes && 'needs node:module stripTypeScriptTypes (Node 22.13+)' }, () => {
  const meterColor = () => {
    const start = source.indexOf('function meterColor(')
    assert.notEqual(start, -1, 'register.tsx no longer has function meterColor')
    const open = source.indexOf('{', source.indexOf(')', start))
    const ts = source.slice(start, open) + balanced(source, open)
    return Function(`${nodeModule.stripTypeScriptTypes(ts)}; return meterColor`)()
  }
  const GREEN = '#7fb069'
  const YELLOW = '#e3c34a'
  const ORANGE = '#e08a3a'
  const RED = '#d9534a'

  // The cutoffs the README's table promises: 0-30 green, 31-55 yellow, 56-75 orange, above 75 red.
  const cases = [
    [0, GREEN],
    [30, GREEN],
    [30.5, YELLOW],
    [31, YELLOW],
    [55, YELLOW],
    [56, ORANGE],
    [75, ORANGE],
    [75.1, RED],
    [100, RED],
    [140, RED],
  ]

  for (const [percent, color] of cases) {
    test(`${percent}% is ${color}`, () => {
      assert.equal(meterColor()(percent), color)
    })
  }
})
