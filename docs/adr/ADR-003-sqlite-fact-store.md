# ADR-003: SQLite for the fact store

## Context
Vector databases are common for AI applications. Our facts are structured (characters, events, rules), not embeddings.

## Decision
Use SQLite with a relational schema rather than a vector database.

## Reasoning
Facts have clear fields (name, trait, chapter, rule text). Retrieval is by character name and chapter number, not semantic similarity. SQLite is zero-config, ships with Node 24, and supports the upsert/dedup logic the Knowledge Agent needs. Upgradeable to Postgres later without changing agent interfaces.

## Status
Accepted