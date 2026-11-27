# Coastline

A dark theme for the Claude desktop app, inspired by a beach at dusk.

- Warm dark-sand backgrounds with soft cream text instead of bright white
- A gold accent for links, buttons and highlights
- A still backdrop: a faint dusk glow along the top, even sand through the middle, and a gentle teal ocean glow along the bottom
- Lightly frosted panels, so the backdrop shows through without hurting readability
- Usage meters above the message box for your 5-hour and weekly limits, colored by how much you've used:

| Used | Color |
|---|---|
| 0–30% | Green |
| 31–55% | Yellow |
| 56–75% | Orange |
| Above 75% | Red |

Coastline is made for dark mode. In light mode the app keeps its normal look.

## Install

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `andrew-hanzhou-li/claude-coastline-theme`, then **Add plugin**.

At the prompt of a terminal session:

```
/plugin install coastline-theme --marketplace andrew-hanzhou-li/claude-coastline-theme
```

From a shell:

```bash
claude plugin install coastline-theme --marketplace andrew-hanzhou-li/claude-coastline-theme
```

New sessions pick up the theme automatically. Restart the app for sessions that are already open.

## Customize

Everything lives in `hooks/register.tsx`:

- **Colors:** the `makeColors({...})` call near the top sets the surfaces, text and accent colors.
- **Backdrop:** `SCENE` is the SVG drawn behind the conversation.
- **Glass:** `glass: { blur, tint, opacity }` controls how see-through the panels are.
- **Meter cutoffs:** `meterColor()` holds the 30 / 55 / 75 percent thresholds and their colors.

After a change, run `node --test` (Node 22.13 or later) to check the colors still build and the meter cutoffs still match the table above.

## Uninstall

```bash
claude plugin uninstall coastline-theme
```

## License

MIT. See [LICENSE](LICENSE).
