# ADR-004: Granite for structured reasoning, not perception

## Context
The Continuity Agent needs to reason about contradictions. Some models handle vision, some handle structured output.

## Decision
Use IBM Granite for all reasoning (claim extraction, fact comparison, explanation generation). Do not use Granite for document parsing (Docling handles that) or image analysis (out of scope).

## Reasoning
Granite excels at structured text reasoning. Document parsing is better handled by a dedicated tool (Docling). Image-based stories are explicitly out of scope for this version.

## Status
Accepted

## Update: Model and endpoint migration

The original spec targeted ibm/granite-13b-instruct-v2 via /ml/v1/text/generation.
Live testing found this model deprecated (404 in eu-de). Migrated to ibm/granite-4-h-small via /ml/v1/text/chat. 
The chat endpoint requires messages format instead of raw completion. 
Agent prompts needed no changes because they already specify JSON output format explicitly.