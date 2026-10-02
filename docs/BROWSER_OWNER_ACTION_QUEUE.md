# GridPermit Browser / Owner-Action Queue

Last reconciled: 2026-08-26

## Purpose

This file separates work that genuinely requires an authenticated browser or owner-controlled binding/tax/payment action from research, email, code and staging work that can continue autonomously.

A row in this file is not approval, advertiser acceptance or permission to enable production tracking. The canonical commercial state remains in `docs/MONETIZATION_CANONICAL_STATE.md` and `src/lib/partners.ts`.

## Authorized for browser execution now

### ALLPOWERS via CJ

- CJ advertiser ID: `7797916`
- Direct-confirmed baseline: 5% commission, 30-day attribution
- Direct-confirmed fit: international publisher with primarily U.S. organic-search/editorial traffic
- Manual approver: Bei Li
- Owner authorization: explicitly granted 2026-08-26 for submission after live-term review
- Gmail thread: `1a0359c5fa271aba`
- GitHub execution issue: see the dedicated authenticated-browser issue linked from issue #7

Execution:
1. verify advertiser identity in CJ
2. capture the live advertiser terms
3. stop only for a material conflict or unexpected fee, exclusivity, identity, tax, bank or other owner obligation
4. otherwise submit Apply/Join under the recorded authorization
5. send Bei the exact CJ publisher/account name after submission
6. record `pending_approval` only after submission is observable

Production remains fail-closed until approval plus a real attributable CJ link and deliberate placement review.

## Browser-ready but not owner-authorized by the ALLPOWERS approval

These are prepared routes, but the 2026-08-26 ALLPOWERS authorization must not be generalized to them.

| Program | Platform / identifier | Current verified baseline | Browser action still gated |
|---|---|---|---|
| EnergySage | CJ advertiser `5835771` | CJ publisher account active; no advertiser approval/link | Review live advertiser terms and obtain explicit submission authorization |
| Renogy | Impact | Direct-confirmed 6%, 27 days; organic/editorial and U.S.-audience international publisher accepted | Review live Impact/network + advertiser terms and obtain submission authorization |
| BougeRV | Impact | Direct-confirmed 7%; organic/editorial accepted | Review live terms and obtain submission authorization |
| LiTime | Impact | Direct-confirmed 5% starting rate, 30 days; editorial/SEO accepted | Review live terms and obtain submission authorization; send Elena the account name after submission |
| Duracell Portable Power Stations | Impact | Public at least 5%; publisher/content route verified | Review live terms; international eligibility and attribution still unconfirmed |
| Goal Zero | Partnerize | Public up to 10%, 30 days | Binding agreement plus tax/payment fields require owner-controlled completion |
| Digital Master Media | Direct publisher application | Public up to $53/call is not GridPermit-specific | Binding signature/application; exact SEO buffer and campaign economics still need capture |

## Tax / payment documents

- CompareSolarPrices: W-8BEN requested for file but is not a launch blocker.
- Lead Smart: W-8 required, but do not provide it until current Solar coverage, payout, hours and billable criteria are concrete enough to evaluate.
- Never fabricate, pre-sign or submit tax, identity, bank or payment information.

## Browser-session evidence checklist

For every network/advertiser join, preserve enough evidence to reconcile the ledger without guessing:

1. advertiser identity and program ID
2. displayed commission / payable action
3. attribution window
4. allowed traffic and prohibited methods
5. geography and product exclusions
6. returns, reversals and lock period
7. disclosure / creative approval obligations
8. payment, tax, certification or identity requirements
9. submission confirmation and exact account name
10. approval/rejection status and issued tracking asset

## Production rule

No application, approval email or visible advertiser relationship is enough by itself. Production requires:

- real approval or documented direct relationship
- real attributable tracking asset
- reviewed eligibility and promotional restrictions
- truthful disclosure
- deliberate `trackingEnabled`, `placementEligible` and `launchEnabled` changes
- fail-closed geography and page-type routing
