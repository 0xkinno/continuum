# Demo Data — The Ashenveil Chronicles

This directory contains the seeded demo project for Continuum.

## Story

**The Ashenveil Chronicles** follows Maren Ashcroft, a hedge-witch who arrives at
Thornmere, a village at the edge of a haunted forest. Over four chapters, the story
establishes a set of precise facts about characters, world rules, and a timeline of
events. Chapter 5 (the test draft) contains three deliberate continuity errors.

## Files

```
demo-data/
├── chapters/
│   ├── chapter-01.md   The Warding Circle — Maren arrives, learns First Law
│   ├── chapter-02.md   Iron and Salt — Second and Third Laws established,
│   │                   binding oath, CRITICAL: salt water limitation clarified
│   ├── chapter-03.md   The Scholar's Visit — Fenwick teaches PAIRED RESONANCE
│   │                   (Maren learns this for the first time here)
│   └── chapter-04.md   The Night the Lock-Box Broke — salt water protocol used,
│                       binding extension proposed
├── characters/
│   └── character-sheet.md  Full profiles for Maren, Aldric, Fenwick with precise
│                           knowledge timelines
└── test-draft.md       Chapter 5 draft — contains exactly 3 contradictions
```

## The Three Contradictions

| ID | Type | What the draft says | What was established | Chapter |
|----|------|--------------------|--------------------|---------|
| C1 | CHARACTER KNOWLEDGE | Maren claims she worked out paired resonance independently before arriving | She learned it from Fenwick in Ch. 3 and explicitly had never heard of it before | Ch. 3 |
| C2 | ESTABLISHED RULE | Maren draws warding circles in "two strokes" | The Second Law: circles must be one unbroken motion or they are inert | Ch. 2 |
| C3 | ESTABLISHED RULE | Maren says salt water neutralises active iron resonance | The Third Law: salt water only cancels past trails, not currently resonating iron | Ch. 2 |

## Running the Seed

```bash
# From continuum/backend/
npm run seed:demo
```

Or via the HTTP endpoint (for the UI button):
```
POST http://localhost:3001/seed/demo
```

The seed script:
1. Clears all data
2. Ingests all 5 documents via Granite
3. Runs the test draft through the continuity + explanation pipeline
4. Validates all 3 contradictions are caught
5. Exits 0 if all caught, exits 1 with details if any are missed
