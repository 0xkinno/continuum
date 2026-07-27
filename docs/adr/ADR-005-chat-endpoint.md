# ADR-005: Chat endpoint over text generation

## Context
The /ml/v1/text/generation endpoint is deprecated by IBM. granite-4-h-small
returns terse, unparseable responses through it.

## Decision
Migrated to /ml/v1/text/chat with structured messages format.

## Reasoning
The chat endpoint supports system messages, which lets us enforce
"respond only with valid JSON" at the protocol level rather than
hoping the model follows an inline instruction. JSON parsing
reliability improved immediately after migration.

## Status
Accepted