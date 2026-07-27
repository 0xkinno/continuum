# IBM Bob Usage Log

## Session 1 — Phase 1+2: Foundation and Ingestion Agent
- Scaffolded Next.js 14 + Fastify backend
- Bob chose subprocess bridge for Docling (Node spawning Python) rather than a separate microservice
- Bob implemented watsonx IAM token caching with 55-minute expiry to avoid rate limits
- 20 files created, zero TypeScript errors

## Session 2 — Phase 3+4: Knowledge Agent and Continuity Agent
- Bob chose Node 24 built-in node:sqlite over better-sqlite3 to avoid native compilation issues on Windows
- Designed 12-table SQLite schema with upsert semantics for fact deduplication
- Built two-pass Granite reasoning for continuity checking (extract claims, then verify against facts)
- SQLite smoke test passed all assertions

## Session 3 — Phase 5+6: Explanation Agent and Flagship UI
- Built the Explanation Agent with temperature 0.3 for editorial prose variety
- Built 4 views: Manuscript workspace, Canon (story bible), History (audit log), Landing page
- Implemented inline amber flag highlighting with click-to-scroll to margin notes
- Added Framer Motion AnimatePresence for staggered note entrance animations
- Added check_history table for persistent audit logging
- 44 files changed, zero TypeScript errors

## Session 4 — Phase 7: Demo Hardening
- Created The Ashenveil Chronicles demo story (4 chapters + character sheet)
- Engineered 3 unambiguous contradictions using exact vocabulary matching
- Built seed-demo.ts validation script that refuses to pass unless all 3 contradictions are caught
- Added POST /seed/demo endpoint with NDJSON streaming progress
- Added "Load demo project" button to workspace UI
- Created directIngest.ts for filesystem-based ingestion (bypasses HTTP/Docling for seeding)
- Created clearDemo.ts for FK-safe database wipe across 16 tables
- Created docs/DEMO.md judge walkthrough

## Session 5 — Phase 8: CI and Tests
- Created agents.test.ts with 14 tests using node:test runner
- Tests use real agent functions with intercepted fetch for deterministic Granite responses
- Database isolation via CONTINUUM_DB_PATH=:memory:
- Bob identified Node 24 requirement for node:sqlite (CI originally specified Node 20)
- Created .github/workflows/ci.yml for automated CI on push and PR

## Session 6 — watsonx model discovery
- Discovered ibm/granite-13b-instruct-v2 deprecated (404 in eu-de region)
- Migrated to ibm/granite-4-h-small (only available instruct model)
- Queried /ml/v1/foundation_model_specs to find available models

## Session 7 — watsonx migration
- Migrated from /ml/v1/text/generation to /ml/v1/text/chat endpoint
- Fixed normalizePartial() bug where missing array fields caused crash
- Added console.error logging to watsonxClient for future debugging
- Security fix: removed real API key from .env.example
- Only instruct-capable Granite model: ibm/granite-4-h-small
- Root cause was model deprecation, not auth failure

## Session 8 — Chat endpoint migration
- Migrated from /ml/v1/text/generation (deprecated) to /ml/v1/text/chat
- Fixed normalizePartial() crash when Granite omits optional array fields
- Discovered granite-4-h-small catches 2-5 of 3 target contradictions depending on run
- Added system message enforcing JSON-only responses

## Session 9 — UI redesign
- Overhauled all four views to editorial premium design
- Added parallax hero images on Canon and History pages
- Implemented Apple-style scroll animations with spring physics
- Added state persistence so draft survives route changes

## Session 10 — Deployment and submission
- Deployed frontend to Vercel, backend to Render
- Pre-seeded the deployed backend with demo data
- Took production screenshots for README and submission
- Recorded 3-minute demo video