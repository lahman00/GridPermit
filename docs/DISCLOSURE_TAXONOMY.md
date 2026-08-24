# Disclosure Taxonomy

Last reconciled: 2026-08-25

The exact, current disclosure sentences GridPermit is allowed to show for each verified partner state. Implemented in `src/lib/partners.ts` (`getDisclosureText`, `getCplDisclosureText`) so copy is generated from state, never hand-written per placement. Do not invent new wording; if a state genuinely needs new language, add it here and to the code in the same change.

## Partner relationship (untracked)

> "GridPermit has a partner relationship with {Partner}; this link is not currently tracked, and whether the partnership results in compensation to GridPermit has not yet been confirmed."

Used when: a real business relationship exists, but the link carries no tracking parameter and no compensation has been confirmed. This is EnergySage's disclosure today.

## Tracked, compensation unconfirmed

> "This link is tracked; whether it results in compensation to GridPermit has not yet been confirmed."

Used when: a real tracking mechanism exists (a tracked URL or a dedicated phone number) but no signed/confirmed compensation agreement exists yet.

## Approved, not yet live

> "GridPermit has an approved partnership with {Partner}; tracking is not yet live on this link."

Used when: status is `approved` and compensation is verified, but the link has not yet been switched to the live tracked URL (a transitional state between approval and go-live).

## Tracked affiliate (active)

> "This link may earn GridPermit a commission at no additional cost to you."

Used when: a partner is fully launch-ready (`isLaunchReady()` true), i.e. approved, tracked, placement-eligible, and deliberately launched.

## Pay-per-call

> "Calls may be recorded for quality and compliance purposes."

Used when: a pay-per-call CTA renders. This is the minimum disclosure; if DMM's final compliance package specifies additional required wording (e.g. state-specific consent language), that exact wording must be added here and to `PayPerCallCTA.astro` before launch, not approximated.

## Rules

- Never use "may earn a commission" language unless `compensationVerified` is true.
- Never omit the "has not yet been confirmed" qualifier while compensation is genuinely unconfirmed.
- Never invent consent or compliance language for pay-per-call ahead of DMM's actual final wording; use only the placeholder above until it arrives.
- Every disclosure string lives in exactly one place (`src/lib/partners.ts`); component templates render it, they never duplicate it as literal prose.
