# CLAUDE.md

## Core Principles
- Safety, correctness, maintainability > development speed
- Explicit > clever. Simple > complex.
- Surface trade-offs; never make hidden decisions.
- Verification-first: define how to validate before writing any code.

---

## Planning

Always plan before coding. Lightweight bullets for small changes; full plan for:
- 3+ files, DB schema, API contract, auth, architecture, concurrency, perf, security

**Every plan must include:**
- What problem is being solved and why
- Key decisions made and alternatives rejected
- Most uncertain assumption in this plan
- Acceptance criteria (specific and measurable, not "works correctly")

Do not begin implementation without explicit approval.

---

## Verification Cycle

Implement → Verify → Fix → Verify Again (repeat per milestone, not just at the end)

---

## Validation Checklist

**Static**
- [ ] Build succeeds, lint passes, no new warnings

**Unit Tests**
- [ ] Business rules, edge cases, error paths

**Integration Tests**
- [ ] API contracts, DB behavior, external services

**Contract Tests** *(if API or event schema changed)*
- [ ] Producer output matches consumer's expected schema

**Performance Tests** *(if perf-critical)*
- [ ] Latency thresholds defined and validated (e.g. p95 < 500ms)
- [ ] Load tested at expected peak

**Security Tests**
- [ ] Static analysis clean (no new high/critical findings)
- [ ] `dotnet list package --vulnerable` / `npm audit` executed

**E2E Tests** *(if applicable)*
- [ ] Critical user journeys covered

**Manual Verification**
- [ ] Step-by-step instructions with expected and actual results

---

## UX Review

- [ ] Step count minimized; unnecessary steps eliminated
- [ ] Sequence is intuitive without needing instructions
- [ ] No unnecessary confirmation dialogs
- [ ] No forms asking for inferable information
- [ ] Errors are actionable (tell user what to do next)
- [ ] Loading, empty, and error states all handled
- [ ] User can recover from mistakes without losing progress

**[MUST]** Proactively flag any flow that will confuse or frustrate users.
If a simpler workflow exists, propose it.

---

## Performance Review

**Database**
- [ ] Queries use appropriate indexes
- [ ] PK, FK, unique constraints correctly defined
- [ ] No `SELECT *`; project only required columns
- [ ] Large result sets are paginated
- [ ] No N+1 query risks

**Application**
- [ ] Only necessary data loaded into memory
- [ ] External calls are async where appropriate
- [ ] Caching opportunities identified

**Scalability**
- [ ] Behavior at 10x traffic considered
- [ ] Behavior at 100x data volume considered
- [ ] No in-process state that breaks multi-instance deployment

---

## Security Review

- [ ] Input validated; output encoded
- [ ] SQL injection, XSS, CSRF, SSRF, path traversal, command injection checked
- [ ] Auth: identity validated, token expiry/rotation handled, session invalidated on logout
- [ ] Authz: role check at service layer (not just UI), ownership check before data access
- [ ] File upload: type validated by content (not extension), size limited, stored in isolation
- [ ] No secrets or credentials in source code
- [ ] No passwords, tokens, or PII written to logs
- [ ] No new vulnerable dependencies introduced

---

## Concurrency Review

**[MUST]** Assume multi-instance deployment at all times.

- [ ] Shared resources identified; appropriate lock strategy chosen
- [ ] Optimistic lock (rowversion/ETag) vs pessimistic lock decision made explicitly
- [ ] Distributed lock used where in-process lock is insufficient
- [ ] Operations are idempotent; safe to retry
- [ ] Duplicate request handling in place where needed
- [ ] Out-of-order event/message delivery tolerated or prevented

---

## Reliability Review

- [ ] Timeouts configured for all external calls
- [ ] Retry with exponential backoff and jitter
- [ ] Circuit breaker considered for unstable dependencies
- [ ] Partial failure scenarios handled (e.g. DB write succeeds, notification fails)
- [ ] Graceful degradation; no single failure cascades

---

## Observability

- [ ] Business events logged (created, processed, failed)
- [ ] Errors logged with enough context to diagnose
- [ ] No sensitive data in logs
- [ ] Success/failure rates, latency, throughput tracked
- [ ] Single request traceable end-to-end
- [ ] Audit trail where required (who, when, what changed)

---

## Code Quality

- [ ] No unnecessary abstractions or layers
- [ ] 20-line solution preferred over 100-line solution when equally clear

**When simplicity trades off against perf/maintainability/correctness:**
Present options explicitly — do not decide silently.

| | Option A | Option B |
|---|---|---|
| Approach | | |
| Pros | | |
| Cons | | |
| Recommendation | | |

---

## Documentation

For significant changes, document:
- [ ] What the system does
- [ ] **Why** it works this way (decisions and constraints)
- [ ] How data flows through the system
- [ ] API changes and migration notes
- [ ] Operational notes (deploy, config, rollback)

---

## Risk Assessment

Before closing any task:

- [ ] Most fragile component identified
- [ ] Most likely production failure point named
- [ ] Bottleneck at 10x traffic named
- [ ] Bottleneck at 100x data named
- [ ] Rollback path exists

| Severity | Risk | Mitigation |
|---|---|---|
| High | | |
| Medium | | |
| Low | | |

---

## Definition of Done

- [ ] Requirements implemented
- [ ] Acceptance criteria passed
- [ ] Plan and reasoning documented
- [ ] Unit / integration / contract tests passing
- [ ] E2E tests passing (if applicable)
- [ ] Static analysis clean
- [ ] Dependency vulnerability check done
- [ ] Security review complete
- [ ] Performance review complete
- [ ] Concurrency review complete
- [ ] UX review complete
- [ ] Observability verified
- [ ] Documentation updated
- [ ] Risks identified and communicated
