# GridPermit design system

The site uses one "architectural editorial" system (`data-gridpermit-design="architectural-20261004"`), defined in `src/styles/global.css` and loaded on every page through `DesignHead.astro` or `BaseHead.astro`. This file records its rules so new work stays consistent. It does not change the brand: same palette, type, grid lines and 2px corners.

## Principles

- Facts first: official sources, dates and confidence are shown next to the claim they support. Visual design never implies certainty the record does not have.
- Open rows and hairlines, not stacks of raised cards. One accent color, used for the primary action and small markers.
- Every interactive state is visible: hover, keyboard focus, loading, empty, error and success.
- Motion explains a change (a result appeared, a field needs fixing). It is never decoration, and it is removed for reduced-motion users.

## Tokens

All colors come from tokens that switch with the theme (`:root` is dark, `:root[data-theme='light']` is light). Do not hard-code hex values in components.

| Token | Use |
| --- | --- |
| `--gp-bg`, `--gp-surface`, `--gp-surface-hover` | Page, panel and hover backgrounds |
| `--gp-ink`, `--gp-muted` | Body text and secondary text (both pass WCAG AA on bg and surface) |
| `--gp-line` | Hairline borders and dividers |
| `--gp-accent`, `--gp-accent-ink` | Primary action fill and its text (AA in both themes; guarded by `tests/permit-path-organizer-cta-contrast.test.mjs`) |
| `--gp-focus` | Keyboard focus ring |
| `--gp-ok`, `--gp-warn`, `--gp-danger` | Status and validation (light: 6.0, 5.9 and 7.3:1 on the page background) |
| `--gp-font`, `--gp-mono` | Text and the small uppercase "kicker" labels |
| `--gp-width`, `--gp-gutter` | Container width and side padding |

Spacing follows an 8px grid: `--gp-space-half` (4px), `--gp-space-1` (8px), `-2` (16), `-3` (24), `-4` (32), `-5` (40), `-6` (48), `-8` (64), `-10` (80). Older rules contain off-grid values; replace them with tokens when a component is edited for another reason, not in bulk.

Type: headings are light weight with tight tracking (`h1` clamps 40 to 76px). Body is 17px/1.65. Labels and metadata use `.gp-kicker` (mono, 11px, uppercase). Never set body text below 12px.

## Components

- Primary action: `.gp-button` (accent fill). Secondary: `.gp-button-quiet`. Inline navigation: `.gp-text-link` with a trailing arrow. Targets are at least 44px high.
- External destinations say so before the click, for example the organizer buy link is described by "Checkout opens on Whop" and shows an arrow.
- Location context: `.breadcrumb-nav` (Home / Section / Page) instead of ad hoc back links.
- Header: four links below 1100px, five from 1100px (the Permit checker joins). Locality pages add a header call to action, and it must never wrap; check 761 to 1440px on an Escondido, Fresno and Austin guide after any header change.
- Panels: `.fact-callout` or a 1px `--gp-line` border on `--gp-surface`. Commercial partner boxes keep their existing selectors and disclosures; their markup is protected by the release-preservation and partner-health gates and must not be restyled without rerunning them.
- Form fields: visible `<label>`; groups use `<fieldset>`/`<legend>`. Validation messages sit directly under the field in `.gp-field-error` with `role="alert"`, the field gets `aria-invalid="true"` and `aria-describedby` pointing at the message. Clear the message when the field changes.

## States

| State | Pattern |
| --- | --- |
| Empty | Dashed `--gp-line` box explaining what to do first (`.result-empty`) |
| Loading | Same box, solid border, short text, `aria-busy="true"` on the region |
| Error | `.status.caution` with `role="alert"` and a concrete next step |
| Success | `.status.good`, announced through a polite status region; focus moves to the result heading |

## Motion

- Global rule: `prefers-reduced-motion: reduce` collapses all transitions and animations.
- Transitions come from transitions.dev snippets, installed per snippet in `global.css` with their own reduced-motion guards: panel reveal (`.t-panel-slide`, used for Permit Path results, 12px travel) and error state shake (`.t-input.is-shaking`, used for the locality field). Two deliberate deviations: the snippet's auto-hiding error message is not used (validation messages stay until the field is fixed), and the resting panel drops `filter` and `will-change` (only `.is-revealing` sets the hint) with a print override, because a resting filter turned printed results into images without selectable text or links.
- Durations: 150 to 250ms for hover and state changes, 400ms for a panel reveal. Do not add an animation library.

## Accessibility checklist for any UI change

1. Keyboard: every control reachable, visible focus, logical order, Escape closes menus.
2. Contrast: text 4.5:1, large text and UI parts 3:1, in both themes.
3. Errors next to the field, in text, not color alone.
4. Status changes announced once (status region), focus moved only when the user asked for the change.
5. Check desktop (1440), tablet (834) and phone (390) widths with no horizontal scroll.
6. Run `npm test`, `npx astro check`, `npm run build`, `npm run seo-check` and `npm run partner-health -- --out <dir>` before review.
