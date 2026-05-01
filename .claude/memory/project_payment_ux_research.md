---
name: Payment Page UX Research — Competitor Analysis
description: Designer research on best-in-breed payment/checkout patterns for subscription SaaS and people-search services. Actionable recommendations implemented in PaymentPage.
type: project
---

# Payment Page UX Research (2026-03-16)
Source: Designer agent analysis of BeenVerified, TruthFinder, Spokeo, Stripe, Paddle patterns.

**Why:** Conversion uplift sprint for the payment page — the last step before a visitor becomes a paying subscriber.
**How to apply:** Already implemented. Use as reference if PaymentPage is modified.

## Implemented Changes
- Two-column layout: form left (full width mobile), sticky order summary right
- Person preview banner above form when selectedPerson is present
- Card type detection (Visa/MC/Amex/Discover pill) as user types
- Real-time field validation with ✓/✗ indicators (after first touch)
- Luhn check for card number validation
- Collapsible billing address (default: hidden, "uses address on file")
- CTA text: "Unlock Report — $29.99/mo" (when person) / "Subscribe Now — $29.99/mo"
- Reassurance copy: "No lock-in. Cancel anytime." above billing note
- Order summary with plan features checklist + gradient header
- Trust section: FCRA-compliant, SSL, PCI, "data never sold"
- Spinner + "Processing…" during submission
- Error box with red icon, specific title, retry guidance

## Key UX Principles Applied
- Show value first (order summary + person preview) before asking for payment
- Reduce friction (collapsible billing address, autocomplete attributes)
- Benefit-focused CTA (not "Pay" or "Submit")
- Trust specificity (FCRA-compliant, not generic "we protect your data")
- No countdown timers / false urgency (dark pattern)
