import { atom, read, update } from 'claude-code'
import type { Register, ThemeSetArgs } from 'claude-code'

import type { Limit } from '../types'

import { makeColors } from './make-colors.js'

// Coastline: a beach at dusk. Warm dark sand, cream text, a gold accent,
// a dusk glow at the top, a faint teal ocean glow at the bottom, and color-coded usage meters.
const { theme, problems } = makeColors({
  label: 'Coastline',
  only: 'dark',
  roles: { accent: '#e0a83a', danger: '#c4553f', success: '#6f9a5a', warning: '#d07a2a', pro: '#a77bb5' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#181512',
        'surface-1': '#201c18',
        'surface-2': '#26211c',
        'surface-3': '#28231e',
        'text-primary': '#ece4d4',
        'text-secondary': '#cfc5b3',
        'text-muted': '#a89d8a',
      },
    },
  },
})

// A still scene that stretches to any window: a dusk glow at the top, warm sand through
// the middle, and a faint teal glow rising from the bottom edge and fading out as it goes up.
const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="none">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#262018"/>
      <stop offset="0.05" stop-color="#1f1a15"/>
      <stop offset="0.13" stop-color="#191613"/>
      <stop offset="1" stop-color="#191613"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d4744" stop-opacity="0"/>
      <stop offset="0.6" stop-color="#1d4744" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#1d4744" stop-opacity="0.45"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#sky)"/>
  <rect y="920" width="1600" height="80" fill="url(#sea)"/>
</svg>`

// Usage meters: green up to 30%, yellow to 55%, orange to 75%, red above that.
const limits = atom({ plugin: 'coastline-theme', key: 'limits' } as const, [] as Limit[])

const LABELS: Record<string, string> = { five_hour: '5-hour limit', seven_day: 'Weekly limit' }

function meterColor(percentUsed: number): string {
  if (percentUsed <= 30) return '#7fb069'
  if (percentUsed <= 55) return '#e3c34a'
  if (percentUsed <= 75) return '#e08a3a'
  return '#d9534a'
}

// Light frosting: panels stay mostly solid so text is easy to read, with a hint of the scene showing through.
const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'dusk-shore', glass: { blur: 20, tint: '#201c18', opacity: 0.8 } },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const set = await $.theme.set(LOOK)

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }
    const usage = await $.session.usage()
    await update($, limits, () => usage.rateLimits)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, limits, () => e.rateLimits)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = (await read($, limits)).filter(limit => LABELS[limit.kind] !== undefined)

    if (e.props.hasSurvey || shown.length === 0) {
      return next(e)
    }

    const { Box, Progress } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" gap={2}>
        {shown.map(limit => (
          <Box flexGrow={1}>
            <Progress
              label={LABELS[limit.kind] ?? limit.kind}
              value={limit.percentUsed}
              max={100}
              valueText={`${Math.round(limit.percentUsed)}%`}
              color={meterColor(limit.percentUsed)}
            />
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return <Svg source={SCENE} alt="A dusk sky over warm sand, with a band of teal ocean along the bottom" />
  })
}
