# ADR-001: Subprocess bridge for Docling

## Context
Docling is a Python library. Our backend is Node/TypeScript.

## Decision
Spawn Python as a child process via execFile rather than running Docling as a separate REST microservice.

## Reasoning
One process to manage, not two. Simpler to debug live. No network calls between services. Consistent with the sequential pipeline design. The subprocess adds 3-5 seconds on cold start, acceptable for a demo.

## Status
Accepted