import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { checkColors, makeColors } from '../hooks/make-colors.js'

const HEX = /^#[0-9a-f]{6}$/
const DUSK = { 'surface-0': '#181512', 'text-primary': '#ece4d4' }

function luminance(hex) {
  const channel = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => channel(c / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('makeColors output shape', () => {
  test('a theme with only roles has both modes, all lowercase six-digit hex', () => {
    const { theme } = makeColors({ label: 'Roles', roles: { accent: '#E0A83A' } })

    assert.equal(theme.v, 1)
    assert.equal(theme.id, 'mod-theme')
    assert.equal(theme.label, 'Roles')
    assert.deepEqual(Object.keys(theme.inputs), ['light', 'dark'])
    for (const mode of ['light', 'dark']) {
      for (const [name, value] of Object.entries(theme.inputs[mode])) {
        assert.match(value, HEX, `${mode}.${name}`)
      }
    }
  })

  test('only keeps just the named mode', () => {
    const { theme } = makeColors({ label: 'Dark', only: 'dark', dark: { gray: { anchors: DUSK } } })

    assert.deepEqual(Object.keys(theme.inputs), ['dark'])
  })

  test('contrast is passed through only when given', () => {
    assert.equal(makeColors({ label: 'x', roles: {}, contrast: 'more' }).theme.contrast, 'more')
    assert.equal('contrast' in makeColors({ label: 'x', roles: {} }).theme, false)
  })

  test('gray anchors land on their stops unchanged (lowercased)', () => {
    const { theme } = makeColors({
      label: 'Anchors',
      only: 'dark',
      dark: { gray: { anchors: { 'surface-0': '#18151A', 'text-primary': '#ECE4D4' } } },
    })

    assert.equal(theme.inputs.dark['gray-900'], '#18151a')
    assert.equal(theme.inputs.dark['gray-50'], '#ece4d4')
  })

  test('the result is plain JSON and the same for the same input', () => {
    const definition = { label: 'Same', roles: { accent: '#e0a83a' }, dark: { gray: { anchors: DUSK } } }
    const first = makeColors(definition)

    assert.deepEqual(JSON.parse(JSON.stringify(first.theme)), first.theme)
    assert.deepEqual(makeColors(definition), first)
  })

  test('the stock theme has no problems', () => {
    assert.deepEqual(makeColors({ label: 'Stock', roles: {} }).problems, [])
  })
})

describe('makeColors clamps out-of-gamut and extreme seeds', () => {
  for (const seed of ['#00ff00', '#ffff00', '#ff00ff', '#000080', '#ffffff', '#000000']) {
    test(`accent seed ${seed} gives valid colors and readable ink on the fill`, () => {
      const { theme } = makeColors({ label: 'Seed', roles: { accent: seed } })

      for (const mode of ['light', 'dark']) {
        const inputs = theme.inputs[mode]
        for (const [name, value] of Object.entries(inputs)) {
          if (name.startsWith('role-accent-')) assert.match(value, HEX, `${mode}.${name}`)
        }
        assert.ok(
          contrast(inputs['role-accent-on'], inputs['role-accent-fill']) >= 4.4,
          `${mode}: ${inputs['role-accent-on']} on ${inputs['role-accent-fill']}`,
        )
      }
    })
  }
})

describe('makeColors rejects what it cannot use', () => {
  const cases = [
    ['an unknown only', { label: 'x', only: 'sepia', roles: {} }, /only is "sepia"/],
    ['a three-digit hex', { label: 'x', roles: { accent: '#fff' } }, /roles\.accent\.seed is "#fff"/],
    ['a color name', { label: 'x', roles: { danger: 'red' } }, /six-digit hex/],
    ['an unknown role', { label: 'x', roles: { brand: '#ffffff' } }, /roles has "brand"/],
    ['an empty label', { label: '', roles: {} }, /label of 1 to 64 characters/],
    ['a label over 64 characters', { label: 'x'.repeat(65), roles: {} }, /label of 1 to 64 characters/],
    ['a definition that sets nothing', { label: 'x' }, /sets nothing/],
    ['an unknown top-level key', { label: 'x', roles: {}, colors: {} }, /has "colors"/],
    [
      'a fillShade that is not a stop',
      { label: 'x', roles: { accent: { seed: '#123456', fillShade: 451 } } },
      /fillShade is 451/,
    ],
    [
      'anchors without text-primary',
      { label: 'x', dark: { gray: { anchors: { 'surface-0': '#181512' } } } },
      /needs "text-primary"/,
    ],
    [
      'a page lighter than its text',
      { label: 'x', dark: { gray: { anchors: { 'surface-0': '#ffffff', 'text-primary': '#000000' } } } },
      /surface-0 .* is lighter than text-primary/,
    ],
    [
      'an unknown git state',
      { label: 'x', dark: { git: { renamed: '#ffffff' } } },
      /dark\.git names "renamed"/,
    ],
  ]

  for (const [what, definition, message] of cases) {
    test(`throws on ${what}`, () => {
      assert.throws(() => makeColors(definition), message)
    })
  }
})

describe('contrast problems', () => {
  test('text under 3:1 is reported with the "Desktop won\'t paint" prefix register.tsx looks for', () => {
    const { problems } = makeColors({
      label: 'Murky',
      only: 'dark',
      dark: { gray: { anchors: { 'surface-0': '#181512', 'text-primary': '#222222' } } },
    })

    assert.ok(problems.some(line => line.startsWith("Desktop won't paint")))
  })

  test('a readable theme has no "Desktop won\'t paint" line', () => {
    const { problems } = makeColors({ label: 'Readable', only: 'dark', dark: { gray: { anchors: DUSK } } })

    assert.equal(problems.filter(line => line.startsWith("Desktop won't paint")).length, 0)
  })
})

describe('checkColors', () => {
  test('a non-object is one problem', () => {
    assert.deepEqual(checkColors(null), ['colors must be an object, so nothing paints.'])
    assert.deepEqual(checkColors([]), ['colors must be an object, so nothing paints.'])
  })

  test('reports a bad version, label, mode, input name and hex', () => {
    const problems = checkColors({
      v: 2,
      label: '',
      inputs: { dark: { 'gray-0': 'red', 'nope-x': '#000000' }, sepia: {} },
    })

    assert.deepEqual(problems, [
      'v must be 1, so nothing paints.',
      'label must be 1 to 64 characters, so nothing paints.',
      'inputs.dark.gray-0 is not six-digit hex, so it paints nothing.',
      "inputs.dark.nope-x isn't a theme color name, so it paints nothing.",
      "inputs.sepia isn't a mode, so nothing paints there: use light or dark.",
    ])
  })

  test('reports an undefined value, which $.theme.set refuses', () => {
    assert.deepEqual(checkColors({ v: 1, label: 'x', inputs: { dark: { 'gray-0': undefined } } }), [
      'colors.inputs.dark.gray-0 is undefined, and $.theme.set refuses that: leave the key out.',
    ])
  })

  test('agrees with makeColors on its own output', () => {
    const { theme, problems } = makeColors({ label: 'Same', roles: { accent: '#e0a83a' } })

    assert.deepEqual(checkColors(theme), problems)
  })
})
