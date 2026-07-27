# ADR-006: No silent model fallback

## Context
Rather than using a Gemini fallback when watsonx returns 429. We considered
adding a similar fallback to a non-IBM model.

## Decision
No fallback. If Granite fails, the app surfaces the error clearly
rather than silently switching to a non-IBM model.

## Reasoning
This is an IBM challenge. Using a non-IBM model as a silent fallback
would undermine the submission's integrity. The app degrades honestly:
the user sees "watsonx unavailable" rather than getting results from a hidden Gemini call. Some projects disclosed their fallback; we chose not to need one.

## Status
Accepted