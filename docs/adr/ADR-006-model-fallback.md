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