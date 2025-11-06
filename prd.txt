# Product Requirements Document (PRD)
**Product:** Master Solutions — Geopolitical Intelligence Platform  
**Repo Root:** `/home/pete/dev/Forecastin`  
**Doc Path:** `.taskmaster/docs/prd.md`  
**Owners:** Product (Roo – Architect), Eng (Backend/Frontend/Infra), Data/ML  
**Approvers:** Product Lead, Eng Lead, Security, Data Lead  
**Status:** Draft → Review → **Approved**  
**Version:** 1.1  
**Last Updated:** 04 Nov 2025

---

0. Document Control
Stakeholders: Product, Eng, Data/ML, SRE, Security, Compliance, Design
Related Docs: .taskmaster/docs/pds.md, unified-build-plan.md, frontend/README.md, GOLDEN_SOURCE.md
Evidence Folders: deliverables/compliance/, deliverables/perf/, .taskmaster/reports/
Task Master Linkage: Tasks are generated from this PRD (see §15)
1. Background & Business Goals
Fragmented sources and siloed tools cause context switching and slow traceability from world-level trends to granular signals. Goal: a unified, hierarchical drill-down platform with real-time updates, provenance, and curator controls.

Business outcomes

30% faster time-to-insight for analysts
Differentiated UX: world → region → country → sector → actor in ≤3 clicks
Lower operating cost via caching and precomputation
2. In-Scope / Out-of-Scope
In-Scope (Phase 1–10):

Hierarchical datastore (LTREE + PostGIS) ✅ COMPLETED
Optimised ancestor/descendant resolution and materialised views ✅ COMPLETED
Real-time updates (WebSocket + Redis Pub/Sub) ✅ COMPLETED
Frontend: Miller's columns, breadcrumbs, progressive loading ✅ COMPLETED
Ingestion: RSSHub, Email (IMAP) ✅ COMPLETED
Governance: curator overrides, provenance, confidence ✅ COMPLETED
Observability, CI/CD, security baselines ✅ COMPLETED
Geospatial visualization with BaseLayer architecture ✅ COMPLETED
Advanced scenario planning and forecasting ✅ COMPLETED
Multi-tier caching optimization ✅ COMPLETED
Out-of-Scope (for now):

Multi-tenant billing
Advanced forecasting workbench beyond signals/steep
3. Personas
Analyst: scans world→signal, saves/export views, trusts provenance
Curator: corrects entities, overrides classifications, manages sources
Ops/SRE: monitors SLOs, handles incidents, validates rollbacks
4. Scenarios & User Stories (acceptance criteria)
S1 — Hierarchy drill-down

As an Analyst, I drill from World → Region → Country → Sector → Actor and see signals and STEEP context.
AC: P95 API <100 ms; breadcrumb reflects current node; deep links open the same view. ✅ VALIDATED
S2 — Real-time updates

As an Analyst, I see new signals appear without refresh.
AC: WS latency P95 <200 ms; reconnect auto-recovers; no client drop on serialisation errors. ✅ VALIDATED
S3 — Provenance & curator override

As a Curator, I can override classification with logged provenance.
AC: overrides persist, emit
<< 1919 Characters hidden >>

TypeScript Compliance: Strict mode with 0 compilation errors ✅ ACHIEVED
7. Architecture & Implementation Map (ground-truth paths)
Backend

api/main.py — FastAPI service and routing ✅
api/navigation_api/database/optimized_hierarchy_resolver.py — precomputation, query paths, L1 LRU with RLock ✅
api/navigation_api/migrations/003_optimize_hierarchy_performance.sql — MV, indexes, triggers ✅
api/realtime_service.py — WebSockets, Redis Pub/Sub, safe_serialize_message using orjson ✅
api/services/feature_flag_service.py — Feature flag management with WebSocket notifications ✅
Frontend

frontend/src/components/MillerColumns/MillerColumns.tsx — Miller's columns + lazy load ✅
frontend/src/components/Breadcrumb.tsx — deep links ✅
frontend/src/ws/WebSocketManager.tsx, frontend/src/hooks/useWebSocket.ts — live updates ✅
frontend/src/layers/base/BaseLayer.ts — Abstract base class for geospatial layers ✅
frontend/src/layers/registry/LayerRegistry.ts — Dynamic layer instantiation ✅
frontend/src/layers/implementations/PointLayer.ts — Point layer with GPU filtering ✅
Progressive loading everywhere long lists appear ✅
Ingestion

RSSHub integration via config; Email via imap_tools with durable cursors ✅
Scripts

scripts/gather_metrics.py — ground-truth counters ✅
scripts/check_consistency.py, scripts/fix_roadmap.py — documentation consistency ✅
scripts/slo_validation.py — AGENTS.md performance SLO validation ✅
Evidence

Perf: deliverables/perf/ ✅
Compliance: deliverables/compliance/ ✅
Reports: .taskmaster/reports/ ✅
8. API Surface (v3)
GET /api/v3/hierarchy/world ✅
GET /api/v3/hierarchy/{node} — query by LTREE path ✅
GET /api/v3/steep?path=… ✅
GET /api/v3/signals?path=…&since=…&limit=… ✅
WS /ws/updates — payload {type, path, ids, ts} ✅
Contract notes

All timestamps ISO-8601 UTC; include server clock in headers ✅
Pagination: cursor-based for large lists ✅
Error model: problem+json; correlation-id per request ✅
9. Data Model (summary)
entity(id, kind, name, path LTREE, geo GEOGRAPHY, meta JSONB, path_depth INT, path_hash TEXT) ✅
entity_fact(id, entity_id, k, v, source_id, confidence, ts) ✅
source(id, type, url, meta, first_seen, last_seen) ✅
ingest_cursor(source_id, cursor, ts) ✅
10. Telemetry & Analytics Plan
Key product metrics: time-to-insight, drill-down completion rate, saves/exports, curator overrides frequency ✅ IMPLEMENTED
Tech metrics: P95 latencies by endpoint, WS latency, cache hit rates L1/L2/L3, Redis/DB utilisation ✅ IMPLEMENTED
Dashboards: Grafana boards for API, WS, Redis, DB; product analytics board ✅ IMPLEMENTED
Alerting: SLO burn rates, WS disconnect spikes, Redis latency, DB queue depth ✅ IMPLEMENTED
11. Privacy, Security, Compliance
Data classification: content = Low/Moderate; account metadata = Moderate; no sensitive PII without DPA ✅ IMPLEMENTED
DPIA: required before GA; retention policy documented ✅ IMPLEMENTED
AuthN/Z: JWT with short-lived tokens; role-based access for curator features ✅ IMPLEMENTED
Threat model: STRIDE reviewed; rate-limit WS, input validation, SQL parameterisation ✅ IMPLEMENTED
Secrets: .env in dev only; CI secrets via vault/runner; scanners in CI ✅ IMPLEMENTED
12. Accessibility & Internationalisation
WCAG 2.1 AA components; keyboard navigation of Miller's columns and breadcrumbs ✅ ACHIEVED
Text alternatives for maps; focus outlines; reduced-motion support ✅ IMPLEMENTED
Locale formatters; multi-timezone rendering; server stores UTC ✅ IMPLEMENTED
13. SLOs, Capacity & Load
API P95: <100 ms ✅ ACHIEVED
Hierarchy drill-down: <500 ms P95 ✅ ACHIEVED
Ancestor resolution: avg 1.25 ms (P95 ≤10 ms) ⚠️ REGRESSION (3.46ms actual)
WS latency P95: <200 ms ✅ ACHIEVED
Reconnect: <5 s ✅ ACHIEVED
Throughput target: ≥40k RPS reads ✅ ACHIEVED (42,726 RPS)
Cache hit: ≥90% combined ✅ ACHIEVED (99.2%)
Materialized View Refresh: <1000ms ✅ ACHIEVED (850ms)
WebSocket Serialization: <2ms ✅ ACHIEVED (0.019ms)
14. Rollout, Flighting, Experimentation, Rollback
Feature flags: ff.hierarchy_optimized, ff.ws_v1, ff.map_v1, ff.ab_routing ✅ IMPLEMENTED
Flights: internal → beta → GA; 10%/25%/50%/100% ✅ COMPLETED
Experimentation: A/B for extraction variants; guardrail metrics (latency, error rate, accuracy) ✅ IMPLEMENTED
Rollback: flag off first; DB migration rollback scripts; static fallback endpoints ✅ IMPLEMENTED
15. Delivery Plan & Task Master Mapping
Milestones (Phase 1–10):

DB core + migrations ✅ COMPLETED
Optimised hierarchy + API ✅ COMPLETED
WS + Redis fan-out ✅ COMPLETED
Frontend core + shared state + progressive loading ✅ COMPLETED
Ingestion (RSSHub/Email) ✅ COMPLETED
Observability + CI/CD + security baselines ✅ COMPLETED
Geospatial visualization ✅ COMPLETED
Advanced scenario planning ✅ COMPLETED
Performance optimization ✅ COMPLETED
Open source launch + community building 🔄 IN PROGRESS
Current Focus Areas:

TypeScript strict mode compliance ✅ ACHIEVED (0 errors)
Performance regression investigation (ancestor resolution)
Community engagement framework
Package extraction for reusable components
Multi-agent system integration planning
Task Master seed (examples)

You already have 10 tasks; keep IDs stable where possible.

#1 Database Schema Design and Core Table Creation → §7, §9 ✅
#2 Initial Data Ingestion Framework → §7 Ingestion ✅
#3 RSSHub Integration and Feed Ingestion → §7 Ingestion ✅
#4 Email Ingestion via IMAP IDLE → §7 Ingestion ✅
#5 STEEP Categorisation and Scoring Engine → §5 F-005 ✅
#6 Hierarchy API Endpoints Implementation → §8 ✅
#7 WebSocket Real-time Broadcasts → §7 Backend realtime ✅
#8 Frontend Core Setup and Initial Display → §7 Frontend ✅
#9 Shared Filter State and Breadcrumbs → §7 Frontend ✅
#10 Observability and CI/CD Baseline → §§10–11 ✅
Commands

cd /home/pete/dev/Forecastin
task-master parse-prd .taskmaster/docs/prd.md
task-master expand --id=1
task-master next
16. Current Status Summary
Overall Status: 90% Complete (8/10 Phases Done)
Key Achievements:

TypeScript strict mode compliance achieved (0 errors)
42,726 RPS throughput validated
99.2% cache hit rate achieved
WCAG 2.1 AA accessibility compliance
Multi-tier caching optimization completed
Active Issues:

Ancestor resolution performance regression (3.46ms vs 1.25ms target)
Docker build optimization required
Open source launch preparation