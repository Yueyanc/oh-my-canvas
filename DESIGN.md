# Design

## Visual Theme

Information Radar uses a restrained product UI theme: warm light canvas, soft surfaces, muted borders, compact cards, and one primary accent. The design should preserve the current calm operational feel rather than becoming illustrative or promotional.

## Color

The active palette is token-driven through `apps/web/src/styles.css`.

- Canvas: warm off-white / muted sage neutrals.
- Surface: near-white panels with subtle warm tint.
- Text: dark olive-neutral ink, softened secondary text, muted metadata.
- Accent: primary/accent token only for active states, top ranks, icons, focus, and primary actions.
- Errors: destructive token with low-opacity background.

Use color sparingly. Source ranking cards should not become platform-colored unless that color directly improves recognition without hurting scan speed.

## Typography

Use the existing sans stack and app font preference system. Keep product typography compact:

- Page title: around 28-30px, semibold.
- Section and card titles: around 15-16px, semibold.
- Row titles: around 13-14px, medium.
- Metadata and chips: around 11-12px.
- Numeric ranking and score values use tabular figures.

Hierarchy should come from weight, spacing, and tone, not oversized display type.

## Layout

The overview page structure is fixed:

1. Top orientation row with page title, status pills, and refresh action.
2. Source/category ranking grid.
3. Global ranking and latest collection status.

The source/category ranking grid is the primary surface. Cards should feel aligned and scannable, with consistent row rhythm and stable rank/score columns.

## Components

- Ranking cards: soft surface, subtle border, compact header, list rows, footer metadata.
- Ranking rows: rank marker, title/metadata, score column, clear hover/focus affordance.
- Metric pills: compact status indicators, not dominant KPI tiles.
- Collector status: secondary operational context.
- Empty states: calm dashed panels with direct explanatory copy.

## Motion

Motion is quiet and state-driven:

- Hover transitions use 180-250ms ease-out curves.
- Avoid large vertical movement and dramatic shadow jumps.
- Row hover may tint background and reveal the external-link icon.
- Refresh icon may spin only while loading.
- Respect reduced-motion expectations by keeping movement small.

## Responsive

Cards collapse through existing grid breakpoints. Text truncates inside rows, score columns remain stable, and touch targets remain comfortable on narrow screens. The primary source/category ranking order must remain before global ranking on all breakpoints.
