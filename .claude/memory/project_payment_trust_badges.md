---
name: project_payment_trust_badges
description: "Payment-page credibility badges — research + recommendations (which seals convert, PCI-logo entitlement constraint, what to get from the QSA vendor)"
metadata: 
  node_type: memory
  type: project
  originSessionId: a30cdc08-f0c0-401c-a086-f4170eba2f74
---

**Task (owner 2026-08-14):** add real credibility badges (security/PCI/guarantee) to the payment page. We ARE PCI audited; owner getting the certifying vendor (QSA) details. Research done; implementation pending the vendor seal + owner assets.

**Current state (the gap):** `PaymentPage.js` has only EMOJI/text badges — trust row "🔒 256-bit SSL · ✓ PCI Compliant · 🔐 Encrypted" (~line 1393) + a "Why people trust us" card (~1444: data-never-sold / 3M+ members / live support). Evidence says these vague self-made badges are the WORST-performing kind and an outdated "PCI Compliant" text can *raise* perceived risk. Upgrade to recognizable marks + a real guarantee.

**Evidence-based priority (Baymard 2022 seal survey n=3,516; CXL; 2024–25 A/B aggregates):**
1. **Money-back / cancellation GUARANTEE badge = highest leverage** (outperforms an SSL seal ~2–3× in A/B tests). We already have "100% hassle-free cancellation" copy — elevate it to a visual badge. Category fit: people-search subscription = high trust-anxiety, first-time buyers (Baymard: 25% of first-time-brand buyers abandon on card-trust) → badges matter MORE for us than average.
2. **Recognized third-party security seal** — Norton ranked #1 every Baymard survey for a decade (35.4%), then Google Trusted Store (20.9%), BBB (15.7%), McAfee (12.8%). Adding a Norton mark lifted CR +12.2% / revenue +16.6% in one CXL-cited test. ⚠️ **These are PAID subscription programs and several rebranded:** McAfee SECURE retired 2021 → **TrustedSite**; classic **Norton Secured Seal is being retired → DigiCert "Smart Seal"** (bundled with DigiCert Secure Site SSL). So the obtainable modern seals = TrustedSite or DigiCert Smart Seal (require signup/$$), not the legacy logos.
3. **Card-network logos** (Visa/Mastercard/Amex/Discover) — free, set expectations + add baseline trust. We already detect card type; show the accepted-cards row.
4. **Industry certification** where relevant (+up to 30% in safety/finance verticals per Econsultancy).

**⚠️ PCI-LOGO ENTITLEMENT CONSTRAINT (important, non-obvious):** You may NOT display the official PCI SSC / PCI-DSS logo unless you are a QSA firm. Being PCI-*compliant* does not grant logo rights. Correct move: use the **QSA's own seal** and/or **link to your Attestation of Compliance (AoC)** — i.e. whatever the certifying vendor provides. So what to get from the vendor = (a) their branded seal image/embed script, (b) a verification/AoC link, (c) written OK to display their mark. Generic "PCI Compliant" text with no vendor backing is both weak AND borderline-misleading.

**Rules:** max ~4 badges in one cluster (more reads as anxious clutter); place them immediately adjacent to the CTA / card field (Baymard: SSL-style seal near the pay button is the single most influential element); keep them current-looking.

**Recommended set for us:** (1) Cancellation/guarantee badge, (2) the QSA's PCI seal (→ AoC link) once vendor supplies it, (3) accepted-card logos, (4) a "Secure / encrypted checkout" mark — ideally the SSL provider's real seal (DigiCert Smart Seal if we buy DigiCert; else a clean lock+"SSL Secured" that isn't emoji). Drop the third emoji. Optionally the recognized third-party seal (TrustedSite) if owner wants to pay for the recognition lift.

**Our PCI audit sources (owner 2026-08-14): TWO — (1) TRX Services (trxservices.com), (2) Celero Commerce.** These are our acquirers/processors, not consumer-recognized seal brands (so their logos carry little of the Norton/TrustedSite recognition lift). Findings:
- **TRX Services** = **PCI DSS 4.0 certified**; offers a **Hosted Pay Page** where TRX handles sensitive card data → shifts PCI burden off us (SAQ-A-style scope). If the consumer checkout routes card entry through TRX's hosted page, TRX is the certified party and we can likely show "Payments secured by TRX Services · PCI DSS 4.0" (with their permission).
- **Celero Commerce** = sells a **PCI Security Bundle**; their compliance/attestation is typically run through a partner ASV (SecurityMetrics / Trustwave / Aperia-class) that issues a verifiable seal + AoC — that partner's seal is the displayable, entitlement-safe mark.
- ⚠️ Two audits likely = two processing paths / merchant accounts. **The badge must reflect the vendor covering the CONSUMER checkout flow.** OPEN QUESTION for owner: which processor does the consumer PaymentPage route through (BC→TRX? BC→Celero? TRX Hosted Pay Page directly?), and which of the two audits covers THAT flow? That determines which seal we're entitled to show.
- Ask each vendor for: their branded PCI seal (image/embed) + a verification/AoC link + written OK to display. Prefer the one whose seal is verifiable + covers the consumer flow. Recognition lift still comes mainly from the guarantee badge + accepted-card logos (+ optional TrustedSite), NOT the processor logo.

⚠️ **REALITY CHECK — our consumer PaymentPage collects the RAW PAN** in its own React form (`form.cardNumber`/detectCardType/luhnCheck at ~L32–83, submitted via BC `billing.sale`), NOT a hosted iframe / TRX Hosted Pay Page. So (1) our page IS in PCI scope (SAQ A-EP / D) — we CANNOT use TRX's "card data never touches us" framing; any seal must match the reality that we capture the PAN then pass to BC→acquirer. (2) Bigger win worth flagging separately: switching card entry to a TRX hosted/tokenized field would BOTH cut PCI scope AND let us truthfully display TRX's PCI-4.0-certified seal — product/security call, not part of the badge task.

**Status:** recommendations delivered; awaiting (a) which vendor covers the consumer checkout, (b) the vendor seal/AoC assets. Can build the visual badge row now with placeholder SVGs and swap in the real vendor seal when provided. Ties to [[project_payment_ux_research]] (existing payment-page patterns). Note: earlier assumed processor = BC/ByteCrtrs billing (card tokenized via BC commerceTokens); reconcile with TRX/Celero — BC may front TRX/Celero as the acquirer.
</content>
</invoke>
