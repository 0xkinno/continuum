# ADR-006: No silent model fallback

## Context
Some competitors use a Gemini fallback when watsonx returns 429.
We considered adding a similar fallback to a non-IBM model.

## Decision
No fallback. If Granite fails, the app surfaces the error clearly
rather than silently switching to a non-IBM model.

## Reasoning
This is an IBM challenge. Using a non-IBM model as a silent fallback
would undermine the submission integrity. The app degrades honestly:
the user sees "services unavailable" rather than getting results from
a hidden non-IBM call.

## Status
Accepted

## Update: Scoped exception for image ingestion

The original decision holds for text-based reasoning. However, watsonx.ai
has no vision-capable Granite model in this region (see ADR-004). Image
ingestion uses Groq Vision solely as an image-to-text description
step. The resulting description is passed through the same Granite-powered
Ingestion Agent as any other source. Granite remains the sole reasoning
engine for fact extraction and continuity checking. This is disclosed
rather than hidden.