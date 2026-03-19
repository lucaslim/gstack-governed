You are adapting a Claude Code skill document for a team that uses
React, TypeScript, and GraphQL (client-side with Apollo/urql). The upstream version
targets Rails/Ruby teams. Your job: make every recommendation, example, check, and
vocabulary item feel native to React/TS/GraphQL developers.

## Stack Identity (this is WHO we are — every example, every check, every recommendation
should feel native to this stack, not adapted from another one)
Target: React 18+ / TypeScript / GraphQL client (Apollo Client or urql) / Vite or Next.js
Testing: Vitest or Jest + Playwright for E2E
Styling: Tailwind CSS or CSS Modules
State: React Query / Apollo Cache / Zustand
API: GraphQL with typed codegen (graphql-codegen), REST for third-party integrations

## Vocabulary Mapping (exhaustive — apply ALL of these)
Architecture:
  Models → Components | Controllers → Pages/Routes | Concerns → Hooks
  Models & services → Components & hooks | Controllers & views → Pages & routes
  Models/Controllers/Concerns → Components/Hooks/Services/Utils
  ActiveRecord associations → GraphQL relationships
  N+1 queries → Waterfall requests | rake tasks → scripts
  SQL & Data Safety → Data Mutation Safety
  app/services/ → src/components/ | app/models/ → src/hooks/
Error handling:
  ActiveRecord::RecordNotFound → NotFoundError
  Faraday::TimeoutError → TimeoutError
  ActiveRecord::ConnectionTimeoutError → ConnectionPoolError
  JSON::ParserError → SyntaxError
  rescue StandardError → catch(error) with no type narrowing
  rescue → catch | raise → throw | re-raise → re-throw
  rescued → caught | unrescued → uncaught
  Error & Rescue Map → Error & Recovery Map
  EXCEPTION CLASS → ERROR TYPE | RESCUED? → CAUGHT?
  500 error → Crash | rescue action → recovery action
Files & tools:
  *.rb → *.ts/*.tsx | Gemfile.lock → package.json
  bin/test-lane → project test commands from CLAUDE.local.md
  npm run test → project test commands from CLAUDE.local.md
  gems/npm packages → npm packages | gems → packages
  gstack-slug eval → inline sed: SLUG=$(git remote get-url origin 2>/dev/null | sed ...)
  Keep .gstack/ paths as-is (use upstream default — no rename needed)
  --include="*.rb" → --include="*.ts" --include="*.tsx"
  grep *.rb → grep *.ts *.tsx *.js *.jsx
Framework detection:
  csrf-token meta tag → Rails → csrf-token meta tag → Server-rendered framework
  SQL, command, template injection → XSS, command, template, LLM prompt injection
Diagrams in code comments:
  Models (state transitions), Services (pipelines), Controllers (request flow), Concerns (mixin behavior)
  → Components (state transitions), Services/Utils (pipelines), Hooks (data flow), Context providers (shared state)

## Structural Changes
Preamble:
  The {{PREAMBLE}} placeholder is handled by the generator — do NOT modify it.
  Preserve {{PREAMBLE}} exactly as-is. The generator resolver removes only
  UPGRADE_AVAILABLE handling and Contributor Mode; everything else passes through.
QA Methodology:
  The {{QA_METHODOLOGY}} placeholder is handled by the generator — do NOT modify it.
  Preserve {{QA_METHODOLOGY}} exactly as-is. The generator resolver removes the Rails
  subsection, swaps vocabulary, and adds React-specific SPA checks.
Review template:
  Remove "Step 2.5: Check for Greptile review comments" section entirely.
  Remove "### Greptile comment resolution" subsection entirely.
  Remove any greptile-triage.md references.
Retro template:
  Remove command 8 (greptile-history fetch) from the data gathering step.
  Remove "Greptile signal" metric row from the summary table.
  Remove greptile field from the JSON output format.
  Remove Greptile signal computation paragraph.
Design-consultation template:
  Replace the 3-step competitor research flow (WebSearch + browse visual research)
  with WebSearch-only research. Remove browse binary check, screenshot commands,
  and graceful degradation logic. Keep the synthesis step.
Plan-eng-review template:
  After "### 4. Performance review" section, add:
  ### 5. API / Backend Dependencies
  When a plan requires new API queries or mutations that don't yet exist, include a
  "Request for BE team" section with: ideal query/mutation shape, missing API
  capabilities, N+1/waterfall risks.
  Replace "make sure there is a JS or Rails test" with "make sure there is a test
  using the project's test framework from CLAUDE.local.md"

## Frontmatter Injection (add these fields to YAML frontmatter)
After the "version:" line, add "model:" field per skill:
  gstack: sonnet | browse: sonnet | qa: sonnet | qa-only: sonnet
  review: opus | plan-ceo-review: opus | plan-eng-review: opus
  plan-design-review: opus | design-consultation: opus
  retro: sonnet | document-release: sonnet | setup-browser-cookies: haiku
Add Serena MCP tools to allowed-tools for these skills:
  qa, review, plan-ceo-review, plan-eng-review, plan-design-review,
  design-consultation, qa-design-review
  Tools to add: mcp__serena__activate_project, mcp__serena__get_symbols_overview,
  mcp__serena__find_symbol, mcp__serena__find_referencing_symbols,
  mcp__serena__search_for_pattern

## Serena Setup Section
After the resolved Preamble (AskUserQuestion Format section), for skills with Serena
tools in allowed-tools, insert this section:

## Serena Code Navigation (optional, reduces token usage)
[Full Serena setup text: activation, onboarding, patterns table, fallback rule]

## Deep Framework Steering (this is what makes reviews feel NATIVE, not adapted)

For plan-ceo-review and plan-eng-review especially — these must read like they were
written by a senior React/TS/GraphQL engineer:

Error handling examples: Use REAL TypeScript patterns, not translated Ruby.
  Bad:  "catch(error) with no type narrowing" (feels like translated "rescue StandardError")
  Good: "catch (error) { if (error instanceof ApolloError) { ... } }" with specific
        GraphQL error types: NetworkError, GraphQLError with extensions.code,
        cache write failures, optimistic update rollbacks.

Architecture review: Think in React mental models.
  - State machines: useReducer transitions, not class-based state
  - Data flow: Apollo cache normalization, not ORM associations
  - Coupling: barrel exports, prop drilling vs context, hook composition
  - Boundaries: Error boundaries, Suspense boundaries, route-level code splitting

Performance review: Use React/GraphQL-specific patterns.
  - Waterfall GraphQL requests (sequential useQuery in render tree)
  - Over-fetching (selecting fields you don't render)
  - Cache invalidation strategy (refetchQueries vs cache.modify vs evict)
  - Re-render storms (missing memo/useMemo, unstable references in deps)
  - Bundle size impact of new dependencies

Security review: Use web frontend threat models.
  - XSS via dangerouslySetInnerHTML or unsanitized GraphQL responses
  - CSRF on mutations (unless using same-origin with cookies)
  - Exposed API keys in client bundles
  - PII in Apollo cache (persisted cache leaking user data)
  - GraphQL introspection exposure in production

Test review: Use React testing patterns.
  - Components: render + assert with Testing Library, not enzyme/shallow
  - Hooks: renderHook for custom hooks
  - GraphQL: MockedProvider for Apollo, msw for network-level mocks
  - E2E: Playwright with page objects
  - "What's the test a hostile QA engineer would write?" → cache staleness,
    optimistic rollback on error, race conditions in concurrent mutations

QA methodology: Use frontend-specific checks.
  - Hydration errors (Next.js SSR/CSR mismatch)
  - CLS from lazy-loaded components
  - Stale Apollo cache after mutation (navigate away and back)
  - Client-side routing vs full page reload
  - GraphQL error states (network error, partial data, null fields)

## Framework Detection Additions
Where framework detection exists: add
  - "presence of @apollo/client, urql, or graphql-request → GraphQL client"
  - "presence of .graphql files or gql`` tagged templates → GraphQL schema"
  - "presence of codegen.ts or graphql-codegen → typed GraphQL"

## Output Rules
- Keep ALL structure, heading levels, code blocks, markdown formatting IDENTICAL
- Do NOT rewrite prose style or add new explanations beyond what's specified above
- Do NOT remove content unless explicitly listed in Structural Changes above
- Preserve all {{PLACEHOLDER}} patterns exactly as they appear
- The adapted output must be the same length ±10% as the input (flag if not)
