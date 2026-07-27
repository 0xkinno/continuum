# Continuum — Judge Demo Walkthrough

> **Time to wow moment: ~20 seconds after clicking "Check continuity"**

---

## Prerequisites

Before starting, ensure both services are running:

```bash
# Terminal 1 — backend (port 3001)
cd continuum/backend
npm run dev

# Terminal 2 — frontend (port 3000)
cd continuum
npm run dev
```

And that `backend/.env` contains valid `WATSONX_API_KEY` and `WATSONX_PROJECT_ID`.

---

## The Demo Story

**The Ashenveil Chronicles** is a short fantasy story about Maren Ashcroft, a hedge-witch who arrives at a village called Thornmere where uncovered iron attracts creatures called the Hollow.

Over four chapters, the story establishes:
- Three world-rules about iron, warding circles, and salt water
- A character (Maren) who learns specific knowledge only at specific chapters
- A precise timeline of events

The test draft — Chapter 5 — contains **3 deliberate continuity errors**.

---

## The Three Contradictions in the Test Draft

| # | Type | What the draft claims | What was established |
|---|---|---|---|
| C1 | CHARACTER KNOWLEDGE | Maren claims she worked out "paired resonance" independently before arriving in Thornmere | Paired resonance was documented by Fenwick Pale and Maren learned it for the first time in Chapter 3 — she explicitly states she had never heard of it before |
| C2 | ESTABLISHED RULE | Maren says she draws warding circles in "two strokes" and this works | The Second Law (Chapter 2) states warding circles must be completed in a **single unbroken motion** — any break renders the ward inert |
| C3 | ESTABLISHED RULE | Maren tells Orin that salt water poured at the perimeter will neutralise actively resonating uncovered iron | The Third Law (Chapter 2) explicitly states: salt water cancels **past resonance trails only** — it cannot neutralise iron that is currently resonating. Aldric explicitly clarified this distinction |

---

## Step-by-Step Demo

### Step 1 — Open the app

Navigate to **http://localhost:3000**

You will see the Manuscript workspace: upload panel on the left, draft editor in the centre, editor notes on the right.

---

### Step 2 — Load the demo project (one click)

In the left upload panel, click **"Load demo project"**.

This will:
1. Clear any existing data from the database
2. Ingest all 4 chapters and the character sheet through the full pipeline (Docling → Granite)
3. Populate the Canon view with all extracted facts
4. Load the test draft (Chapter 5) automatically into the editor

**Watch the progress log** — you'll see each document ingested in real time.

When it says **"✓ Demo loaded. Draft ready in editor"**, proceed to Step 3.

> **Note:** This takes 60–90 seconds because it makes 6 Granite API calls (one per document). For a faster demo, pre-seed the database with `npm run seed:demo` in the backend directory before the presentation.

---

### Step 3 — Inspect the Canon view (optional, shows depth)

Click **Canon** in the navigation.

You'll see the complete story bible built from the 4 chapters:
- **Characters**: Maren, Aldric, Fenwick — with their traits, knowledge timeline, and relationships
- **Timeline**: Events from all four chapters in narrative order
- **Established Rules**: The three laws of Thornmere, the paired resonance phenomenon, the binding oath rule

This is the knowledge model that contradictions are checked against.

---

### Step 4 — Return to Manuscript and click "Check continuity"

Click **Manuscript** in the nav to return to the workspace.

The test draft is already in the editor (it was loaded automatically in Step 2).

Click **"Check continuity"**.

The system will:
1. Extract all factual claims from the draft (~2 seconds)
2. Retrieve relevant facts from the Knowledge store (~instant)
3. Reason step by step against established facts (~5 seconds)
4. Generate editorial explanations (~5 seconds)

**Total: approximately 15–25 seconds.**

---

### Step 5 — See the three flags appear inline

Three things happen simultaneously:

1. **The draft text transforms**: three phrases become highlighted in amber with underlines.

2. **Three editor notes appear** in the right margin panel, sliding in one by one:
   - Each note has a red left border
   - A mono label shows the flag type (CHARACTER KNOWLEDGE / ESTABLISHED RULE)
   - The explanation reads like a note from a human continuity editor
   - A source reference line shows where the contradicted fact was established

3. **Clicking any highlighted phrase** in the draft scrolls to its margin note.

---

## Example Output (what the judges should see)

**Flag 1 — CHARACTER KNOWLEDGE** *(high confidence)*

> *"The draft states that Maren worked out paired resonance independently before arriving in Thornmere. This directly contradicts what is established in Chapter 3: Maren had never heard of paired resonance before Fenwick Pale explained it to her, and she explicitly noted that it was documented only after she left the Academy. The claim in the draft retroactively gives Maren knowledge she did not possess for the first three chapters of the story."*
>
> Established in: Chapter 3, character-sheet.md

---

**Flag 2 — ESTABLISHED RULE** *(high confidence)*

> *"The draft shows Maren drawing warding circles using a two-stroke method, which she describes as equally effective. This violates the Second Law of Thornmere, established in Chapter 2: a warding circle must be completed in a single unbroken motion or it is completely inert. Aldric witnessed this rule fail in practice when a traveller tried to patch a broken ward. A two-stroke method would produce a ward that does nothing."*
>
> Established in: Chapter 2, chapter-02.md

---

**Flag 3 — ESTABLISHED RULE** *(high confidence)*

> *"Maren tells Orin that salt water poured at the perimeter will neutralise the resonance of uncovered iron stored nearby. This contradicts the Third Law as clarified by Aldric in Chapter 2: salt water can only cancel a past resonance trail — it cannot suppress the active resonance of iron that is currently uncovered. Aldric's exact clarification: 'Salt water only works when there is no iron currently resonating.' Maren herself wrote this down in her notebook in Chapter 2."*
>
> Established in: Chapter 2, chapter-02.md

---

## Running the Seed Validation Script

To verify all 3 contradictions are reliably caught before the demo, run:

```bash
cd continuum/backend
npm run seed:demo
```

Expected output:
```
✓ DEMO SEED PASSED — all 3 contradictions caught.
  The demo is ready. Run the app and follow docs/DEMO.md for the judge walkthrough.
```

If any contradiction is missed, the script exits with code 1 and identifies which one was missed.

---

## Resetting the Demo

To reset to a clean state between judge runs:

**Option A — One button in the UI:** Click "Load demo project" in the Manuscript workspace. This clears and re-seeds everything.

**Option B — Command line:**
```bash
cd continuum/backend
npm run seed:demo
```

---

## Architecture (30-second explanation for judges)

```
Your uploaded chapters
        ↓
  Docling parser → clean text
        ↓
  IBM Granite (Ingestion Agent) → extracts characters, events, rules as JSON
        ↓
  SQLite (Knowledge Agent) → stores facts individually, queryable by character/chapter
        ↓
  New draft submitted
        ↓
  IBM Granite pass 1 (Continuity Agent) → identifies all factual claims in draft
        ↓
  IBM Granite pass 2 → checks each claim against Knowledge store step by step
        ↓
  IBM Granite (Explanation Agent) → writes editorial note for each contradiction
        ↓
  Inline flags in the manuscript editor
```

Every step uses real IBM Granite reasoning — no hardcoded rules, no keyword matching.
