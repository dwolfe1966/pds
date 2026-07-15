# Lightweight Identity Verification — Comparison & Recommendation

**Status:** Forward research (NOT a launch blocker). Written 2026-07-15.
**Context:** We are building an "Identity" product where a member maps to their own public record. We want lightweight identity verification that **we run ourselves** (not via ByteCrtrs/BC, our data-layer vendor). This doc compares options and recommends a phased path.

---

## 1. Exec summary + phased recommendation

**The core insight:** For our use case (a member proving "this public record is actually me"), we already hold the record we want to match against. That changes the economics. We don't need a full KYC/AML identity-proofing stack — we need to bind a claimed record to a person with *some* friction and *some* signal. The cheapest genuinely-useful step is to **parse the barcode/MRZ off a government ID and field-match it against the mapped record** — this is nearly free, runs client-side, and gives us real name/DOB/address/DL-number fields to compare. It does **not** prove the document is authentic or that a live human presented it, but it is a large step up from "click to claim."

Recommended phases:

- **Phase 0 (now, ~free): Barcode/MRZ field-match.** Client-side scan of a US driver's license PDF417 barcode (and/or passport MRZ), parse AAMVA/ICAO fields, match name + DOB + address against the record we already mapped. Uses OSS only (zxing-js / a PDF417 SDK + an AAMVA parser; a MRZ parser for passports). Zero per-verification cost, no PII leaves our infra if we parse in the browser. This is the "cheapest genuinely-useful lightweight step now."
  - **Limitation to state plainly:** barcode parse ≠ authenticity. A barcode can be hand-crafted with any values, and a photo of someone else's real license still parses. It is a matching + friction signal, not proof of identity.

- **Phase 0.5 (optional, cheap add-on): DIY KBA as a *second* friction factor.** Generate a short quiz from record data (prior cities, a relative's first name, an approximate age). Useful as a lightweight bot/casual-fraud deterrent layered on Phase 0. **Do not treat it as proof** — see §4; the decoys and answers come from the same public data an attacker can look up.

- **Phase 1 (adopt when we need real assurance, ~$0.50–$1.50/verification): a self-serve commercial doc-verification provider.** When we need document *authenticity* + *face match/liveness* (e.g., before we let a member unlock or alter sensitive record content, or for a trust badge), turn on a usage-based, self-serve provider with a hosted flow. Best current fits on price + self-serve + US coverage: **Stripe Identity** ($1.50/verification, first 50 free, trivial integration if we're already on Stripe — and we run billing through Stripe/BC commerce), **Veriff** (~$0.80 self-serve), or **iDenfy** (~$0.50–$1.35). Hosted flow keeps the document image and biometric off our servers.

- **Later / higher-assurance (only if a regulatory or high-value need appears):** enterprise providers (Jumio, Socure ID+, Persona at full config, Onfido/Entrust) or database + KBV identity proofing (LexisNexis, IDology). These are sales-led, pricier, and overkill for "member claims their own record." Revisit only if we add money movement, regulated data, or a legal must-verify.

**Bottom line:** Ship Phase 0 (OSS barcode/MRZ match) as the lightweight step. Keep Stripe Identity / Veriff / iDenfy on the shelf as the drop-in for when we genuinely need authenticity + liveness. Skip enterprise KYC and commercial KBA unless a specific compliance need forces it.

---

## 2. Commercial document-verification services — comparison

*Per-verification figures are indicative — several come from third-party comparison roundups, not vendor pricing pages, and self-serve vs. enterprise rates differ. Confirm with vendors at contract time.*

| Service | What it verifies | Pricing (public) | Self-serve / API | Integration | Notes on PII/residency |
|---|---|---|---|---|---|
| **Stripe Identity** | Doc authenticity, data extraction, selfie face-match + liveness | **$1.50/verification** (first 50 free) | Yes, fully self-serve | Easiest if already on Stripe; hosted verification flow (redirect) or embedded; also API/SDK | Stripe hosts the flow; images/biometrics stay in Stripe. US + intl doc support. |
| **Veriff** | Doc authenticity, face match, liveness | **~$0.80/verification** (self-serve entry) | Yes, self-serve tier | SDK (web/mobile) + API; hosted flow available | EU-headquartered; data-residency options; strong on liveness. |
| **iDenfy** | Doc verification, face match, liveness; optional manual review | **~$0.50–$1.35/verification**; manual review $0.35–$0.55; "pay per approved" or "pay per completed" | Yes | SDK + API + hosted | Lithuania/EU; flexible pay-per-approved model is cost-friendly for low volume. |
| **Vouched** | Doc verification, face match, liveness | **$300/mo + $0.75/transaction** | Yes | API/SDK | US-focused; monthly floor makes it pricier at low volume. |
| **Persona** | Doc, selfie/liveness, database checks, orchestration/workflows | **~$2–$5/verification** (config-dependent); free tier exists | Self-serve start, scales to enterprise | Hosted "Inquiry" flow + API; very configurable | US; strong orchestration; can get expensive at full config. |
| **Onfido** (now **Entrust IDV**) | Doc authenticity, biometric/liveness, since acquiring **Airside/Berbix** adds reusable ID | **~$2–$5/verification**, sales-led; **pay-per-attempt** (billed even on drop-offs/fails) | Sales-led | SDK + API | Enterprise contracts; pay-per-attempt inflates real cost. Airside (ex-Berbix) folded in for "verify once, share anywhere." |
| **Jumio** | Doc, biometric/liveness, AML/KYC suite | **Not published**; enterprise annual deals commonly **$50k–$200k+** | Sales-led | SDK + API | Enterprise KYC/AML; overkill + expensive for us. |
| **Socure** | ID+, DocV (document), fraud/risk, watchlist | Sales-led + volume tiers; **"Socure Launch"** self-serve with **$1,000/mo free credits**, no contract | Self-serve tier now exists (Launch) | API | US-centric, strong fraud analytics; DocV module for docs. Worth a look if we ever want fraud scoring too. |
| **Microblink / BlinkID** | **Data extraction + on-device doc scanning SDK** (parses AAMVA barcode, MRZ, VIZ). *Not* an authenticity/liveness verdict by itself | Not published; custom license + 30-day trial | SDK (Web/WASM, iOS, Android, RN, Flutter) | SDK you embed; runs on-device | **On-device parsing → no image leaves the client.** This is the commercial upgrade path from OSS Phase 0: far better capture/parse accuracy than zxing-js, still a data-extraction tool not a verifier. |
| **AWS Rekognition-based DIY** | Face compare (`CompareFaces`) + liveness (`FaceLivenessSession`); OCR via Textract; **you build the doc-auth logic yourself** | Pay-per-API-call (fractions of a cent to low cents per call) | Yes, raw AWS APIs | High — you assemble the flow; no turnkey "verify a license" verdict | Stays in your AWS account/region (data-residency control), but you own all the glue and the authenticity heuristics. Only worth it if we want deep control. |

**Reading the table for our case:** If/when we need real authenticity + liveness, **Stripe Identity** (simplest, transparent $1.50, free tier) or **Veriff/iDenfy** (cheaper per-unit) are the self-serve sweet spot. **Microblink BlinkID** is the natural *on-device* upgrade from the OSS Phase-0 parse if capture quality is the pain point but we don't yet want a full verifier. Enterprise (Jumio, Onfido/Entrust, Socure full) is out of scope unless a compliance need appears.

---

## 3. OSS / self-hostable options

These cover **capture + parse + field-match** (Phase 0). None of them establish document authenticity or liveness — that is the commercial gap.

**US driver's license — PDF417 barcode (AAMVA):**
US/Canada driver's licenses carry a **PDF417 barcode on the back** encoding AAMVA-standard fields via subfile elements: `DAC`/`DCS` (first/last name), `DBB` (DOB), `DAG`/`DAI`/`DAJ`/`DAK` (address), `DAQ` (DL number), `DBA` (expiry), etc. Two steps: (1) decode the PDF417 to a raw string, (2) parse the AAMVA element codes into fields.

- **Decoders (step 1):**
  - **`@zxing/library` (zxing-js)** — TypeScript port of ZXing; provides `BrowserPDF417Reader`. Free, browser-native. Caveat: PDF417 decoding from live video / angled / low-quality license barcodes can be flaky; works best on a good still image.
  - **`js-zxing-pdf417` (PeculiarVentures)** — focused JS port of just the ZXing PDF417 detector/decoder; can be more robust for PDF417 specifically.
  - **ZXing (Java)** or **ZXing C++** — if we ever want a server-side/self-hosted decode service instead of browser.
  - *(Commercial fallback for capture quality: Dynamsoft, Scandit, STRICH, Microblink — not OSS, but far better real-world PDF417 capture.)*
- **AAMVA parsers (step 2):**
  - **`parse-usdl`** (npm) — parses US DL PDF417 payload into fields. Mature but last published ~4 years ago; may lag newest AAMVA versions.
  - **`aamva-parser`** (npm) — TypeScript, zero-dependency, claims AAMVA versions 1–12 (CDS 2000–2025). Better-maintained choice today.
  - Reference implementations in other languages: `c0shea/IdParser` (C#), `ksoftllc/license-parser`, `joptimus/aamva-parser`.

**Passport (and many national IDs) — MRZ (ICAO Doc 9303):**
The **machine-readable zone** is standardized by ICAO Doc 9303, printed in **OCR-B**, using only `A–Z`, `0–9`, `<`. Formats: **TD3** (passports, 2×44), **TD1** (ID cards, 3×30), **TD2** (2×36). Two steps: OCR the MRZ text, then parse/validate it (each field has a check digit).

- **OCR (step 1):**
  - **`tesseract.js`** — WASM Tesseract in-browser. The default English model is poor on OCR-B MRZ; needs a **custom MRZ-trained model** (community models exist) for usable accuracy.
  - **`PassportEye`** (Python) — end-to-end MRZ extraction via Tesseract; ~80% recall when a clear MRZ is present. Good for a self-hosted Python service, not browser.
- **Parse/validate (step 2):**
  - **`mrz`** (npm) — parses & validates TD1/TD2/TD3 strings, checks check digits. Pair with tesseract.js output.
  - **`mrz-scanner`** (PWA reference) and various DEV/Medium walkthroughs show a full browser pipeline (camera → tesseract custom model → `mrz` parse) with **no server**.

**Liveness / face-match (OSS):**
Weak here. Options like face-recognition libs (e.g., `face-api.js`, `dlib`/`face_recognition`) can do a *face compare* between the ID portrait and a selfie, but **OSS liveness (anti-spoofing) is not production-grade** — presentation-attack detection is exactly what the commercial vendors sell. If we need liveness, buy it (Phase 1); don't self-build.

**What OSS does and does NOT do:**
- **Does:** decode the barcode/MRZ, extract structured fields, let us match name/DOB/address/ID-number against the record we mapped, all client-side and free.
- **Does NOT:** confirm the document is genuine (not forged/edited), confirm the presenter is the document holder, or detect a photo-of-a-photo / screen replay. Barcode/MRZ parse is a **matching + friction** mechanism, not identity proof.

---

## 4. KBA (knowledge-based verification) — analysis + the security caveat

**What it is:** generate quiz questions from record data — prior addresses/cities, relatives' names, past employers, approximate age, associated phone — with plausible decoys, and ask the claimant to pick the correct ones.

**The assurance limitation (state this plainly):**
KBA built from **public-record data is low-assurance because the decoys and the correct answers are drawn from the same data an attacker can look up.** Our own product — and every competitor (Spokeo, BeenVerified, etc.) — *sells* exactly this data. Anyone who can pull a report on the target can answer the quiz. So DIY KBA over public records proves "the claimant can access the same public data we can," not "the claimant is the person."

This is not just our opinion — it tracks the standards:
- **NIST SP 800-63** removed KBA as an acceptable **authenticator** (formerly a "pre-registered knowledge token"): the answers are too discoverable and the choice space too small, giving "unacceptably high risk of successful use by an attacker."
- KBA's cousin, **KBV**, is still *permitted* for **identity resolution and, with restrictions, remote proofing** — but NIST explicitly treats KBA/knowledge as **public information** and imposes stringent conditions. It's a starting point, not verification on its own.

**Where DIY KBA is still useful for us:**
- As **lightweight friction / a signal**, not proof: deters bots and casual/opportunistic claims, adds a step that a drive-by attacker may not bother with.
- As a **second factor layered on Phase 0** (barcode match): "matched the ID fields *and* passed a 3-question quiz" is a better composite signal than either alone.
- For **UX warmth / engagement**: the quiz doubles as a "we found this about you — is this right?" confirmation moment that also lets the member correct/curate their record.
- **Design guards if we build it:** time-limit answers, limit attempts, randomize/rotate questions, prefer facts that are *less* trivially searchable, never gate anything truly sensitive on KBA alone, and never present it to the user as "verified."

**Commercial KBA** (brief): **LexisNexis** and **IDology** offer database-backed KBV/"out-of-wallet" quizzes at higher assurance (broader, fresher, less-public data sources) — but it's sales-led, adds per-check cost, and inherits the same fundamental critique for anything genuinely public. Our interest is the **DIY** version as friction, not the commercial product.

---

## 5. Privacy / PII considerations — what data leaves our infra, per option

| Option | Where processing happens | What leaves our infra | Notes |
|---|---|---|---|
| **OSS barcode/MRZ parse in the browser** (Phase 0) | Client device (zxing-js / tesseract.js / parsers all run client-side) | **Nothing** — the ID image and parsed fields need never hit our servers if we do the field-match client-side or send only a pass/fail boolean | Best privacy posture. If we send parsed fields to our server to match, we now hold ID-derived PII (name/DOB/DL#) — treat as sensitive, minimize + short-retain. **Never store the raw DL number / full barcode payload** unless there's a clear need; it's high-value PII. |
| **Microblink BlinkID SDK** | On-device (WASM/native) | Nothing (parse is on-device); we choose what, if anything, to transmit | Same on-device privacy benefit as OSS, better accuracy; commercial license. |
| **DIY KBA** | Our infra (we generate from record data we already have) | Nothing new leaves — but we are now *using* the person's record data to quiz them; log answers minimally | We already hold this data; the marginal privacy cost is low. Don't log raw wrong-answer patterns longer than needed. |
| **Stripe Identity / Veriff / iDenfy / Vouched / Persona (hosted flow)** | Vendor's infra | **The ID image + selfie/biometric go to the vendor**, not us; we typically receive only extracted fields + a verdict | Offloads the sensitive biometric/image storage to a vendor with a compliance posture — often *better* for us than holding it. Check data-residency (Stripe/US, Veriff/iDenfy EU-based with residency options) and DPA terms. We become a data controller; vendor is processor. |
| **AWS Rekognition/Textract DIY** | Our AWS account | Stays in our AWS region if configured so | Max control + residency, but **we** then store/handle the raw ID image and face data — highest self-imposed PII burden and liability. |
| **Enterprise (Jumio/Socure/Onfido)** | Vendor infra | Image + biometric + often database-check inputs | Heaviest data sharing; only justified by a real KYC/AML need. |

**General principles for whatever we ship:** minimize collection (prefer a pass/fail boolean over storing fields), keep raw ID images/biometrics off our servers (client-side parse or vendor-hosted flow), never persist the full PDF417 payload or DL number without a documented need, short retention windows, and be explicit to the member about what we scan and that we don't store the image. Because we ourselves are a people-search product, holding additional raw ID PII raises our own breach blast-radius — the OSS client-side-only path avoids that entirely.

---

## Sources

- [Stripe Identity pricing](https://stripe.com/identity) · [Stripe Identity billing](https://support.stripe.com/questions/billing-for-stripe-identity)
- [Veriff / Onfido / Jumio pricing comparison](https://didit.me/blog/top-10-kyc-providers-in-2026-features-pricing-comparison/) · [Sumsub vs Onfido vs Jumio vs Veriff](https://tech-insider.org/igt-sumsub-vs-onfido-vs-jumio-vs-veriff-for-igaming-kyc-202-en-d181/)
- [iDenfy pricing](https://idenfy.com/pricing-plans-v3/) · [Vouched pricing](https://www.vouched.id/identityverificationpricing)
- [Persona vs Entrust/Onfido (deepidv)](https://www.deepidv.com/media/articles/persona-vs-entrust-idv-onfido-comparison-2026)
- [Socure Launch (self-serve)](https://www.socure.com/launch) · [Socure DocV](https://www.socure.com/products/document-verification)
- [Onfido acquires Airside (Entrust)](https://www.entrust.com/company/newsroom/onfido-acquires-airside)
- [Microblink BlinkID document scanner SDK](https://microblink.com/identity/document-scanner-sdk/) · [BlinkID in-browser SDK (npm)](https://www.npmjs.com/package/@microblink/blinkid-in-browser-sdk)
- [parse-usdl (npm)](https://www.npmjs.com/package/parse-usdl) · [aamva-parser](https://app.unpkg.com/aamva-parser@1.3.0/files/README.md)
- [zxing-js PDF417 example](https://zxing-js.github.io/library/examples/pdf417-image/) · [js-zxing-pdf417 (PeculiarVentures)](https://github.com/PeculiarVentures/js-zxing-pdf417)
- [PassportEye](https://github.com/konstantint/PassportEye) · [mrz-scanner PWA](https://github.com/uwolfer/mrz-scanner) · [MRZ via tesseract.js](https://medium.com/@ilhan.negis/browser-based-passport-mrz-reader-with-tesseract-js-c9c04c98168a)
- [NIST SP 800-63-4 (KBA/KBV)](https://pages.nist.gov/800-63-4/sp800-63b.html) · [NIST 800-63 FAQ](https://pages.nist.gov/800-63-FAQ/)
