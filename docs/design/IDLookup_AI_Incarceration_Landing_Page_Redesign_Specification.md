# IDLookup.AI Incarceration Landing Page Redesign Specification

## Objective

Transform the landing page from a generic search form into a high-conversion, emotionally-aware experience optimized for Google Search Ads traffic. Visitors arrive with high intent, often motivated by fear, concern, urgency, curiosity, or legal necessity. The design should acknowledge these emotions while establishing trust and making the path to search obvious.

---

# Guiding Design Principles

1. Design for emotional intent rather than utility.
2. Build trust before requesting action.
3. Reduce cognitive load and friction.
4. Emphasize reassurance, legitimacy, and privacy.
5. Keep the primary call-to-action visually dominant.

---

# User Psychology

Typical visitor motivations include:

- Looking for a recently arrested family member
- Trying to locate a missing friend
- Checking whether someone is incarcerated
- Researching a former partner
- Investigating a legal matter
- Confirming custody status

The visitor is not asking for a search form.

They are asking:

> "Can this website answer the question that brought me here?"

The interface should answer that question before asking for input.

---

# Current Experience Assessment

| Area | Score |
|------|------:|
| Visual Design | 8.5/10 |
| Trust | 6/10 |
| Emotional Connection | 4/10 |
| Clarity | 8/10 |
| Motivation | 5/10 |
| Conversion Potential | 6.5/10 |

The current experience resembles a SaaS application rather than an emotionally-driven landing page.

---

# Hero Section

## Remove

Remove the existing banner:

> IDLookup.AI — Find Anyone, Anytime

This message is generic and does not reinforce the visitor's search intent.

---

## Replace With

### Headline

# Find Someone in Jail or Prison

### Supporting Copy

Search current and historical incarceration records from correctional facilities and public-record sources.

### Trust Statement

Private searches • No one is notified • Results in seconds

---

# Search Card

Increase padding and visual emphasis.

Increase title size and weight.

Replace emoji bullets with consistent SVG icons.

Replace copy with:

- Find current facility
- View booking information
- Check custody status
- See release information (when available)
- Search historical incarceration records

---

# Form Simplification

Show only:

- First Name
- Last Name

Move Middle Name into an expandable Advanced Search section.

Placeholder examples:

First Name

John

Last Name

Smith

---

# Value Preview

Move the "What You'll Find" section ABOVE the Search button.

Display as chips or icon cards.

Suggested items:

- Current Facility
- Booking Date
- Charges
- Custody Status
- Release Information
- Previous Facilities
- Mugshot (where available)

---

# Primary CTA

Replace:

Search

with

Search Incarceration Records

(or "Find Records" if width constrained)

Button requirements:

- Full width
- 56–60px height
- Highest visual contrast on page
- Strong hover state
- Slight shadow/elevation

---

# Trust Block

Directly beneath the CTA:

Searches public records only.

No one is notified that you searched.

Typical search completes in under 10 seconds.

---

# Social Proof

Insert beneath the search card:

Used by families, attorneys, journalists, and concerned individuals to locate incarceration records.

Avoid unsupported quantitative claims.

---

# Navigation

Desktop

- Logo
- Privacy
- Support
- Menu

Remove:

- Login
- Sign Up

Mobile

- Logo
- Hamburger menu only

---

# Footer

Reduce footer height substantially.

Retain only:

- Privacy Policy
- Terms
- Contact
- Support

---

# Visual Hierarchy

Recommended reading order:

1. Headline
2. Supporting copy
3. Trust statement
4. Benefits
5. Search form
6. Value preview
7. CTA
8. Trust block
9. Social proof

---

# Color and Contrast

Maintain the existing green brand color.

Increase CTA prominence by:

- Brighter accent
- Larger button
- Elevated shadow
- Increased spacing around CTA

---

# White Space

Reduce excessive vertical spacing.

Compress hero spacing by approximately 20%.

Ensure CTA remains above the fold on standard laptop resolutions.

---

# Microcopy

Below the CTA include:

- Searches public records only.
- No one is notified.
- Typical search completes in under 10 seconds.

These statements reduce hesitation and improve trust.

---

# Accessibility

- Maintain WCAG AA contrast ratios.
- Responsive layouts for desktop, tablet, and mobile.
- Ensure keyboard accessibility.
- Preserve screen reader semantics.

---

# Behavioral Conversion Flow

```
Visitor arrives
        │
        ▼
"I have an urgent question"
        │
        ▼
This service understands my situation
        │
        ▼
These records exist
        │
        ▼
This looks legitimate
        │
        ▼
Searching is private
        │
        ▼
The search is easy
        │
        ▼
I click Search
```

The current implementation largely skips the trust-building stages and moves directly to data entry. The redesigned page should intentionally guide visitors through reassurance before asking for action.

---

# Implementation Checklist

## Hero
- [ ] Replace generic headline
- [ ] Add emotional supporting copy
- [ ] Add privacy/trust statement

## Search Card
- [ ] Increase visual emphasis
- [ ] Replace emoji with SVG icons
- [ ] Rewrite benefits

## Form
- [ ] Hide middle name under Advanced Search
- [ ] Improve placeholders

## Value Preview
- [ ] Move above CTA
- [ ] Expand result types

## CTA
- [ ] Rename button
- [ ] Increase prominence
- [ ] Full-width layout

## Trust
- [ ] Public-record disclaimer
- [ ] Privacy reassurance
- [ ] Search time expectation

## Navigation
- [ ] Remove Login
- [ ] Remove Sign Up
- [ ] Simplify navigation

## Footer
- [ ] Reduce height
- [ ] Keep only essential links

## Responsive
- [ ] Above-the-fold CTA
- [ ] Maintain mobile usability
- [ ] Preserve accessibility

---

# Strategic Observation

This page should not present itself as a search utility.

It should present itself as the fastest and most trustworthy path to answering a highly emotional question.

The design should communicate:

> "We understand why you came here, we can help, your search is private, and you're only moments away from an answer."

That message—not the search fields—is what should drive conversion.
