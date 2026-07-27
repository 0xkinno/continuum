# ADR-002: Sequential agent pipeline

## Context
Multi-agent frameworks like LangGraph exist for orchestrating AI agents.

## Decision
Use a plain function calling each agent in order (Ingestion → Knowledge → Continuity → Explanation) rather than a framework.

## Reasoning
Four agents in a fixed sequence do not need a graph. A framework adds dependency weight, debugging complexity, and abstraction without benefit here. Each agent is independently testable as a function.

## Status
Accepted