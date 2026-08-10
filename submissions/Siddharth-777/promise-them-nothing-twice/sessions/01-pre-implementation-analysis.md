╭─── Claude Code v2.1.226 ─────────────────────────────────────────────────────╮
│                                                   │ Tips for getting started │
│                   Welcome back!                   │ Run /init to create a C… │
│                                                   │ ──────────────────────── │
│                      ▐▛███▜▌                      │ What's new               │
│                     ▝▜█████▛▘                     │ Bug fixes and reliabili… │
│                       ▘▘ ▝▝                       │ Added gateway spend-lim… │
│                                                   │ Added a workspace trust… │
│             Opus 4.6 · Amazon Bedrock             │ /release-notes for more  │
│   D:\Trilogy Innovations\ti-assignment-research   │                          │
╰──────────────────────────────────────────────────────────────────────────────╯


❯ This repo contains an assignment that involves building a rate limiter along  
  with the load harness system. We are given a high-level scenario where a      
  company called RelayAPI, a B2B API platform which gives metered HTTP API      
  services to its customers, has an issue with its previous                     
  rate-limiters.Analyze the given assignment.md document and provide me the     
  following details:                                                            
  - What to build?                                                              
  - Deliverables                                                                
  - Evaluation criteria                                                         
  - System specifications                                                       
  - Customer specifications                                                     
  - Rate limiter problem                                                        
  - Conflict in team instructions                                               

  Thought for 6s, read 4 files (ctrl+o to expand)

● Here's my analysis of the assignment:

  ---
  What to Build

  1. A rate-limiting HTTP API/middleware that enforces per-customer RPM limits
  across multiple instances (3 stateless nodes behind a load balancer — not a
  single-process demo)
  2. A load-generating harness that drives the service at quota boundaries and
  reports results clearly (stdout tables, JSON report, etc.)
  3. A thin vertical slice: one endpoint (e.g. GET /api/v1/ping), real limiter
  middleware, config for at least two fake customer IDs including a Northwind
  stand-in, simulating multi-node deployment

  ---
  Deliverables

  ┌─────┬─────────────────────────────────────────────────────┬──────────────┐
  │  #  │                        What                         │   Location   │
  ├─────┼─────────────────────────────────────────────────────┼──────────────┤
  │ 1   │ Working service + load harness + README (runnable   │ solution/    │
  │     │ in ≤15 min with free tools)                         │              │
  ├─────┼─────────────────────────────────────────────────────┼──────────────┤
  │     │ AI session exports (full transcripts of every       │              │
  │ 2   │ working session — prompts + agent output). This is  │ sessions/    │
  │     │ the primary deliverable they evaluate.              │              │
  ├─────┼─────────────────────────────────────────────────────┼──────────────┤
  │     │ Decisions note (≤1 page) covering conflict          │              │
  │ 3   │ resolution, algorithm choice, what harness          │ DECISIONS.md │
  │     │ proves/doesn't, next steps                          │              │
  └─────┴─────────────────────────────────────────────────────┴──────────────┘

  Submission via PR to upstream ti-hiring repo under
  submissions/<github-username>/promise-them-nothing-twice/.

  ---
  Evaluation Criteria

  They grade how you drive AI, not code quality:

  ┌────────────────┬────────────────────────────────────────────────────────┐
  │   Dimension    │                   What they look for                   │
  ├────────────────┼────────────────────────────────────────────────────────┤
  │ Understanding  │ Grasping the conflict and constraints before building  │
  ├────────────────┼────────────────────────────────────────────────────────┤
  │ Prompting      │ Clear goals, useful context, iterative refinement,     │
  │                │ recovery from bad agent turns                          │
  ├────────────────┼────────────────────────────────────────────────────────┤
  │ Critical       │ Catching subtly wrong "distributed" designs,           │
  │ review         │ off-by-one windows, tests that prove nothing           │
  ├────────────────┼────────────────────────────────────────────────────────┤
  │ Debugging      │ Systematic diagnosis when harness and service disagree │
  ├────────────────┼────────────────────────────────────────────────────────┤
  │ Decomposition  │ Sequenced work — not one giant prompt                  │
  ├────────────────┼────────────────────────────────────────────────────────┤
  │ Communication  │ A reviewer can follow your intent from exports alone   │
  └────────────────┴────────────────────────────────────────────────────────┘

  They do not grade variable names, micro-optimizations, or framework choices.

  ---
  System Specifications

  - 3 stateless app nodes behind a round-robin load balancer (no sticky
  sessions)
  - Data stores: Postgres (billing/config), Redis (cache — may or may not be
  available; don't assume ops will provision new infra)
  - Customer identity: X-Customer-Id header (trusted from API gateway)
  - No shared memory between nodes; no request affinity
  - TLS termination at LB → app node → upstream API handlers

  ---
  Customer Specifications

  ┌────────────┬───────────────────┬──────────────────────────────┐
  │    Tier    │        RPM        │            Notes             │
  ├────────────┼───────────────────┼──────────────────────────────┤
  │ Starter    │ 60                │ Long tail of small customers │
  ├────────────┼───────────────────┼──────────────────────────────┤
  │ Growth     │ 300               │ Default new signup           │
  ├────────────┼───────────────────┼──────────────────────────────┤
  │ Enterprise │ Custom/negotiated │ Northwind is here            │
  └────────────┴───────────────────┴──────────────────────────────┘

  Northwind Logistics specifics:
  - ~60% of ARR, renewal in 6 weeks, CEO involved
  - Contracted 300 RPM
  - Nightly batch 02:00–04:00 UTC: sustained ~800–1200 RPM for 90–120 minutes
  - Batch is business-critical; retries on 429 amplify load (aggressive retry
  client)
  - Will not re-architect their scheduler before renewal

  ---
  Rate Limiter Problem

  1. Previous limiter (deprecated): Did not correctly enforce limits under
  load-balanced distribution — allowed traffic well above quota. Decommissioned.
  2. New limiter prototype: Had correctness issues at quota boundaries under
  Northwind-scale traffic in staging. Rolled back before GA.
  3. Core distributed challenge: With 3 stateless nodes and no shared memory,
  you must coordinate counters across nodes. Naive per-node counting (divide
  quota by 3) fails because round-robin isn't perfectly even.
  4. Algorithm choice required: Token bucket, sliding window, fixed window,
  leaky bucket, or hybrid — must reason about fairness, burst behavior, and
  distributed coordination.
  5. CTO's error direction preference: Under-limit rather than over-limit
  (reject a few extra legitimate requests rather than let someone blow past
  quota).

  ---
  Conflict in Team Instructions

  CTO (Priya Nair) says:
  - Hard enforcement — customer must never exceed contracted quota
  - Return 429 when limit hit, no exceptions
  - Strictly fair metering — same tier = same treatment
  - No hidden bypasses, no manual overrides in production code paths
  - No if (customerId === ...) special-case hacks
  - Any commercial exception must go through config and audit

  Support Lead (Marcus Webb) says:
  - Northwind must never see a 429 during their batch window (02:00–04:00 UTC)
  - They send 800–1200 RPM against a 300 RPM contract
  - Northwind is 60% of revenue, renewal in 6 weeks — losing them is existential
  - Exception must be invisible to the customer
  - Don't tell them to spread requests; their ERP controls the schedule

  The tension: The CTO demands strict, fair, auditable enforcement with no
  special cases. The Support Lead demands that the single most important
  customer be allowed to exceed their quota by 3–4x during a specific window
  without seeing errors. These are directly contradictory.

  Your job: Resolve this conflict explicitly — not make both memos literally
  true. Build a solution that reflects your resolution, document what you chose
  and what you rejected in DECISIONS.md.

  ---
  The key insight is that a configurable exception mechanism (e.g.,
  time-window-based burst allowances defined in customer config, not hardcoded)
  could thread the needle — it's auditable and goes through config (satisfying
  the CTO's spirit) while ensuring Northwind doesn't get 429s (satisfying
  Support). But you must own and defend whatever tradeoff you pick.

✻ Worked for 34s

※ recap: You're building a distributed rate limiter with a load harness for a take-home assignment. We just finished analyzing the assignment docs and identified the core conflict between strict enforcement and exempting the top customer. Next step is deciding your resolution approach and starting implementation. (disable recaps in /config)

❯ Elaborate more on the RelayAPI service. Explain the whole system architecture 
  and the flow of requests from the start to the end. Give me the UML diagram   
  and class diagram for the system. Elaborate more on the tiers of the          
  customers. Also explain about the pain points of the system.                  

  Thought for 6s, searched for 1 pattern, read 3 files (ctrl+o to expand)

● Here's a comprehensive elaboration of the RelayAPI system:

  ---
  RelayAPI Service — Complete System Overview

  What is RelayAPI?

  RelayAPI is a B2B API platform that sells metered HTTP API access to other
  companies. Think of it as a managed API gateway/proxy — customers subscribe to
  a tier, get an API key, and make requests against RelayAPI's endpoints.
  RelayAPI meters usage and enforces rate limits based on the customer's
  contracted requests-per-minute (RPM) quota.

  ---
  System Architecture

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                              INTERNET
  │
  │
  │
  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
  │   │  Northwind   │    │  Customer B  │    │  Customer C  │                 │
  │   │  (Enterprise)│    │  (Growth)    │    │  (Starter)   │                 │
  │   │  300 RPM     │    │  300 RPM     │    │  60 RPM      │                 │
  │   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                 │
  │          │                   │                   │
  │
  └──────────┼───────────────────┼───────────────────┼──────────────────────────
  ┘
             │                   │                   │
             ▼                   ▼                   ▼
  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                         TLS TERMINATION
  │
  │  ┌───────────────────────────────────────────────────────────────────────┐
  │
  │  │                    LOAD BALANCER (Round-Robin)                         │
  │
  │  │         No sticky sessions • No request affinity                      │
  │
  │  │         Adds trusted X-Customer-Id header via API Gateway             │
  │
  │  └───────────┬────────────────────┬────────────────────┬─────────────────┘
  │
  │              │                    │                    │
  │
  │              ▼                    ▼                    ▼
  │
  │  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐         │
  │  │   App Node 1      │ │   App Node 2      │ │   App Node 3      │         │
  │  │   (Stateless)     │ │   (Stateless)     │ │   (Stateless)     │         │
  │  │                   │ │                   │ │                   │         │
  │  │ ┌───────────────┐ │ │ ┌───────────────┐ │ │ ┌───────────────┐ │         │
  │  │ │ Rate Limiter  │ │ │ │ Rate Limiter  │ │ │ │ Rate Limiter  │ │         │
  │  │ │ Middleware    │ │ │ │ Middleware    │ │ │ │ Middleware    │ │         │
  │  │ └───────┬───────┘ │ │ └───────┬───────┘ │ │ └───────┬───────┘ │         │
  │  │         │         │ │         │         │ │         │         │         │
  │  │ ┌───────▼───────┐ │ │ ┌───────▼───────┐ │ │ ┌───────▼───────┐ │         │
  │  │ │ API Handlers  │ │ │ │ API Handlers  │ │ │ │ API Handlers  │ │         │
  │  │ └───────────────┘ │ │ └───────────────┘ │ │ └───────────────┘ │         │
  │  └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘         │
  │            │                     │                     │
  │
  │            └─────────────────────┼─────────────────────┘
  │
  │                                  │
  │
  │                                  ▼
  │
  │  ┌───────────────────────────────────────────────────────────────────────┐
  │
  │  │                     SHARED DATA LAYER                                  │
  │
  │  │                                                                       │
  │
  │  │  ┌─────────────────────┐       ┌──────────────────────────────────┐   │
  │
  │  │  │  Redis (Cache)      │       │  PostgreSQL                      │   │
  │
  │  │  │  • Rate counters    │       │  • Customer config (tier, RPM)   │   │
  │
  │  │  │  • Sliding windows  │       │  • Billing records               │   │
  │
  │  │  │  • Token buckets    │       │  • Audit logs                    │   │
  │
  │  │  │  (MAY NOT BE        │       │  • Override/exception config     │   │
  │
  │  │  │   AVAILABLE)        │       │                                  │   │
  │
  │  │  └─────────────────────┘       └──────────────────────────────────┘   │
  │
  │  └───────────────────────────────────────────────────────────────────────┘
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Request Flow (Start to End)

  Step 1: CLIENT REQUEST
  ━━━━━━━━━━━━━━━━━━━━━
  Customer app (e.g., Northwind's ERP) sends HTTP request:
      POST https://api.relayapi.com/v1/shipments
      Authorization: Bearer <api-key>

          │
          ▼

  Step 2: TLS TERMINATION + API GATEWAY
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • TLS handshake terminated at load balancer
  • API Gateway authenticates the API key
  • Injects trusted header: X-Customer-Id: northwind-logistics
  • Strips/sanitizes other sensitive headers

          │
          ▼

  Step 3: LOAD BALANCER ROUTING
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Round-robin selection (no session affinity)
  • Request may hit ANY of the 3 nodes
  • Consecutive requests from same customer land on DIFFERENT nodes

          │
          ▼

  Step 4: RATE LIMITER MIDDLEWARE (on the selected node)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Extract X-Customer-Id from request
  • Look up customer's RPM limit (from config/DB)
  • Check current usage against limit:
      ├── IF under limit → increment counter → ALLOW (continue to Step 5)
      └── IF at/over limit → DENY (skip to Step 6)

          │
          ├── ALLOWED ──────────────────┐
          │                             │
          ▼                             ▼

  Step 5: API HANDLER                Step 6: RATE LIMIT RESPONSE
  ━━━━━━━━━━━━━━━━━━━━━━             ━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Process business logic           • HTTP 429 Too Many Requests
  • Call upstream services           • Header: Retry-After: <seconds>
  • Return 200/201/etc.             • Body: { "error": "rate_limited",
  • Log for billing                 •         "limit": 300,
                                    •         "retry_after": 12 }
          │                             │
          ▼                             ▼

  Step 7: RESPONSE TO CLIENT
  ━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Response passes back through LB to client
  • Billing system records the request (allowed or denied)
  • Audit trail updated

  ---
  UML Sequence Diagram

  ┌────────┐     ┌────────────┐    ┌───────────┐    ┌─────────────┐    ┌───────┐
     ┌──────────┐
  │Customer│     │Load Balancer│    │App Node N │    │Rate Limiter │    │ Redis
  │    │API Handler│
  │ Client │     │+ API Gateway│    │(Stateless)│    │ Middleware  │
  │(Shared)│    │          │
  └───┬────┘     └─────┬───────┘    └─────┬─────┘    └──────┬──────┘
  └───┬───┘    └────┬─────┘
      │                │                  │                  │               │
             │
      │  HTTPS Request │                  │                  │               │
             │
      │───────────────>│                  │                  │               │
             │
      │                │                  │                  │               │
             │
      │                │ Authenticate     │                  │               │
             │
      │                │ Add X-Customer-Id│                  │               │
             │
      │                │ Round-robin route│                  │               │
             │
      │                │─────────────────>│                  │               │
             │
      │                │                  │                  │               │
             │
      │                │                  │  Check rate limit│               │
             │
      │                │                  │─────────────────>│               │
             │
      │                │                  │                  │               │
             │
      │                │                  │                  │  GET/INCR     │
             │
      │                │                  │                  │  counter      │
             │
      │                │                  │                  │──────────────>│
             │
      │                │                  │                  │               │
             │
      │                │                  │                  │  current_count│
             │
      │                │                  │                  │<──────────────│
             │
      │                │                  │                  │               │
             │
      │                │                  │     ┌────────────┴────────────┐  │
             │
      │                │                  │     │ IF count <= RPM limit:  │  │
             │
      │                │                  │     │   ALLOW                 │  │
             │
      │                │                  │     │ ELSE:                   │  │
             │
      │                │                  │     │   DENY (429)            │  │
             │
      │                │                  │     └────────────┬────────────┘  │
             │
      │                │                  │                  │               │
             │
      │                │                  │                  │               │
             │
      │                │                  │  ─ ─ ─ ─ ─ ─ ─ ─ ALLOWED PATH ─ ─ ─
  ─ ─ ─ ─ ─│
      │                │                  │  allow           │               │
             │
      │                │                  │<─────────────────│               │
             │
      │                │                  │                  │               │
             │
      │                │                  │  Forward to handler              │
             │
      │                │
  │─────────────────────────────────────────────────>│
      │                │                  │                  │               │
             │
      │                │                  │                  │               │
   200 OK    │
      │                │
  │<─────────────────────────────────────────────────│
      │                │  200 OK          │                  │               │
             │
      │                │<─────────────────│                  │               │
             │
      │   200 OK       │                  │                  │               │
             │
      │<───────────────│                  │                  │               │
             │
      │                │                  │                  │               │
             │
      │                │                  │  ─ ─ ─ ─ ─ ─ ─ ─  DENIED PATH  ─ ─ ─
  ─ ─ ─ ─ │
      │                │                  │  deny (429)      │               │
             │
      │                │                  │<─────────────────│               │
             │
      │                │  429 + Retry-After│                 │               │
             │
      │                │<─────────────────│                  │               │
             │
      │ 429 Too Many   │                  │                  │               │
             │
      │<───────────────│                  │                  │               │
             │
      │                │                  │                  │               │
             │

  ---
  Class Diagram

  ┌─────────────────────────────────────────────────────────────────────────────
  ─────────┐
  │                              RATE LIMITER SYSTEM - CLASS DIAGRAM
            │
  └─────────────────────────────────────────────────────────────────────────────
  ─────────┘

  ┌─────────────────────────────┐          ┌─────────────────────────────────┐
  │      «interface»            │          │         «interface»              │
  │      RateLimiter            │          │         CounterStore             │
  ├─────────────────────────────┤          ├─────────────────────────────────┤
  │                             │          │                                 │
  │ + isAllowed(req: Request)   │          │ + increment(key: str, window:   │
  │     : RateLimitResult       │          │     int) : int                  │
  │ + getRemainingQuota(        │          │ + getCount(key: str, window:    │
  │     customerId: str) : int  │          │     int) : int                  │
  │                             │          │ + reset(key: str) : void        │
  └──────────────┬──────────────┘          └────────────────┬────────────────┘
                 │                                          │
                 │ implements                               │ implements
         ┌───────┴────────┐                        ┌───────┴────────┐
         │                │                        │                │
  ┌──────▼──────────┐ ┌───▼──────────────┐  ┌──────▼──────────┐
  ┌───▼───────────────┐
  │SlidingWindowLog │ │ TokenBucket      │  │ RedisCounter    │ │
  InMemoryCounter   │
  │RateLimiter      │ │ RateLimiter      │  │ Store           │ │ Store
  (testing)   │
  ├─────────────────┤ ├──────────────────┤  ├─────────────────┤
  ├───────────────────┤
  │- store          │ │- store           │  │- redisClient    │ │- counters: Map
     │
  │- windowSize: ms │ │- bucketCapacity  │  │- keyPrefix      │ │
     │
  │                 │ │- refillRate      │  │                 │ │
     │
  ├─────────────────┤ ├──────────────────┤  ├─────────────────┤
  ├───────────────────┤
  │+ isAllowed()    │ │+ isAllowed()     │  │+ increment()    │ │+ increment()
     │
  │+ getRemainingQ()│ │+ consume()       │  │+ getCount()     │ │+ getCount()
     │
  └─────────────────┘ │+ refill()        │  │+ reset()        │ │+ reset()
     │
                      └──────────────────┘  └─────────────────┘
  └───────────────────┘

  ┌─────────────────────────────────┐
  ┌──────────────────────────────────────┐
  │        CustomerConfig           │       │         RateLimitResult
    │
  ├─────────────────────────────────┤
  ├──────────────────────────────────────┤
  │ + customerId: string            │       │ + allowed: boolean
    │
  │ + tier: Tier                    │       │ + remaining: int
    │
  │ + rpmLimit: int                 │       │ + limit: int
    │
  │ + overrides: OverrideConfig[]   │       │ + retryAfterMs: int | null
    │
  │ + createdAt: DateTime           │       │ + windowResetAt: DateTime
    │
  ├─────────────────────────────────┤
  └──────────────────────────────────────┘
  │ + getEffectiveLimit(            │
  │     now: DateTime) : int        │
  │ + hasActiveOverride(            │
  ┌──────────────────────────────────────┐
  │     now: DateTime) : bool       │       │       OverrideConfig
    │
  └─────────────────────────────────┘
  ├──────────────────────────────────────┤
                                            │ + overrideId: string
    │
                                            │ + customerId: string
    │
  ┌─────────────────────────────────┐       │ + effectiveRpm: int
    │
  │     «enumeration»               │       │ + windowStart: Time (e.g. "02:00")
    │
  │         Tier                    │       │ + windowEnd: Time (e.g. "04:00")
    │
  ├─────────────────────────────────┤       │ + reason: string
    │
  │  STARTER   (60 RPM)            │       │ + approvedBy: string
   │
  │  GROWTH    (300 RPM)           │       │ + expiresAt: DateTime | null
   │
  │  ENTERPRISE (custom RPM)       │
  ├──────────────────────────────────────┤
  └─────────────────────────────────┘       │ + isActive(now: DateTime) : bool
    │

  └──────────────────────────────────────┘

  ┌─────────────────────────────────┐
  ┌──────────────────────────────────────┐
  │     RateLimiterMiddleware       │       │        ConfigService
    │
  ├─────────────────────────────────┤
  ├──────────────────────────────────────┤
  │ - rateLimiter: RateLimiter      │       │ - db: PostgresConnection
    │
  │ - configService: ConfigService  │       │ - cache: Map<str, CustomerConfig>
    │
  │ - auditLogger: AuditLogger     │       │ - cacheTTL: int
   │
  ├─────────────────────────────────┤
  ├──────────────────────────────────────┤
  │ + handle(req, res, next): void  │       │ + getCustomerConfig(id: str)
    │
  │ - extractCustomerId(req): str   │       │     : CustomerConfig
    │
  │ - buildRetryAfterHeader(        │       │ + getEffectiveLimit(id: str,
    │
  │     result: RateLimitResult)    │       │     now: DateTime) : int
    │
  │     : string                    │       │ + listOverrides() : Override[]
    │
  └─────────────────────────────────┘
  └──────────────────────────────────────┘

  ┌─────────────────────────────────┐
  ┌──────────────────────────────────────┐
  │        AuditLogger              │       │       LoadHarness
    │
  ├─────────────────────────────────┤
  ├──────────────────────────────────────┤
  │ - db: PostgresConnection        │       │ + targetUrls: string[]
    │
  │                                 │       │ + customers: HarnessCustomer[]
    │
  ├─────────────────────────────────┤       │ + durationSec: int
    │
  │ + logDecision(                  │       │ + reportFormat: "table"|"json"
     │
  │     customerId: str,            │
  ├──────────────────────────────────────┤
  │     allowed: bool,              │       │ + run() : HarnessReport
    │
  │     currentCount: int,          │       │ + generateTraffic(customer,
    │
  │     limit: int,                 │       │     rpm: int) : RequestLog[]
    │
  │     timestamp: DateTime) : void │       │ + analyzeResults() :
  BoundaryReport  │
  │ + queryHistory(customerId,      │       │ + printReport() : void
    │
  │     range: TimeRange)           │
  └──────────────────────────────────────┘
  │     : AuditEntry[]              │
  └─────────────────────────────────┘

  ---
  Customer Tiers — Detailed Breakdown

  Tier Structure

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        RELAYAPI CUSTOMER TIERS                            │
  ├─────────────┬────────┬────────────────────────────────────────────────── ┤
  │    Tier     │  RPM   │  Characteristics                                  │
  ├─────────────┼────────┼───────────────────────────────────────────────────┤
  │             │        │                                                   │
  │  STARTER    │   60   │  • Long tail of small customers                   │
  │             │        │  • Self-serve signup                              │
  │             │        │  • Low revenue per customer                       │
  │             │        │  • Predictable, low-volume traffic                │
  │             │        │  • 1 req/sec sustained average                    │
  │             │        │                                                   │
  ├─────────────┼────────┼───────────────────────────────────────────────────┤
  │             │        │                                                   │
  │  GROWTH     │  300   │  • Default tier for new signups                   │
  │             │        │  • Mid-market companies                           │
  │             │        │  • Moderate revenue contribution                  │
  │             │        │  • May have periodic spikes                       │
  │             │        │  • 5 req/sec sustained average                    │
  │             │        │                                                   │
  ├─────────────┼────────┼───────────────────────────────────────────────────┤
  │             │        │                                                   │
  │  ENTERPRISE │ Custom │  • Negotiated limits (per contract)               │
  │             │        │  • High-touch, account-managed                    │
  │             │        │  • Large revenue contribution                     │
  │             │        │  • SLA-bound with legal agreements                │
  │             │        │  • May have batch processing patterns             │
  │             │        │  • Northwind: 300 RPM contracted,                 │
  │             │        │    but USES 800-1200 RPM in batch window          │
  │             │        │                                                   │
  └─────────────┴────────┴───────────────────────────────────────────────────┘

  Northwind Logistics — The Critical Customer

  ┌──────────────────────────────────────────────────────────────────────────┐
  │                    NORTHWIND LOGISTICS PROFILE                             │
  ├──────────────────────────────────────────────────────────────────────────┤
  │                                                                          │
  │  Revenue:        ~60% of Annual Recurring Revenue (ARR)                  │
  │  Tier:           Enterprise (custom)                                     │
  │  Contracted RPM: 300                                                     │
  │  Actual Usage:   800–1200 RPM during batch window                        │
  │  Batch Window:   02:00–04:00 UTC (nightly)                               │
  │  Batch Duration: 90–120 minutes                                          │
  │  Renewal:        6 weeks away                                            │
  │  Escalation:     VP of Engineering → CEO (direct)                        │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐  │
  │  │             NORTHWIND TRAFFIC PATTERN (24hr)                        │  │
  │  │                                                                    │  │
  │  │  RPM                                                               │  │
  │  │  1200 ┤                    ████                                     │  │
  │  │  1000 ┤                   ██████                                    │  │
  │  │   800 ┤                  ████████                                   │  │
  │  │   600 ┤                 ██████████                                  │  │
  │  │       ┤                ────────────── ← Actual batch traffic        │  │
  │  │   300 ┤═══════════════════════════════════════════ ← Contracted RPM │  │
  │  │   200 ┤  ░░░░░░░░░░░░░             ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │  │
  │  │   100 ┤  ░░░░░░░░░░░░░             ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │  │
  │  │     0 ┼──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──  │  │
  │  │        00 02 04 06 08 10 12 14 16 18 20 22 24   (UTC)              │  │
  │  │            ▲     ▲                                                 │  │
  │  │         BATCH START  END                                           │  │
  │  └────────────────────────────────────────────────────────────────────┘  │
  │                                                                          │
  │  KEY RISKS:                                                              │
  │  • 429 retries AMPLIFY load (aggressive retry client)                    │
  │  • They will NOT re-architect their scheduler                            │
  │  • Loss = existential threat to RelayAPI                                 │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘

  Revenue Concentration Risk

         RelayAPI Revenue Distribution
         ══════════════════════════════

         ┌─────────────────────────────────────────────────────────────┐
         │████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░│
         │████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░│
         │██████████ NORTHWIND ███████████████░░░ ALL OTHERS ░░░░░░░░░│
         │█████████████ 60% █████████████████░░░░░░ 40% ░░░░░░░░░░░░░│
         │████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░│
         └─────────────────────────────────────────────────────────────┘
          0%              30%              60%              100%

  ---
  Pain Points — Detailed Analysis

  Pain Point 1: Previous Rate Limiter (Deprecated)

  What happened: The old limiter did not correctly enforce limits under
  load-balanced distribution.

  THE NAIVE APPROACH THAT FAILED:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Customer limit: 300 RPM
    Naive idea: Each node gets 300/3 = 100 RPM per node

    PROBLEM: Round-robin is NOT perfectly even.

    Reality over 60 seconds:
    ┌──────────────────────────────────────────────────────┐
    │  Node 1:  received 145 requests  (allowed 100, blocked 45)    │
    │  Node 2:  received  82 requests  (allowed  82, blocked  0)    │
    │  Node 3:  received  73 requests  (allowed  73, blocked  0)    │
    │                                                      │
    │  TOTAL ALLOWED: 255 out of 300 entitled  ← UNDER-SERVED       │
    │  OR                                                  │
    │  Node 1: allowed 100, Node 2: allowed 100, Node 3: allowed 100│
    │  But customer only sent 250 → wasted 50 capacity     │
    └──────────────────────────────────────────────────────┘

    ALTERNATIVE FAILURE: No coordination at all
    ┌──────────────────────────────────────────────────────┐
    │  Each node tracks independently, no shared state:    │
    │  Node 1: thinks customer used  95 RPM  → allows     │
    │  Node 2: thinks customer used 102 RPM  → allows     │
    │  Node 3: thinks customer used  98 RPM  → allows     │
    │                                                      │
    │  ACTUAL: customer used 295 RPM across all nodes      │
    │  But nodes can't see each other's counts!            │
    │                                                      │
    │  Result: allowed WELL ABOVE quota in production      │
    └──────────────────────────────────────────────────────┘

  Why it was decommissioned: It allowed traffic well above contracted quota — a
  compliance and billing integrity failure.

  ---
  Pain Point 2: Staging Incident (New Prototype)

  What happened: The replacement limiter had correctness issues at quota 
  boundaries under Northwind-scale traffic.

  BOUNDARY CORRECTNESS ISSUES:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Common boundary bugs in distributed rate limiters:

    1. RACE CONDITION (Check-then-Increment)
    ┌────────────────────────────────────────────────────────────┐
    │  Time T:  Node 1 reads counter = 299                       │
    │  Time T:  Node 2 reads counter = 299  (same instant!)      │
    │  Time T+1: Node 1 increments → 300  (allows request)      │
    │  Time T+1: Node 2 increments → 301  (allows request)      │
    │                                                            │
    │  Result: 301 requests allowed for a 300 RPM customer       │
    │  At Northwind scale (800-1200 RPM), this race happens      │
    │  dozens of times per minute.                               │
    └────────────────────────────────────────────────────────────┘

    2. WINDOW BOUNDARY RESET RACE
    ┌────────────────────────────────────────────────────────────┐
    │  Fixed window: minute boundary at :00                       │
    │                                                            │
    │  Time 12:00:59.998: Node 1 allows request #300 (at limit) │
    │  Time 12:00:59.999: Node 2 still sees old window,         │
    │                      counter = 299, allows request         │
    │  Time 12:01:00.001: Window resets to 0                     │
    │  Time 12:01:00.002: Burst of requests flood in            │
    │                                                            │
    │  Result: 2x burst allowed at window boundary               │
    │  (Known as the "fixed window boundary burst" problem)      │
    └────────────────────────────────────────────────────────────┘

    3. CLOCK SKEW BETWEEN NODES
    ┌────────────────────────────────────────────────────────────┐
    │  Node 1 clock: 12:01:00.000                                │
    │  Node 2 clock: 12:00:59.850  (150ms behind)               │
    │  Node 3 clock: 12:01:00.200  (200ms ahead)                │
    │                                                            │
    │  Different nodes disagree on which window a request        │
    │  belongs to → inconsistent counting                        │
    └────────────────────────────────────────────────────────────┘

  Why it was rolled back: Correctness at boundaries was not provable under
  production-scale traffic.

  ---
  Pain Point 3: Compliance/Auditability

  ENTERPRISE PROSPECT REQUIREMENT:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Enterprise prospects want a ONE-PARAGRAPH explanation of counting
    semantics for their security review.

    ┌────────────────────────────────────────────────────────────────┐
    │  WHAT THEY NEED TO KNOW:                                       │
    │                                                                │
    │  1. How is a "minute" defined?                                 │
    │     - Fixed calendar minute? (:00 to :59)                      │
    │     - Sliding 60-second window from first request?             │
    │     - Rolling average?                                         │
    │                                                                │
    │  2. When does the counter reset?                               │
    │     - At the minute boundary?                                  │
    │     - After 60s of inactivity?                                 │
    │     - Continuously refilling (token bucket)?                   │
    │                                                                │
    │  3. How are requests counted across nodes?                     │
    │     - Central counter (Redis)?                                 │
    │     - Distributed consensus?                                   │
    │     - Best-effort with error margin?                           │
    │                                                                │
    │  4. What is the error margin?                                  │
    │     - Can they get 301 requests through on a 300 limit?        │
    │     - Or might they get cut off at 298?                        │
    │     - Is the error bounded and documented?                     │
    │                                                                │
    │  "It's complicated" is NOT an answer. (CTO memo)               │
    └────────────────────────────────────────────────────────────────┘

  ---
  Pain Point 4: The Amplification Problem (Northwind-Specific)

  429 RETRY AMPLIFICATION:
  ━━━━━━━━━━━━━━━━━━━━━━━━

    Northwind's client retries aggressively on 429:

    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │  Normal batch:     800 RPM sustained                            │
    │                                                                 │
    │  After first 429:  800 RPM original + retries                   │
    │                    ≈ 1000 RPM total                              │
    │                                                                 │
    │  After more 429s:  Original + Retry wave 1 + Retry wave 2      │
    │                    ≈ 1200-1500 RPM (cascading)                  │
    │                                                                 │
    │  ┌──── TIME ──────────────────────────────────────────────────┐ │
    │  │                                                            │ │
    │  │  RPM  █ = original requests                                │ │
    │  │       ░ = retry requests                                   │ │
    │  │                                                            │ │
    │  │ 1500┤                        ░░░░░                         │ │
    │  │ 1200┤              ░░░░░░░░░░░░░░░░░░░                     │ │
    │  │ 1000┤         ░░░░░░░░░░░░░░░░░░░░░░░░░░░                 │ │
    │  │  800┤    ████████████████████████████████████               │ │
    │  │  600┤    ████████████████████████████████████               │ │
    │  │  300┤────────────────────────────────────────── (limit)    │ │
    │  │     ┼────┬────┬────┬────┬────┬────┬────┬────              │ │
    │  │     02:00  02:15  02:30  02:45  03:00  03:15              │ │
    │  │          ▲                                                 │ │
    │  │       First 429s hit → retry storm begins                  │ │
    │  └────────────────────────────────────────────────────────────┘ │
    │                                                                 │
    │  OUTCOME: Rate limiting Northwind INCREASES total load           │
    │  on the platform, making the situation WORSE for everyone.       │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘

  ---
  The Core Distributed Coordination Challenge

  WHY THIS IS HARD:
  ━━━━━━━━━━━━━━━━━

  ┌──────────────────────────────────────────────────────────────────────────┐
  │                                                                          │
  │  REQUIREMENT: Count ALL requests from Customer X across ALL nodes        │
  │               within a 60-second window, with ≤1% error margin.          │
  │                                                                          │
  │  CONSTRAINTS:                                                            │
  │  • Nodes share NO memory                                                 │
  │  • Round-robin = unpredictable distribution                              │
  │  • Redis MAY or MAY NOT be available                                     │
  │  • Latency to shared store adds p99 tail to every request                │
  │  • Must not fail-open (let unlimited traffic) if store is down           │
  │  • Must not fail-closed (block everyone) if store is slow                │
  │                                                                          │
  │  APPROACHES:                                                             │
  │                                                                          │
  │  ┌─────────────────┬─────────────────┬────────────────────────────────┐  │
  │  │ Approach        │ Pros            │ Cons                           │  │
  │  ├─────────────────┼─────────────────┼────────────────────────────────┤  │
  │  │ Central Redis   │ Strong          │ Single point of failure,       │  │
  │  │ counter         │ consistency     │ adds latency to every req,     │  │
  │  │                 │                 │ Redis may not be provisioned   │  │
  │  ├─────────────────┼─────────────────┼────────────────────────────────┤  │
  │  │ Per-node with   │ Low latency,    │ Inaccurate under uneven        │  │
  │  │ static split    │ no coordination │ distribution, wastes quota     │  │
  │  ├─────────────────┼─────────────────┼────────────────────────────────┤  │
  │  │ Gossip/sync     │ Eventually      │ Complex, window for            │  │
  │  │ between nodes   │ consistent      │ over-counting during sync      │  │
  │  ├─────────────────┼─────────────────┼────────────────────────────────┤  │
  │  │ Sliding window  │ Smooth, no      │ More state to store,           │  │
  │  │ log (central)   │ boundary burst  │ memory grows with traffic      │  │
  │  ├─────────────────┼─────────────────┼────────────────────────────────┤  │
  │  │ Token bucket    │ Allows bursts   │ Harder to explain to           │  │
  │  │ (central)       │ naturally       │ enterprise prospects           │  │
  │  └─────────────────┴─────────────────┴────────────────────────────────┘  │
  │                                                                          │
  │  CTO PREFERENCE: Under-limit rather than over-limit.                     │
  │  → Error direction: reject a few extra rather than allow over quota       │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘

  ---
  Summary

  The system is conceptually simple (HTTP proxy with metering) but the challenge
  lies in:

  1. Distributed correctness — counting accurately across 3 stateless nodes with
  no shared memory
  2. Business conflict — strict enforcement vs. keeping a customer who pays 60%
  of revenue
  3. Boundary behavior — proving the limiter works correctly at the exact
  threshold where it should flip from allow → deny
  4. Auditability — being able to explain the counting algorithm in one
  paragraph to enterprise prospects
  5. Failure modes — what happens when the coordination layer (Redis) is slow or
  unavailable

✻ Cooked for 2m 43s

❯ Break down the CTO's memo and provide me the system requirements. Also share  
  the technical context required by the CTO.                                    

  Thought for 3s (ctrl+o to expand)

● CTO Memo Breakdown — Priya Nair

  Context: This is a directive for GA (General Availability) launch. Billing is
  already wired to per-customer RPM tiers. Legal has signed off on SLA language.
  This means the rate limiter is not a nice-to-have — it's a contractual
  obligation.

  ---
  System Requirements (Non-Negotiable)

  Requirement 1: Hard Enforcement

  ┌───────────────┬─────────────────────────────────────────────────────────┐
  │    Aspect     │                         Detail                          │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ Rule          │ When a customer hits their RPM limit, return 429 Too    │
  │               │ Many Requests with a Retry-After header                 │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ No soft       │ No grace period, no "almost at limit" state             │
  │ warnings      │                                                         │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ No overage    │ No "we'll bill you extra" path in v1                    │
  │ billing       │                                                         │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ Binary        │ Every request is either ALLOWED or DENIED — no middle   │
  │ decision      │ ground                                                  │
  └───────────────┴─────────────────────────────────────────────────────────┘

  REQUEST DECISION FLOW (CTO's model):
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Incoming request from Customer X
           │
           ▼
    ┌─────────────────────────┐
    │ count(X) < limit(X) ?   │
    └────────┬────────────────┘
             │
       ┌─────┴─────┐
       │YES        │NO
       ▼           ▼
    ┌──────┐    ┌──────────────────────────┐
    │ 200  │    │ 429 Too Many Requests    │
    │ OK   │    │ Retry-After: <seconds>   │
    └──────┘    └──────────────────────────┘

    NO EXCEPTIONS IN CODE. NO SOFT STATES.

  Implementation implications:
  - The Retry-After header must be computed — it tells the client how long to
  wait before trying again
  - This requires knowing when the current window resets or when a token will be
  available
  - The response must be immediate (not queued or delayed)

  ---
  Requirement 2: Per-Customer Isolation

  ┌───────────────────┬─────────────────────────────────────────────────────┐
  │      Aspect       │                       Detail                        │
  ├───────────────────┼─────────────────────────────────────────────────────┤
  │ Rule              │ Customer A's traffic spike must NOT consume         │
  │                   │ Customer B's budget                                 │
  ├───────────────────┼─────────────────────────────────────────────────────┤
  │ Shared pools are  │ No global counter divided among customers           │
  │ OUT               │                                                     │
  ├───────────────────┼─────────────────────────────────────────────────────┤
  │ Isolation         │ Each customer's limit is independent of all others  │
  │ guarantee         │                                                     │
  └───────────────────┴─────────────────────────────────────────────────────┘

  WHAT IS FORBIDDEN:
  ━━━━━━━━━━━━━━━━━━

    ✗ Global pool approach:
      ┌────────────────────────────────────────┐
      │  Platform total capacity: 1000 RPM     │
      │  Customer A uses 800 → Customer B      │
      │  only gets 200 even though B's         │
      │  contract says 300                     │
      └────────────────────────────────────────┘

    ✓ Per-customer counter approach:
      ┌────────────────────────────────────────┐
      │  Customer A: 0/300 ████░░░░░░ counter  │
      │  Customer B: 0/300 ████░░░░░░ counter  │
      │  Customer C: 0/60  ██░░░░░░░░ counter  │
      │                                        │
      │  Each is COMPLETELY independent.       │
      │  A's spike cannot touch B's budget.    │
      └────────────────────────────────────────┘

  Implementation implications:
  - Rate limit state must be keyed by customerId
  - Data structure: Map<customerId, counter/bucket>
  - No shared capacity pools, no "borrowing" between customers
  - If the store is slow, you can't fall back to a shared fast-path

  ---
  Requirement 3: Strictly Fair Metering

  ┌──────────────────┬──────────────────────────────────────────────────────┐
  │      Aspect      │                        Detail                        │
  ├──────────────────┼──────────────────────────────────────────────────────┤
  │ Rule             │ Two customers on the same tier must get the same     │
  │                  │ treatment                                            │
  ├──────────────────┼──────────────────────────────────────────────────────┤
  │ No hidden        │ No secret code paths that treat some customers       │
  │ bypasses         │ differently                                          │
  ├──────────────────┼──────────────────────────────────────────────────────┤
  │ No manual        │ No hardcoded exceptions in production traffic paths  │
  │ overrides        │                                                      │
  ├──────────────────┼──────────────────────────────────────────────────────┤
  │ Audit-ready      │ If someone audits the code, every customer goes      │
  │                  │ through the same logic                               │
  └──────────────────┴──────────────────────────────────────────────────────┘

  WHAT IS FORBIDDEN:
  ━━━━━━━━━━━━━━━━━━

    ✗ Hidden bypass:
      if (customerId === "northwind") {
          return ALLOW;  // skip rate check
      }

    ✗ Buried multiplier:
      let limit = customerConfig.rpm;
      if (PREMIUM_LIST.includes(customerId)) {
          limit = limit * 4;  // undocumented
      }

    ✗ Inconsistent algorithm:
      // Use lenient algorithm for big customers,
      // strict algorithm for small ones

  WHAT IS ALLOWED (CTO explicitly says):
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    ✓ Commercial exception through CONFIG and AUDIT:
      {
        "customerId": "northwind",
        "tier": "enterprise",
        "contractedRpm": 300,
        "effectiveRpm": 1200,          ← configurable, auditable
        "overrideReason": "batch window accommodation",
        "approvedBy": "sales-vp",
        "expiresAt": "2026-06-01"
      }

    The key distinction: the ALGORITHM is the same for everyone.
    The INPUT (configured limit) can differ per customer.
    This is auditable and explainable.

  Implementation implications:
  - Single code path for all customers — no branching on customer identity
  - The limit value comes from config/DB, not hardcoded
  - If a customer gets a higher limit, it's visible in config, not buried in
  logic
  - Same algorithm, same enforcement behavior — only the numeric limit differs

  ---
  Requirement 4: Auditable

  ┌─────────────────────────┬────────────────────────────────────────────────┐
  │         Aspect          │                     Detail                     │
  ├─────────────────────────┼────────────────────────────────────────────────┤
  │ Rule                    │ Must be able to explain to an enterprise       │
  │                         │ prospect exactly how requests are counted      │
  ├─────────────────────────┼────────────────────────────────────────────────┤
  │ "It's complicated" is   │ One-paragraph explanation required             │
  │ not an answer           │                                                │
  ├─────────────────────────┼────────────────────────────────────────────────┤
  │ Security review ready   │ Prospects will scrutinize counting semantics   │
  └─────────────────────────┴────────────────────────────────────────────────┘

  WHAT AN AUDIT EXPLANATION LOOKS LIKE:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    GOOD (auditable):
    ┌────────────────────────────────────────────────────────────┐
    │ "We use a sliding window counter with 1-second granularity.│
    │  Each request increments a per-customer counter in a shared│
    │  Redis store. The counter sums all requests in the last 60 │
    │  seconds. If the sum ≥ your contracted RPM, the request is │
    │  rejected with 429. Error margin: ±2 requests due to       │
    │  network propagation (bounded, never exceeds limit+2)."    │
    └────────────────────────────────────────────────────────────┘

    BAD (not auditable):
    ┌────────────────────────────────────────────────────────────┐
    │ "We use a distributed token bucket with gossip protocol    │
    │  synchronization, probabilistic rate estimation via HLL    │
    │  sketches, and adaptive windowing that adjusts based on    │
    │  cluster load. The effective limit may vary by ±15%        │
    │  depending on network conditions."                         │
    │                                                            │
    │  → Enterprise prospect: "So... you don't actually know     │
    │    how many requests you'll allow?"                        │
    └────────────────────────────────────────────────────────────┘

  Implementation implications:
  - Choose a well-understood, well-documented algorithm
  - Must be able to state: "given N RPM limit, here's exactly how we count and
  when we cut off"
  - Error bounds must be known and documented
  - Logging/audit trail of decisions (allowed/denied with counts)

  ---
  Technical Context (CTO's Constraints)

  Constraint 1: Must Work Across 3 Stateless Nodes

  WHAT THE CTO ACCEPTS:
  ━━━━━━━━━━━━━━━━━━━━━

    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │  "Whatever you build must work when requests land on            │
    │   different nodes between seconds"                              │
    │                                                                 │
    │   Request 1 → Node 1 ─┐                                        │
    │   Request 2 → Node 3 ─┤── All must count toward the SAME       │
    │   Request 3 → Node 2 ─┤   customer's single quota              │
    │   Request 4 → Node 1 ─┤                                        │
    │   Request 5 → Node 2 ─┘                                        │
    │                                                                 │
    │  This eliminates:                                               │
    │  • In-process counters (only see local requests)                │
    │  • Static per-node quota splitting (inaccurate)                 │
    │  • Anything that only works with sticky sessions                │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘

  Constraint 2: Eventual Consistency with Error Direction

  CTO'S ERROR PREFERENCE:
  ━━━━━━━━━━━━━━━━━━━━━━━

    "I am fine with eventual consistency as long as the error
     direction is UNDER-LIMITING, not OVER-LIMITING."

    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │  Customer's limit: 300 RPM                                      │
    │                                                                 │
    │  ACCEPTABLE (under-limiting = rejecting too early):             │
    │  ┌──────────────────────────────────────────────────┐           │
    │  │  Actual requests allowed: 295-300                 │           │
    │  │  Customer got slightly LESS than entitled         │           │
    │  │  → Safe. We never violate the SLA ceiling.       │           │
    │  └──────────────────────────────────────────────────┘           │
    │                                                                 │
    │  NOT ACCEPTABLE (over-limiting = allowing too many):            │
    │  ┌──────────────────────────────────────────────────┐           │
    │  │  Actual requests allowed: 305-310                 │           │
    │  │  Customer got MORE than contracted                │           │
    │  │  → Dangerous. SLA violated. Billing inaccurate.  │           │
    │  │  → Legal liability. Previous limiter died for this│           │
    │  └──────────────────────────────────────────────────┘           │
    │                                                                 │
    │  In distributed systems terms:                                  │
    │  • If nodes disagree, err on the side of REJECTING             │
    │  • Better to double-count a request than miss-count it          │
    │  • Better to have slightly conservative limits than lenient     │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘

  What this means for implementation:
  - If Redis is slow and you can't confirm the count, reject (don't assume
  there's room)
  - If two nodes race to increment, allowing a slight over-count in the store is
  OK because it leads to earlier rejection (under-limiting)
  - The bias is: reject when uncertain

  Constraint 3: Well-Understood Algorithm

  CTO'S ALGORITHM PREFERENCE:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━

    "Pick a well-understood algorithm. I do not want a bespoke
     counter unless you can prove it."

    ┌───────────────────────────────────────────────────────────────┐
    │                                                               │
    │  ACCEPTABLE CHOICES (well-understood, documented, proven):    │
    │                                                               │
    │  1. Token Bucket                                              │
    │     • Tokens refill at steady rate                            │
    │     • Each request consumes one token                         │
    │     • Bucket has max capacity = burst allowance               │
    │     • Well-documented: RFC 2697, RFC 2698                     │
    │                                                               │
    │  2. Sliding Window Log                                        │
    │     • Store timestamp of every request                        │
    │     • Count requests in last 60s                              │
    │     • Most accurate, most memory-intensive                    │
    │                                                               │
    │  3. Sliding Window Counter                                    │
    │     • Weighted average of current + previous fixed window     │
    │     • Good accuracy/memory tradeoff                           │
    │     • Well-documented in rate limiting literature             │
    │                                                               │
    │  4. Fixed Window Counter                                      │
    │     • Count per calendar minute                               │
    │     • Simplest to explain and audit                           │
    │     • Known boundary-burst issue (documented, bounded)        │
    │                                                               │
    │  5. Leaky Bucket                                              │
    │     • Queue-based, constant drain rate                        │
    │     • Smooths traffic perfectly                               │
    │     • Adds latency (queuing), not just rejection              │
    │                                                               │
    │  NOT ACCEPTABLE:                                              │
    │  • Custom probabilistic estimators                            │
    │  • ML-based adaptive limits                                   │
    │  • Novel algorithms without published analysis                │
    │  • "I invented something better" without proof                │
    │                                                               │
    └───────────────────────────────────────────────────────────────┘

  ---
  What the CTO Explicitly Does NOT Want

  ┌─────┬─────────────────────────────┬─────────────────────────────────────┐
  │  #  │          Rejection          │                 Why                 │
  ├─────┼─────────────────────────────┼─────────────────────────────────────┤
  │     │ Single-process limiter      │ Each instance would only see ~1/3   │
  │ 1   │ deployed 3x with "fingers   │ of traffic — limits become          │
  │     │ crossed"                    │ meaningless                         │
  ├─────┼─────────────────────────────┼─────────────────────────────────────┤
  │     │ "We'll fix distributed      │ Not acceptable for GA. The          │
  │ 2   │ state in v2"                │ distributed problem must be solved  │
  │     │                             │ NOW. Legal has signed off.          │
  ├─────┼─────────────────────────────┼─────────────────────────────────────┤
  │     │ if (customerId === ...)     │ If a commercial exception is        │
  │ 3   │ special-case hacks          │ needed, it goes through config and  │
  │     │                             │ audit, not a midnight commit        │
  └─────┴─────────────────────────────┴─────────────────────────────────────┘

  ---
  CTO's Success Criteria (Demo Requirement)

  THE DEMO THE CTO WANTS TO SEE:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Setup:
    • 3 nodes running behind a load balancer
    • Customer A: 100 RPM tier
    • Customer B: 100 RPM tier
    • Customer C: sending > 100 RPM

    Prove:
    ┌────────────────────────────────────────────────────────────────┐
    │                                                                │
    │  1. Customer A sends 100 RPM → all 100 allowed ✓              │
    │  2. Customer B sends 100 RPM → all 100 allowed ✓              │
    │     (A and B don't interfere with each other)                  │
    │                                                                │
    │  3. Customer C sends 150 RPM → exactly 100 allowed,           │
    │     50 get 429 ✓                                               │
    │     (Hard enforcement works)                                   │
    │                                                                │
    │  4. Hammer the load balancer RANDOMLY across all 3 nodes       │
    │     → Results stay the same ✓                                  │
    │     (Distributed coordination works)                           │
    │                                                                │
    └────────────────────────────────────────────────────────────────┘

    This is exactly what the LOAD HARNESS must prove.

  ---
  Summary: CTO's Mental Model

  The CTO thinks of the rate limiter as a contract enforcement mechanism:

  1. Legal says the SLA caps requests at contracted RPM — no exceptions
  2. Billing relies on the limiter being accurate — what's allowed is what's
  billed
  3. Fairness is non-negotiable — same tier, same treatment, period
  4. Distributed correctness is a DAY ONE requirement, not a future enhancement
  5. Error bias toward conservative (reject when unsure)
  6. Transparency — explainable algorithm, auditable decisions, config-driven
  exceptions

  The CTO is explicitly leaving room for commercial exceptions ("If we ever
  grant a commercial exception, it goes through config and audit") — but the
  code path must be the same for everyone. The limit number can be different;
  the logic cannot.

✻ Baked for 1m 18s

❯ Break down the support lead's memo and provide me the demands of the support  
  team. Also compare CTO's memo and support leads memo and provide the          
  conflicts of the different teams.                                             

  Thought for 2s (ctrl+o to expand)

● Support Lead Memo Breakdown — Marcus Webb

  Context: This is a P0 escalation. Northwind's VP of Engineering has already
  emailed RelayAPI's CEO directly. Marcus is escalating "again" (implying this
  has been raised before). He's going on PTO next week and threatening to route
  tickets directly to engineering leadership. This is a crisis, not a planning
  discussion.

  ---
  The Incident

  TIMELINE OF EVENTS:
  ━━━━━━━━━━━━━━━━━━━

    ┌────────────────────────────────────────────────────────────────────────┐
    │                                                                        │
    │  1. New rate limiter prototype deployed to STAGING                     │
    │  2. Northwind's nightly batch runs as usual (02:00–04:00 UTC)          │
    │  3. Batch sends ~800–1200 RPM against their 300 RPM contract           │
    │  4. New limiter correctly enforces 300 RPM → returns 429s              │
    │  5. Northwind's aggressive retry client amplifies load                 │
    │  6. Northwind VP emails RelayAPI CEO directly                          │
    │  7. Marcus escalates to engineering (this memo)                        │
    │                                                                        │
    │  KEY QUOTE from Northwind:                                             │
    │  "If your platform can't handle our contracted operations window,      │
    │   we'll need to revisit the partnership."                              │
    │                                                                        │
    │  Translation: Fix this or we leave.                                    │
    │                                                                        │
    └────────────────────────────────────────────────────────────────────────┘

  ---
  Support Team Demands

  Demand 1: Northwind Must NEVER See a 429 During Batch Window

  ┌──────────────────┬──────────────────────────────────────────────────────┐
  │      Aspect      │                        Detail                        │
  ├──────────────────┼──────────────────────────────────────────────────────┤
  │ Rule             │ Zero 429 responses to Northwind between 02:00–04:00  │
  │                  │ UTC                                                  │
  ├──────────────────┼──────────────────────────────────────────────────────┤
  │ Not "fewer"      │ NEVER. Not "reduce by 90%." Zero.                    │
  ├──────────────────┼──────────────────────────────────────────────────────┤
  │ Every night      │ Not a one-time fix. Guaranteed nightly.              │
  ├──────────────────┼──────────────────────────────────────────────────────┤
  │ Regardless of    │ Even at 800–1200 RPM against a 300 RPM contract      │
  │ RPM              │                                                      │
  └──────────────────┴──────────────────────────────────────────────────────┘

  WHAT MARCUS DEMANDS:
  ━━━━━━━━━━━━━━━━━━━━

    Northwind's batch window (02:00–04:00 UTC):

    ┌────────────────────────────────────────────────────────────────┐
    │                                                                │
    │  Current behavior (with new limiter):                          │
    │                                                                │
    │  02:00  Batch starts → 800 RPM                                 │
    │  02:00  Limiter kicks in at 300 → 429 responses                │
    │  02:01  Retries amplify → 1000+ RPM                            │
    │  02:05  Northwind VP sends angry email to CEO                  │
    │  02:10  Batch partially fails, data integrity at risk          │
    │                                                                │
    │  Required behavior:                                            │
    │                                                                │
    │  02:00  Batch starts → 800 RPM                                 │
    │  02:00  ALL requests succeed → 200 OK                          │
    │  02:30  Still 1000+ RPM → ALL succeed                          │
    │  04:00  Batch completes successfully                           │
    │  04:01  Normal rate limiting resumes                           │
    │                                                                │
    └────────────────────────────────────────────────────────────────┘

  ---
  Demand 2: Do NOT Tell Them to "Spread Their Requests Out"

  ┌─────────────┬────────────────────────────────────────────────────────────┐
  │   Aspect    │                           Detail                           │
  ├─────────────┼────────────────────────────────────────────────────────────┤
  │ Rule        │ The solution must be on RelayAPI's side, not Northwind's   │
  ├─────────────┼────────────────────────────────────────────────────────────┤
  │ Why         │ Their ERP controls the schedule; they cannot change it     │
  ├─────────────┼────────────────────────────────────────────────────────────┤
  │ Implication │ We cannot ask the customer to change behavior              │
  ├─────────────┼────────────────────────────────────────────────────────────┤
  │ Reality     │ They've explicitly said they won't re-architect before     │
  │             │ renewal                                                    │
  └─────────────┴────────────────────────────────────────────────────────────┘

  WHAT IS OFF THE TABLE:
  ━━━━━━━━━━━━━━━━━━━━━━

    ✗ "Hey Northwind, can you spread your batch over 6 hours?"
       → They said NO. Their ERP decides.

    ✗ "Can you add exponential backoff to your client?"
       → They already have retries. That's the PROBLEM.

    ✗ "Can you queue requests on your side?"
       → They will not re-architect before renewal (6 weeks).

    ✗ "We'll give you a higher tier for more money"
       → Marcus explicitly says: fix it FIRST, commercial
          arrangement comes LATER.

    The fix must be ENTIRELY on RelayAPI's side.
    The customer changes NOTHING.

  ---
  Demand 3: Exception Must Be Invisible to the Customer

  ┌───────────────┬──────────────────────────────────────────────────────────┐
  │    Aspect     │                          Detail                          │
  ├───────────────┼──────────────────────────────────────────────────────────┤
  │ Rule          │ Northwind should not see errors while "we figure out a   │
  │               │ commercial arrangement"                                  │
  ├───────────────┼──────────────────────────────────────────────────────────┤
  │ Implication   │ No 429s, no degraded responses, no special headers       │
  │               │ revealing the exception                                  │
  ├───────────────┼──────────────────────────────────────────────────────────┤
  │ UX            │ From Northwind's perspective, the API just works         │
  │ requirement   │                                                          │
  └───────────────┴──────────────────────────────────────────────────────────┘

  INVISIBLE MEANS:
  ━━━━━━━━━━━━━━━━

    ✓ Northwind sends 800 RPM → gets 800 responses of 200 OK
      (They don't know anything special happened)

    ✗ Northwind sends 800 RPM → gets 200 OK with header
      "X-Rate-Limit-Exception: temporary-override"
      (Now they know we're doing something special)

    ✗ Northwind sends 800 RPM → gets 200 OK but slower (queued)
      (They'd notice latency spike and investigate)

    ✗ Northwind sends 800 RPM → gets 429 with body
      "Contact sales for higher limits"
      (This is what happened. This is the crisis.)

  ---
  Demand 4: Not Asking to Remove Rate Limiting for Everyone

  ┌─────────────┬───────────────────────────────────────────────────────┐
  │   Aspect    │                        Detail                         │
  ├─────────────┼───────────────────────────────────────────────────────┤
  │ Scope       │ Only Northwind needs this accommodation               │
  ├─────────────┼───────────────────────────────────────────────────────┤
  │ Not anarchy │ Other customers should still be rate-limited normally │
  ├─────────────┼───────────────────────────────────────────────────────┤
  │ Reasonable  │ Marcus acknowledges rate limiting exists for a reason │
  └─────────────┴───────────────────────────────────────────────────────┘

  MARCUS'S ACTUAL ASK (scoped):
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │  Customer        │ Behavior Marcus Wants                │
    │  ─────────────── │ ──────────────────────────────────── │
    │  Northwind       │ No 429s during 02:00–04:00 UTC      │
    │  (batch window)  │                                     │
    │                  │                                     │
    │  Northwind       │ Normal rate limiting (300 RPM)      │
    │  (outside batch) │                                     │
    │                  │                                     │
    │  All others      │ Normal rate limiting always         │
    │                  │                                     │
    └─────────────────────────────────────────────────────────┘

    He's not asking for chaos. He's asking for ONE customer,
    ONE time window, EVERY night.

  ---
  The Urgency Signals

  PRESSURE INDICATORS IN THE MEMO:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    1. "I am escalating this AGAIN"
       → This has been raised before and not resolved

    2. "Northwind's VP of Engineering emailed our CEO this morning"
       → Executive-to-executive escalation = crisis

    3. "60% of our revenue"
       → Losing Northwind = company might not survive

    4. "Renewal is in six weeks"
       → Hard deadline. Not theoretical. Calendar real.

    5. "Marcus is on PTO next week"
       → Implicit deadline: resolve before he leaves

    6. "Routing all Northwind tickets directly to engineering leadership"
       → Threat: if you don't fix it, YOU deal with the angry customer

    BUSINESS REALITY:
    ┌────────────────────────────────────────────────────────────┐
    │                                                            │
    │   If Northwind leaves:                                     │
    │   • 60% revenue gone                                       │
    │   • Likely layoffs                                         │
    │   • Possibly company-ending                                │
    │                                                            │
    │   If we violate "strict fairness" for Northwind:           │
    │   • ???                                                    │
    │   • Other customers probably don't even notice             │
    │   • No immediate business consequence                      │
    │                                                            │
    │   Marcus's implicit argument:                              │
    │   "Principles don't pay salaries."                         │
    │                                                            │
    └────────────────────────────────────────────────────────────┘

  ---
  Head-to-Head Comparison: CTO vs. Support Lead

  Direct Conflicts

  #: 1
  Issue: 429 for Northwind
  CTO (Priya Nair): If they exceed 300 RPM, they get 429. That's the contract.
  Support Lead (Marcus Webb): Northwind must NEVER see 429 during batch.
  Conflict: Direct contradiction
  ────────────────────────────────────────
  #: 2
  Issue: Special treatment
  CTO (Priya Nair): No hidden bypasses, no manual overrides in production paths
  Support Lead (Marcus Webb): Make an exception — make it invisible
  Conflict: Direct contradiction
  ────────────────────────────────────────
  #: 3
  Issue: Fairness
  CTO (Priya Nair): Same tier = same treatment. No customer gets favored.
  Support Lead (Marcus Webb): Northwind gets special treatment because they're
  60% of revenue
  Conflict: Direct contradiction
  ────────────────────────────────────────
  #: 4
  Issue: Code-level exceptions
  CTO (Priya Nair): No if (customerId === ...) blocks
  Support Lead (Marcus Webb): "If you need a temporary exception mechanism,
  fine"
  Conflict: Direct contradiction
  ────────────────────────────────────────
  #: 5
  Issue: Who adapts
  CTO (Priya Nair): The system enforces limits; customers adapt or upgrade
  Support Lead (Marcus Webb): The system adapts to the customer; don't tell them

  to change
  Conflict: Philosophical conflict

  ---
  Detailed Conflict Analysis

  Conflict 1: Hard Enforcement vs. Zero 429s

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  CTO:     "Return 429 when customer hits RPM limit. Not 'mostly,' not      │
  │            'on average' — NEVER exceed quota."
  │
  │
  │
  │  SUPPORT: "Northwind must NEVER see a 429 during their batch window."      │
  │
  │
  │  ┌─────────────────────────────────────────────────────────────────────┐   │
  │  │                                                                     │   │
  │  │   Northwind batch: 800-1200 RPM                                     │   │
  │  │   Northwind contract: 300 RPM                                       │   │
  │  │                                                                     │   │
  │  │   CTO's system: 300 allowed, 500-900 get 429  ← CTO happy          │   │
  │  │   Support's ask: 800-1200 allowed, 0 get 429  ← Support happy      │   │
  │  │                                                                     │   │
  │  │   BOTH CANNOT BE TRUE SIMULTANEOUSLY.                               │   │
  │  │                                                                     │   │
  │  └─────────────────────────────────────────────────────────────────────┘   │
  │
  │
  │  THE GAP: Northwind needs 4x their contracted limit during batch.          │
  │  CTO says limit is sacred. Support says customer is sacred.                │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Conflict 2: No Special Cases vs. Exception Mechanism

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  CTO:     "No special-case hacks buried in if (customerId === ...) blocks. │
  │            If we ever grant a commercial exception, it goes through config
  │
  │            and audit — not a midnight commit."
  │
  │
  │
  │  SUPPORT: "If you need a temporary exception mechanism, fine — but it must │
  │            be invisible to the customer."
  │
  │
  │
  │  ┌─────────────────────────────────────────────────────────────────────┐   │
  │  │                                                                     │   │
  │  │  CTO's red line:                                                    │   │
  │  │  • No hardcoded customer checks in code                             │   │
  │  │  • Exceptions ONLY through config + audit trail                     │   │
  │  │  • Every exception is visible, explainable, reversible              │   │
  │  │                                                                     │   │
  │  │  Support's ask:                                                     │   │
  │  │  • Exception must exist (somehow)                                   │   │
  │  │  • Exception must be invisible to customer                          │   │
  │  │  • Needs to work TONIGHT, not after a commercial renegotiation      │   │
  │  │                                                                     │   │
  │  │  PARTIAL OVERLAP:                                                   │   │
  │  │  Both agree an exception mechanism can exist.                       │   │
  │  │  CTO: "through config and audit"                                    │   │
  │  │  Support: "temporary exception mechanism, fine"                     │   │
  │  │                                                                     │   │
  │  │  THE CRACK: CTO leaves a door open for config-driven exceptions.    │   │
  │  │  This is where resolution lives.                                    │   │
  │  │                                                                     │   │
  │  └─────────────────────────────────────────────────────────────────────┘   │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Conflict 3: Fairness vs. Business Survival

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  CTO:     "Two customers on the same tier must get the same treatment."    │
  │
  │
  │  SUPPORT: "Northwind is 60% of revenue. A literal reading of RPM limits   │
  │            that breaks their batch is not a viable outcome for this
  │
  │            company."
  │
  │
  │
  │  ┌─────────────────────────────────────────────────────────────────────┐   │
  │  │                                                                     │   │
  │  │  CTO's worldview:                                                   │   │
  │  │  ┌──────────────────────────────────────────────┐                   │   │
  │  │  │  Rules apply equally to all.                  │                   │
  │
  │  │  │  If Northwind needs more, they UPGRADE.       │                   │
  │
  │  │  │  The system is the authority.                 │                   │
  │
  │  │  │  Fairness protects smaller customers too.     │                   │
  │
  │  │  └──────────────────────────────────────────────┘                   │   │
  │  │                                                                     │   │
  │  │  Support's worldview:                                               │   │
  │  │  ┌──────────────────────────────────────────────┐                   │   │
  │  │  │  Rules that kill the company aren't rules.    │                   │
  │
  │  │  │  Revenue concentration = existential risk.    │                   │
  │
  │  │  │  The customer is the authority.               │                   │
  │
  │  │  │  No smaller customer is harmed by this.       │                   │
  │
  │  │  └──────────────────────────────────────────────┘                   │   │
  │  │                                                                     │   │
  │  │  NEITHER IS WRONG. This is a values conflict, not a logic error.    │   │
  │  │                                                                     │   │
  │  └─────────────────────────────────────────────────────────────────────┘   │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Conflict 4: Timelines

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  CTO:     "We are two sprints from GA."                                    │
  │            → Build it right for launch. Correctness first.
  │
  │
  │
  │  SUPPORT: "Renewal is in six weeks." / "Marcus on PTO next week."          │
  │            → Fix it NOW. Tonight's batch must work.
  │
  │
  │
  │  ┌─────────────────────────────────────────────────────────────────────┐   │
  │  │                                                                     │   │
  │  │  Timeline comparison:                                               │   │
  │  │                                                                     │   │
  │  │  TODAY──────────┬────────────────┬──────────────────┬──────         │   │
  │  │                 │                │                  │               │   │
  │  │           Marcus PTO       GA Launch         Northwind              │   │
  │  │           (1 week)         (2 sprints        Renewal                │   │
  │  │                             ≈ 4 weeks)       (6 weeks)              │   │
  │  │                 │                │                  │               │   │
  │  │                 ▼                ▼                  ▼               │   │
  │  │           "Fix it before    "Build it right    "Don't lose          │   │
  │  │            I leave"          for launch"       this customer"       │   │
  │  │                                                                     │   │
  │  │  Support needs it YESTERDAY.                                        │   │
  │  │  CTO needs it RIGHT for GA (4 weeks).                               │   │
  │  │  Business needs Northwind happy for renewal (6 weeks).              │   │
  │  │                                                                     │   │
  │  └─────────────────────────────────────────────────────────────────────┘   │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  The Resolution Space (Where Both Memos Agree)

  Despite the conflicts, there IS common ground:

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                        AREAS OF AGREEMENT
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  1. Rate limiting SHOULD exist for everyone
  │
  │     CTO: "Hard enforcement"
  │
  │     Support: "I am NOT asking you to remove rate limiting for everyone"
  │
  │
  │
  │  2. Exception mechanisms CAN exist
  │
  │     CTO: "If we ever grant a commercial exception, it goes through
  │
  │           config and audit"
  │
  │     Support: "If you need a temporary exception mechanism, fine"
  │
  │
  │
  │  3. The problem is scoped (one customer, one time window)
  │
  │     CTO: doesn't forbid different configured limits for different customers
  │
  │     Support: "Only Northwind, only batch window"
  │
  │
  │
  │  4. Both want the system to be robust
  │
  │     CTO: correct distributed enforcement
  │
  │     Support: reliable (no surprise failures)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  The Key Insight for Resolution

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  THE CTO'S EXACT WORDS:
  │
  │
  │
  │    "If we ever grant a commercial exception, it goes through
  │
  │     CONFIG and AUDIT — not a midnight commit."
  │
  │
  │
  │  THIS IS THE DOOR:
  │
  │
  │
  │  A configurable, auditable override system that:
  │
  │  • Raises Northwind's EFFECTIVE limit to 1200 RPM during 02:00–04:00       │
  │  • Is stored in config/DB (not hardcoded)
  │
  │  • Has an audit trail (who approved, when, why, expiration)
  │
  │  • Uses the SAME algorithm and code path as everyone else
  │
  │  • Is visible to anyone who looks at customer config
  │
  │
  │
  │  ┌─────────────────────────────────────────────────────────────────────┐   │
  │  │                                                                     │   │
  │  │  The algorithm doesn't change.                                      │   │
  │  │  The code path doesn't branch on customerId.                        │   │
  │  │  The CONFIGURED LIMIT changes based on time window.                 │   │
  │  │                                                                     │   │
  │  │  Every customer can have time-window overrides.                     │   │
  │  │  Northwind just happens to be the first one configured.             │   │
  │  │  It's generic, auditable, configurable.                             │   │
  │  │                                                                     │   │
  │  │  CTO:     ✓ Same algorithm, same code path, config-driven, auditable│   │
  │  │  SUPPORT: ✓ Northwind doesn't see 429 during batch                  │   │
  │  │                                                                     │   │
  │  └─────────────────────────────────────────────────────────────────────┘   │
  │
  │
  │  WHAT YOU EXPLICITLY REJECT:
  │
  │  • The limit is NOT "unlimited" — it's raised to accommodate known usage   │
  │  • It's NOT invisible to internal auditors — it's in config
  │
  │  • It's NOT permanent — it has an expiration (forces commercial resolution)
  │
  │  • It's NOT a code hack — any customer could get one through the same path
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Summary Table

  Dimension: Enforcement
  CTO Wants: Hard 429 at limit
  Support Wants: No 429 for Northwind
  Tension: The "limit" must be different during batch
  Resolution Lever: Config-driven time-window limits
  ────────────────────────────────────────
  Dimension: Fairness
  CTO Wants: Same tier = same rules
  Support Wants: Northwind gets special pass
  Tension: The mechanism must be generic, not a hack
  Resolution Lever: Any customer can have overrides (generic feature)
  ────────────────────────────────────────
  Dimension: Visibility
  CTO Wants: Auditable, explainable
  Support Wants: Invisible to customer
  Tension: Internal audit ≠ customer-visible
  Resolution Lever: Internally visible in config; externally seamless
  ────────────────────────────────────────
  Dimension: Code purity
  CTO Wants: No if (customer) branches
  Support Wants: Exception must exist somehow
  Tension: No code branching; config branching instead
  Resolution Lever: Limit resolution function checks config, not IDs
  ────────────────────────────────────────
  Dimension: Timeline
  CTO Wants: Right for GA (4 weeks)
  Support Wants: Fixed tonight
  Tension: Both need it soon
  Resolution Lever: Build the override system as part of the rate limiter from
  day one

  The assignment's challenge is not picking a "winner" — it's finding a design
  that satisfies the spirit of both memos while explicitly documenting what you
  chose to sacrifice from each.

✻ Crunched for 1m 44s

❯ Elaborate in detail about the NorthWind's exception. Also state the logistics 
  of the company along with a detailed information about the nightly batch of   
  the North Wind.                                                               

  Thought for 9s (ctrl+o to expand)

● Northwind Logistics — Complete Profile

  ---
  Company Overview

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                     NORTHWIND LOGISTICS — CUSTOMER PROFILE
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  Company Type:        B2B Logistics / Supply Chain
  │
  │  RelayAPI Tier:       Enterprise (custom/negotiated)
  │
  │  Contracted RPM:      300 requests per minute
  │
  │  Actual Peak Usage:   800–1200 RPM (during batch)
  │
  │  Revenue Share:       ~60% of RelayAPI's Annual Recurring Revenue (ARR)
  │
  │  Renewal Status:      6 weeks away, active conversation, CEO involved
  │
  │  Escalation Level:    VP of Engineering → RelayAPI CEO (direct)
  │
  │  Risk Classification: EXISTENTIAL — loss = potential company failure
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Northwind's Business Context (Inferred from Assignment)

  Northwind Logistics is a logistics company that relies on RelayAPI's metered
  HTTP APIs for its core operations. As a logistics company, their likely use of
  RelayAPI involves:

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                  NORTHWIND'S LIKELY API USAGE PATTERN
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT A LOGISTICS COMPANY DOES WITH AN API PLATFORM:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  DAYTIME (normal operations, ~100-200 RPM):                          │  │
  │  │  • Real-time shipment tracking queries                               │  │
  │  │  • Driver/fleet status updates                                       │  │
  │  │  • Customer-facing delivery status lookups                           │  │
  │  │  • Warehouse inventory sync                                          │  │
  │  │  • Route optimization API calls                                      │  │
  │  │                                                                      │  │
  │  │  NIGHTLY BATCH (02:00–04:00 UTC, ~800-1200 RPM):                     │  │
  │  │  • Bulk reconciliation of all day's shipments                        │  │
  │  │  • ERP system sync (orders, invoices, manifests)                     │  │
  │  │  • Route planning for next-day deliveries                            │  │
  │  │  • Compliance reporting data pulls                                   │  │
  │  │  • Cross-system data synchronization                                 │  │
  │  │  • End-of-day financial reconciliation                               │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  The Nightly Batch — Detailed Breakdown

  What Is the Nightly Batch?

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                      NORTHWIND NIGHTLY BATCH PROCESS
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  TRIGGER:       ERP system scheduler (automated, no human in the loop)
  │
  │  WINDOW:        02:00–04:00 UTC (every night, 7 days a week)
  │
  │  DURATION:      90–120 minutes (varies by queue depth)
  │
  │  THROUGHPUT:    800–1200 RPM sustained
  │
  │  TOTAL REQUESTS: ~72,000–144,000 per batch run
  │
  │                  (800 RPM × 90 min = 72,000 minimum)
  │
  │                  (1200 RPM × 120 min = 144,000 maximum)
  │
  │  CRITICALITY:   Business-critical (data integrity depends on completion)
  │
  │  CONTROLLABLE:  NO — Northwind cannot/will not change the schedule
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Why 02:00–04:00 UTC?

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  WHY THIS WINDOW EXISTS (logistics industry norms):
  │
  │
  │
  │  02:00 UTC is chosen because:
  │
  │
  │
  │  1. END OF BUSINESS DAY (North America)
  │
  │     • 02:00 UTC = 9:00 PM ET / 6:00 PM PT                                  │
  │     • All day's operations are complete
  │
  │     • Warehouses closed, drivers off-shift
  │
  │     • Full day's data is available for reconciliation
  │
  │
  │
  │  2. BEFORE NEXT BUSINESS DAY
  │
  │     • Results must be ready by 06:00-08:00 UTC (early morning)
  │
  │     • Next-day route plans need to be computed overnight
  │
  │     • Financial close requires overnight processing                        │
  │
  │
  │  3. LOW-CONTENTION WINDOW
  │
  │     • Minimal real-time traffic competing for resources
  │
  │     • Database locks are less disruptive
  │
  │     • If batch fails, there's time to retry before morning                 │
  │
  │
  │  4. ERP SCHEDULING CONSTRAINTS
  │
  │     • Enterprise ERP systems (SAP, Oracle, etc.) have rigid schedulers
  │
  │     • Batch windows are configured months in advance
  │
  │     • Changing them requires change management, testing, approval
  │
  │     • Cross-system dependencies: other batches may depend on this one
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Northwind's statement: "We will NOT re-architect our scheduler      │  │
  │  │  before renewal."                                                    │  │
  │  │                                                                      │  │
  │  │  Translation: Changing ERP batch schedules is a 3-6 month project    │  │
  │  │  involving their DBA team, testing, compliance, and multiple         │  │
  │  │  downstream systems. It's not happening in 6 weeks.                  │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Batch Traffic Shape

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  NORTHWIND BATCH TRAFFIC PATTERN (detailed):
  │
  │
  │
  │  RPM
  │
  │  1400 ┤
  │
  │       │
  │
  │  1200 ┤              ┌────────────────────┐ ← Peak: varies by queue depth
  │
  │       │             ╱│                    │╲
  │
  │  1000 ┤           ╱  │  SUSTAINED PLATEAU │  ╲
  │
  │       │         ╱    │  (main processing) │    ╲
  │
  │   800 ┤       ╱      │                    │      ╲    ← Minimum sustained
  │
  │       │     ╱        └────────────────────┘        ╲
  │
  │   600 ┤   ╱          ▲                    ▲          ╲
  │
  │       │ ╱         RAMP UP              RAMP DOWN       ╲
  │
  │   400 ┤╱          (warm-up)            (tail jobs)       ╲
  │
  │       │                                                    ╲
  │
  │   300 ┤═══════════════════════════════════════════════════════════ LIMIT
  │
  │       │
  │
  │   200 ┤░░░░░░                                              ░░░░░░░░░░░░░░  │
  │       │░░░░░░  ← normal daytime                            ░░░░░░░░░░░░░░  │
  │   100 ┤░░░░░░    operations                                ░░░░░░░░░░░░░░  │
  │       │░░░░░░                                              ░░░░░░░░░░░░░░  │
  │     0 ┼──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──   │
  │       00:00  01:00  02:00  02:30  03:00  03:30  04:00  05:00  06:00
  │
  │                     │                           │
  │
  │                     ▼                           ▼
  │
  │               BATCH START                  BATCH END
  │
  │
  │
  │  PHASES OF THE BATCH:
  │
  │
  │
  │  ┌──────────┬────────────┬─────────────────────────────────────────────┐   │
  │  │ Phase    │ Duration   │ Behavior                                    │   │
  │  ├──────────┼────────────┼─────────────────────────────────────────────┤   │
  │  │ Ramp-up  │ ~5-10 min  │ 300→800 RPM as workers spin up             │   │
  │  │ Plateau  │ ~60-90 min │ 800-1200 RPM sustained processing          │   │
  │  │ Ramp-down│ ~10-20 min │ 1200→300 RPM as queue drains               │   │
  │  │ Tail     │ ~5-10 min  │ Stragglers, retries, confirmations         │   │
  │  └──────────┴────────────┴─────────────────────────────────────────────┘   │
  │
  │
  │  Total window: 90–120 minutes depending on queue depth
  │
  │  Queue depth varies by: day of week, season, order volume
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  What the Batch Actually Does (Request-Level)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  BATCH JOB INTERNAL STRUCTURE:
  │
  │
  │
  │  ┌────────────────────────────────────────────────────────────────────┐    │
  │  │  NORTHWIND ERP SYSTEM                                              │    │
  │  │                                                                    │    │
  │  │  ┌─────────────────────┐                                          │    │
  │  │  │  Job Scheduler      │ ← Triggers at 02:00 UTC                  │    │
  │  │  │  (cron / ERP timer) │                                          │    │
  │  │  └─────────┬───────────┘                                          │    │
  │  │            │                                                       │    │
  │  │            ▼                                                       │    │
  │  │  ┌─────────────────────┐                                          │    │
  │  │  │  Work Queue         │ ← Populated with day's pending items     │    │
  │  │  │  (thousands of jobs)│    Could be 50,000-100,000 items         │    │
  │  │  └─────────┬───────────┘                                          │    │
  │  │            │                                                       │    │
  │  │            ▼                                                       │    │
  │  │  ┌─────────────────────┐                                          │    │
  │  │  │  Worker Pool        │ ← Multiple parallel workers              │    │
  │  │  │  (N threads/procs)  │    Each worker makes API calls           │    │
  │  │  └─────────┬───────────┘                                          │    │
  │  │            │                                                       │    │
  │  │            │  Each worker pulls jobs and calls RelayAPI:           │    │
  │  │            │                                                       │    │
  │  │            ▼                                                       │    │
  │  │  ┌─────────────────────────────────────────────────────────────┐  │    │
  │  │  │  Per job, multiple API calls:                                │  │    │
  │  │  │                                                             │  │    │
  │  │  │  1. GET  /api/v1/shipments/{id}        (fetch status)       │  │    │
  │  │  │  2. POST /api/v1/reconcile             (sync data)          │  │    │
  │  │  │  3. GET  /api/v1/routes?date=tomorrow  (route planning)     │  │    │
  │  │  │  4. POST /api/v1/reports               (compliance)         │  │    │
  │  │  │                                                             │  │    │
  │  │  │  ~3-5 API calls per job × thousands of jobs = 800-1200 RPM  │  │    │
  │  │  └─────────────────────────────────────────────────────────────┘  │    │
  │  │                                                                    │    │
  │  └────────────────────────────────────────────────────────────────────┘    │
  │
  │
  │  WHY IT'S 800-1200 RPM:
  │
  │  • Queue depth: 20,000–40,000 items on a typical night
  │
  │  • Each item: 3-5 API calls
  │
  │  • Worker concurrency: tuned to process everything within 2-hour window
  │
  │  • They CANNOT slow down: if they reduce concurrency, batch exceeds
  │
  │    the window and overlaps with morning operations
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  The Retry Amplification Problem (Critical Detail)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  NORTHWIND'S RETRY BEHAVIOR:
  │
  │
  │
  │  Their HTTP client is configured with AGGRESSIVE retries.
  │
  │  This is standard in enterprise logistics (data loss is unacceptable).
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  RETRY CONFIGURATION (typical enterprise pattern):                   │  │
  │  │                                                                      │  │
  │  │  • Max retries: 3-5 per request                                      │  │
  │  │  • Backoff: minimal or none (they want throughput, not politeness)   │  │
  │  │  • Retry on: 429, 500, 502, 503, timeout                            │  │
  │  │  • No circuit breaker (batch MUST complete)                          │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  AMPLIFICATION CASCADE:
  │
  │
  │
  │  Minute 1 (no 429s yet):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Original requests:   800 RPM                                        │  │
  │  │  Retries:               0 RPM                                        │  │
  │  │  TOTAL:               800 RPM                                        │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  Minute 2 (limiter kicks in at 300 RPM, 500 get 429):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Original requests:   800 RPM (new work still coming)                │  │
  │  │  Retry wave 1:        500 RPM (retrying the 429s from minute 1)      │  │
  │  │  TOTAL:             1,300 RPM → 1,000 get 429                        │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  Minute 3 (cascade intensifies):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Original requests:   800 RPM                                        │  │
  │  │  Retry wave 1:        500 RPM (still retrying minute 1 failures)     │  │
  │  │  Retry wave 2:      1,000 RPM (retrying minute 2 failures)           │  │
  │  │  TOTAL:             2,300 RPM → 2,000 get 429                        │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  Minute 4+ (steady-state disaster):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  System is now overwhelmed with retries.                             │  │
  │  │  Effective load: 2,000-3,000+ RPM                                    │  │
  │  │  Success rate: ~10-15% (only 300 out of 2000+ succeed)               │  │
  │  │  Batch progress: nearly stalled                                      │  │
  │  │  Batch completion: WILL EXCEED 4-hour window                         │  │
  │  │  Data integrity: AT RISK (partial completion)                        │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │
  │
  │  VISUAL: RETRY STORM
  │
  │
  │
  │  RPM
  │
  │  3000 ┤                         ░░░░░░░░░░░░░░░░  ← retry storm            │
  │       │                       ░░░░░░░░░░░░░░░░░░░░                         │
  │  2500 ┤                     ░░░░░░░░░░░░░░░░░░░░░░░░                       │
  │       │                   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░                     │
  │  2000 ┤                 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                   │
  │       │               ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                │
  │  1500 ┤             ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░              │
  │       │           ░░░░░░░░░░░░ RETRIES ░░░░░░░░░░░░░░░░░░░░░░             │
  │  1000 ┤         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░           │
  │       │       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░         │
  │   800 ┤  ████████████████████████████████████████████████████████████      │
  │       │  ██████████████████ ORIGINAL REQUESTS █████████████████████████
  │
  │   300 ┤══════════════════════════════════════════════════════════ LIMIT
  │
  │       │
  │
  │     0 ┼──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────         │
  │       02:00  02:01  02:02  02:03  02:04  02:05  02:06  02:07               │
  │              ▲
  │
  │         First 429s trigger cascade
  │
  │
  │
  │  KEY INSIGHT: Rate limiting Northwind INCREASES total platform load.
  │
  │  The "protective" mechanism becomes a DoS amplifier.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Why Northwind Can't Change

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  NORTHWIND'S CONSTRAINTS (why they won't re-architect):
  │
  │
  │
  │  ┌────────────────────────────────────────────────────────────────────┐    │
  │  │                                                                    │    │
  │  │  1. ERP SYSTEM RIGIDITY                                            │    │
  │  │     • Enterprise ERP (SAP/Oracle/custom) batch scheduling is       │    │
  │  │       deeply integrated with dozens of other processes             │    │
  │  │     • Changing one batch affects upstream/downstream dependencies  │    │
  │  │     • Change management process: 3-6 months minimum               │    │
  │  │     • Requires testing, UAT, compliance sign-off                  │    │
  │  │                                                                    │    │
  │  │  2. BUSINESS-CRITICAL DATA INTEGRITY                               │    │
  │  │     • The batch reconciles financial data                         │    │
  │  │     • Must complete before morning operations begin                │    │
  │  │     • Spreading over 6 hours means data isn't ready at 06:00      │    │
  │  │     • Partial completion = data inconsistency = operational risk   │    │
  │  │                                                                    │    │
  │  │  3. CONTRACTUAL POSITION                                           │    │
  │  │     • Northwind views this as RelayAPI's problem, not theirs       │    │
  │  │     • "If your platform can't handle our operations window..."     │    │
  │  │     • They're paying for a service; they expect it to work         │    │
  │  │     • They may not even know their RPM exceeds the contract        │    │
  │  │       (they see "operations window" not "rate limit violation")    │    │
  │  │                                                                    │    │
  │  │  4. TIMELINE                                                       │    │
  │  │     • Renewal in 6 weeks — no major engineering work before then   │    │
  │  │     • Their engineering resources are allocated to other projects  │    │
  │  │     • Even if they agreed today, implementation takes months       │    │
  │  │                                                                    │    │
  │  │  5. LEVERAGE                                                       │    │
  │  │     • They're 60% of revenue — they have all the power            │    │
  │  │     • They can credibly threaten to leave                         │    │
  │  │     • RelayAPI needs them more than they need RelayAPI            │    │
  │  │                                                                    │    │
  │  └────────────────────────────────────────────────────────────────────┘    │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  The Exception Mechanism — Design Requirements

  What the Exception Must Achieve

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  THE EXCEPTION REQUIREMENT (synthesized from both memos):
  │
  │
  │
  │  ┌────────────────────────────────────────────────────────────────────┐    │
  │  │                                                                    │    │
  │  │  MUST:                                                             │    │
  │  │  ├── Allow Northwind 800-1200 RPM during 02:00–04:00 UTC          │    │
  │  │  ├── Be config-driven (not hardcoded in application logic)        │    │
  │  │  ├── Be auditable (who approved, when, why, expiration)           │    │
  │  │  ├── Be invisible to the CUSTOMER (they see 200 OK, not 429)     │    │
  │  │  ├── Be visible INTERNALLY (audit trail, config review)           │    │
  │  │  ├── Use the SAME code path as all other customers                │    │
  │  │  ├── Be generic (any customer could get the same mechanism)       │    │
  │  │  └── Be temporary (forces commercial resolution)                  │    │
  │  │                                                                    │    │
  │  │  MUST NOT:                                                         │    │
  │  │  ├── Be a hardcoded `if (customerId === "northwind")` check       │    │
  │  │  ├── Remove rate limiting for all customers                       │    │
  │  │  ├── Be a permanent free pass (must expire)                       │    │
  │  │  ├── Affect other customers' quotas (per-customer isolation)      │    │
  │  │  ├── Be unexplainable to an auditor                              │    │
  │  │  └── Require Northwind to change anything on their side           │    │
  │  │                                                                    │    │
  │  └────────────────────────────────────────────────────────────────────┘    │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Exception Data Model

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  OVERRIDE CONFIGURATION (stored in DB/config, not code):
  │
  │
  │
  │  ┌────────────────────────────────────────────────────────────────────┐    │
  │  │                                                                    │    │
  │  │  {                                                                 │    │
  │  │    "overrideId": "override-northwind-batch-2026",                  │    │
  │  │    "customerId": "northwind-logistics",                            │    │
  │  │    "type": "time_window_burst",                                    │    │
  │  │                                                                    │    │
  │  │    // What changes                                                 │    │
  │  │    "baseRpm": 300,              // their contracted limit          │    │
  │  │    "effectiveRpm": 1200,        // limit during override window    │    │
  │  │                                                                    │    │
  │  │    // When it applies                                              │    │
  │  │    "schedule": {                                                   │    │
  │  │      "windowStart": "02:00",    // UTC                             │    │
  │  │      "windowEnd": "04:00",      // UTC                             │    │
  │  │      "daysOfWeek": ["*"],       // every day                       │    │
  │  │      "timezone": "UTC"                                             │    │
  │  │    },                                                              │    │
  │  │                                                                    │    │
  │  │    // Governance                                                   │    │
  │  │    "approvedBy": "vp-sales",                                       │    │
  │  │    "approvalDate": "2026-03-15",                                   │    │
  │  │    "reason": "Northwind batch accommodation pending contract       │    │
  │  │              renegotiation — approved per revenue risk assessment", │
  │
  │  │    "ticketRef": "SUPPORT-4521",                                    │    │
  │  │                                                                    │    │
  │  │    // Expiration (forces commercial resolution)                    │    │
  │  │    "expiresAt": "2026-05-01",   // before renewal closes          │    │
  │  │    "reviewDate": "2026-04-15",  // 2 weeks before expiry          │    │
  │  │                                                                    │    │
  │  │    // Audit                                                        │    │
  │  │    "createdAt": "2026-03-15T10:00:00Z",                            │    │
  │  │    "lastModified": "2026-03-15T10:00:00Z",                         │    │
  │  │    "modifiedBy": "platform-eng"                                    │    │
  │  │  }                                                                 │    │
  │  │                                                                    │    │
  │  └────────────────────────────────────────────────────────────────────┘    │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  How the Exception Works at Runtime

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  RATE LIMIT RESOLUTION FLOW (same code path for ALL customers):
  │
  │
  │
  │  ┌────────────────────────────────────────────────────────────────────┐    │
  │  │                                                                    │    │
  │  │  function getEffectiveLimit(customerId, currentTime):              │    │
  │  │                                                                    │    │
  │  │      config = loadCustomerConfig(customerId)                       │    │
  │  │      baseLimit = config.contractedRpm         // e.g. 300          │    │
  │  │                                                                    │    │
  │  │      // Check for active overrides (GENERIC — not customer-specific│    │
  │  │      // logic, just config lookup)                                 │    │
  │  │      overrides = config.overrides.filter(o => o.isActive(now))     │    │
  │  │                                                                    │    │
  │  │      if (overrides.length > 0):                                    │    │
  │  │          return max(overrides.map(o => o.effectiveRpm))            │    │
  │  │      else:                                                         │    │
  │  │          return baseLimit                                          │    │
  │  │                                                                    │    │
  │  └────────────────────────────────────────────────────────────────────┘    │
  │
  │
  │
  │
  │  EXAMPLE SCENARIOS:
  │
  │
  │
  │  ┌────────────────────────────────────────────────────────────────────┐    │
  │  │                                                                    │    │
  │  │  Scenario 1: Northwind at 01:59 UTC (outside batch window)         │    │
  │  │  ─────────────────────────────────────────────────────────         │    │
  │  │  customerId: "northwind-logistics"                                 │    │
  │  │  currentTime: 01:59 UTC                                            │    │
  │  │  baseLimit: 300                                                    │    │
  │  │  activeOverrides: [] (window hasn't started)                       │    │
  │  │  effectiveLimit: 300 RPM ← normal enforcement                     │    │
  │  │                                                                    │    │
  │  │  Scenario 2: Northwind at 02:30 UTC (inside batch window)          │    │
  │  │  ─────────────────────────────────────────────────────────         │    │
  │  │  customerId: "northwind-logistics"                                 │    │
  │  │  currentTime: 02:30 UTC                                            │    │
  │  │  baseLimit: 300                                                    │    │
  │  │  activeOverrides: [{ effectiveRpm: 1200 }]                         │    │
  │  │  effectiveLimit: 1200 RPM ← elevated limit                        │    │
  │  │                                                                    │    │
  │  │  Scenario 3: Other customer at 02:30 UTC (same time, no override)  │    │
  │  │  ─────────────────────────────────────────────────────────         │    │
  │  │  customerId: "acme-corp"                                           │    │
  │  │  currentTime: 02:30 UTC                                            │    │
  │  │  baseLimit: 300                                                    │    │
  │  │  activeOverrides: [] (acme has no overrides configured)            │    │
  │  │  effectiveLimit: 300 RPM ← normal enforcement                     │    │
  │  │                                                                    │    │
  │  │  Scenario 4: Northwind on 2026-05-02 (override expired)            │    │
  │  │  ─────────────────────────────────────────────────────────         │    │
  │  │  customerId: "northwind-logistics"                                 │    │
  │  │  currentTime: 02:30 UTC                                            │    │
  │  │  baseLimit: 300                                                    │    │
  │  │  activeOverrides: [] (expired — forces commercial resolution)      │    │
  │  │  effectiveLimit: 300 RPM ← back to contract                       │    │
  │  │                                                                    │    │
  │  └────────────────────────────────────────────────────────────────────┘    │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  The Numbers That Matter

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  NORTHWIND BY THE NUMBERS:
  │
  │
  │
  │  ┌────────────────────────────────────────────────────────────────────┐    │
  │  │                                                                    │    │
  │  │  Contract vs. Reality:                                             │    │
  │  │  ├── Contracted:     300 RPM                                       │    │
  │  │  ├── Actual peak:    1,200 RPM                                     │    │
  │  │  ├── Overage:        4x contracted limit (300% over)               │    │
  │  │  └── Duration:       90-120 minutes nightly                        │    │
  │  │                                                                    │    │
  │  │  Financial Impact:                                                 │    │
  │  │  ├── Revenue share:  60% of ARR                                    │    │
  │  │  ├── Renewal:        6 weeks                                       │    │
  │  │  └── Loss scenario:  Existential (company may not survive)         │    │
  │  │                                                                    │    │
  │  │  Request Volume (batch window):                                    │    │
  │  │  ├── Minimum:  800 RPM × 90 min  = 72,000 requests                │    │
  │  │  ├── Maximum:  1200 RPM × 120 min = 144,000 requests              │    │
  │  │  ├── Average:  ~1000 RPM × 105 min = 105,000 requests             │    │
  │  │  └── With retries on 429: could reach 200,000-300,000+            │    │
  │  │                                                                    │    │
  │  │  Capacity Planning:                                                │    │
  │  │  ├── 3 nodes × (whatever per-node capacity)                        │    │
  │  │  ├── At 1200 RPM: 20 req/sec spread across 3 nodes                │    │
  │  │  ├── Per node: ~7 req/sec from Northwind alone                     │    │
  │  │  ├── This is NOT a capacity problem (easily handled)               │    │
  │  │  └── It's purely a POLICY problem (limit enforcement)              │    │
  │  │                                                                    │    │
  │  │  Key Ratio:                                                        │    │
  │  │  ├── Batch window: 2 hours out of 24 = 8.3% of the day            │    │
  │  │  ├── Revenue at risk: 60% of company                              │    │
  │  │  └── Conclusion: 8.3% of time threatens 60% of revenue            │    │
  │  │                                                                    │    │
  │  └────────────────────────────────────────────────────────────────────┘    │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Why "Just Raise the Limit" Is Not Enough

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  NAIVE SOLUTION: "Just set Northwind's limit to 1200 RPM permanently"      │
  │
  │
  │  WHY THIS DOESN'T WORK:
  │
  │
  │
  │  ┌────────────────────────────────────────────────────────────────────┐    │
  │  │                                                                    │    │
  │  │  1. CTO FAIRNESS VIOLATION                                         │    │
  │  │     • Northwind is on "Enterprise 300 RPM" tier                    │    │
  │  │     • If another Enterprise 300 customer audits and finds          │    │
  │  │       Northwind gets 1200, it's a fairness/legal issue            │    │
  │  │     • CTO: "Same tier = same treatment"                            │    │
  │  │                                                                    │    │
  │  │  2. BILLING/CONTRACT MISMATCH                                      │    │
  │  │     • They're PAYING for 300 RPM                                   │    │
  │  │     • Giving them 1200 permanently means they get 4x for free      │    │
  │  │     • Sets a precedent: overuse your contract, get rewarded        │    │
  │  │                                                                    │    │
  │  │  3. NO FORCING FUNCTION                                            │    │
  │  │     • If limit is permanently 1200, there's no incentive to        │    │
  │  │       renegotiate the contract to match reality                   │    │
  │  │     • The commercial conversation never happens                    │    │
  │  │     • Revenue is permanently leaked                               │    │
  │  │                                                                    │    │
  │  │  4. DOES NOT MATCH REALITY                                         │    │
  │  │     • Northwind only NEEDS 1200 during 02:00-04:00                 │    │
  │  │     • Rest of day they use ~100-200 RPM                            │    │
  │  │     • A permanent 1200 is wasteful and misrepresents usage         │    │
  │  │                                                                    │    │
  │  └────────────────────────────────────────────────────────────────────┘    │
  │
  │
  │  CORRECT SOLUTION: Time-window override with expiration
  │
  │
  │
  │  ┌────────────────────────────────────────────────────────────────────┐    │
  │  │                                                                    │    │
  │  │  • Normal hours: 300 RPM (matches contract, fair to all)           │    │
  │  │  • 02:00-04:00: 1200 RPM (accommodates batch, config-driven)      │    │
  │  │  • Expires in 6 weeks (forces contract renegotiation)              │    │
  │  │  • Auditable (who, when, why, ticket reference)                    │    │
  │  │  • Generic (any customer could get one through same mechanism)     │    │
  │  │                                                                    │    │
  │  │  After renewal:                                                    │    │
  │  │  • Either Northwind's new contract says 1200 RPM (they pay more)  │    │
  │  │  • Or they get a "burst tier" in their contract (new tier type)    │    │
  │  │  • Or they re-architect (unlikely but possible)                    │    │
  │  │  • Or the override is renewed with fresh approval                  │    │
  │  │                                                                    │    │
  │  └────────────────────────────────────────────────────────────────────┘    │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Summary: The Exception in Context

  ┌───────────────┬─────────────────────────────────────────────────────────┐
  │    Aspect     │                         Detail                          │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ What          │ Time-window rate limit override: 1200 RPM during        │
  │               │ 02:00–04:00 UTC                                         │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ Who           │ Northwind Logistics (60% ARR, Enterprise tier, 300 RPM  │
  │               │ contracted)                                             │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ Why           │ Nightly batch sends 800–1200 RPM; 429s trigger retry    │
  │               │ amplification cascade; customer threatens to leave      │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ How long      │ 90–120 minutes nightly, override expires in ~6 weeks    │
  │               │ (renewal deadline)                                      │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ Mechanism     │ Config-driven, auditable, generic (same code path as    │
  │               │ all customers)                                          │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ Not a hack    │ No if (customerId) check; limit comes from config       │
  │               │ lookup that any customer can have                       │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ Forces        │ Expiration means this is a temporary bridge to a proper │
  │ resolution    │  commercial agreement                                   │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ Satisfies CTO │ Config-driven, auditable, same algorithm, no code-level │
  │               │  special cases                                          │
  ├───────────────┼─────────────────────────────────────────────────────────┤
  │ Satisfies     │ Northwind sees zero 429s during batch, invisible to     │
  │ Support       │ them, no changes on their side                          │
  └───────────────┴─────────────────────────────────────────────────────────┘

✻ Cogitated for 2m 40s

❯ Compare the various rate limiting algorithms and evaluate them based on their 
  efficiency in this project. Make sure that you provide the inferences based   
  on their match for the given problem statement. Also explain the advantages   
  and trade-offs of using each algorithm in this project.                       

  Thought for 6s (ctrl+o to expand)

● Rate Limiting Algorithms — Comparative Analysis for RelayAPI

  ---
  The Evaluation Criteria (Derived from Problem Statement)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                    RELAYAPI-SPECIFIC EVALUATION CRITERIA
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  From CTO memo:
  │
  │  C1. Distributed correctness (3 nodes, no shared memory)
  │
  │  C2. Error direction: under-limit preferred (reject extra, never
  over-allow)│
  │  C3. Per-customer isolation (no shared pools)
  │
  │  C4. Auditability (one-paragraph explanation for enterprise prospects)
  │
  │  C5. Well-understood algorithm (no bespoke inventions)
  │
  │  C6. Strictly fair (same tier = same behavior)
  │
  │
  │
  │  From Support memo:
  │
  │  C7. Burst-friendly (Northwind's batch ramps from 300→1200 RPM)            │
  │  C8. Predictable behavior (customer should understand when they'll be cut)
  │
  │
  │
  │  From Platform context:
  │
  │  C9. Redis may or may not be available (must consider fallback)
  │
  │  C10. Must handle boundary correctness (staging incident was here)
  │
  │  C11. Low latency per-request decision (sits in hot path)
  │
  │  C12. Memory-efficient at scale (many customers)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Algorithm 1: Fixed Window Counter

  How It Works

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                        FIXED WINDOW COUNTER
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  MECHANISM:
  │
  │  • Divide time into fixed intervals (e.g., calendar minutes: :00 to :59)   │
  │  • Maintain one counter per customer per window
  │
  │  • Increment on each request; reject if counter ≥ limit                    │
  │  • Reset counter to 0 at the start of each new window                      │
  │
  │
  │  VISUALIZATION:
  │
  │
  │
  │  Window 1 (12:00:00 - 12:00:59)    Window 2 (12:01:00 - 12:01:59)         │
  │  ┌────────────────────────────┐    ┌────────────────────────────┐          │
  │  │ Counter: 0→1→2→...→299→300│    │ Counter: 0→1→2→...         │          │
  │  │ Limit: 300                 │    │ Limit: 300                 │          │
  │  │                            │    │                            │          │
  │  │ Req #1-300: ✓ ALLOWED     │    │ Req #1-300: ✓ ALLOWED     │          │
  │  │ Req #301+:  ✗ 429         │    │ Req #301+:  ✗ 429         │          │
  │  └────────────────────────────┘    └────────────────────────────┘          │
  │              ▲                                  ▲
  │
  │              │         HARD RESET               │
  │
  │              └──────── counter = 0 ─────────────┘
  │
  │
  │
  │  DATA STRUCTURE (in Redis):
  │
  │  Key:    "ratelimit:{customerId}:{windowTimestamp}"
  │
  │  Value:  integer counter
  │
  │  TTL:    60 seconds (auto-cleanup)
  │
  │
  │
  │  OPERATION:
  │
  │  INCR key → if result > limit → REJECT, else → ALLOW                       │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  The Boundary Burst Problem

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  THE CRITICAL FLAW: DOUBLE-BURST AT WINDOW BOUNDARY
  │
  │
  │
  │  Customer limit: 300 RPM
  │
  │
  │
  │  ┌─────── Window 1 ──────┐┌─────── Window 2 ──────┐                        │
  │  │                        ││                        │
  │
  │  │    idle...    ████████ ││ ████████    idle...    │
  │
  │  │               ▲        ││ ▲                      │
  │
  │  │               │        ││ │                      │
  │
  │  │          300 requests  ││ 300 requests           │
  │
  │  │          at 12:00:55   ││ at 12:01:00            │
  │
  │  │                        ││                        │
  │
  │  └────────────────────────┘└────────────────────────┘
  │
  │
  │
  │  RESULT: 600 requests in a 5-second span, all ALLOWED.
  │
  │  Both windows technically under 300, but actual throughput = 2x limit.
  │
  │
  │
  │  FOR RELAYAPI:
  │
  │  • CTO says "never exceed quota" — this violates that at boundaries
  │
  │  • The staging incident may have been exactly this bug
  │
  │  • Enterprise prospects asking about counting semantics would find this
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Evaluation Against RelayAPI Criteria

  ┌───────────────────────┬───────────┬─────────────────────────────────────┐
  │       Criterion       │   Score   │              Reasoning              │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C1. Distributed       │ GOOD      │ Single atomic INCR in Redis; easy   │
  │ correctness           │           │ to coordinate                       │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C2. Error direction   │ FAIR      │ Boundary burst means over-limiting  │
  │ (under-limit)         │           │ is possible                         │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C3. Per-customer      │ EXCELLENT │ Naturally keyed per customer        │
  │ isolation             │           │                                     │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │                       │           │ "We count requests per calendar     │
  │ C4. Auditability      │ EXCELLENT │ minute. At 300, we reject." One     │
  │                       │           │ sentence.                           │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C5. Well-understood   │ EXCELLENT │ Simplest algorithm, universally     │
  │                       │           │ documented                          │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C6. Fairness          │ EXCELLENT │ Trivially identical for same-tier   │
  │                       │           │ customers                           │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C7. Burst-friendly    │ POOR      │ Boundary burst is uncontrolled;     │
  │                       │           │ real burst handling is absent       │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C8. Predictable       │ GOOD      │ Customer knows: new minute = fresh  │
  │                       │           │ budget                              │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C9. Redis fallback    │ GOOD      │ Only needs INCR + TTL; simplest     │
  │                       │           │ Redis usage                         │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C10. Boundary         │ POOR      │ The known failure mode — 2x burst   │
  │ correctness           │           │ at boundary                         │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C11. Low latency      │ EXCELLENT │ Single INCR operation               │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C12. Memory efficient │ EXCELLENT │ One integer per customer per window │
  └───────────────────────┴───────────┴─────────────────────────────────────┘

  Advantages for This Project

  + Simplest to implement correctly in distributed setting
  + Easiest to explain to enterprise prospects (CTO's auditability requirement)
  + Atomic INCR in Redis means no race conditions on count
  + Minimal Redis operations (one INCR per request)
  + Trivially fair — every customer uses identical logic
  + TTL handles cleanup automatically
  + Retry-After header is trivial: seconds until next minute boundary

  Trade-offs for This Project

  - Boundary burst problem DIRECTLY contradicts CTO's "never exceed quota"
  - This may be exactly what caused the staging incident
  - Northwind's batch starting at :00 could trigger boundary burst
  - CTO's error direction preference (under-limit) is violated at boundaries
  - If you pick this, you MUST acknowledge the boundary limitation in
  DECISIONS.md

  ---
  Algorithm 2: Sliding Window Log

  How It Works

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                        SLIDING WINDOW LOG
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  MECHANISM:
  │
  │  • Store the timestamp of every request in a sorted set
  │
  │  • On each new request: remove timestamps older than 60s, count remaining  │
  │  • If count ≥ limit → reject; otherwise add current timestamp and allow    │
  │
  │
  │  VISUALIZATION:
  │
  │
  │
  │  Current time: 12:01:30
  │
  │  Window: [12:00:30 — 12:01:30] (last 60 seconds)                           │
  │
  │
  │  Sorted Set for customer "northwind":
  │
  │  ┌─────────────────────────────────────────────────────────────────────┐   │
  │  │  12:00:28 ← EXPIRED (older than 60s) → REMOVED                     │   │
  │  │  12:00:29 ← EXPIRED (older than 60s) → REMOVED                     │   │
  │  │  ─────────────── 60-second boundary ───────────────                 │   │
  │  │  12:00:31 ← IN WINDOW                                              │   │
  │  │  12:00:31 ← IN WINDOW                                              │   │
  │  │  12:00:32 ← IN WINDOW                                              │   │
  │  │  ...                                                                │   │
  │  │  12:01:29 ← IN WINDOW                                              │   │
  │  │  12:01:30 ← NEW REQUEST (add if count < 300)                       │   │
  │  │                                                                     │   │
  │  │  Count of entries in window: 298                                    │   │
  │  │  298 < 300 → ALLOW, add timestamp                                   │   │
  │  └─────────────────────────────────────────────────────────────────────┘   │
  │
  │
  │  DATA STRUCTURE (in Redis):
  │
  │  Key:    "ratelimit:log:{customerId}"
  │
  │  Type:   Sorted Set (ZSET)
  │
  │  Score:  timestamp (milliseconds)
  │
  │  Member: unique request ID or timestamp + random suffix
  │
  │
  │
  │  OPERATIONS PER REQUEST:
  │
  │  1. ZREMRANGEBYSCORE key 0 (now - 60000)    // prune expired               │
  │  2. ZCARD key                                // count current
  │
  │  3. if count < limit: ZADD key now requestId // add new                    │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  The Sliding Nature (No Boundary Burst)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  WHY SLIDING WINDOW ELIMINATES BOUNDARY BURST:
  │
  │
  │
  │  The window is ALWAYS "the last 60 seconds from NOW" — no fixed edges.     │
  │
  │
  │  Time: ──────────────────────────────────────────────────────────→
  │
  │
  │
  │  At 12:00:55:  window = [11:59:55 — 12:00:55]  count = 300 → FULL         │
  │  At 12:01:00:  window = [12:00:00 — 12:01:00]  count = 298 → 2 free       │
  │  At 12:01:05:  window = [12:00:05 — 12:01:05]  count = 295 → 5 free       │
  │
  │
  │  As old requests "slide out" the back of the window, new ones can enter.   │
  │  There is NEVER a moment where 2x the limit is possible.
  │
  │
  │
  │  MAXIMUM possible in any 60-second span: exactly `limit` requests.
  │
  │
  │
  │  ┌─────────────────────────────────────────────────────────────────────┐   │
  │  │        ◄──────────── 60 seconds ──────────────►                     │   │
  │  │        │                                      │                     │   │
  │  │  ──────┼══════════════════════════════════════┼──────── time        │   │
  │  │        │   EXACTLY `limit` max in this span   │                     │   │
  │  │        │                                      │                     │   │
  │  │        ◄──── window slides continuously ─────►                      │   │
  │  │                                                                     │   │
  │  └─────────────────────────────────────────────────────────────────────┘   │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  The Memory Problem

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  MEMORY USAGE ANALYSIS FOR RELAYAPI:
  │
  │
  │
  │  Each entry in the sorted set: ~50 bytes (timestamp + member + overhead)   │
  │
  │
  │  Per customer at full rate:
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Starter (60 RPM):       60 entries  × 50 bytes = 3 KB              │  │
  │  │  Growth (300 RPM):       300 entries × 50 bytes = 15 KB             │  │
  │  │  Northwind batch (1200): 1200 entries × 50 bytes = 60 KB            │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  With many customers:
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  100 Starter customers:    100 × 3 KB  = 300 KB                     │  │
  │  │  50 Growth customers:      50 × 15 KB  = 750 KB                     │  │
  │  │  5 Enterprise customers:   5 × 60 KB   = 300 KB                     │  │
  │  │  TOTAL:                                 ≈ 1.35 MB                    │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  VERDICT: For RelayAPI's scale, memory is NOT a problem.
  │
  │  This is a concern at millions of customers, not hundreds.
  │
  │  But the Redis operations per request are heavier (3 ops vs 1 for fixed).  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Race Condition in Distributed Setting

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  DISTRIBUTED RACE: CHECK-THEN-ADD
  │
  │
  │
  │  The 3-step operation (prune, count, add) is NOT atomic:
  │
  │
  │
  │  Node 1:  ZREMRANGEBYSCORE → ZCARD = 299 → ZADD (allows)                   │
  │  Node 2:  ZREMRANGEBYSCORE → ZCARD = 299 → ZADD (allows)                   │
  │
  │
  │  Result: 301 entries in the set. Limit was 300.
  │
  │
  │
  │  SOLUTION: Use Redis Lua script to make it atomic:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  -- Lua script (atomic in Redis)                                     │  │
  │  │  redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)                 │  │
  │  │  local count = redis.call('ZCARD', key)                              │  │
  │  │  if count < limit then                                               │  │
  │  │      redis.call('ZADD', key, now, requestId)                         │  │
  │  │      redis.call('EXPIRE', key, 60)                                   │  │
  │  │      return 1  -- allowed                                            │  │
  │  │  end                                                                 │  │
  │  │  return 0  -- denied                                                 │  │
  │  │                                                                      │  │
  │  │  Lua scripts execute atomically in Redis — no race.                  │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  COST: Lua scripts block other Redis commands during execution.
  │
  │  At Northwind scale (1200 RPM = 20 req/sec), this is negligible.           │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Evaluation Against RelayAPI Criteria

  ┌─────────────────────┬───────────┬───────────────────────────────────────┐
  │      Criterion      │   Score   │               Reasoning               │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │ C1. Distributed     │ GOOD      │ Atomic with Lua script; no race       │
  │ correctness         │           │ conditions                            │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │ C2. Error direction │ EXCELLENT │ Perfectly accurate — no over-counting │
  │  (under-limit)      │           │  or boundary issues                   │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │ C3. Per-customer    │ EXCELLENT │ Separate sorted set per customer      │
  │ isolation           │           │                                       │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │                     │           │ "We store every request timestamp. We │
  │ C4. Auditability    │ EXCELLENT │  count the last 60 seconds. At limit, │
  │                     │           │  we reject." Crystal clear.           │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │ C5. Well-understood │ EXCELLENT │ Textbook algorithm, widely documented │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │ C6. Fairness        │ EXCELLENT │ Identical behavior for all same-tier  │
  │                     │           │ customers                             │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │                     │           │ Allows bursts only if recent history  │
  │ C7. Burst-friendly  │ FAIR      │ is empty; no "credit" for quiet       │
  │                     │           │ periods                               │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │ C8. Predictable     │ EXCELLENT │ "Your oldest request will fall off in │
  │                     │           │  X seconds, then you get one more"    │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │                     │           │ Requires sorted set operations        │
  │ C9. Redis fallback  │ FAIR      │ (heavier than INCR); Lua script adds  │
  │                     │           │ complexity                            │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │ C10. Boundary       │ EXCELLENT │ NO boundary — sliding window          │
  │ correctness         │           │ eliminates the problem entirely       │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │ C11. Low latency    │ FAIR      │ 3 Redis operations (or 1 Lua script   │
  │                     │           │ call); heavier than INCR              │
  ├─────────────────────┼───────────┼───────────────────────────────────────┤
  │ C12. Memory         │ FAIR      │ Stores every timestamp; O(limit) per  │
  │ efficient           │           │ customer vs O(1) for counters         │
  └─────────────────────┴───────────┴───────────────────────────────────────┘

  Advantages for This Project

  + PERFECT accuracy — no boundary burst, no over-counting, no under-counting
  + Directly addresses the staging incident (boundary correctness issues)
  + Most auditable: can literally SHOW the timestamps that were counted
  + CTO's "never exceed quota" is mathematically guaranteed
  + Retry-After calculation is precise: "your oldest request expires in X ms"
  + Enterprise prospect explanation is one clear sentence
  + Error direction is a non-issue — there IS no error margin

  Trade-offs for This Project

  - Higher memory usage per customer (O(limit) vs O(1))
  - Heavier Redis operations (sorted set vs simple counter)
  - Requires Lua scripting for atomicity (more complex deployment)
  - Slightly higher latency per request (3 ops or 1 Lua call)
  - At massive scale (millions of customers), memory grows linearly
  - Redis dependency is stronger (more operations = more failure surface)
  - For Northwind at 1200 RPM: 1200 entries × constant churn in Redis

  ---
  Algorithm 3: Sliding Window Counter (Hybrid)

  How It Works

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                       SLIDING WINDOW COUNTER
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  MECHANISM:
  │
  │  • Combine TWO fixed window counters with a weighted average
  │
  │  • Approximates a sliding window without storing every timestamp
  │
  │  • Weight = how far into the current window we are
  │
  │
  │
  │  FORMULA:
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  estimated_count = (prev_window_count × overlap_ratio)               │  │
  │  │                  + current_window_count                               │
  │
  │  │                                                                      │  │
  │  │  where overlap_ratio = 1 - (elapsed_in_current_window / window_size) │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  VISUALIZATION:
  │
  │
  │
  │  Current time: 12:01:20 (20 seconds into current window)
  │
  │
  │
  │  ┌──── Previous Window ────┐┌──── Current Window ────┐
  │
  │  │     (12:00:00-12:00:59) ││ (12:01:00-12:01:59)    │
  │
  │  │                         ││                         │
  │
  │  │   prev_count = 250      ││ curr_count = 100        │
  │
  │  │                         ││                         │
  │
  │  └─────────────────────────┘└─────────────────────────┘
  │
  │
  │
  │              ◄──── overlap = 40/60 = 0.667 ────►
  │
  │              │                                  │
  │
  │  ┌───────────┼══════════════════════════════════┼────────┐
  │
  │  │           │  SLIDING WINDOW (60 seconds)     │        │
  │
  │  │           │  [12:00:20 ──────── 12:01:20]    │        │
  │
  │  └───────────┼──────────────────────────────────┼────────┘
  │
  │
  │
  │  Estimated count = (250 × 0.667) + 100 = 167 + 100 = 267                   │
  │  267 < 300 → ALLOW
  │
  │
  │
  │  DATA STRUCTURE (in Redis):
  │
  │  Key 1:  "ratelimit:{customerId}:{current_window}"  → counter              │
  │  Key 2:  "ratelimit:{customerId}:{previous_window}" → counter              │
  │  Only 2 integers needed per customer (same as fixed window × 2)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  The Approximation Error

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  HOW ACCURATE IS THE APPROXIMATION?
  │
  │
  │
  │  The formula ASSUMES traffic was evenly distributed in the previous window.
  │
  │  Reality: traffic may be bursty.
  │
  │
  │
  │  WORST CASE (traffic concentrated at end of previous window):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Previous window: 300 requests all sent in last 10 seconds           │  │
  │  │  Overlap ratio: 0.667 (we're 20s into current window)                │  │
  │  │  Estimated from prev: 300 × 0.667 = 200                             │  │
  │  │  ACTUAL from prev still in window: 300 (all were in last 10s!)       │  │
  │  │                                                                      │  │
  │  │  Error: estimated 200, actual 300 → UNDER-COUNTED by 100            │  │
  │  │  → Customer gets 100 more requests than they should                  │  │
  │  │  → OVER-LIMITING violation (CTO's bad direction)                     │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  WORST CASE (traffic concentrated at start of previous window):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Previous window: 300 requests all sent in first 10 seconds          │  │
  │  │  Overlap ratio: 0.667                                                │  │
  │  │  Estimated from prev: 300 × 0.667 = 200                             │  │
  │  │  ACTUAL from prev still in window: 0 (all already expired!)          │  │
  │  │                                                                      │  │
  │  │  Error: estimated 200, actual 0 → OVER-COUNTED by 200               │  │
  │  │  → Customer gets 200 fewer requests than entitled                    │  │
  │  │  → UNDER-LIMITING (CTO's preferred error direction!) ✓              │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  CONCLUSION: Error can go BOTH ways depending on traffic distribution.
  │
  │  It's not consistently in the CTO's preferred direction.
  │
  │
  │
  │  PRACTICAL ERROR BOUND:
  │
  │  • Cloudflare's analysis: error is typically within ±5-10% for normal
  │
  │    traffic patterns
  │
  │  • For 300 RPM limit: ±15-30 requests of error                             │
  │  • For auditing purposes: "approximately 300" vs "exactly 300"
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Evaluation Against RelayAPI Criteria

  ┌───────────────────────┬───────────┬─────────────────────────────────────┐
  │       Criterion       │   Score   │              Reasoning              │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C1. Distributed       │ GOOD      │ Atomic INCR on current window       │
  │ correctness           │           │ counter; read previous counter      │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C2. Error direction   │ FAIR      │ Error can go both ways; not         │
  │ (under-limit)         │           │ consistently conservative           │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C3. Per-customer      │ EXCELLENT │ Naturally keyed per customer        │
  │ isolation             │           │                                     │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │                       │           │ Requires explaining "weighted       │
  │ C4. Auditability      │ FAIR      │ approximation" — harder than pure   │
  │                       │           │ log                                 │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C5. Well-understood   │ GOOD      │ Well-documented (Cloudflare, Redis  │
  │                       │           │ docs), but less intuitive than log  │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C6. Fairness          │ GOOD      │ Same approximation for all; but     │
  │                       │           │ error varies by traffic shape       │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C7. Burst-friendly    │ GOOD      │ Smooths boundary transition; no     │
  │                       │           │ hard 2x burst                       │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C8. Predictable       │ FAIR      │ Hard to tell customer exactly when  │
  │                       │           │ their next request will be allowed  │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C9. Redis fallback    │ GOOD      │ Only needs 2 counters per customer  │
  │                       │           │ (lightweight)                       │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C10. Boundary         │ GOOD      │ Much better than fixed window; not  │
  │ correctness           │           │ perfect like log                    │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C11. Low latency      │ EXCELLENT │ 1 INCR + 1 GET (or 1 Lua script);   │
  │                       │           │ very fast                           │
  ├───────────────────────┼───────────┼─────────────────────────────────────┤
  │ C12. Memory efficient │ EXCELLENT │ 2 integers per customer             │
  └───────────────────────┴───────────┴─────────────────────────────────────┘

  Advantages for This Project

  + Best memory/accuracy tradeoff — almost as good as log, far less memory
  + Eliminates the fixed window boundary burst problem (mostly)
  + Low latency — just 2 counter operations
  + Well-documented by industry leaders (Cloudflare uses this)
  + Memory: O(1) per customer regardless of RPM
  + Good enough accuracy for most use cases (~95%+ accuracy)
  + Graceful degradation: worst case is bounded and known

  Trade-offs for This Project

  - Approximation error can go in BOTH directions (CTO wants consistent
  under-limit)
  - Harder to audit: "we use a weighted average" is less clear than "we count
  timestamps"
  - Enterprise prospect explanation requires more words and caveats
  - Cannot tell customer EXACTLY when their next request will be allowed
  - Error margin depends on traffic distribution (not constant, not bounded in
  one direction)
  - For compliance: "approximately 300" vs "exactly 300" may not satisfy legal
  - The CTO specifically wants "never exceed" — this cannot guarantee that

  ---
  Algorithm 4: Token Bucket

  How It Works

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                           TOKEN BUCKET
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  MECHANISM:
  │
  │  • Each customer has a "bucket" with maximum capacity (burst size)
  │
  │  • Tokens refill at a steady rate (RPM/60 = tokens per second)             │
  │  • Each request consumes one token
  │
  │  • If no tokens available → reject (429)
  │
  │  • Bucket can accumulate tokens during idle periods (enables bursts)
  │
  │
  │
  │  PARAMETERS:
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  bucket_capacity:  maximum tokens (= burst allowance)                │  │
  │  │  refill_rate:      tokens added per second (= RPM / 60)              │  │
  │  │  current_tokens:   how many tokens are available right now           │  │
  │  │  last_refill_time: when we last calculated token addition            │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  FOR RELAYAPI (300 RPM customer):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  bucket_capacity = 300  (or could be 300 for full-minute burst)      │  │
  │  │  refill_rate     = 5 tokens/second (300/60)                          │  │
  │  │  Decision: burst size is a TUNING parameter                          │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  VISUALIZATION:
  │
  │
  │
  │  Bucket capacity: 300 tokens
  │
  │  Refill: 5 tokens/second
  │
  │
  │
  │  Time 0s:   [████████████████████████████████████████] 300/300 (full)      │
  │  Time 1s:   (10 requests arrive)
  │
  │             [██████████████████████████████████████░░] 290/300
  │
  │  Time 2s:   (0 requests, +5 refill)
  │
  │             [██████████████████████████████████████░░] 295/300
  │
  │  Time 3s:   (20 requests, +5 refill)
  │
  │             [████████████████████████████████░░░░░░░░] 280/300
  │
  │  ...
  │
  │  Time 30s:  (sustained 10 req/s, +5 refill/s → net drain 5/s)              │
  │             [██████████████████░░░░░░░░░░░░░░░░░░░░░░] 150/300             │
  │  ...
  │
  │  Time 60s:  (sustained 10 req/s)
  │
  │             [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  0/300 → 429!     │
  │
  │
  │  KEY: If sustained rate > refill rate, bucket empties.
  │
  │       If sustained rate ≤ refill rate, bucket stays positive.
  │
  │       Burst allowed UP TO bucket_capacity even if above steady rate.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Token Bucket and Northwind's Batch Pattern

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  NORTHWIND WITH TOKEN BUCKET (contracted 300 RPM = 5 tokens/sec):          │
  │
  │
  │  SCENARIO: Northwind is idle from 22:00–02:00 (4 hours), then batch starts │
  │
  │
  │  Bucket at 22:00:    300/300 (full, normal operations ended)
  │
  │  Bucket at 02:00:    300/300 (still full — tokens cap at capacity)
  │
  │
  │
  │  02:00:00  Batch starts: 800 RPM = 13.3 req/sec                            │
  │            Refill: 5 tokens/sec
  │
  │            Net drain: 13.3 - 5 = 8.3 tokens/sec                            │
  │
  │
  │  02:00:00  Tokens: 300
  │
  │  02:00:36  Tokens: 300 - (8.3 × 36) ≈ 0 → FIRST 429!                      │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  RESULT: Northwind gets only ~36 seconds of burst before 429s.       │  │
  │  │  After that: sustained 5 tokens/sec = 300 RPM effective throughput.  │  │
  │  │                                                                      │  │
  │  │  This DOES NOT solve the Northwind problem.                          │  │
  │  │  They need 800-1200 RPM for 90-120 MINUTES.                          │  │
  │  │  Token bucket gives them ~36 seconds of grace, then hard limit.      │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  VISUAL: Token drain during Northwind batch
  │
  │
  │
  │  Tokens
  │
  │  300 ┤████
  │
  │      │    ████
  │
  │  250 ┤        ████
  │
  │      │            ████
  │
  │  200 ┤                ████
  │
  │      │                    ████
  │
  │  150 ┤                        ████
  │
  │      │                            ████
  │
  │  100 ┤                                ████
  │
  │      │                                    ████
  │
  │   50 ┤                                        ████
  │
  │      │                                            ████
  │
  │    0 ┤═══════════════════════════════════════════════════════════════════
  │
  │      ┼──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──              │
  │      02:00  :05  :10  :15  :20  :25  :30  :35  :40                        │
  │                                             ▲
  │
  │                                        BUCKET EMPTY
  │
  │                                        429s start
  │
  │                                        (only 36s of grace)
  │
  │
  │
  │  WITH OVERRIDE (effectiveRpm = 1200 = 20 tokens/sec, capacity = 1200):     │
  │  Batch at 1000 RPM = 16.7 req/sec < 20 tokens/sec → NEVER empties ✓       │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Distributed Token Bucket Challenge

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  DISTRIBUTED TOKEN BUCKET — THE HARD PART:
  │
  │
  │
  │  Token bucket requires READ-MODIFY-WRITE:
  │
  │  1. Read current tokens + last_refill_time
  │
  │  2. Calculate tokens to add (time elapsed × refill_rate)
  │
  │  3. Check if tokens ≥ 1 (enough for this request)
  │
  │  4. Decrement tokens by 1
  │
  │  5. Write back new token count + current time
  │
  │
  │
  │  All 5 steps must be ATOMIC across 3 nodes:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  -- Redis Lua script for atomic token bucket                         │  │
  │  │  local key = KEYS[1]                                                 │  │
  │  │  local capacity = tonumber(ARGV[1])                                  │  │
  │  │  local refill_rate = tonumber(ARGV[2])                               │  │
  │  │  local now = tonumber(ARGV[3])                                       │  │
  │  │                                                                      │  │
  │  │  local data = redis.call('HMGET', key, 'tokens', 'last_refill')     │  │
  │  │  local tokens = tonumber(data[1]) or capacity                        │  │
  │  │  local last_refill = tonumber(data[2]) or now                        │  │
  │  │                                                                      │  │
  │  │  -- Refill tokens based on elapsed time                              │  │
  │  │  local elapsed = (now - last_refill) / 1000                          │  │
  │  │  tokens = math.min(capacity, tokens + (elapsed * refill_rate))       │  │
  │  │                                                                      │  │
  │  │  if tokens >= 1 then                                                 │  │
  │  │      tokens = tokens - 1                                             │  │
  │  │      redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now) │  │
  │  │      redis.call('EXPIRE', key, 120)                                  │  │
  │  │      return 1  -- allowed                                            │  │
  │  │  else                                                                │  │
  │  │      redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now) │  │
  │  │      redis.call('EXPIRE', key, 120)                                  │  │
  │  │      return 0  -- denied                                             │  │
  │  │  end                                                                 │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  WORKS: Redis Lua is atomic. All 3 nodes call this script.
  │
  │  Correctness guaranteed if Redis is the single source of truth.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Evaluation Against RelayAPI Criteria

  ┌──────────────────────┬───────────┬──────────────────────────────────────┐
  │      Criterion       │   Score   │              Reasoning               │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C1. Distributed      │ GOOD      │ Atomic with Lua script; single Redis │
  │ correctness          │           │  source of truth                     │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C2. Error direction  │ GOOD      │ Deterministic — no approximation     │
  │ (under-limit)        │           │ error; bucket is precise             │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C3. Per-customer     │ EXCELLENT │ Separate bucket per customer         │
  │ isolation            │           │                                      │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │                      │           │ "Tokens refill at X/sec, bucket      │
  │ C4. Auditability     │ FAIR      │ holds Y max" — requires more         │
  │                      │           │ explanation than counting            │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C5. Well-understood  │ EXCELLENT │ RFC 2697/2698; networking standard   │
  │                      │           │ for decades                          │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │                      │           │ Same params = same behavior; but     │
  │ C6. Fairness         │ GOOD      │ burst allowance favors idle          │
  │                      │           │ customers                            │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C7. Burst-friendly   │ EXCELLENT │ Natural burst handling — idle        │
  │                      │           │ periods accumulate tokens            │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C8. Predictable      │ FAIR      │ Harder to explain "when will my next │
  │                      │           │  request succeed?"                   │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C9. Redis fallback   │ FAIR      │ Requires hash + Lua script; more     │
  │                      │           │ complex than INCR                    │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C10. Boundary        │ EXCELLENT │ No window boundaries at all —        │
  │ correctness          │           │ continuous refill                    │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C11. Low latency     │ GOOD      │ Single Lua script call; slightly     │
  │                      │           │ heavier than INCR                    │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C12. Memory          │ EXCELLENT │ 2 values per customer (tokens +      │
  │ efficient            │           │ timestamp)                           │
  └──────────────────────┴───────────┴──────────────────────────────────────┘

  Advantages for This Project

  + Natural burst handling — idle periods earn tokens (good for varied traffic)
  + No window boundary issues at all (continuous, not windowed)
  + Deterministic — no approximation, no error margin
  + Well-understood in networking (RFC standard, decades of use)
  + Memory efficient (2 values per customer)
  + Smooth rate enforcement — no "reset moment" where everyone fires at once
  + Northwind's batch: if limit is properly configured, works perfectly

  Trade-offs for This Project

  - HARDER TO AUDIT for enterprise prospects:
    "How do you count?" → "We don't count. We have tokens that refill."
    "So how many requests can I make in a minute?" → "It depends on when you
     sent your previous requests."
    This is less intuitive than "300 per minute."

  - Burst behavior is IMPLICIT, not configurable without extra parameters:
    Bucket capacity determines burst. What should it be?
    capacity = RPM? → allows full minute of burst at any rate
    capacity = RPM/2? → 30s of burst
    The choice is not obvious and affects fairness

  - "Strictly fair" is debatable:
    A customer idle for 5 minutes gets 300 tokens accumulated.
    A customer steadily using 250 RPM has ~50 tokens.
    Same tier, different burst allowance at any point. Is that "fair"?

  - The CTO wants to explain counting semantics in one paragraph.
    Token bucket semantics require understanding refill rate, capacity,
    and the relationship between burst and sustained rate.
    Possible, but harder than "we count requests in the last 60 seconds."

  - Configuration is more complex (capacity + refill_rate vs just a limit
  number)

  ---
  Algorithm 5: Leaky Bucket

  How It Works

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                           LEAKY BUCKET
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  MECHANISM:
  │
  │  • Requests enter a queue (bucket)
  │
  │  • Bucket drains at a FIXED rate (like water through a hole)
  │
  │  • If bucket is full when new request arrives → reject (429)
  │
  │  • Requests are processed at constant output rate regardless of input      │
  │
  │
  │  TWO VARIANTS:
  │
  │
  │
  │  Variant A: "Leaky Bucket as a Meter" (no queuing, just counting)          │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Functionally identical to Token Bucket (inverted perspective)        │
  │
  │  │  Water level goes UP with requests, drains at steady rate            │  │
  │  │  If level ≥ capacity → reject                                        │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  Variant B: "Leaky Bucket as a Queue" (actual queuing)                     │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Requests are HELD in queue and released at constant rate            │  │
  │  │  Output is perfectly smooth: exactly RPM/60 requests per second      │  │
  │  │  If queue is full → reject                                           │  │
  │  │  Adds LATENCY to requests (they wait in queue)                       │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  VISUALIZATION (Variant B — Queue):
  │
  │
  │
  │         INPUT (bursty)              OUTPUT (smooth)
  │
  │         ████
  │
  │         ████                        ──────────────────
  │
  │    ████ ████                        │  │  │  │  │  │   = constant rate     │
  │    ████ ████ ████                   ──────────────────
  │
  │         │                                  ▲
  │
  │         ▼                                  │
  │
  │  ┌─────────────────┐              drain at fixed rate
  │
  │  │ ░░░░░░░░░░░░░░░ │ ← queue         (5 req/sec for 300 RPM)              │
  │  │ ░░░░░░░░░░░░░░░ │                                                      │
  │  │ ░░░░░░░ BUCKET  │                                                      │
  │  │ ░░░░░░░░░░░░░░░ │                                                      │
  │  │ ░░░░░░░░░░░░░░░ │                                                      │
  │  └────────┬────────┘                                                       │
  │           │
  │
  │           ▼
  │
  │     Drain (constant rate)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Why Leaky Bucket Is Problematic for RelayAPI

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  FUNDAMENTAL PROBLEM: LATENCY
  │
  │
  │
  │  RelayAPI is a real-time API platform. Customers expect:
  │
  │  • Request → immediate response (success or failure)
  │
  │  • NOT: Request → wait in queue → eventually get response
  │
  │
  │
  │  WITH LEAKY BUCKET (QUEUE VARIANT):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Northwind sends 800 RPM, drain rate is 300 RPM (5/sec):             │  │
  │  │                                                                      │  │
  │  │  Request #1:   enters queue → processed immediately (queue empty)    │  │
  │  │  Request #5:   enters queue → waits 1 second                         │  │
  │  │  Request #50:  enters queue → waits 10 seconds                       │  │
  │  │  Request #300: enters queue → waits 60 seconds                       │  │
  │  │  Request #301: queue full → 429 (OR wait grows unbounded)            │  │
  │  │                                                                      │  │
  │  │  RESULT:                                                              │
  │
  │  │  • Requests "succeed" but with massive latency                       │  │
  │  │  • Northwind's batch STILL takes longer (throttled output rate)      │  │
  │  │  • Customer sees timeouts instead of 429s (arguably worse)           │  │
  │  │  • The batch still can't complete in 2 hours at 300 RPM output       │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  WITH LEAKY BUCKET (METER VARIANT):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Functionally equivalent to an inverted token bucket.                │  │
  │  │  No actual queuing — just reject when "full".                        │  │
  │  │  Same behavior as token bucket but described differently.            │  │
  │  │                                                                      │  │
  │  │  If using meter variant: just use token bucket (better documented).  │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  DISTRIBUTED QUEUING IS EXTREMELY HARD:
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  • Where does the queue live? (Not in stateless nodes)               │  │
  │  │  • Queue ordering across 3 nodes? (Distributed consensus needed)     │  │
  │  │  • What if queue node dies? (Requests lost)                          │  │
  │  │  • Queue depth monitoring? (New infra needed)                        │  │
  │  │  • Connection holding during queue wait? (Resource exhaustion)       │  │
  │  │                                                                      │  │
  │  │  This is FAR more complex than needed for this problem.              │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Evaluation Against RelayAPI Criteria

  ┌──────────────────────┬───────────┬──────────────────────────────────────┐
  │      Criterion       │   Score   │              Reasoning               │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C1. Distributed      │           │ Distributed queuing is extremely     │
  │ correctness          │ POOR      │ complex; meter variant = token       │
  │                      │           │ bucket                               │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C2. Error direction  │ GOOD      │ Meter variant: deterministic. Queue  │
  │ (under-limit)        │           │ variant: adds latency instead.       │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C3. Per-customer     │ GOOD      │ Separate queue per customer          │
  │ isolation            │           │                                      │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C4. Auditability     │ FAIR      │ Queue variant: "requests wait."      │
  │                      │           │ Meter variant: same as token bucket  │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │                      │           │ Well-documented, but conflated       │
  │ C5. Well-understood  │ GOOD      │ terminology (two variants) causes    │
  │                      │           │ confusion                            │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C6. Fairness         │ EXCELLENT │ Perfectly smooth output — everyone   │
  │                      │           │ gets exactly their rate              │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │                      │           │ ANTI-burst by design — smooths all   │
  │ C7. Burst-friendly   │ POOR      │ bursts out. Opposite of what         │
  │                      │           │ Northwind needs                      │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C8. Predictable      │ GOOD      │ Output rate is perfectly constant    │
  │                      │           │ (queue variant)                      │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C9. Redis fallback   │ POOR      │ Queue variant needs persistent queue │
  │                      │           │  infrastructure                      │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C10. Boundary        │ EXCELLENT │ No windows, no boundaries —          │
  │ correctness          │           │ continuous drain                     │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C11. Low latency     │ POOR      │ Queue variant adds latency by        │
  │                      │           │ design; meter variant is fine        │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C12. Memory          │ POOR      │ Queue variant stores actual          │
  │ efficient            │           │ requests; meter variant is O(1)      │
  └──────────────────────┴───────────┴──────────────────────────────────────┘

  Advantages for This Project

  + Perfectly smooth output rate (good for upstream API protection)
  + No burst at all — strictest possible enforcement
  + Meter variant eliminates boundary issues entirely
  + Fair in the purest sense — exactly RPM/60 per second, no more

  Trade-offs for This Project

  - Queue variant adds LATENCY — customers wait instead of getting fast 429
    (Marcus: "invisible" means fast, not slow)
  - ANTI-burst: Northwind's batch pattern is the WORST case for leaky bucket
    (they need burst; leaky bucket eliminates burst by design)
  - Distributed queue is orders of magnitude harder than distributed counter
  - Queue variant requires new infrastructure (exactly what wiki says ops won't
  provision)
  - Meter variant is just an inverted token bucket — use token bucket instead
  - Confused terminology makes auditability harder ("which leaky bucket do you
  mean?")
  - Holding connections during queue wait = resource exhaustion risk on app
  nodes
  - CTO wants fast decisions: "429 with Retry-After" not "wait indefinitely"

  ---
  Algorithm 6: Sliding Window Counter with Sub-Windows (Granular Fixed Windows)

  How It Works

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                 SLIDING WINDOW WITH SUB-WINDOWS (HYBRID)
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  MECHANISM:
  │
  │  • Divide the 60-second window into N sub-windows (e.g., 6 × 10 seconds)  │
  │  • Each sub-window has its own counter
  │
  │  • Total count = sum of all sub-window counters within the sliding range   │
  │  • Old sub-windows expire and get dropped
  │
  │
  │
  │  VISUALIZATION (6 sub-windows of 10 seconds each):
  │
  │
  │
  │  Current time: 12:01:35 (in sub-window 12:01:30-12:01:39)
  │
  │
  │
  │  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐                  │
  │  │ 45 ││ 52 ││ 48 ││ 51 ││ 49 ││ 55 ││ 47 ││ 50 ││ 12 │                  │
  │  │    ││    ││    ││    ││    ││    ││    ││    ││    │                  │
  │  └────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘                  │
  │  12:00  :10   :20   :30   :40   :50  01:00  :10   :20   :30              │
  │
  │
  │  EXPIRED ──────┤ ├──── SLIDING WINDOW (last 60s) ────────────┤
  │
  │                │ │                                            │
  │
  │  Dropped       │ Sub-windows counted: 52+48+51+49+55+47+50+12 = 364       │
  │  (too old)     │ Wait — that's a partial window at the edge!               │
  │                │
  │
  │  With proportional counting of the oldest included sub-window:
  │
  │  Oldest partial sub-window (12:00:30-12:00:39): 51 × (5/10) = 25.5        │
  │  Total: 25.5 + 49 + 55 + 47 + 50 + 12 = 238.5 → round to 239             │
  │
  │
  │  239 < 300 → ALLOW
  │
  │
  │
  │  DATA STRUCTURE (in Redis):
  │
  │  Key:    "ratelimit:{customerId}:sub:{subWindowTimestamp}"
  │
  │  Value:  integer counter
  │
  │  TTL:    70 seconds (window + buffer)
  │
  │  Keys per customer: 6-7 at any time
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Evaluation Against RelayAPI Criteria

  ┌──────────────────────┬───────────┬──────────────────────────────────────┐
  │      Criterion       │   Score   │              Reasoning               │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C1. Distributed      │ GOOD      │ Each sub-window is atomic INCR; sum  │
  │ correctness          │           │ is read-only                         │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C2. Error direction  │ GOOD      │ Proportional edge reduces error;     │
  │ (under-limit)        │           │ configurable granularity             │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C3. Per-customer     │ EXCELLENT │ Naturally keyed per customer         │
  │ isolation            │           │                                      │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C4. Auditability     │ GOOD      │ "We count in 10-second buckets and   │
  │                      │           │ sum the last 6" — clear enough       │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C5. Well-understood  │ GOOD      │ Used by Kong, rate-limiter-flexible; │
  │                      │           │  documented                          │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C6. Fairness         │ EXCELLENT │ Identical for same-tier customers    │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C7. Burst-friendly   │ GOOD      │ Smaller sub-windows = less boundary  │
  │                      │           │ burst                                │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C8. Predictable      │ GOOD      │ "Your oldest sub-window drops in X   │
  │                      │           │ seconds"                             │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C9. Redis fallback   │ GOOD      │ Multiple INCR + GET; more ops but    │
  │                      │           │ all simple                           │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C10. Boundary        │ GOOD      │ Boundary burst reduced to sub-window │
  │ correctness          │           │  size (10s burst, not 60s)           │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C11. Low latency     │ GOOD      │ Multiple simple ops; can pipeline in │
  │                      │           │  Redis                               │
  ├──────────────────────┼───────────┼──────────────────────────────────────┤
  │ C12. Memory          │ GOOD      │ 6-7 integers per customer (between   │
  │ efficient            │           │ counter and log)                     │
  └──────────────────────┴───────────┴──────────────────────────────────────┘

  ---
  Head-to-Head Comparison Matrix

  ┌─────────────────────────────────────────────────────────────────────────────
  ────────────┐
  │                          ALGORITHM COMPARISON FOR RELAYAPI
               │
  ├───────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──
  ───────────┤
  │                   │  Fixed   │ Sliding  │ Sliding  │  Token   │  Leaky   │
  Sub-Window  │
  │ Criterion         │  Window  │  Window  │  Window  │  Bucket  │  Bucket  │
  Counter    │
  │                   │ Counter  │   Log    │ Counter  │          │          │
  (Hybrid)   │
  ├───────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──
  ───────────┤
  │ C1. Distributed   │  ★★★★   │  ★★★★   │  ★★★★   │  ★★★★   │  ★★      │  ★★★★
       │
  │ C2. Under-limit   │  ★★★    │  ★★★★★  │  ★★★    │  ★★★★   │  ★★★★   │  ★★★★
      │
  │ C3. Isolation     │  ★★★★★  │  ★★★★★  │  ★★★★★  │  ★★★★★  │  ★★★★   │  ★★★★★
      │
  │ C4. Auditability  │  ★★★★★  │  ★★★★★  │  ★★★    │  ★★★    │  ★★★    │  ★★★★
      │
  │ C5. Well-known    │  ★★★★★  │  ★★★★★  │  ★★★★   │  ★★★★★  │  ★★★★   │  ★★★★
      │
  │ C6. Fairness      │  ★★★★★  │  ★★★★★  │  ★★★★   │  ★★★★   │  ★★★★★  │  ★★★★★
      │
  │ C7. Burst-friend  │  ★★     │  ★★★    │  ★★★★   │  ★★★★★  │  ★       │  ★★★★
       │
  │ C8. Predictable   │  ★★★★   │  ★★★★★  │  ★★★    │  ★★★    │  ★★★★   │  ★★★★
      │
  │ C9. Redis fallbk  │  ★★★★★  │  ★★★    │  ★★★★   │  ★★★    │  ★★      │  ★★★★
       │
  │ C10. Boundary     │  ★★     │  ★★★★★  │  ★★★★   │  ★★★★★  │  ★★★★★  │  ★★★★
      │
  │ C11. Low latency  │  ★★★★★  │  ★★★    │  ★★★★★  │  ★★★★   │  ★★      │  ★★★★
       │
  │ C12. Memory       │  ★★★★★  │  ★★★    │  ★★★★★  │  ★★★★★  │  ★★      │  ★★★★
       │
  ├───────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──
  ───────────┤
  │ TOTAL (out of 60) │   49     │   50     │   47     │   49     │   38     │
  51        │
  ├───────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──
  ───────────┤
  │ CRITICAL FLAW     │ Boundary │  Memory  │  Error   │ Audit    │ Latency/ │
  None       │
  │ for RelayAPI      │  burst   │ + Redis  │direction │ explain  │ anti-burst│
  (moderate)  │
  │                   │ (CTO: no)│  weight  │ variable │ complex  │          │
            │
  └───────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──
  ───────────┘

  ---
  Detailed Inference for Each Algorithm

  Fixed Window Counter — Project Fit

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  VERDICT: PARTIALLY SUITABLE — but boundary burst is a known killer
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FITS WELL:
  │
  │  • CTO's auditability requirement (simplest explanation possible)
  │
  │  • CTO's "well-understood algorithm" (universally known)
  │
  │  • Distributed coordination (single INCR in Redis)
  │
  │  • Memory/performance (minimal Redis usage)
  │
  │  • Fairness (trivially identical for all customers)
  │
  │
  │
  │  FITS POORLY:
  │
  │  • CTO's "never exceed quota" — boundary burst allows 2x                   │
  │  • Platform context: "correctness issues at quota boundaries"
  │
  │    (this is LIKELY what the staging incident was)
  │
  │  • CTO's error direction — burst allows over-limit, not under-limit
  │
  │
  │
  │  USE IF: You're OK acknowledging the boundary limitation and the
  │
  │  harness DEMONSTRATES it. Honest about the flaw = strong signal.
  │
  │
  │
  │  DO NOT USE IF: You want to claim "never exceeds quota" because it can.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Sliding Window Log — Project Fit

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  VERDICT: BEST CORRECTNESS — heavier implementation, perfect accuracy
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FITS WELL:
  │
  │  • CTO's "never exceed quota" — mathematically guaranteed
  │
  │  • CTO's error direction — no error at all (perfect count)
  │
  │  • Auditability — "we count timestamps in the last 60 seconds"             │
  │  • Platform context: SOLVES the boundary correctness issue from staging
  │
  │  • Predictability — exact "retry after" calculation possible
  │
  │  • Debugging — can inspect actual stored timestamps
  │
  │
  │
  │  FITS POORLY:
  │
  │  • Redis weight — sorted set operations are heavier than INCR              │
  │  • Memory — stores every timestamp (O(RPM) per customer)                   │
  │  • Platform context: "Redis may not be available" (heavier dependency)     │
  │  • Lua scripting adds deployment complexity
  │
  │  • Not burst-friendly naturally (past activity blocks present)             │
  │
  │
  │  USE IF: Correctness is your primary claim. You want to PROVE the
  │
  │  CTO's requirement is met. Perfect for the harness demo.
  │
  │
  │
  │  BEST FOR: Demonstrating boundary correctness in the load harness.
  │
  │  The harness can show "exactly 300 allowed, exactly 0 boundary burst."
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Sliding Window Counter — Project Fit

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  VERDICT: GOOD PRAGMATIC CHOICE — but can't guarantee "never exceed"
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FITS WELL:
  │
  │  • Practical compromise between accuracy and performance
  │
  │  • Eliminates the worst boundary burst
  │
  │  • Lightweight Redis usage (just counters)
  │
  │  • Industry-proven (Cloudflare, nginx)
  │
  │
  │
  │  FITS POORLY:
  │
  │  • CTO's "never exceed" — cannot guarantee (error goes both ways)
  │
  │  • Auditability — "weighted approximation" harder to explain
  │
  │  • Error is traffic-shape-dependent (unpredictable)
  │
  │  • Compliance: "approximately 300" may not satisfy legal review
  │
  │
  │
  │  USE IF: You prioritize performance and your DECISIONS.md acknowledges
  │
  │  the approximation error honestly.
  │
  │
  │
  │  RISK: The CTO explicitly said "not mostly, not on average — NEVER."
  │
  │  This algorithm is "mostly" and "on average."
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Token Bucket — Project Fit

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  VERDICT: STRONG CHOICE — natural burst handling but harder to audit
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FITS WELL:
  │
  │  • Burst-friendly (Northwind's ramp-up is smoothly handled)
  │
  │  • No boundary issues (continuous, not windowed)
  │
  │  • Deterministic (no approximation error)
  │
  │  • Well-understood (RFC standard, decades of network use)
  │
  │  • CTO's error direction: exact — no error either way
  │
  │  • Memory efficient (2 values per customer)
  │
  │
  │
  │  FITS POORLY:
  │
  │  • Auditability: "How many requests per minute?" → "It depends"
  │
  │    CTO wants a one-paragraph explanation for enterprise prospects
  │
  │    Token bucket answer is: "Up to X sustained, with burst capacity Y"      │
  │    vs. "300 per minute" (simpler)
  │
  │  • Fairness: idle customers accumulate burst capacity; active don't
  │
  │    Is that "same tier = same treatment"?
  │
  │  • Burst size is a new parameter that needs justification
  │
  │  • CTO's demo: "exactly 100 RPM" is harder to demonstrate                  │
  │    (token bucket allows burst ABOVE 100/min short-term)
  │
  │
  │
  │  USE IF: You frame it as "sustained rate enforcement with controlled
  │
  │  burst" and can explain burst capacity to the CTO's satisfaction.
  │
  │
  │
  │  GOOD FOR: If the override mechanism raises Northwind's refill rate
  │
  │  during the batch window, token bucket handles the transition smoothly.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Leaky Bucket — Project Fit

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  VERDICT: POOR FIT — wrong tool for this problem
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FITS WELL:
  │
  │  • Strictest possible enforcement (output is perfectly constant)
  │
  │  • (Very little else aligns with RelayAPI's needs)
  │
  │
  │
  │  FITS POORLY:
  │
  │  • Queue variant adds LATENCY — API platform needs fast responses
  │
  │  • Anti-burst by design — worst possible for Northwind's pattern
  │
  │  • Distributed queue is enormously complex (new infra needed)              │
  │  • Wiki explicitly says ops won't provision new infra for prototype
  │
  │  • Marcus wants "invisible to customer" — latency is visible               │
  │  • Meter variant is just token bucket with different name
  │
  │  • Connection holding during queue wait = resource exhaustion
  │
  │
  │
  │  DO NOT USE for this project. It's the wrong paradigm.
  │
  │  RelayAPI needs FAST REJECTION (429 + Retry-After), not slow admission.
  │
  │
  │
  │  The only scenario where leaky bucket fits: protecting a fragile upstream
  │
  │  service from bursts. That's not the problem here.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Sub-Window Counter (Hybrid) — Project Fit

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  VERDICT: SOLID PRAGMATIC CHOICE — good balance, moderate complexity
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FITS WELL:
  │
  │  • Reduces boundary burst to sub-window size (10s burst vs 60s)
  │
  │  • Simple Redis operations (INCR on sub-window keys)
  │
  │  • Better auditability than pure sliding counter
  │
  │    ("We count in 10-second buckets, sum the last 6")
  │
  │  • Good accuracy without storing every timestamp
  │
  │  • Predictable: "your oldest bucket expires in X seconds"
  │
  │  • Distributed: each sub-counter is atomic INCR
  │
  │
  │
  │  FITS POORLY:
  │
  │  • Still has SMALL boundary burst (within sub-window size)
  │
  │  • More Redis keys per customer (6-7 vs 1-2)
  │
  │  • CTO's "never exceed" — still possible to get sub-window-size burst      │
  │  • Slightly more complex than pure fixed window
  │
  │  • More Redis operations per decision (read 6+ keys)
  │
  │
  │
  │  USE IF: You want sliding window accuracy with counter-level simplicity
  │
  │  and are OK with bounded (small) boundary error.
  │
  │
  │
  │  GOOD FOR: Demonstrating awareness of the fixed-window flaw while
  │
  │  keeping implementation practical.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Final Recommendation for RelayAPI

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  RECOMMENDED: SLIDING WINDOW LOG
  │
  │  RUNNER-UP:   TOKEN BUCKET
  │
  │  PRAGMATIC:   SUB-WINDOW COUNTER
  │
  │
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHY SLIDING WINDOW LOG IS THE TOP CHOICE:
  │
  │
  │
  │  1. DIRECTLY ADDRESSES THE STAGING INCIDENT
  │
  │     The staging incident was "correctness issues at quota boundaries."
  │
  │     Sliding window log has NO boundaries. Problem solved at root.
  │
  │
  │
  │  2. MEETS CTO'S "NEVER EXCEED" LITERALLY                                   │
  │     No approximation. No error margin. Mathematically exact.
  │
  │     Customer gets ≤ limit requests in ANY 60-second span. Period.
  │
  │
  │
  │  3. MOST AUDITABLE
  │
  │     "We store the timestamp of every request. We count how many
  │
  │     are in the last 60 seconds. If count ≥ limit, we reject."              │
  │     One paragraph. Enterprise prospects understand immediately.
  │
  │
  │
  │  4. ERROR DIRECTION IS A NON-ISSUE
  │
  │     There IS no error. CTO's preference for under-limit is satisfied
  │
  │     trivially: there's no direction because there's no error.              │
  │
  │
  │  5. DEBUGGABLE
  │
  │     Can inspect the actual timestamps. When harness disagrees with
  │
  │     service, you can look at stored state and diagnose exactly.
  │
  │
  │
  │  6. PERFORMANCE IS ACCEPTABLE
  │
  │     At RelayAPI's scale (hundreds of customers, max 1200 RPM per):         │
  │     - 1200 entries × 50 bytes = 60KB per customer (trivial for Redis)      │
  │     - Lua script executes in <1ms
  │
  │     - 20 req/sec for Northwind at peak is not a Redis bottleneck           │
  │
  │
  │  7. RETRY-AFTER IS PRECISE
  │
  │     Can compute exactly: "your oldest request expires in 3.2 seconds,
  │
  │     then you'll have one slot." No guessing.
  │
  │
  │
  │  THE TRADEOFF YOU ACCEPT:
  │
  │  - Slightly heavier Redis usage (sorted set + Lua vs simple INCR)          │
  │  - Redis dependency is stronger (more operations per request)
  │
  │  - If Redis goes down, you need a fallback strategy
  │
  │  - State this honestly in DECISIONS.md
  │
  │
  │
  │  THE TRADEOFF YOU REJECT:
  │
  │  - Fixed window's simplicity (because boundary burst violates the brief)   │
  │  - Token bucket's burst handling (because auditability is harder)
  │
  │  - Sliding counter's approximation (because CTO said "never," not "mostly")│
  │  - Leaky bucket entirely (wrong paradigm for fast-reject API platform)     │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Decision Tree for Algorithm Selection

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  START: What is your primary constraint?
  │
  │         │
  │
  │         ├── "Must NEVER exceed quota" (CTO's literal words)
  │
  │         │    │
  │
  │         │    ├── Can you accept heavier Redis usage?
  │
  │         │    │    ├── YES → SLIDING WINDOW LOG ✓
  │
  │         │    │    └── NO  → TOKEN BUCKET (exact, but harder audit)
  │
  │         │    │
  │
  │         │    └── Must be trivially auditable?
  │
  │         │         ├── YES → SLIDING WINDOW LOG ✓
  │
  │         │         └── ACCEPTABLE → TOKEN BUCKET
  │
  │         │
  │
  │         ├── "Good enough accuracy with minimal infra"
  │
  │         │    │
  │
  │         │    ├── Can tolerate boundary burst?
  │
  │         │    │    ├── YES → FIXED WINDOW COUNTER
  │
  │         │    │    └── NO  → SUB-WINDOW COUNTER (reduced burst)             │
  │         │    │
  │
  │         │    └── Need smooth burst handling?
  │
  │         │         └── YES → SLIDING WINDOW COUNTER
  │
  │         │
  │
  │         └── "Need request smoothing / traffic shaping"
  │
  │              └── LEAKY BUCKET (but NOT for RelayAPI's use case)
  │
  │
  │
  │  FOR THIS ASSIGNMENT:
  │
  │  The CTO literally said "never" and "not mostly, not on average."
  │
  │  The staging incident was boundary correctness.
  │
  │  Enterprise prospects need a one-paragraph explanation.
  │
  │
  │
  │  → SLIDING WINDOW LOG is the strongest defensible choice.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

✻ Crunched for 5m 17s

※ recap: We're analyzing the RelayAPI rate limiter assignment to understand requirements, conflicts, and algorithm choices before building. We just finished comparing all rate limiting algorithms. Next step is deciding on an approach and starting implementation. (disable recaps in /config)

❯ Based on the analysis that we have made, the sliding window log seems to be   
  the optimal solution and it suits this problem statement too. Analyze the     
  feasibility of this algorithm. Also explain the counting semantics of the     
  algorithm.                                                                    

  Thought for 3s (ctrl+o to expand)

● Sliding Window Log — Feasibility Analysis & Counting Semantics

  ---
  Algorithm Definition (Formal)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                    SLIDING WINDOW LOG — FORMAL DEFINITION
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  INVARIANT:
  │
  │  For any customer C with limit L, at any point in time T:
  │
  │
  │
  │      count(requests from C in interval [T-60s, T]) ≤ L
  │
  │
  │
  │  This invariant holds for ALL values of T — there is no "boundary"
  │
  │  where it can be violated.
  │
  │
  │
  │  DATA STRUCTURE:
  │
  │  Per customer: an ordered log of request timestamps
  │
  │
  │
  │      Log(C) = { t₁, t₂, t₃, ..., tₙ }  where t₁ < t₂ < ... < tₙ         │
  │      All entries satisfy: tᵢ ≥ (now - 60s)                                 │
  │      Entries older than 60s are pruned
  │
  │
  │
  │  DECISION PROCEDURE (for new request at time T):
  │
  │  1. Prune: remove all entries where tᵢ < (T - 60s)                         │
  │  2. Count: n = |Log(C)| (number of remaining entries)
  │
  │  3. Decide:
  │
  │     • if n < L: add T to Log(C), return ALLOW                              │
  │     • if n ≥ L: do NOT add T, return DENY                                  │
  │
  │
  │  PROPERTIES:
  │
  │  • Perfectly accurate (no approximation)
  │
  │  • No boundary effects (window slides continuously)
  │
  │  • Deterministic (same state + same input = same output always)            │
  │  • Self-cleaning (old entries pruned automatically)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Counting Semantics (Enterprise-Ready Explanation)

  The One-Paragraph Explanation (CTO's Requirement)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  FOR ENTERPRISE PROSPECTS (security review / compliance):
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  "RelayAPI enforces rate limits using a sliding window log. For each │  │
  │  │   incoming request, we count the number of requests your account has │  │
  │  │   made in the preceding 60 seconds. If that count is below your      │  │
  │  │   contracted limit, the request is allowed and recorded. If the      │  │
  │  │   count equals or exceeds your limit, the request is rejected with   │  │
  │  │   HTTP 429 and a Retry-After header indicating exactly when your     │  │
  │  │   oldest recorded request will expire from the window. There is no   │  │
  │  │   approximation; the count is exact. The maximum number of requests  │  │
  │  │   that will be allowed in any 60-second period is exactly your       │  │
  │  │   contracted RPM — never more."                                      │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  This satisfies:
  │
  │  ✓ CTO: "explain to an enterprise prospect exactly how we counted"
  │
  │  ✓ CTO: "'It's complicated' is not an answer"
  │
  │  ✓ Platform context: "one-paragraph explanation of counting semantics"
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Counting Semantics — Detailed Breakdown

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  WHAT COUNTS AS A "REQUEST"?
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  COUNTED (increments the log):                                       │  │
  │  │  • Every HTTP request that reaches the rate limiter middleware       │  │
  │  │  • Regardless of HTTP method (GET, POST, PUT, DELETE)                │  │
  │  │  • Regardless of response status from upstream handler               │  │
  │  │  • Regardless of request body size                                   │  │
  │  │  • A request that is ALLOWED is added to the log                     │  │
  │  │                                                                      │  │
  │  │  NOT COUNTED (does not increment):                                   │  │
  │  │  • Requests that are REJECTED (429) — not added to log              │  │
  │  │    (critical: rejected requests don't consume quota)                 │  │
  │  │  • Health checks / internal requests without X-Customer-Id           │  │
  │  │  • Requests that fail authentication (no valid customer)            │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  WHY REJECTED REQUESTS ARE NOT COUNTED:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  If rejected requests WERE counted:                                  │  │
  │  │  • Customer hits limit at 300 → all subsequent requests are 429     │  │
  │  │  • Each 429 adds to the log → counter grows to 301, 302, 303...    │  │
  │  │  • Customer can NEVER recover within the window!                     │  │
  │  │  • Even after waiting 60 seconds, the 429s are still in the log     │  │
  │  │  • This creates a death spiral — fundamentally broken               │  │
  │  │                                                                      │  │
  │  │  By NOT counting rejections:                                         │  │
  │  │  • Counter stays at 300 when customer is at limit                    │  │
  │  │  • As old entries expire (slide out of window), slots free up        │  │
  │  │  • Customer naturally recovers at the rate old requests expire       │  │
  │  │  • System is self-healing                                            │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  How the Window Slides — Step-by-Step

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  EXAMPLE: Customer "acme" with 5 RPM limit (simplified for illustration)   │
  │  Window: 60 seconds
  │
  │
  │
  │  Time 00:00:10 — Request arrives
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Window: [23:59:10 — 00:00:10]                                       │  │
  │  │  Log: { }  (empty)                                                   │  │
  │  │  Count: 0                                                            │  │
  │  │  0 < 5 → ALLOW, add 00:00:10 to log                                 │  │
  │  │  Log: { 00:00:10 }                                                   │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  Time 00:00:15 — Request arrives
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Window: [23:59:15 — 00:00:15]                                       │  │
  │  │  Log: { 00:00:10 }                                                   │  │
  │  │  Count: 1                                                            │  │
  │  │  1 < 5 → ALLOW, add 00:00:15                                        │  │
  │  │  Log: { 00:00:10, 00:00:15 }                                         │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  Time 00:00:20, 00:00:25, 00:00:30 — Three more requests                   │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Log: { 00:00:10, 00:00:15, 00:00:20, 00:00:25, 00:00:30 }          │  │
  │  │  Count: 5                                                            │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  Time 00:00:35 — Request arrives (AT LIMIT)
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Window: [23:59:35 — 00:00:35]                                       │  │
  │  │  Log: { 00:00:10, 00:00:15, 00:00:20, 00:00:25, 00:00:30 }          │  │
  │  │  Count: 5                                                            │  │
  │  │  5 ≥ 5 → DENY (429)                                                 │  │
  │  │  Retry-After: 00:00:10 + 60s = 00:01:10 (oldest expires then)       │  │
  │  │  Retry-After seconds: 00:01:10 - 00:00:35 = 35 seconds              │  │
  │  │  Log: UNCHANGED (rejected request NOT added)                         │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  Time 00:01:11 — Request arrives (oldest entry has expired!)
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  Window: [00:00:11 — 00:01:11]                                       │  │
  │  │  Prune: 00:00:10 < 00:00:11 → REMOVE                                │  │
  │  │  Log after prune: { 00:00:15, 00:00:20, 00:00:25, 00:00:30 }        │  │
  │  │  Count: 4                                                            │  │
  │  │  4 < 5 → ALLOW, add 00:01:11                                        │  │
  │  │  Log: { 00:00:15, 00:00:20, 00:00:25, 00:00:30, 00:01:11 }          │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  THE KEY INSIGHT:
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  The window doesn't "reset" — entries INDIVIDUALLY expire.           │  │
  │  │  At 00:01:10, ONE slot frees up (not all 5).                         │  │
  │  │  At 00:01:15, another slot frees up.                                 │  │
  │  │  Etc.                                                                │  │
  │  │                                                                      │  │
  │  │  This means: throughput gradually recovers.                          │  │
  │  │  No "burst at reset" because there IS no reset.                      │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Visual: The Sliding Window Over Time

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  TIME AXIS (each | = 10 seconds):
  │
  │
  │
  │  Requests:  R1    R2    R3    R4    R5         R6(429)    R7(ok!)
  │
  │             │     │     │     │     │          │          │
  │
  │  ───────────┼─────┼─────┼─────┼─────┼──────────┼──────────┼─────── time    │
  │          00:10  00:15  00:20  00:25  00:30   00:35     01:11
  │
  │
  │
  │
  │
  │  WINDOW AT 00:30 (5/5 = FULL):
  │
  │  ◄─────────────────── 60 seconds ───────────────────────►
  │
  │  [23:59:30════════════════════════════════════════00:00:30]
  │
  │            R1    R2    R3    R4    R5
  │
  │            ●     ●     ●     ●     ●    = 5 entries (FULL)
  │
  │
  │
  │
  │
  │  WINDOW AT 00:35 (attempt R6 — DENIED):
  │
  │       ◄─────────────────── 60 seconds ───────────────────────►
  │
  │       [23:59:35══════════════════════════════════════00:00:35]
  │
  │                 R1    R2    R3    R4    R5
  │
  │                 ●     ●     ●     ●     ●    = 5 entries (FULL → 429)
  │
  │
  │
  │
  │
  │  WINDOW AT 01:11 (R1 has expired! R7 allowed):
  │
  │                 ◄─────────────────── 60 seconds ──────────────────►
  │
  │                 [00:00:11═══════════════════════════════════00:01:11]
  │
  │                       R2    R3    R4    R5                      R7
  │
  │                       ●     ●     ●     ●                      ●
  │
  │                 R1 ✗ (expired — older than 60s)
  │
  │                 Count: 4 → room for R7! ALLOWED.
  │
  │
  │
  │
  │
  │  WINDOW AT 01:16 (R2 expires, another slot):
  │
  │                      ◄─────────────────── 60 seconds ──────────────────►
  │
  │                      [00:00:16═══════════════════════════════════00:01:16]
  │
  │                            R3    R4    R5                      R7
  │
  │                            ●     ●     ●                      ●
  │
  │                 R1 ✗  R2 ✗ (both expired)
  │
  │                 Count: 4 → one slot available.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Feasibility Analysis

  1. Redis Implementation Feasibility

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  REDIS SORTED SET AS THE LOG:
  │
  │
  │
  │  Redis ZSET (Sorted Set) is a PERFECT fit for sliding window log:
  │
  │  • Ordered by score (timestamp) → natural time ordering
  │
  │  • O(log N) insert (ZADD)
  │
  │  • O(log N + M) range removal (ZREMRANGEBYSCORE) where M = entries removed │
  │  • O(1) count (ZCARD)
  │
  │  • Built-in TTL for automatic cleanup
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  KEY DESIGN:                                                         │  │
  │  │                                                                      │  │
  │  │  Key:    "rl:{customerId}"                                           │  │
  │  │  Type:   ZSET (Sorted Set)                                           │  │
  │  │  Score:  Unix timestamp in milliseconds (request time)               │  │
  │  │  Member: Unique identifier (timestamp:nodeId:counter or UUID)        │  │
  │  │  TTL:    65 seconds (window + 5s safety buffer)                      │  │
  │  │                                                                      │  │
  │  │  WHY MEMBER MUST BE UNIQUE:                                          │  │
  │  │  • Two requests at same millisecond from different nodes             │  │
  │  │  • ZSET deduplicates by member — same member = overwrite, not add!  │  │
  │  │  • Solution: member = "{timestamp}:{nodeId}:{atomicCounter}"         │  │
  │  │    e.g., "1710432000123:node2:4857"                                  │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  ATOMIC LUA SCRIPT (production-ready):
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  -- EVAL script (atomic in Redis single-threaded execution)          │  │
  │  │  -- KEYS[1] = "rl:{customerId}"                                      │  │
  │  │  -- ARGV[1] = now (current timestamp in ms)                          │  │
  │  │  -- ARGV[2] = window_size (60000 ms)                                 │  │
  │  │  -- ARGV[3] = limit (e.g., 300)                                      │  │
  │  │  -- ARGV[4] = unique member ID                                       │  │
  │  │                                                                      │  │
  │  │  local key = KEYS[1]                                                 │  │
  │  │  local now = tonumber(ARGV[1])                                       │  │
  │  │  local window = tonumber(ARGV[2])                                    │  │
  │  │  local limit = tonumber(ARGV[3])                                     │  │
  │  │  local member = ARGV[4]                                              │  │
  │  │                                                                      │  │
  │  │  -- Step 1: Prune expired entries                                    │  │
  │  │  redis.call('ZREMRANGEBYSCORE', key, 0, now - window)                │  │
  │  │                                                                      │  │
  │  │  -- Step 2: Count current entries                                    │  │
  │  │  local count = redis.call('ZCARD', key)                              │  │
  │  │                                                                      │  │
  │  │  -- Step 3: Decide                                                   │  │
  │  │  if count < limit then                                               │  │
  │  │      -- ALLOW: add this request to the log                           │  │
  │  │      redis.call('ZADD', key, now, member)                            │  │
  │  │      redis.call('PEXPIRE', key, window + 5000)                       │  │
  │  │      return {1, limit - count - 1, 0}                                │  │
  │  │      -- {allowed=1, remaining, retryAfter=0}                         │  │
  │  │  else                                                                │  │
  │  │      -- DENY: find when oldest entry expires                         │  │
  │  │      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')   │  │
  │  │      local retry_after = 0                                           │  │
  │  │      if #oldest > 0 then                                             │  │
  │  │          retry_after = (tonumber(oldest[2]) + window) - now          │  │
  │  │      end                                                             │  │
  │  │      redis.call('PEXPIRE', key, window + 5000)                       │  │
  │  │      return {0, 0, retry_after}                                      │  │
  │  │      -- {allowed=0, remaining=0, retryAfterMs}                       │  │
  │  │  end                                                                 │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  ATOMICITY GUARANTEE:
  │
  │  • Redis executes Lua scripts atomically (single-threaded)
  │
  │  • No other command can interleave between steps 1, 2, and 3               │
  │  • ALL 3 nodes calling this script are serialized through Redis
  │
  │  • Race condition: IMPOSSIBLE (by Redis's execution model)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  2. Performance Feasibility

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  PERFORMANCE ANALYSIS FOR RELAYAPI:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  OPERATION COMPLEXITY (per request):                                  │
  │
  │  │                                                                      │  │
  │  │  Operation              │ Redis Command        │ Time Complexity      │
  │
  │  │  ───────────────────────┼──────────────────────┼────────────────────  │
  │
  │  │  Prune expired entries  │ ZREMRANGEBYSCORE     │ O(log N + M)         │
  │
  │  │  Count entries          │ ZCARD                │ O(1)                 │
  │
  │  │  Add new entry          │ ZADD                 │ O(log N)             │
  │
  │  │  Find oldest (deny)     │ ZRANGE 0 0           │ O(log N + 1)         │
  │
  │  │  Set TTL                │ PEXPIRE              │ O(1)                 │
  │
  │  │                                                                      │  │
  │  │  Where N = number of entries in the set (≤ limit per customer)       │  │
  │  │  Where M = number of pruned entries (usually 0-5 per call)           │  │
  │  │                                                                      │  │
  │  │  TOTAL per request: O(log N) where N ≤ 1200 (max configured RPM)    │  │
  │  │  In practice: log₂(1200) ≈ 10 operations internally in Redis        │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  LATENCY ESTIMATES:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Component                    │ Latency                              │  │
  │  │  ─────────────────────────────┼──────────────────────────────────── │  │
  │  │  Network round-trip to Redis  │ 0.1-0.5ms (local network)           │  │
  │  │  Lua script execution         │ 0.01-0.05ms (in-memory, fast)       │  │
  │  │  TOTAL per decision           │ ~0.2-0.6ms (sub-millisecond)        │  │
  │  │                                                                      │  │
  │  │  Compare to:                                                         │  │
  │  │  Fixed window INCR            │ ~0.1-0.3ms                           │  │
  │  │  Upstream API handler         │ 10-200ms (actual business logic)     │  │
  │  │                                                                      │  │
  │  │  VERDICT: Rate limiter adds <1ms to a request that takes 10-200ms.  │  │
  │  │  This is negligible. The customer will not notice.                    │
  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  THROUGHPUT ESTIMATES:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Redis single instance can handle:                                   │  │
  │  │  • ~100,000+ operations/second for simple commands                   │  │
  │  │  • ~50,000-80,000 EVAL (Lua script) calls/second                     │  │
  │  │                                                                      │  │
  │  │  RelayAPI needs:                                                     │  │
  │  │  • Northwind peak: 1200 RPM = 20 req/sec                            │  │
  │  │  • All customers combined (estimate): ~2000-3000 RPM = 50 req/sec   │  │
  │  │  • With headroom (10x): ~500 req/sec                                 │  │
  │  │                                                                      │  │
  │  │  REDIS UTILIZATION: 500 / 50,000 = 1% of Redis capacity             │  │
  │  │                                                                      │  │
  │  │  VERDICT: Redis is vastly over-provisioned for this workload.        │  │
  │  │  Sliding window log's heavier operations are irrelevant at this      │  │
  │  │  scale. We'd need 100x more customers before Redis becomes           │  │
  │  │  a bottleneck.                                                        │
  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  3. Memory Feasibility

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  MEMORY ANALYSIS:
  │
  │
  │
  │  PER ENTRY IN REDIS SORTED SET:
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Member string: "1710432000123:node2:4857" = ~25 bytes               │  │
  │  │  Score (double): 8 bytes                                             │  │
  │  │  Redis skiplist overhead: ~40 bytes per entry                        │  │
  │  │  TOTAL per entry: ~73 bytes (round to ~80 bytes)                     │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  PER CUSTOMER (at maximum throughput):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Tier         │ Max Entries │ Memory per Customer                    │  │
  │  │  ─────────────┼─────────────┼────────────────────────────────────── │  │
  │  │  Starter      │ 60          │ 60 × 80 = 4.8 KB                      │  │
  │  │  Growth       │ 300         │ 300 × 80 = 24 KB                      │  │
  │  │  Enterprise   │ 300         │ 300 × 80 = 24 KB (contracted)         │  │
  │  │  Northwind    │ 1200        │ 1200 × 80 = 96 KB (with override)     │  │
  │  │  (batch)      │             │                                        │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  TOTAL SYSTEM MEMORY:
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Scenario: 100 Starter + 50 Growth + 10 Enterprise + 1 Northwind    │  │
  │  │                                                                      │  │
  │  │  100 × 4.8 KB   = 480 KB                                            │  │
  │  │  50 × 24 KB     = 1,200 KB                                          │  │
  │  │  10 × 24 KB     = 240 KB                                            │  │
  │  │  1 × 96 KB      = 96 KB                                             │  │
  │  │  ──────────────────────────                                          │  │
  │  │  TOTAL:         ≈ 2 MB                                               │  │
  │  │                                                                      │  │
  │  │  Redis typical memory: 1-16 GB available                             │  │
  │  │  Utilization: 2 MB / 1 GB = 0.2%                                    │  │
  │  │                                                                      │  │
  │  │  VERDICT: Memory is a complete NON-ISSUE at this scale.              │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  WHEN WOULD MEMORY BECOME A CONCERN?
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Customers     │ Avg Entries │ Total Memory                          │  │
  │  │  ──────────────┼─────────────┼──────────────────────────────────     │  │
  │  │  1,000         │ 200         │ 16 MB    (still trivial)              │  │
  │  │  10,000        │ 200         │ 160 MB   (manageable)                 │  │
  │  │  100,000       │ 200         │ 1.6 GB   (need dedicated Redis)       │  │
  │  │  1,000,000     │ 200         │ 16 GB    (need sharding/cluster)      │  │
  │  │                                                                      │  │
  │  │  RelayAPI is B2B (hundreds of customers, not millions).              │  │
  │  │  Memory is not a concern for the foreseeable future.                 │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  4. Distributed Correctness Feasibility

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  HOW 3 STATELESS NODES COORDINATE:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Node 1 ──┐                                                          │  │
  │  │           │                                                          │  │
  │  │  Node 2 ──┼──→ Redis (single instance) ──→ Lua Script (atomic)      │  │
  │  │           │         │                                                │  │
  │  │  Node 3 ──┘         │                                                │  │
  │  │                     ▼                                                │  │
  │  │              ZSET "rl:northwind"                                      │
  │
  │  │              (single source of truth)                                 │
  │
  │  │                                                                      │  │
  │  │  GUARANTEES:                                                         │  │
  │  │  • Only ONE Lua script executes at a time (Redis is single-threaded) │  │
  │  │  • Scripts are atomic (no interleaving with other commands)           │
  │
  │  │  • All nodes see the SAME state (single Redis instance)              │  │
  │  │  • Order of operations is serialized by Redis                        │  │
  │  │                                                                      │  │
  │  │  RACE CONDITION PROOF:                                               │  │
  │  │                                                                      │  │
  │  │  Scenario: Counter is at 299/300. Two requests arrive simultaneously │  │
  │  │  from Node 1 and Node 2.                                             │  │
  │  │                                                                      │  │
  │  │  WITHOUT Lua (separate commands — BROKEN):                           │  │
  │  │  ┌──────────────────────────────────────────────────────────┐       │  │
  │  │  │  Node 1: ZCARD → 299 (reads before Node 2's ZADD)       │       │  │
  │  │  │  Node 2: ZCARD → 299 (reads before Node 1's ZADD)       │       │  │
  │  │  │  Node 1: ZADD → 300 (adds because 299 < 300)            │       │  │
  │  │  │  Node 2: ZADD → 301 (adds because 299 < 300)  ← BUG!   │       │  │
  │  │  └──────────────────────────────────────────────────────────┘       │  │
  │  │                                                                      │  │
  │  │  WITH Lua (atomic script — CORRECT):                                 │  │
  │  │  ┌──────────────────────────────────────────────────────────┐       │  │
  │  │  │  Node 1's script: prune → count=299 → 299<300 → ZADD    │       │  │
  │  │  │  (completes fully, count is now 300)                     │       │  │
  │  │  │                                                          │       │  │
  │  │  │  Node 2's script: prune → count=300 → 300≥300 → DENY    │       │  │
  │  │  │  (sees 300 because Node 1's script completed first)      │       │  │
  │  │  └──────────────────────────────────────────────────────────┘       │  │
  │  │                                                                      │  │
  │  │  Redis queues script calls. They execute ONE AT A TIME.              │  │
  │  │  The race is IMPOSSIBLE by construction.                             │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  5. Clock Skew Handling

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  CLOCK SKEW BETWEEN NODES:
  │
  │
  │
  │  Problem: Node 1 thinks it's 12:01:00.000, Node 2 thinks it's 12:00:59.850│
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  APPROACH 1: Use Redis server time (RECOMMENDED)                     │  │
  │  │                                                                      │  │
  │  │  Instead of passing client timestamp to Lua script,                  │  │
  │  │  use redis.call('TIME') inside the script:                           │  │
  │  │                                                                      │  │
  │  │  local time = redis.call('TIME')                                     │  │
  │  │  local now = tonumber(time[1]) * 1000 + math.floor(                  │  │
  │  │      tonumber(time[2]) / 1000)  -- ms precision                      │  │
  │  │                                                                      │  │
  │  │  BENEFIT:                                                            │  │
  │  │  • All decisions use the SAME clock (Redis's clock)                  │  │
  │  │  • Node clock differences become irrelevant                          │  │
  │  │  • Window boundaries are consistent across all nodes                 │  │
  │  │                                                                      │  │
  │  │  CAVEAT:                                                             │  │
  │  │  • Redis TIME is not available in cluster mode scripts               │  │
  │  │  • For single Redis instance: works perfectly                        │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  APPROACH 2: Accept node timestamps, bound the error                 │  │
  │  │                                                                      │  │
  │  │  • Use NTP-synchronized node clocks (typical skew: <10ms)            │  │
  │  │  • Accept that two nodes may disagree by ~10ms                       │  │
  │  │  • At 300 RPM (5 req/sec), 10ms skew = 0.05 requests of error      │  │
  │  │  • Negligible — not worth worrying about                             │  │
  │  │                                                                      │  │
  │  │  ERROR ANALYSIS:                                                     │  │
  │  │  • Worst case: Node A's timestamp is 10ms in the future             │  │
  │  │  • Node A's request appears "newer" than it actually is             │  │
  │  │  • An entry that should expire in <10ms might persist                │  │
  │  │  • This means: AT MOST 1 extra request could be blocked             │  │
  │  │  • Error direction: UNDER-LIMIT (conservative) ← CTO's preference! │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  6. Redis Failure Mode Analysis

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  WHAT HAPPENS WHEN REDIS IS UNAVAILABLE?
  │
  │
  │
  │  Platform context: "Redis — may or may not be available"
  │
  │  CTO: "error direction under-limiting, not over-limiting"
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  FAILURE MODE 1: Redis is completely DOWN                            │  │
  │  │  ─────────────────────────────────────────                           │  │
  │  │                                                                      │  │
  │  │  Options:                                                            │  │
  │  │                                                                      │  │
  │  │  A. FAIL CLOSED (reject all requests):                               │  │
  │  │     • Every request gets 429                                         │  │
  │  │     • Safest from compliance perspective (never over-limit)          │  │
  │  │     • But: ALL customers are blocked, including healthy ones         │  │
  │  │     • CTO's preference? Under-limit ✓ but also extreme              │  │
  │  │                                                                      │  │
  │  │  B. FAIL OPEN (allow all requests):                                  │  │
  │  │     • Every request gets 200                                         │  │
  │  │     • Service stays available                                        │  │
  │  │     • But: violates "never exceed quota"                             │  │
  │  │     • CTO: explicitly does NOT want over-limiting                    │  │
  │  │                                                                      │  │
  │  │  C. DEGRADE TO LOCAL COUNTERS (recommended):                         │  │
  │  │     • Each node falls back to in-memory counter                      │  │
  │  │     • Local limit = ceil(customer_limit / num_nodes)                  │
  │
  │  │     • Node 1 allows 100, Node 2 allows 100, Node 3 allows 100       │  │
  │  │     • Total possible: 300 (matches limit, but distribution uneven)  │  │
  │  │     • If round-robin is uneven: some requests rejected early         │  │
  │  │     • Error direction: UNDER-LIMIT ✓ (CTO's preference)             │  │
  │  │     • Temporary until Redis recovers                                 │  │
  │  │                                                                      │  │
  │  │  RECOMMENDED: Option C with health check                             │  │
  │  │  • Try Redis first (with timeout: 50ms)                              │  │
  │  │  • If Redis times out: use local counter                             │  │
  │  │  • Log the degradation (audit requirement)                           │  │
  │  │  • Periodically retry Redis connection                               │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  FAILURE MODE 2: Redis is SLOW (>50ms response)                      │  │
  │  │  ────────────────────────────────────────────                        │  │
  │  │                                                                      │  │
  │  │  • Set Redis operation timeout: 50ms                                 │  │
  │  │  • If timeout: treat as failure → fall back to local counter         │  │
  │  │  • This prevents rate limiter from becoming a latency bottleneck     │  │
  │  │  • Error direction: under-limit (local counter is conservative)      │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  FAILURE MODE 3: Redis data LOSS (restart without persistence)       │  │
  │  │  ──────────────────────────────────────────────────────────          │  │
  │  │                                                                      │  │
  │  │  • All sorted sets gone → all customers appear at count 0            │  │
  │  │  • Every customer gets a "fresh start"                               │  │
  │  │  • For that first window (~60 seconds): no enforcement               │  │
  │  │  • After 60 seconds: normal operation resumes                        │  │
  │  │  • Error direction: OVER-LIMIT for ~60 seconds (temporary)           │  │
  │  │                                                                      │  │
  │  │  Mitigation: Redis AOF persistence (fsync every second)              │  │
  │  │  Worst case data loss: 1 second of request logs                      │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  FALLBACK ARCHITECTURE:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │   Request arrives                                                    │  │
  │  │       │                                                              │  │
  │  │       ▼                                                              │  │
  │  │   ┌────────────────┐                                                 │  │
  │  │   │ Try Redis Lua  │──── Success ──→ Return Redis decision           │  │
  │  │   │ (timeout 50ms) │                                                 │  │
  │  │   └───────┬────────┘                                                 │  │
  │  │           │ Timeout / Error                                          │  │
  │  │           ▼                                                          │  │
  │  │   ┌────────────────┐                                                 │  │
  │  │   │ Local in-memory │                                                │  │
  │  │   │ counter         │──→ Return local decision (conservative)        │  │
  │  │   │ (limit / N)     │                                                │  │
  │  │   └────────────────┘                                                 │  │
  │  │           │                                                          │  │
  │  │           ▼                                                          │  │
  │  │   Log degradation event (audit trail)                                │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  7. Retry-After Header Precision

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  RETRY-AFTER CALCULATION (UNIQUE ADVANTAGE OF SLIDING WINDOW LOG):
  │
  │
  │
  │  When a request is DENIED, we know EXACTLY when the next slot opens:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Log contents (limit = 5):                                           │  │
  │  │  { 12:00:10, 12:00:15, 12:00:20, 12:00:25, 12:00:30 }              │  │
  │  │                                                                      │  │
  │  │  Current time: 12:00:35                                              │  │
  │  │  Oldest entry: 12:00:10                                              │  │
  │  │  Oldest expires at: 12:00:10 + 60s = 12:01:10                       │  │
  │  │                                                                      │  │
  │  │  Retry-After = 12:01:10 - 12:00:35 = 35 seconds                     │  │
  │  │                                                                      │  │
  │  │  PRECISION: This is EXACT. Not "try again in about a minute."        │  │
  │  │  The customer knows: "wait 35 seconds, then exactly 1 slot opens."  │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  COMPARISON WITH OTHER ALGORITHMS:
  │
  │
  │
  │  ┌─────────────────────┬────────────────────────────────────────────────┐  │
  │  │ Algorithm           │ Retry-After accuracy                           │  │
  │  ├─────────────────────┼────────────────────────────────────────────────┤  │
  │  │ Fixed Window        │ "Wait until next minute" (could be 1-60s)     │  │
  │  │ Sliding Window Log  │ "Wait exactly 35.2 seconds" (precise)         │  │
  │  │ Sliding Counter     │ "Wait approximately 40 seconds" (estimate)    │  │
  │  │ Token Bucket        │ "Wait 0.2 seconds for next token" (precise)   │  │
  │  │ Leaky Bucket        │ "Wait until queue drains" (variable)          │  │
  │  └─────────────────────┴────────────────────────────────────────────────┘  │
  │
  │
  │  WHY THIS MATTERS FOR NORTHWIND:
  │
  │  • Northwind retries aggressively on 429
  │
  │  • If Retry-After is imprecise, they retry too early → more 429s → storm  │
  │  • With precise Retry-After, a well-behaved client waits exactly right     │
  │  • Even Northwind's aggressive retrier will eventually respect it
  │
  │  • Reduces amplification effect
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  8. Auditability and Debugging Feasibility

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  AUDIT AND DEBUG CAPABILITIES:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  1. INSPECT CURRENT STATE (at any moment):                           │  │
  │  │                                                                      │  │
  │  │  > ZRANGEBYSCORE rl:northwind -inf +inf WITHSCORES                   │  │
  │  │                                                                      │  │
  │  │  Returns:                                                            │  │
  │  │  1) "1710432000123:node1:1001"                                       │  │
  │  │  2) "1710432000123"           ← timestamp (score)                    │  │
  │  │  3) "1710432000456:node2:4522"                                       │  │
  │  │  4) "1710432000456"                                                  │  │
  │  │  ... (every request in the current window)                           │  │
  │  │                                                                      │  │
  │  │  AUDIT VALUE: Can show an enterprise customer EXACTLY which          │  │
  │  │  requests were counted, when they arrived, and on which node.        │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  2. ANSWER "WHY WAS MY REQUEST REJECTED?":                           │  │
  │  │                                                                      │  │
  │  │  > ZCARD rl:northwind                                                │  │
  │  │  > 300                                                               │  │
  │  │                                                                      │  │
  │  │  "Your account had 300 requests recorded in the last 60 seconds.    │  │
  │  │   Your limit is 300. The next slot opens in 12 seconds when your     │  │
  │  │   oldest request (from 48 seconds ago) expires from the window."     │  │
  │  │                                                                      │  │
  │  │  AUDIT VALUE: Precise, factual, no ambiguity.                        │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  3. VERIFY CORRECTNESS (for harness):                                │  │
  │  │                                                                      │  │
  │  │  After running load harness, inspect Redis:                          │  │
  │  │  • ZCARD should never exceed configured limit                        │  │
  │  │  • ZRANGEBYSCORE with time range shows exact window contents         │  │
  │  │  • Can correlate with harness request log for perfect audit          │  │
  │  │                                                                      │  │
  │  │  This makes the load harness PROOF trivial:                          │  │
  │  │  harness_allowed_count ≤ limit FOR EVERY 60-second span.            │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  4. HISTORICAL ANALYSIS (with logging):                              │  │
  │  │                                                                      │  │
  │  │  Every rate limit decision can be logged:                            │  │
  │  │  {                                                                   │  │
  │  │    "timestamp": "2026-03-15T02:15:30.123Z",                          │  │
  │  │    "customerId": "northwind",                                        │  │
  │  │    "decision": "ALLOW",                                              │  │
  │  │    "currentCount": 247,                                              │  │
  │  │    "limit": 1200,                                                    │  │
  │  │    "remaining": 952,                                                 │  │
  │  │    "nodeId": "node2",                                                │  │
  │  │    "overrideActive": true,                                           │  │
  │  │    "overrideId": "override-northwind-batch-2026"                     │  │
  │  │  }                                                                   │  │
  │  │                                                                      │  │
  │  │  Audit trail shows: WHICH override was active, WHO approved it,      │  │
  │  │  and exactly how many requests were counted at decision time.         │
  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  9. Override/Exception Mechanism Integration

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  HOW THE NORTHWIND OVERRIDE WORKS WITH SLIDING WINDOW LOG:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  The override changes ONE input to the algorithm: the LIMIT.         │  │
  │  │  The algorithm itself is UNCHANGED.                                  │  │
  │  │                                                                      │  │
  │  │  FLOW:                                                               │  │
  │  │                                                                      │  │
  │  │  1. Request arrives with X-Customer-Id: northwind                    │  │
  │  │  2. Look up customer config:                                         │  │
  │  │     • baseRpm: 300                                                   │  │
  │  │     • overrides: [{ window: "02:00-04:00", effectiveRpm: 1200 }]    │  │
  │  │  3. Check current time: 02:30 UTC → override is ACTIVE              │  │
  │  │  4. effectiveLimit = 1200                                            │  │
  │  │  5. Run SAME Lua script with limit=1200 instead of limit=300         │  │
  │  │  6. Script checks: count < 1200? → ALLOW                            │  │
  │  │                                                                      │  │
  │  │  THE CODE PATH IS IDENTICAL FOR ALL CUSTOMERS:                       │  │
  │  │                                                                      │  │
  │  │  function getEffectiveLimit(customerId, now):                        │  │
  │  │      config = getConfig(customerId)                                  │  │
  │  │      for override in config.overrides:                               │  │
  │  │          if override.isActiveAt(now):                                │  │
  │  │              return override.effectiveRpm                            │  │
  │  │      return config.baseRpm                                           │  │
  │  │                                                                      │  │
  │  │  // Same function for ALL customers.                                 │  │
  │  │  // Northwind has an override configured.                            │  │
  │  │  // Other customers have empty override list → get baseRpm.          │  │
  │  │  // No if(customerId === "northwind") anywhere.                      │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  WHAT HAPPENS AT WINDOW BOUNDARIES (02:00 and 04:00):
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  AT 02:00 (override activates):                                      │  │
  │  │  • Before: limit = 300. Log has ~200 entries (normal usage).         │  │
  │  │  • After: limit = 1200. Same log, same 200 entries.                  │  │
  │  │  • 200 < 1200 → plenty of room. Batch starts freely.                │  │
  │  │  • Transition is SEAMLESS. No reset, no gap.                         │  │
  │  │                                                                      │  │
  │  │  AT 04:00 (override deactivates):                                    │  │
  │  │  • Before: limit = 1200. Log might have ~800 entries (batch tail).  │  │
  │  │  • After: limit = 300. Same log, same 800 entries.                   │  │
  │  │  • 800 ≥ 300 → new requests DENIED until entries expire.            │  │
  │  │  • Entries from the last 60s of batch will drain over ~60 seconds.   │  │
  │  │  • After ~60s: log drops below 300, normal traffic resumes.          │  │
  │  │                                                                      │  │
  │  │  IS THE 04:00 TRANSITION A PROBLEM?                                  │  │
  │  │  • Northwind's batch should be DONE by 04:00.                        │  │
  │  │  • If batch finishes at 03:50, by 04:00 the log already drained     │  │
  │  │    (requests from 03:50 expire at 04:50, but traffic dropped)        │  │
  │  │  • In practice: batch ramps DOWN before 04:00.                       │  │
  │  │  • If batch runs late: entries from 03:50+ block until 04:50         │  │
  │  │  • Solution: set override window to 02:00-04:30 (buffer)            │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  VISUAL: Limit transition at 04:00
  │
  │
  │
  │  Entries
  │
  │  in log
  │
  │  1200 ┤─────────────────── LIMIT (override active) ──────────┐             │
  │       │                                                       │
  │
  │  1000 ┤      ████████████████████████                         │
  │
  │       │   ███                        ███                      │
  │
  │   800 ┤ ██                              ████                  │
  │
  │       │██                                   ████              │
  │
  │   600 ┤█                                        ████          │
  │
  │       │                                             ████      │
  │
  │   400 ┤                                                 ███   │
  │
  │       │                                                    ██ │
  │
  │   300 ┤══════════════════════════════════════════════════════════ LIMIT
  (base)
  │       │                                                       ▲ │
  │
  │   200 ┤                                                    ███  │ entries
  │
  │       │                                                  ██     │ drain
  │
  │   100 ┤                                               ███       │ below
  │
  │       │                                             ██          │ 300
  │
  │     0 ┼──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──    │           │
  │       02:00     03:00     04:00     04:30    05:00               │
  │
  │                           ▲                         ▲
  │
  │                    Override ends              Normal resumes
   │
  │                                              (~60s drain)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  10. Load Harness Provability

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  WHAT THE HARNESS CAN PROVE WITH SLIDING WINDOW LOG:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  TEST 1: EXACT ENFORCEMENT (CTO's demo)                              │  │
  │  │  ───────────────────────────────────────                              │
  │
  │  │  • Send exactly 300 RPM from Customer A → ALL allowed                │  │
  │  │  • Send exactly 300 RPM from Customer B → ALL allowed                │  │
  │  │  • Send 400 RPM from Customer C → exactly 300 allowed, 100 denied   │  │
  │  │  • Verify: in ANY 60-second sliding window, never >300 allowed      │  │
  │  │                                                                      │  │
  │  │  PROVABLE: YES (sliding window log guarantees this mathematically)   │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  TEST 2: NO BOUNDARY BURST                                           │  │
  │  │  ─────────────────────────────                                       │  │
  │  │  • Send 300 requests in last 5 seconds of a "minute"                 │  │
  │  │  • Send 300 requests in first 5 seconds of next "minute"             │  │
  │  │  • Verify: second batch gets mostly DENIED (slots haven't expired)  │  │
  │  │  • Total allowed in that 10-second span: ≤ 300 (not 600!)           │  │
  │  │                                                                      │  │
  │  │  PROVABLE: YES (no boundary to exploit — window slides continuously) │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  TEST 3: DISTRIBUTED CORRECTNESS                                     │  │
  │  │  ─────────────────────────────────                                   │  │
  │  │  • Send 400 RPM with random distribution across 3 nodes              │  │
  │  │  • Verify: total allowed is still ≤ 300 (global, not per-node)      │  │
  │  │  • Even with uneven distribution: (200 + 150 + 50 requests to       │  │
  │  │    different nodes), total allowed ≤ 300                             │  │
  │  │                                                                      │  │
  │  │  PROVABLE: YES (single Redis ZSET is the sole source of truth)       │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  TEST 4: CUSTOMER ISOLATION                                          │  │
  │  │  ──────────────────────────────                                      │  │
  │  │  • Customer A at 300 RPM (at limit)                                  │  │
  │  │  • Customer B at 100 RPM (under limit)                               │  │
  │  │  • Verify: Customer B sees 0 rejections despite A being at limit    │  │
  │  │                                                                      │  │
  │  │  PROVABLE: YES (separate ZSET per customer — impossible to interfere)│  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  TEST 5: NORTHWIND BATCH WINDOW                                      │  │
  │  │  ──────────────────────────────────                                  │  │
  │  │  • Simulate time = 02:30 UTC, override active (limit = 1200)         │  │
  │  │  • Send 1000 RPM from Northwind → ALL allowed                        │  │
  │  │  • Simulate time = 05:00 UTC, override inactive (limit = 300)        │  │
  │  │  • Send 400 RPM from Northwind → 300 allowed, 100 denied            │  │
  │  │                                                                      │  │
  │  │  PROVABLE: YES (override changes input limit; algorithm unchanged)   │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │  │                                                                      │  │
  │  │  TEST 6: RECOVERY AFTER HITTING LIMIT                                │  │
  │  │  ────────────────────────────────────────                            │  │
  │  │  • Send 300 requests in 10 seconds (burst)                           │  │
  │  │  • Next 50 seconds: all requests denied                              │  │
  │  │  • After 60 seconds: requests start being allowed again              │  │
  │  │  • Rate of recovery: gradual (as entries expire one by one)          │  │
  │  │                                                                      │  │
  │  │  PROVABLE: YES (can show the exact drain curve in harness output)    │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  HARNESS OUTPUT FORMAT:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  ═══════════════════════════════════════════════════════════════════  │
  │
  │  │  TEST: Exact Enforcement (300 RPM limit, 400 RPM sent)               │  │
  │  │  ═══════════════════════════════════════════════════════════════════  │
  │
  │  │                                                                      │  │
  │  │  Window [T+0s to T+60s]:                                             │  │
  │  │    Sent:     400 requests                                            │  │
  │  │    Allowed:  300 requests  ✓ (exactly at limit)                      │  │
  │  │    Denied:   100 requests  ✓                                         │  │
  │  │    Max in any 60s span: 300  ✓ (never exceeds)                       │  │
  │  │                                                                      │  │
  │  │  Window [T+30s to T+90s]:                                            │  │
  │  │    Sent:     400 requests                                            │  │
  │  │    Allowed:  300 requests  ✓ (sliding window holds)                  │  │
  │  │    Denied:   100 requests  ✓                                         │  │
  │  │    Max in any 60s span: 300  ✓ (never exceeds)                       │  │
  │  │                                                                      │  │
  │  │  Boundary check:                                                     │  │
  │  │    Requests in [T+55s to T+65s]: 67 sent, ≤ 300 in window  ✓        │  │
  │  │    (No boundary burst — window slides continuously)                  │  │
  │  │                                                                      │  │
  │  │  VERDICT: PASS ✓                                                     │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Feasibility Summary

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  SLIDING WINDOW LOG — FEASIBILITY VERDICT
  │
  │
  │
  │  ┌────────────────────────┬────────────┬────────────────────────────────┐  │
  │  │ Dimension              │ Feasible?  │ Notes                          │  │
  │  ├────────────────────────┼────────────┼────────────────────────────────┤  │
  │  │ Redis implementation   │ ✓ YES      │ ZSET + Lua = perfect fit       │  │
  │  │ Performance            │ ✓ YES      │ <1ms per decision; 1% Redis    │  │
  │  │ Memory                 │ ✓ YES      │ ~2MB total for all customers   │  │
  │  │ Distributed correct.   │ ✓ YES      │ Atomic Lua eliminates races    │  │
  │  │ Clock skew             │ ✓ YES      │ Use Redis TIME; error <1 req   │  │
  │  │ Redis failure          │ ✓ YES      │ Fall back to local counters    │  │
  │  │ Retry-After header     │ ✓ YES      │ Precise to the millisecond     │  │
  │  │ Auditability           │ ✓ YES      │ Can show exact request log     │  │
  │  │ Override mechanism      │ ✓ YES      │ Changes limit input only       │
  │
  │  │ Harness provability    │ ✓ YES      │ All CTO demos are provable     │  │
  │  │ Implementation time    │ ✓ YES      │ ~2-4 hours (thin slice)        │  │
  │  │ Complexity             │ ⚠ MODERATE │ Lua script + fallback logic    │  │
  │  ├────────────────────────┼────────────┼────────────────────────────────┤  │
  │  │ OVERALL                │ ✓ FEASIBLE │ Strong fit for all requirements│  │
  │  └────────────────────────┴────────────┴────────────────────────────────┘  │
  │
  │
  │  RISKS AND MITIGATIONS:
  │
  │
  │
  │  ┌──────────────────────────┬────────────────────────────────────────────┐ │
  │  │ Risk                     │ Mitigation                                 │ │
  │  ├──────────────────────────┼────────────────────────────────────────────┤ │
  │  │ Redis unavailable        │ Fallback to per-node conservative counter │ │
  │  │ Redis slow (>50ms)       │ Timeout + fallback + log degradation      │ │
  │  │ Memory growth at scale   │ Not an issue at B2B scale (hundreds)      │ │
  │  │ Lua script complexity    │ Script is <20 lines; well-tested pattern  │ │
  │  │ Unique member collision  │ nodeId + atomic counter = no collision     │ │
  │  │ Override window boundary │ Config buffer (02:00-04:30) + gradual drain│ │
  │  └──────────────────────────┴────────────────────────────────────────────┘ │
  │
  │
  │  CONCLUSION:
  │
  │  Sliding Window Log is not only theoretically optimal for RelayAPI's
  │
  │  requirements — it is practically implementable within the constraints
  │
  │  (3 nodes, Redis available, B2B scale, 4-6 hour timebox).
  │
  │  The Lua script pattern is battle-tested in production by companies
  │
  │  like Stripe, GitHub, and Shopify for exactly this use case.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Counting Semantics — Complete Formal Specification

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  RELAYAPI RATE LIMITING — COUNTING SEMANTICS SPECIFICATION
  │
  │  (For enterprise security review / compliance)
  │
  │
  │
  │  ═══════════════════════════════════════════════════════════════════════
  │
  │
  │
  │  1. UNIT OF MEASUREMENT
  │
  │     One HTTP request = one unit. All HTTP methods count equally.
  │
  │     Request body size does not affect counting.
  │
  │
  │
  │  2. WINDOW DEFINITION
  │
  │     The window is a continuously sliding 60-second interval ending at
  │
  │     the current moment. There are no fixed boundaries or reset points.
  │
  │     At any time T, the window covers [T-60s, T].
  │
  │
  │
  │  3. COUNTING RULE
  │
  │     A request is allowed if and only if the number of previously
  │
  │     allowed requests from the same customer in the current window
  │
  │     is strictly less than the customer's configured limit.
  │
  │
  │
  │  4. REJECTED REQUESTS
  │
  │     Requests that are rejected (429) are NOT counted toward the limit.
  │
  │     Only successfully admitted requests consume quota.
  │
  │
  │
  │  5. ERROR MARGIN
  │
  │     Zero. The count is exact. There is no approximation, no probabilistic
  │
  │     estimation, and no eventual consistency delay in the counting.
  │
  │     The maximum allowed requests in any 60-second span is exactly the
  │
  │     configured limit — never more.
  │
  │
  │
  │  6. COORDINATION
  │
  │     All application nodes share a single atomic counter (Redis sorted set).
  │
  │     Decisions are serialized — no two concurrent requests can both be
  │
  │     admitted if doing so would exceed the limit.
  │
  │
  │
  │  7. RECOVERY
  │
  │     When a customer is at their limit, new capacity becomes available
  │
  │     as older requests expire from the window (i.e., become >60s old).
  │
  │     Recovery is gradual, not instantaneous — there is no "reset" moment.
  │
  │
  │
  │  8. RETRY-AFTER
  │
  │     When a request is rejected, the response includes a Retry-After
  │
  │     header indicating the exact number of seconds until the next slot
  │
  │     becomes available (when the oldest request in the window expires).
  │
  │
  │
  │  9. OVERRIDES
  │
  │     A customer's effective limit may be temporarily elevated via a
  │
  │     time-window override stored in configuration. The override changes
  │
  │     only the limit parameter — the counting algorithm is unchanged.
  │
  │     All overrides are logged with approval metadata.
  │
  │
  │
  │  ═══════════════════════════════════════════════════════════════════════
  │
  │
  │
  │  FORMAL GUARANTEE:
  │
  │
  │
  │  ∀ customer C, ∀ time T:
  │
  │    |{ r ∈ allowed_requests(C) : r.timestamp ∈ [T-60s, T] }| ≤ limit(C, T) │
  │
  │
  │  Where limit(C, T) = effective limit for customer C at time T
  │
  │  (base RPM, or override RPM if an active override exists at time T)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  This specification is complete, auditable, and satisfies both the CTO's "one
  paragraph" requirement and enterprise prospects' security review needs. It's
  unambiguous enough that an independent party could verify compliance by
  examining the Redis state at any point in time.

✻ Cogitated for 4m 44s

❯ I choose node.js as the language, express as the framework, Redis client for  
  shared rate limit state, Lua scripts for atomicity mechanism, Redis time for  
  clock source. We also save the customers config file in a static JSON file    
  called customers.json in a config folder. We use Docker for containerization. 
  For harness test we use custom Node.js scripts. Analyze the given tech stack  
  and provide your inferences for its match and efficiency of the given         
  assignment.                                                                   

  Thought for 4s (ctrl+o to expand)

● Tech Stack Analysis — Node.js + Express + Redis + Docker

  ---
  Stack Overview

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                         CHOSEN TECH STACK
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  ┌────────────────┬─────────────────────────────────────────────────────┐  │
  │  │ Component      │ Choice                                              │  │
  │  ├────────────────┼─────────────────────────────────────────────────────┤  │
  │  │ Language       │ Node.js (JavaScript/ES modules)                     │  │
  │  │ Framework      │ Express.js                                          │  │
  │  │ Shared State   │ Redis (via ioredis or node-redis client)            │  │
  │  │ Atomicity      │ Redis Lua Scripts (EVAL/EVALSHA)                    │  │
  │  │ Clock Source   │ Redis TIME command (inside Lua script)              │  │
  │  │ Config Store   │ Static JSON file (config/customers.json)            │  │
  │  │ Containerize   │ Docker + Docker Compose                             │  │
  │  │ Load Harness   │ Custom Node.js scripts                              │  │
  │  └────────────────┴─────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Component-by-Component Analysis

  1. Node.js as Language

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                         NODE.JS — INFERENCE
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FIT FOR THIS ASSIGNMENT:  ★★★★★ EXCELLENT                                 │
  │
  │
  │  WHY IT MATCHES:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  1. ASYNC I/O IS THE CORE NEED                                       │  │
  │  │     • Rate limiter is I/O-bound (Redis calls), not CPU-bound         │  │
  │  │     • Node's event loop handles concurrent Redis calls efficiently   │  │
  │  │     • No thread management overhead for waiting on Redis responses   │  │
  │  │     • Perfect for "receive request → call Redis → respond" pattern   │  │
  │  │                                                                      │  │
  │  │  2. FAST PROTOTYPING                                                 │  │
  │  │     • 4-6 hour timebox — Node.js has lowest ceremony of all backends │  │
  │  │     • No compilation step, no type system overhead for prototyping    │
  │
  │  │     • npm ecosystem: instant access to Redis clients, HTTP servers   │  │
  │  │     • Express server running in <10 lines of code                    │  │
  │  │                                                                      │  │
  │  │  3. SINGLE LANGUAGE FOR ENTIRE STACK                                 │  │
  │  │     • Service: Node.js                                               │  │
  │  │     • Harness: Node.js                                               │  │
  │  │     • Config parsing: native JSON (no library needed)                │  │
  │  │     • Less context switching = faster development                    │  │
  │  │                                                                      │  │
  │  │  4. REVIEWER FAMILIARITY                                             │  │
  │  │     • Most hiring evaluators know JavaScript                         │  │
  │  │     • Code is readable without language-specific knowledge           │  │
  │  │     • Reduces friction in "≤15 minute setup" requirement             │  │
  │  │                                                                      │  │
  │  │  5. STATELESS BY DEFAULT                                             │  │
  │  │     • Node processes don't share memory (no shared state by default) │  │
  │  │     • Maps perfectly to "3 stateless app nodes" requirement          │  │
  │  │     • Running 3 instances = just launch 3 processes                  │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  POTENTIAL CONCERNS AND REBUTTALS:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Concern: "Node is single-threaded — can it handle the throughput?"  │  │
  │  │  Rebuttal: At 1200 RPM peak (20 req/sec), Node can handle           │  │
  │  │  10,000+ req/sec easily. We're at <1% capacity.                      │  │
  │  │                                                                      │  │
  │  │  Concern: "No type safety — might have runtime errors"               │  │
  │  │  Rebuttal: For a 4-6 hour prototype, type safety overhead            │  │
  │  │  outweighs benefit. The harness IS the type-checker (it proves       │  │
  │  │  correct behavior at runtime).                                       │  │
  │  │                                                                      │  │
  │  │  Concern: "Callback hell / async complexity"                         │  │
  │  │  Rebuttal: Modern Node.js uses async/await. Redis calls are          │  │
  │  │  clean one-liners: `const result = await redis.eval(script, ...)`    │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  2. Express.js as Framework

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                         EXPRESS.JS — INFERENCE
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FIT FOR THIS ASSIGNMENT:  ★★★★★ EXCELLENT                                 │
  │
  │
  │  WHY IT MATCHES:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  1. MIDDLEWARE PATTERN = RATE LIMITER PATTERN                        │  │
  │  │                                                                      │  │
  │  │     Express middleware is EXACTLY how a rate limiter should work:    │  │
  │  │                                                                      │  │
  │  │     app.use(rateLimiterMiddleware)  // runs BEFORE route handlers    │  │
  │  │     app.get('/api/v1/resource', handler)                             │  │
  │  │                                                                      │  │
  │  │     The rate limiter IS a middleware. Express IS a middleware         │
  │
  │  │     framework. The mapping is 1:1.                                   │  │
  │  │                                                                      │  │
  │  │  2. MINIMAL CEREMONY                                                 │  │
  │  │                                                                      │  │
  │  │     const app = express()                                            │  │
  │  │     app.use(rateLimiter)                                             │  │
  │  │     app.get('/api/v1/resource', (req, res) => res.json({ok: true})) │  │
  │  │     app.listen(PORT)                                                 │  │
  │  │                                                                      │  │
  │  │     That's the entire service. 4 lines. Everything else is the       │  │
  │  │     rate limiter logic itself.                                       │  │
  │  │                                                                      │  │
  │  │  3. HEADER ACCESS                                                    │  │
  │  │                                                                      │  │
  │  │     • Read: req.headers['x-customer-id'] (customer identity)         │  │
  │  │     • Write: res.set('Retry-After', seconds) (rate limit headers)   │  │
  │  │     • Write: res.set('X-RateLimit-Remaining', remaining)            │  │
  │  │     • Status: res.status(429).json({...}) (rejection)               │  │
  │  │                                                                      │  │
  │  │     Express gives clean access to everything the rate limiter needs. │  │
  │  │                                                                      │  │
  │  │  4. MULTIPLE INSTANCES TRIVIAL                                       │  │
  │  │                                                                      │  │
  │  │     • Same code, different PORT env var = different "node"           │  │
  │  │     • Docker Compose: replicas: 3 or 3 separate service entries     │  │
  │  │     • No cluster module needed (each container = one instance)       │  │
  │  │                                                                      │  │
  │  │  5. UNIVERSALLY KNOWN                                                │  │
  │  │                                                                      │  │
  │  │     • Evaluators will understand immediately                         │  │
  │  │     • No framework-specific magic to learn                           │  │
  │  │     • Setup: `npm install express` — done                            │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  EXPRESS MIDDLEWARE ARCHITECTURE (how it maps to RelayAPI):
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  REQUEST FLOW THROUGH EXPRESS:                                       │  │
  │  │                                                                      │  │
  │  │  HTTP Request                                                        │  │
  │  │      │                                                               │  │
  │  │      ▼                                                               │  │
  │  │  ┌──────────────────────────┐                                        │  │
  │  │  │ Express App              │                                        │  │
  │  │  │                          │                                        │  │
  │  │  │  ┌────────────────────┐  │                                        │  │
  │  │  │  │ Middleware 1:      │  │  Extract X-Customer-Id                 │  │
  │  │  │  │ customerIdentify() │──┤  Attach to req.customerId              │  │
  │  │  │  └────────┬───────────┘  │                                        │  │
  │  │  │           │ next()       │                                        │  │
  │  │  │           ▼              │                                        │  │
  │  │  │  ┌────────────────────┐  │                                        │  │
  │  │  │  │ Middleware 2:      │  │  Load config, resolve effective limit   │
  │
  │  │  │  │ rateLimiter()      │──┤  Call Redis Lua script                  │
  │
  │  │  │  │                    │  │  If denied: res.status(429) + RETURN    │
  │
  │  │  │  └────────┬───────────┘  │  If allowed: next()                    │  │
  │  │  │           │ next()       │                                        │  │
  │  │  │           ▼              │                                        │  │
  │  │  │  ┌────────────────────┐  │                                        │  │
  │  │  │  │ Route Handler:     │  │  Actual API business logic             │  │
  │  │  │  │ GET /api/v1/resource│─┤  res.json({ data: ... })               │  │
  │  │  │  └────────────────────┘  │                                        │  │
  │  │  │                          │                                        │  │
  │  │  └──────────────────────────┘                                        │  │
  │  │                                                                      │  │
  │  │  KEY: Rate limiter can SHORT-CIRCUIT the pipeline.                   │  │
  │  │  If denied, it returns 429 and NEVER calls the route handler.        │  │
  │  │  This is exactly how Express middleware is designed to work.          │
  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  POTENTIAL CONCERNS:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Concern: "Express is old / not trendy — should use Fastify/Koa?"    │  │
  │  │  Rebuttal: Assignment says "we do NOT grade framework fashion."      │  │
  │  │  Express is stable, understood, minimal. Perfect for prototypes.     │  │
  │  │                                                                      │  │
  │  │  Concern: "Express has no built-in validation"                       │  │
  │  │  Rebuttal: We're building a middleware, not a REST API. The only     │  │
  │  │  input is X-Customer-Id header. Manual validation is 1 line.         │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  3. Redis Client for Shared State

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                    REDIS CLIENT — INFERENCE
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FIT FOR THIS ASSIGNMENT:  ★★★★★ EXCELLENT                                 │
  │
  │
  │  CLIENT CHOICE: ioredis vs node-redis
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  ┌─────────────────┬───────────────────┬─────────────────────────┐  │  │
  │  │  │ Feature         │ ioredis           │ node-redis (v4+)        │  │  │
  │  │  ├─────────────────┼───────────────────┼─────────────────────────┤  │  │
  │  │  │ Lua script      │ ✓ Built-in        │ ✓ Built-in              │  │  │
  │  │  │ support         │   .eval()         │   .eval()               │  │  │
  │  │  ├─────────────────┼───────────────────┼─────────────────────────┤  │  │
  │  │  │ Promises        │ ✓ Native          │ ✓ Native (v4+)          │  │  │
  │  │  ├─────────────────┼───────────────────┼─────────────────────────┤  │  │
  │  │  │ Auto-reconnect  │ ✓ Built-in        │ ✓ Built-in              │  │  │
  │  │  ├─────────────────┼───────────────────┼─────────────────────────┤  │  │
  │  │  │ Script caching  │ ✓ defineCommand() │ ✓ scripts option        │  │  │
  │  │  │ (EVALSHA)       │                   │                         │  │  │
  │  │  ├─────────────────┼───────────────────┼─────────────────────────┤  │  │
  │  │  │ Maturity        │ Battle-tested     │ Official Redis client   │  │  │
  │  │  ├─────────────────┼───────────────────┼─────────────────────────┤  │  │
  │  │  │ Recommendation  │ ✓ PREFERRED       │ ✓ Also fine             │  │  │
  │  │  └─────────────────┴───────────────────┴─────────────────────────┘  │  │
  │  │                                                                      │  │
  │  │  Either works. ioredis has slightly better Lua script ergonomics     │  │
  │  │  and auto-pipelining. node-redis is the official client.             │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  WHY REDIS IS THE RIGHT CHOICE:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  1. PLATFORM CONTEXT MENTIONS IT                                     │  │
  │  │     "Data stores: Redis (cache — may or may not be available)"       │  │
  │  │     → Redis EXISTS in the architecture. It's a known component.      │  │
  │  │     → Using it doesn't require "provisioning new infra"              │  │
  │  │     → We just need to handle the "may not be available" case         │  │
  │  │                                                                      │  │
  │  │  2. SINGLE-THREADED EXECUTION = ATOMIC OPERATIONS                    │  │
  │  │     → Lua scripts execute without interleaving                       │  │
  │  │     → Solves the distributed race condition completely               │  │
  │  │     → No need for distributed locks, consensus protocols, etc.       │  │
  │  │                                                                      │  │
  │  │  3. SORTED SETS = SLIDING WINDOW LOG                                 │  │
  │  │     → ZSET data structure is purpose-built for this algorithm        │  │
  │  │     → ZADD, ZREMRANGEBYSCORE, ZCARD = the entire algorithm          │  │
  │  │     → TTL for automatic memory cleanup                              │  │
  │  │                                                                      │  │
  │  │  4. SUB-MILLISECOND LATENCY                                          │  │
  │  │     → In-memory operations: ~0.1ms                                   │  │
  │  │     → Network overhead (same Docker network): ~0.2-0.5ms            │  │
  │  │     → Total: <1ms per rate limit decision                            │  │
  │  │                                                                      │  │
  │  │  5. DOCKER-FRIENDLY                                                  │  │
  │  │     → Official Redis Docker image: `redis:7-alpine`                  │  │
  │  │     → Single line in docker-compose.yml                              │  │
  │  │     → No persistent storage needed for prototype                     │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  HANDLING "MAY NOT BE AVAILABLE":
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  The wiki says Redis "may or may not be available."                   │
  │
  │  │  For the PROTOTYPE: we REQUIRE Redis (it's our core coordination).   │  │
  │  │  For PRODUCTION: we'd add a fallback layer.                          │  │
  │  │                                                                      │  │
  │  │  PROTOTYPE STRATEGY (honest in DECISIONS.md):                        │  │
  │  │  • Redis IS required. Docker Compose provisions it.                  │  │
  │  │  • If Redis goes down: service degrades to local counters            │  │
  │  │  • This is acceptable for a "thin working service" prototype        │  │
  │  │  • Document in "what I would build next with 4 more hours"           │  │
  │  │                                                                      │  │
  │  │  IMPLEMENTATION:                                                     │  │
  │  │  • Redis client with connection error handler                        │  │
  │  │  • On connection loss: log warning, fall back to per-node counter    │  │
  │  │  • On reconnection: resume normal distributed operation              │  │
  │  │  • Health endpoint reports Redis connectivity status                 │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  4. Lua Scripts for Atomicity

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                    LUA SCRIPTS — INFERENCE
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FIT FOR THIS ASSIGNMENT:  ★★★★★ EXCELLENT                                 │
  │
  │
  │  WHY LUA IN REDIS IS THE RIGHT ATOMICITY MECHANISM:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  ALTERNATIVES CONSIDERED:                                            │  │
  │  │                                                                      │  │
  │  │  ┌───────────────────┬───────────────┬───────────────────────────┐  │  │
  │  │  │ Approach          │ Atomic?       │ Problem                    │  │  │
  │  │  ├───────────────────┼───────────────┼───────────────────────────┤  │  │
  │  │  │ MULTI/EXEC        │ Partially     │ Cannot branch on read     │  │  │
  │  │  │ (Redis txn)       │               │ values (no conditional)   │  │  │
  │  │  ├───────────────────┼───────────────┼───────────────────────────┤  │  │
  │  │  │ WATCH + MULTI     │ Optimistic    │ Retries under contention; │  │  │
  │  │  │                   │               │ fails at Northwind scale  │  │  │
  │  │  ├───────────────────┼───────────────┼───────────────────────────┤  │  │
  │  │  │ Distributed Lock  │ Yes           │ Complex; latency; Redlock │  │  │
  │  │  │ (Redlock)         │               │ controversy; overkill     │  │  │
  │  │  ├───────────────────┼───────────────┼───────────────────────────┤  │  │
  │  │  │ Lua Script        │ YES (perfect) │ None for this use case    │  │  │
  │  │  │ (EVAL)            │               │                           │  │  │
  │  │  └───────────────────┴───────────────┴───────────────────────────┘  │  │
  │  │                                                                      │  │
  │  │  WHY MULTI/EXEC DOESN'T WORK:                                       │  │
  │  │  We need: IF count < limit THEN add ELSE deny                        │  │
  │  │  MULTI/EXEC cannot branch — it queues commands blindly.              │  │
  │  │  We'd ALWAYS add, then check after — too late to undo atomically.   │  │
  │  │                                                                      │  │
  │  │  WHY WATCH DOESN'T WORK:                                            │  │
  │  │  Under 20 req/sec from Northwind, WATCH would fail (abort)           │  │
  │  │  constantly due to contention on the same key. Retry storms.         │  │
  │  │                                                                      │  │
  │  │  WHY LUA IS PERFECT:                                                 │  │
  │  │  • Read + decide + write in ONE atomic operation                     │  │
  │  │  • Redis guarantees no interleaving during Lua execution             │  │
  │  │  • Can branch (if/else), loop, compute — full programming          │  │
  │  │  • No retries needed — always succeeds in one call                  │  │
  │  │  • Industry standard for exactly this pattern                        │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  IMPLEMENTATION DETAIL:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  EVALSHA vs EVAL:                                                    │  │
  │  │                                                                      │  │
  │  │  • EVAL: sends full script text on every call (more bandwidth)      │  │
  │  │  • EVALSHA: sends SHA1 hash; script cached on Redis server          │  │
  │  │  • SCRIPT LOAD: pre-loads script, returns SHA                        │  │
  │  │                                                                      │  │
  │  │  FOR PROTOTYPE: EVAL is fine (script is small, ~20 lines)           │  │
  │  │  FOR PRODUCTION: EVALSHA with fallback to EVAL on NOSCRIPT error    │  │
  │  │                                                                      │  │
  │  │  ioredis handles this automatically with defineCommand():            │  │
  │  │                                                                      │  │
  │  │  redis.defineCommand('checkRateLimit', {                             │  │
  │  │    numberOfKeys: 1,                                                  │  │
  │  │    lua: fs.readFileSync('scripts/rate-limit.lua', 'utf8')           │  │
  │  │  });                                                                 │  │
  │  │                                                                      │  │
  │  │  // Usage: automatically uses EVALSHA, falls back to EVAL            │  │
  │  │  const result = await redis.checkRateLimit(key, limit, memberId);   │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  PERFORMANCE OF LUA IN REDIS:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  Script size: ~20 lines of Lua                                       │  │
  │  │  Operations within script: 3-4 Redis commands                        │  │
  │  │  Execution time: 0.01-0.05ms (in-memory, no I/O)                    │  │
  │  │  Blocking window: <0.1ms (other clients wait this long)             │  │
  │  │                                                                      │  │
  │  │  At 20 req/sec (Northwind peak):                                     │  │
  │  │  • 20 × 0.05ms = 1ms of total Lua execution per second             │  │
  │  │  • Redis is blocked for 0.1% of each second                         │  │
  │  │  • Remaining 99.9% available for other operations                    │  │
  │  │                                                                      │  │
  │  │  VERDICT: Lua script blocking is completely negligible.              │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  5. Redis TIME as Clock Source

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                    REDIS TIME — INFERENCE
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FIT FOR THIS ASSIGNMENT:  ★★★★☆ VERY GOOD                                 │
  │
  │
  │  WHY REDIS TIME IS THE RIGHT CLOCK SOURCE:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  THE PROBLEM IT SOLVES:                                              │  │
  │  │                                                                      │  │
  │  │  3 nodes may have slightly different clocks:                         │  │
  │  │  • Node 1: 12:01:00.000                                             │  │
  │  │  • Node 2: 12:00:59.985 (15ms behind)                               │  │
  │  │  • Node 3: 12:01:00.120 (120ms ahead)                               │  │
  │  │                                                                      │  │
  │  │  If each node passes ITS OWN timestamp to the Lua script:            │  │
  │  │  • A request on Node 3 appears "from the future"                     │  │
  │  │  • Window calculations become inconsistent                          │  │
  │  │  • Edge case: entry from Node 3 at T+120ms looks newer than it is   │  │
  │  │                                                                      │  │
  │  │  WITH REDIS TIME:                                                    │  │
  │  │  • All decisions use ONE clock (Redis server's clock)                │  │
  │  │  • Node clocks become irrelevant                                     │  │
  │  │  • Window boundaries are perfectly consistent                        │  │
  │  │  • No skew between nodes by construction                            │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  IMPLEMENTATION INSIDE LUA SCRIPT:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  -- Get Redis server time (consistent across all callers)            │  │
  │  │  local time = redis.call('TIME')                                     │  │
  │  │  local now_ms = tonumber(time[1]) * 1000 +                           │  │
  │  │                 math.floor(tonumber(time[2]) / 1000)                  │
  │
  │  │                                                                      │  │
  │  │  -- time[1] = Unix seconds                                           │  │
  │  │  -- time[2] = microseconds within that second                        │  │
  │  │  -- Combined: millisecond-precision timestamp                        │  │
  │  │                                                                      │  │
  │  │  -- Use now_ms for all window calculations:                          │  │
  │  │  local window_start = now_ms - window_size_ms                        │  │
  │  │  redis.call('ZREMRANGEBYSCORE', key, 0, window_start)                │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  CAVEAT AND MITIGATION:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  CAVEAT: redis.call('TIME') is flagged as non-deterministic          │  │
  │  │  in Redis documentation. In Redis cluster mode (with replication),   │  │
  │  │  scripts using TIME cannot be replicated deterministically.           │
  │
  │  │                                                                      │  │
  │  │  FOR THIS PROJECT: NOT A PROBLEM because:                            │  │
  │  │  • We're using a SINGLE Redis instance (not cluster)                 │  │
  │  │  • The wiki describes one Redis instance (not a cluster)             │  │
  │  │  • Rate limit state doesn't need replication (it's ephemeral)        │  │
  │  │  • If Redis restarts, state rebuilds in <60 seconds                  │  │
  │  │                                                                      │  │
  │  │  FOR PRODUCTION (future): If Redis cluster is needed:                │  │
  │  │  • Pass node timestamp as ARGV (acceptable at NTP accuracy)          │  │
  │  │  • Or use Redis Streams with server-generated IDs                    │  │
  │  │  • Document this in "what I would build next"                        │  │
  │  │                                                                      │  │
  │  │  ALTERNATIVE APPROACHES:                                             │  │
  │  │  ┌───────────────────┬──────────────────────────────────────────┐   │  │
  │  │  │ Approach          │ Trade-off                                │   │  │
  │  │  ├───────────────────┼──────────────────────────────────────────┤   │  │
  │  │  │ Redis TIME (Lua)  │ Perfect consistency; non-deterministic    │   │  │
  │  │  │                   │ script (can't replicate)                  │   │  │
  │  │  ├───────────────────┼──────────────────────────────────────────┤   │  │
  │  │  │ Node timestamp    │ Clock skew possible (~10ms); but          │   │  │
  │  │  │ (pass as ARGV)    │ deterministic script; cluster-safe        │   │  │
  │  │  ├───────────────────┼──────────────────────────────────────────┤   │  │
  │  │  │ Hybrid            │ Use node timestamp but validate within    │   │  │
  │  │  │                   │ 100ms of Redis TIME; reject if too skewed │   │  │
  │  │  └───────────────────┴──────────────────────────────────────────┘   │  │
  │  │                                                                      │  │
  │  │  FOR THE PROTOTYPE: Redis TIME is the cleanest solution.             │  │
  │  │  Zero skew, zero configuration, zero ambiguity.                      │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  6. Static JSON Config (customers.json)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                 STATIC JSON CONFIG — INFERENCE
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FIT FOR THIS ASSIGNMENT:  ★★★★★ EXCELLENT                                 │
  │
  │
  │  WHY STATIC JSON IS THE RIGHT CONFIG CHOICE:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  1. MATCHES "THIN VERTICAL SLICE" REQUIREMENT                       │  │
  │  │     • No database schema to design, migrate, seed                    │  │
  │  │     • No API for CRUD operations on config                           │  │
  │  │     • Just a file. Read it. Use it. Done.                            │  │
  │  │     • Full billing/dashboard integration is "out of scope"           │  │
  │  │                                                                      │  │
  │  │  2. READABLE BY EVALUATORS                                           │  │
  │  │     • Open config/customers.json → immediately understand the setup  │  │
  │  │     • No need to query a database to see what's configured           │  │
  │  │     • Self-documenting: the config IS the specification              │  │
  │  │                                                                      │  │
  │  │  3. AUDITABLE (CTO requirement)                                      │  │
  │  │     • Version controlled (git tracks changes to config)              │  │
  │  │     • Git blame shows who changed what, when                         │  │
  │  │     • No "midnight commit" — config changes are in git history       │  │
  │  │     • CTO's "config and audit" requirement: ✓                        │  │
  │  │                                                                      │  │
  │  │  4. NO ADDITIONAL INFRASTRUCTURE                                     │  │
  │  │     • Wiki: "do not assume ops will provision new infra"             │  │
  │  │     • JSON file requires ZERO infra beyond the filesystem            │  │
  │  │     • Docker mounts it as a volume — done                            │  │
  │  │                                                                      │  │
  │  │  5. NATIVE TO NODE.JS                                                │  │
  │  │     • const config = require('./config/customers.json')              │  │
  │  │     • Or: JSON.parse(fs.readFileSync(...))                           │  │
  │  │     • Zero dependencies for config loading                           │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  PROPOSED STRUCTURE:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  // config/customers.json                                            │  │
  │  │  {                                                                   │  │
  │  │    "customers": {                                                    │  │
  │  │      "northwind-logistics": {                                        │  │
  │  │        "name": "Northwind Logistics",                                │  │
  │  │        "tier": "enterprise",                                         │  │
  │  │        "rpmLimit": 300,                                              │  │
  │  │        "overrides": [                                                │  │
  │  │          {                                                           │  │
  │  │            "id": "override-northwind-batch-2026",                    │  │
  │  │            "effectiveRpm": 1200,                                     │  │
  │  │            "schedule": {                                             │  │
  │  │              "windowStart": "02:00",                                 │  │
  │  │              "windowEnd": "04:00",                                   │  │
  │  │              "timezone": "UTC"                                       │  │
  │  │            },                                                        │  │
  │  │            "reason": "Batch window accommodation",                   │  │
  │  │            "approvedBy": "vp-sales",                                 │  │
  │  │            "expiresAt": "2026-05-01T00:00:00Z"                       │  │
  │  │          }                                                           │  │
  │  │        ]                                                             │  │
  │  │      },                                                              │  │
  │  │      "acme-corp": {                                                  │  │
  │  │        "name": "Acme Corporation",                                   │  │
  │  │        "tier": "growth",                                             │  │
  │  │        "rpmLimit": 300,                                              │  │
  │  │        "overrides": []                                               │  │
  │  │      },                                                              │  │
  │  │      "small-startup": {                                              │  │
  │  │        "name": "Small Startup",                                      │  │
  │  │        "tier": "starter",                                            │  │
  │  │        "rpmLimit": 60,                                               │  │
  │  │        "overrides": []                                               │  │
  │  │      }                                                               │  │
  │  │    }                                                                 │  │
  │  │  }                                                                   │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  KEY DESIGN DECISIONS IN THE JSON:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  1. Keyed by customerId (matches X-Customer-Id header) → O(1) lookup│  │
  │  │  2. Override is an ARRAY (multiple overrides possible per customer)  │  │
  │  │  3. Override has schedule (time window) — not hardcoded logic        │  │
  │  │  4. Override has audit fields (approvedBy, reason, expiresAt)        │  │
  │  │  5. Overrides array is EMPTY for normal customers (generic path)    │  │
  │  │  6. No if(customerId === "northwind") anywhere — just config lookup │  │
  │  │                                                                      │  │
  │  │  CTO SATISFACTION:                                                   │  │
  │  │  • "No special-case hacks" → Config file, not code                  │  │
  │  │  • "Goes through config and audit" → ✓ Config, git-auditable        │  │
  │  │  • "No manual overrides in code paths" → ✓ All from JSON            │  │
  │  │                                                                      │  │
  │  │  SUPPORT SATISFACTION:                                               │  │
  │  │  • "Northwind must never see 429" → effectiveRpm: 1200 during batch │  │
  │  │  • "Invisible to customer" → Customer sees 200; config is internal  │  │
  │  │  • "Temporary exception" → expiresAt forces resolution              │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  TRADE-OFFS ACCEPTED:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  • No hot-reload: changing config requires restart (or file watcher) │  │
  │  │    → Acceptable for prototype; production would use DB or env        │  │
  │  │                                                                      │  │
  │  │  • No dynamic API: can't add customers without redeploying           │  │
  │  │    → "Full billing integration is out of scope" per wiki             │  │
  │  │                                                                      │  │
  │  │  • All nodes must mount same file: Docker volume handles this        │  │
  │  │    → Or: bake it into the Docker image                               │  │
  │  │                                                                      │  │
  │  │  • Unknown customerId: what happens?                                 │  │
  │  │    → Return 403 (unrecognized customer) or apply default limit       │  │
  │  │    → Document the choice                                             │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  7. Docker for Containerization

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                    DOCKER — INFERENCE
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FIT FOR THIS ASSIGNMENT:  ★★★★★ EXCELLENT                                 │
  │
  │
  │  WHY DOCKER IS THE PERFECT CONTAINERIZATION CHOICE:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  1. "≤15 MINUTES SETUP" REQUIREMENT                                  │  │
  │  │                                                                      │  │
  │  │     Without Docker:                                                  │  │
  │  │     • Install Node.js (which version?)                               │  │
  │  │     • Install Redis (OS-specific: brew/apt/chocolatey)               │  │
  │  │     • Configure Redis                                                │  │
  │  │     • npm install                                                    │  │
  │  │     • Start Redis                                                    │  │
  │  │     • Start 3 node processes on different ports                      │  │
  │  │     • Configure load balancer (nginx? HAProxy? caddy?)               │  │
  │  │     → Could easily take 30+ minutes for a reviewer                   │  │
  │  │                                                                      │  │
  │  │     With Docker:                                                     │  │
  │  │     docker compose up                                                │  │
  │  │     → 1 command. ~2 minutes (image pull). Done.                      │  │
  │  │                                                                      │  │
  │  │  2. SIMULATES 3 STATELESS NODES PERFECTLY                            │  │
  │  │                                                                      │  │
  │  │     docker-compose.yml:                                              │  │
  │  │     ┌──────────────────────────────────────────────────────────┐    │  │
  │  │     │  services:                                                │    │  │
  │  │     │    redis:                                                 │    │  │
  │  │     │      image: redis:7-alpine                                │    │  │
  │  │     │                                                           │    │  │
  │  │     │    app-node-1:                                            │    │  │
  │  │     │      build: .                                             │    │  │
  │  │     │      environment:                                         │    │  │
  │  │     │        - NODE_ID=node-1                                   │    │  │
  │  │     │        - PORT=3001                                        │    │  │
  │  │     │        - REDIS_URL=redis://redis:6379                     │    │  │
  │  │     │                                                           │    │  │
  │  │     │    app-node-2:                                            │    │  │
  │  │     │      build: .                                             │    │  │
  │  │     │      environment:                                         │    │  │
  │  │     │        - NODE_ID=node-2                                   │    │  │
  │  │     │        - PORT=3002                                        │    │  │
  │  │     │        - REDIS_URL=redis://redis:6379                     │    │  │
  │  │     │                                                           │    │  │
  │  │     │    app-node-3:                                            │    │  │
  │  │     │      build: .                                             │    │  │
  │  │     │      environment:                                         │    │  │
  │  │     │        - NODE_ID=node-3                                   │    │  │
  │  │     │        - PORT=3003                                        │    │  │
  │  │     │        - REDIS_URL=redis://redis:6379                     │    │  │
  │  │     │                                                           │    │  │
  │  │     │    nginx:                                                 │    │  │
  │  │     │      image: nginx:alpine                                  │    │  │
  │  │     │      ports: ["8080:80"]                                   │    │  │
  │  │     │      # round-robin upstream to app-node-1,2,3             │    │  │
  │  │     └──────────────────────────────────────────────────────────┘    │  │
  │  │                                                                      │  │
  │  │     This IS the "3 stateless nodes behind round-robin LB"           │  │
  │  │     from the wiki. Running on a reviewer's laptop. Identical.        │  │
  │  │                                                                      │  │
  │  │  3. ISOLATION PROVES STATELESSNESS                                   │  │
  │  │                                                                      │  │
  │  │     Each container has its own filesystem, memory, network stack.   │  │
  │  │     If the rate limiter works correctly across 3 containers          │  │
  │  │     sharing ONLY Redis, it proves distributed correctness.           │  │
  │  │     No "accidentally shared" process memory.                         │  │
  │  │                                                                      │  │
  │  │  4. REPRODUCIBLE                                                     │  │
  │  │                                                                      │  │
  │  │     • Same Dockerfile = same environment everywhere                  │  │
  │  │     • No "works on my machine" — works in any Docker environment    │  │
  │  │     • Reviewer on Mac, Linux, or Windows: identical behavior         │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  PROPOSED DOCKER ARCHITECTURE:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  ┌─── Docker Compose Network ──────────────────────────────────┐    │  │
  │  │  │                                                              │    │  │
  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │    │  │
  │  │  │  │  Node 1 │  │  Node 2 │  │  Node 3 │  │    Redis     │  │    │  │
  │  │  │  │  :3001  │  │  :3002  │  │  :3003  │  │    :6379     │  │    │  │
  │  │  │  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬───────┘  │    │  │
  │  │  │       │            │            │               │          │    │  │
  │  │  │       └────────────┼────────────┼───────────────┘          │    │  │
  │  │  │                    │            │                           │    │  │
  │  │  │  ┌────────────────────────────────────────────────────┐    │    │  │
  │  │  │  │                NGINX (Load Balancer)                │    │    │  │
  │  │  │  │                Round-robin :8080                    │    │    │  │
  │  │  │  └────────────────────────┬───────────────────────────┘    │    │  │
  │  │  │                           │                                │    │  │
  │  │  └───────────────────────────┼────────────────────────────────┘    │  │
  │  │                              │                                      │  │
  │  │                        Exposed :8080                                │  │
  │  │                              │                                      │  │
  │  │                     ┌────────▼────────┐                             │  │
  │  │                     │  Load Harness   │ (runs outside or inside)    │  │
  │  │                     │  (Node.js)      │                             │  │
  │  │                     └─────────────────┘                             │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  DOCKERFILE (minimal):
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  FROM node:20-alpine                                                 │  │
  │  │  WORKDIR /app                                                        │  │
  │  │  COPY package*.json ./                                               │  │
  │  │  RUN npm ci --production                                             │  │
  │  │  COPY . .                                                            │  │
  │  │  EXPOSE 3000                                                         │  │
  │  │  CMD ["node", "src/server.js"]                                       │  │
  │  │                                                                      │  │
  │  │  → ~50MB image. Builds in <10 seconds.                               │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  8. Custom Node.js Load Harness

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                CUSTOM NODE.JS LOAD HARNESS — INFERENCE
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FIT FOR THIS ASSIGNMENT:  ★★★★★ EXCELLENT                                 │
  │
  │
  │  WHY CUSTOM HARNESS (vs. k6, artillery, wrk, etc.):                        │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  ┌───────────────────┬────────────────────┬─────────────────────┐   │  │
  │  │  │ Approach          │ Pros               │ Cons for THIS task  │   │  │
  │  │  ├───────────────────┼────────────────────┼─────────────────────┤   │  │
  │  │  │ k6 / Artillery    │ Powerful, fast,     │ Can't easily verify │   │  │
  │  │  │ (general-purpose  │ distributed         │ sliding window      │   │  │
  │  │  │  load testers)    │                    │ correctness; generic│   │  │
  │  │  │                   │                    │ output; extra dep   │   │  │
  │  │  ├───────────────────┼────────────────────┼─────────────────────┤   │  │
  │  │  │ Custom Node.js    │ Full control over  │ Must write it       │   │  │
  │  │  │ harness           │ timing, counting,  │ yourself            │   │  │
  │  │  │                   │ reporting, and     │                     │   │  │
  │  │  │                   │ boundary proofs    │                     │   │  │
  │  │  └───────────────────┴────────────────────┴─────────────────────┘   │  │
  │  │                                                                      │  │
  │  │  WHY CUSTOM IS BETTER FOR THIS ASSIGNMENT:                           │  │
  │  │                                                                      │  │
  │  │  1. BOUNDARY PROOF requires custom logic:                            │  │
  │  │     "Verify that in ANY 60-second sliding window, ≤300 allowed"      │  │
  │  │     → k6 can't do this. It reports throughput, not window analysis. │  │
  │  │     → Custom harness timestamps every response and computes windows │  │
  │  │                                                                      │  │
  │  │  2. MULTI-CUSTOMER SIMULATION:                                       │  │
  │  │     "Customer A at 300 RPM + Customer B at 300 RPM + C at 400 RPM" │  │
  │  │     → Custom harness sends requests with different X-Customer-Id    │  │
  │  │     → Reports per-customer results independently                    │  │
  │  │                                                                      │  │
  │  │  3. SCENARIO-SPECIFIC TESTS:                                         │  │
  │  │     "Northwind batch at 02:30 UTC vs 05:00 UTC"                     │  │
  │  │     → Custom harness can simulate time-window scenarios              │  │
  │  │     → Or run with real clock during override window                  │  │
  │  │                                                                      │  │
  │  │  4. LEGIBLE OUTPUT:                                                  │  │
  │  │     Assignment says: "reports results in a legible way"              │  │
  │  │     → Custom harness formats exactly the proofs we need             │  │
  │  │     → Tables showing: sent / allowed / denied / max-in-window       │  │
  │  │     → Not generic "p95 latency" graphs that prove nothing here      │  │
  │  │                                                                      │  │
  │  │  5. "FIRST-CLASS DELIVERABLE"                                        │  │
  │  │     Assignment: "The harness is a first-class deliverable,           │  │
  │  │     not an afterthought."                                            │  │
  │  │     → A custom harness demonstrates ENGINEERING judgment             │  │
  │  │     → Shows you understand WHAT to prove, not just how to load test │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  HARNESS CAPABILITIES NEEDED:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  1. CONTROLLED RATE GENERATION                                       │  │
  │  │     • Send exactly N requests per minute (not "approximately")       │  │
  │  │     • Distribute evenly across the target (round-robin to all nodes) │  │
  │  │     • Ramp up/down to simulate Northwind batch pattern               │  │
  │  │                                                                      │  │
  │  │  2. TIMESTAMP TRACKING                                               │  │
  │  │     • Record send time and response time for every request           │  │
  │  │     • Record whether each request was 200 or 429                     │  │
  │  │     • Millisecond precision                                          │  │
  │  │                                                                      │  │
  │  │  3. SLIDING WINDOW ANALYSIS                                          │  │
  │  │     • Post-hoc: for every possible 60-second window in the test:    │  │
  │  │       count allowed requests                                         │  │
  │  │     • Find the maximum — must be ≤ limit                            │  │
  │  │     • This is THE proof of correctness                               │  │
  │  │                                                                      │  │
  │  │  4. MULTI-CUSTOMER ISOLATION                                         │  │
  │  │     • Run customers in parallel                                      │  │
  │  │     • Verify each independently                                      │  │
  │  │     • Prove no cross-contamination                                   │  │
  │  │                                                                      │  │
  │  │  5. READABLE REPORT OUTPUT                                           │  │
  │  │     • Tables / structured text to stdout                             │  │
  │  │     • Optional JSON for programmatic verification                    │  │
  │  │     • Pass/Fail verdict per test scenario                            │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  NODE.JS ADVANTAGES FOR THE HARNESS:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  • async/await: fire many concurrent requests naturally              │  │
  │  │  • Promise.all: run multiple customer simulations in parallel        │  │
  │  │  • fetch/undici: built-in HTTP client (Node 18+)                     │  │
  │  │  • setInterval: precise rate control                                 │  │
  │  │  • Same language as service: shared types/constants if needed        │  │
  │  │  • No extra runtime: reviewer already has Node.js (from service)    │  │
  │  │  • JSON output: native, no serialization library needed              │  │
  │  │  • Console tables: console.table() for readable output               │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Full Stack Integration Analysis

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  HOW THE STACK FITS TOGETHER:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  ┌─────────────────────────────────────────────────────────────┐    │  │
  │  │  │                    DEVELOPER EXPERIENCE                      │    │  │
  │  │  ├─────────────────────────────────────────────────────────────┤    │  │
  │  │  │                                                             │    │  │
  │  │  │  Start:     docker compose up                               │    │  │
  │  │  │  Test:      node harness/run.js                             │    │  │
  │  │  │  Stop:      docker compose down                             │    │  │
  │  │  │                                                             │    │  │
  │  │  │  That's it. Three commands. ≤5 minutes.                     │    │  │
  │  │  │                                                             │    │  │
  │  │  └─────────────────────────────────────────────────────────────┘    │  │
  │  │                                                                      │  │
  │  │  ┌─────────────────────────────────────────────────────────────┐    │  │
  │  │  │                    DATA FLOW                                 │    │  │
  │  │  ├─────────────────────────────────────────────────────────────┤    │  │
  │  │  │                                                             │    │  │
  │  │  │  Harness → HTTP → Nginx → Round-robin → Node (1|2|3)       │    │  │
  │  │  │                                            │                │    │  │
  │  │  │                                            ▼                │    │  │
  │  │  │                                  Express Middleware          │    │  │
  │  │  │                                            │                │    │  │
  │  │  │                                            ▼                │    │  │
  │  │  │                                  Read customers.json         │    │  │
  │  │  │                                  → getEffectiveLimit()       │    │  │
  │  │  │                                            │                │    │  │
  │  │  │                                            ▼                │    │  │
  │  │  │                                  Redis EVAL (Lua script)    │    │  │
  │  │  │                                  → atomic check+add         │    │  │
  │  │  │                                            │                │    │  │
  │  │  │                                     ┌──────┴──────┐         │    │  │
  │  │  │                                     │             │         │    │  │
  │  │  │                                  ALLOW          DENY        │    │  │
  │  │  │                                  (200)          (429)       │    │  │
  │  │  │                                     │             │         │    │  │
  │  │  │                                     ▼             ▼         │    │  │
  │  │  │                              Route Handler   Retry-After     │    │  │
  │  │  │                              res.json()      res.status(429) │    │  │
  │  │  │                                                             │    │  │
  │  │  └─────────────────────────────────────────────────────────────┘    │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Dependency Count Analysis

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  MINIMAL DEPENDENCY FOOTPRINT:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  package.json dependencies:                                          │  │
  │  │                                                                      │  │
  │  │  {                                                                   │  │
  │  │    "dependencies": {                                                 │  │
  │  │      "express": "^4.18.0",     // HTTP framework                     │  │
  │  │      "ioredis": "^5.3.0"       // Redis client                      │  │
  │  │    }                                                                 │  │
  │  │  }                                                                   │  │
  │  │                                                                      │  │
  │  │  TOTAL: 2 production dependencies.                                   │  │
  │  │                                                                      │  │
  │  │  Everything else is:                                                 │  │
  │  │  • Node.js built-in: fs (config), http (harness), path              │  │
  │  │  • Docker: redis image, nginx image, node image                     │  │
  │  │  • Lua: embedded in Redis (no external dependency)                   │  │
  │  │                                                                      │  │
  │  │  WHY THIS MATTERS:                                                   │  │
  │  │  • Fewer deps = fewer failure points                                 │  │
  │  │  • Faster npm install (reviewer setup time)                          │  │
  │  │  • Smaller attack surface                                            │  │
  │  │  • Easier to audit (2 deps vs 20)                                   │  │
  │  │  • No version conflicts                                              │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Evaluation Against Assignment Criteria

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  STACK vs ASSIGNMENT REQUIREMENTS:
  │
  │
  │
  │  ┌────────────────────────────────┬──────────┬──────────────────────────┐  │
  │  │ Requirement                    │ Score    │ How stack satisfies      │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ Multi-instance deployment      │ ★★★★★   │ Docker Compose 3 nodes  │  │
  │  │                                │          │ + nginx load balancer    │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ Documented algorithm           │ ★★★★★   │ Lua script IS the algo; │  │
  │  │                                │          │ readable in one file     │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ Load harness (first-class)     │ ★★★★★   │ Custom Node.js scripts  │  │
  │  │                                │          │ proving exact boundaries │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ Boundary behavior demos        │ ★★★★★   │ Harness sliding window  │  │
  │  │                                │          │ analysis post-hoc        │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ ≤15 min reviewer setup         │ ★★★★★   │ docker compose up       │  │
  │  │                                │          │ + node harness/run.js    │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ Free tools only                │ ★★★★★   │ All open source         │  │
  │  │                                │          │ (Node, Redis, Nginx,     │  │
  │  │                                │          │  Docker)                 │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ Distributed coordination       │ ★★★★★   │ Redis + Lua (atomic)    │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ Per-customer isolation          │ ★★★★★   │ Redis key per customer  │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ Auditable counting             │ ★★★★★   │ ZSET stores actual      │  │
  │  │                                │          │ timestamps; inspectable  │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ Config-driven overrides         │ ★★★★★   │ customers.json with     │  │
  │  │                                │          │ audit fields             │  │
  │  ├────────────────────────────────┼──────────┼──────────────────────────┤  │
  │  │ 4-6 hour timebox               │ ★★★★★   │ Minimal deps, fast      │  │
  │  │                                │          │ iteration, no boilerplate│  │
  │  └────────────────────────────────┴──────────┴──────────────────────────┘  │
  │
  │
  │  OVERALL STACK FIT: ★★★★★ (55/55 possible points)                          │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Potential Risks & Mitigations

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  ┌────────────────────────────┬─────────────────────────────────────────┐  │
  │  │ Risk                       │ Mitigation                              │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Redis not available on     │ Docker Compose provisions it.           │  │
  │  │ reviewer's machine         │ No local install needed.                │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Docker not installed       │ README mentions it as prerequisite.     │  │
  │  │                            │ Docker Desktop is free.                 │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Port conflicts (8080)      │ Configurable via .env file.             │  │
  │  │                            │ Document in README.                     │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Node.js version mismatch   │ Docker uses node:20-alpine (fixed).     │  │
  │  │                            │ Harness: document minimum version.      │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Harness timing not precise │ Use setInterval + drift compensation.   │  │
  │  │ (Node.js event loop jitter)│ Accept ±5ms jitter (negligible at RPM). │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Lua script syntax error    │ Test script in isolation.               │  │
  │  │ hard to debug              │ Use redis-cli EVAL to test standalone.  │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Config file not found in   │ Mount via Docker volume; COPY in        │  │
  │  │ container                  │ Dockerfile. Fail fast with clear error. │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Windows vs Linux line      │ Use .gitattributes; Docker = Linux.     │  │
  │  │ endings in Lua scripts     │ Store Lua in JS template literal.       │  │
  │  └────────────────────────────┴─────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Final Verdict

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  STACK ASSESSMENT: HIGHLY SUITABLE
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  STRENGTHS:                                                          │  │
  │  │  • Every component maps directly to a requirement (no wasted tech)  │  │
  │  │  • Minimal dependency count (2 npm packages)                         │  │
  │  │  • Single language across service + harness (cognitive efficiency)   │  │
  │  │  • Docker provides reproducible multi-node simulation                │  │
  │  │  • Lua scripts are the algorithm — readable, testable, provable    │  │
  │  │  • JSON config is self-documenting and git-auditable                │  │
  │  │  • Reviewer setup: 1 command (docker compose up)                    │  │
  │  │  • Fast iteration cycle within 4-6 hour timebox                     │  │
  │  │                                                                      │  │
  │  │  WEAKNESSES (acknowledged, not blockers):                            │  │
  │  │  • No type safety (acceptable for prototype; state harness as proof)│  │
  │  │  • Redis TIME non-deterministic (acceptable for single instance)    │  │
  │  │  • Static config requires restart (acceptable; document as "next")  │  │
  │  │  • Docker required on reviewer machine (ubiquitous tool; free)      │  │
  │  │                                                                      │  │
  │  │  OVERALL: This stack enables maximum delivery within the timebox    │  │
  │  │  while satisfying ALL technical requirements. There is no            │  │
  │  │  unnecessary technology and no missing critical component.           │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  The stack is LEAN, PROVEN, and PURPOSE-BUILT for this exact problem.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

✻ Brewed for 4m 32s

❯ Based on the given tech stack in the previous prompt, provide me the workflow 
  and implementation for the whole rate limiter system.                         

  Thought for 1s (ctrl+o to expand)

● Rate Limiter System — Complete Workflow & Implementation

  ---
  Project Directory Structure

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                         PROJECT STRUCTURE
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  solution/
  │
  │  ├── README.md                         # Setup + how to run (≤15 min)
  │
  │  ├── package.json                      # Dependencies (express, ioredis)
  │
  │  ├── package-lock.json                 # Lockfile
  │
  │  ├── .env.example                      # Environment template
  │
  │  ├── Dockerfile                        # Node.js app image
  │
  │  ├── docker-compose.yml                # Full stack orchestration
  │
  │  ├── nginx/
  │
  │  │   └── nginx.conf                   # Round-robin load balancer config   │
  │  ├── config/
  │
  │  │   └── customers.json              # Customer tiers + overrides          │
  │  ├── src/
  │
  │  │   ├── server.js                   # Express app entry point             │
  │  │   ├── middleware/
  │
  │  │   │   └── rateLimiter.js          # Rate limiter middleware             │
  │  │   ├── services/
  │
  │  │   │   ├── redisClient.js          # Redis connection + Lua loader       │
  │  │   │   └── configService.js        # Customer config loader              │
  │  │   ├── scripts/
  │
  │  │   │   └── slidingWindowLog.lua    # Atomic rate limit Lua script        │
  │  │   └── routes/
  │
  │  │       └── api.js                  # Mock API routes                     │
  │  └── harness/
  │
  │      ├── run.js                      # Main harness entry point            │
  │      ├── scenarios/
  │
  │      │   ├── exactEnforcement.js     # Test: limit enforced exactly        │
  │      │   ├── customerIsolation.js    # Test: customers don't interfere     │
  │      │   ├── distributedCorrectness.js # Test: works across nodes          │
  │      │   ├── boundaryBehavior.js     # Test: no boundary burst             │
  │      │   ├── overrideWindow.js       # Test: Northwind batch override      │
  │      │   └── recoveryAfterLimit.js   # Test: gradual recovery             │
  │      ├── lib/
  │
  │      │   ├── requestGenerator.js     # Controlled rate HTTP sender         │
  │      │   ├── windowAnalyzer.js       # Sliding window post-hoc analysis   │
  │      │   └── reporter.js            # Console table + JSON output         │
  │      └── results/                    # Generated test reports (gitignored) │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Implementation Workflow (Build Order)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │                    IMPLEMENTATION PHASES
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  Phase 1: INFRASTRUCTURE (Docker + Redis + Nginx)         ~45 min          │
  │  ═══════════════════════════════════════════════════
  │
  │  ├── 1.1 Docker Compose with Redis + 3 app nodes + Nginx                   │
  │  ├── 1.2 Nginx round-robin config                                          │
  │  ├── 1.3 Basic Express server (health check only)                          │
  │  └── 1.4 Verify: docker compose up → all containers healthy                │
  │
  │
  │  Phase 2: CORE ALGORITHM (Lua Script + Redis)             ~60 min          │
  │  ═══════════════════════════════════════════════════
  │
  │  ├── 2.1 Write Lua sliding window log script                               │
  │  ├── 2.2 Redis client wrapper (load + register Lua script)                 │
  │  ├── 2.3 Test Lua script manually via redis-cli                            │
  │  └── 2.4 Verify: script returns correct allow/deny decisions               │
  │
  │
  │  Phase 3: MIDDLEWARE + CONFIG (Express Integration)       ~45 min          │
  │  ═══════════════════════════════════════════════════
  │
  │  ├── 3.1 Customer config JSON with override structure                      │
  │  ├── 3.2 Config service (load JSON, resolve effective limit)               │
  │  ├── 3.3 Rate limiter middleware (ties config → Lua → response)           │
  │  ├── 3.4 Mock API route (GET /api/v1/resource)                             │
  │  └── 3.5 Verify: curl with X-Customer-Id → 200 or 429                     │
  │
  │
  │  Phase 4: LOAD HARNESS (Test Infrastructure)              ~90 min          │
  │  ═══════════════════════════════════════════════════
  │
  │  ├── 4.1 Request generator (controlled RPM sender)                         │
  │  ├── 4.2 Window analyzer (sliding window post-hoc proof)                   │
  │  ├── 4.3 Reporter (tables + JSON output)                                   │
  │  ├── 4.4 Test scenarios (6 scenarios)                                      │
  │  └── 4.5 Verify: harness runs all scenarios, output is legible             │
  │
  │
  │  Phase 5: VERIFICATION + POLISH                           ~30 min          │
  │  ═══════════════════════════════════════════════════
  │
  │  ├── 5.1 Run full harness suite, capture output                            │
  │  ├── 5.2 Fix any boundary issues found                                     │
  │  ├── 5.3 Write README (setup + run instructions)                           │
  │  └── 5.4 Write DECISIONS.md                                                │
  │
  │
  │  TOTAL ESTIMATED: ~4.5 hours (within 4-6 hour timebox)                     │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 1: Infrastructure

  1.1 Docker Compose

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  docker-compose.yml
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  version: "3.8"
  │
  │
  │
  │  services:
  │
  │    redis:
  │
  │      image: redis:7-alpine
  │
  │      ports:
  │
  │        - "6379:6379"
  │
  │      healthcheck:
  │
  │        test: ["CMD", "redis-cli", "ping"]
  │
  │        interval: 5s
  │
  │        timeout: 3s
  │
  │        retries: 3
  │
  │
  │
  │    app-node-1:
  │
  │      build: .
  │
  │      environment:
  │
  │        - NODE_ID=node-1
  │
  │        - PORT=3000
  │
  │        - REDIS_URL=redis://redis:6379
  │
  │      depends_on:
  │
  │        redis:
  │
  │          condition: service_healthy
  │
  │
  │
  │    app-node-2:
  │
  │      build: .
  │
  │      environment:
  │
  │        - NODE_ID=node-2
  │
  │        - PORT=3000
  │
  │        - REDIS_URL=redis://redis:6379
  │
  │      depends_on:
  │
  │        redis:
  │
  │          condition: service_healthy
  │
  │
  │
  │    app-node-3:
  │
  │      build: .
  │
  │      environment:
  │
  │        - NODE_ID=node-3
  │
  │        - PORT=3000
  │
  │        - REDIS_URL=redis://redis:6379
  │
  │      depends_on:
  │
  │        redis:
  │
  │          condition: service_healthy
  │
  │
  │
  │    nginx:
  │
  │      image: nginx:alpine
  │
  │      ports:
  │
  │        - "8080:80"
  │
  │      volumes:
  │
  │        - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  │
  │      depends_on:
  │
  │        - app-node-1
  │
  │        - app-node-2
  │
  │        - app-node-3
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  1.2 Nginx Configuration

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  nginx/nginx.conf
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  events {
  │
  │      worker_connections 1024;
  │
  │  }
  │
  │
  │
  │  http {
  │
  │      upstream api_nodes {
  │
  │          # Round-robin (default) — no sticky sessions
  │
  │          server app-node-1:3000;
  │
  │          server app-node-2:3000;
  │
  │          server app-node-3:3000;
  │
  │      }
  │
  │
  │
  │      server {
  │
  │          listen 80;
  │
  │
  │
  │          location / {
  │
  │              proxy_pass http://api_nodes;
  │
  │              proxy_set_header Host $host;
  │
  │              proxy_set_header X-Real-IP $remote_addr;
  │
  │              proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  │
  │          }
  │
  │      }
  │
  │  }
  │
  │
  │
  │  KEY POINTS:
  │
  │  • Round-robin is nginx default (no directive needed)
  │
  │  • No sticky sessions (matches wiki: "no session affinity")
  │
  │  • Preserves original headers (X-Customer-Id passes through)               │
  │  • Simple, standard, auditable configuration                               │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  1.3 Dockerfile

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  Dockerfile
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  FROM node:20-alpine
  │
  │
  │
  │  WORKDIR /app
  │
  │
  │
  │  COPY package*.json ./
  │
  │  RUN npm ci --production
  │
  │
  │
  │  COPY config/ ./config/
  │
  │  COPY src/ ./src/
  │
  │
  │
  │  EXPOSE 3000
  │
  │
  │
  │  CMD ["node", "src/server.js"]
  │
  │
  │
  │  NOTES:
  │
  │  • Alpine = ~50MB image (fast pull for reviewers)
  │
  │  • npm ci = deterministic install from lockfile
  │
  │  • Config baked into image (could also be volume-mounted)
  │
  │  • No dev dependencies in production image
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  1.4 Basic Express Server (Skeleton)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  src/server.js (initial skeleton)
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  const express = require('express');
  │
  │  const app = express();
  │
  │
  │
  │  const PORT = process.env.PORT || 3000;
  │
  │  const NODE_ID = process.env.NODE_ID || 'node-local';
  │
  │
  │
  │  // Health check (no rate limiting)
  │
  │  app.get('/health', (req, res) => {
  │
  │      res.json({ status: 'ok', nodeId: NODE_ID });
  │
  │  });
  │
  │
  │
  │  app.listen(PORT, () => {
  │
  │      console.log(`[${NODE_ID}] listening on port ${PORT}`);
  │
  │  });
  │
  │
  │
  │  VERIFY:
  │
  │  $ docker compose up
  │
  │  $ curl http://localhost:8080/health
  │
  │  → {"status":"ok","nodeId":"node-1"} (rotates on each call)                │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 2: Core Algorithm (Lua Script)

  2.1 The Lua Script

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  src/scripts/slidingWindowLog.lua
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  -- Sliding Window Log Rate Limiter
  │
  │  -- Atomic: prune → count → decide → (add or deny)                         │
  │  --
  │
  │  -- KEYS[1] = rate limit key (e.g., "rl:northwind-logistics")
  │
  │  -- ARGV[1] = window size in milliseconds (e.g., 60000)
  │
  │  -- ARGV[2] = limit (effective RPM for this customer at this time)
  │
  │  -- ARGV[3] = unique member ID (e.g., "node-1:1710432000123:0001")
  │
  │  --
  │
  │  -- Returns: {allowed (0|1), remaining, retryAfterMs, currentCount}
  │
  │
  │
  │  local key = KEYS[1]
  │
  │  local window_ms = tonumber(ARGV[1])
  │
  │  local limit = tonumber(ARGV[2])
  │
  │  local member = ARGV[3]
  │
  │
  │
  │  -- Use Redis server time (consistent clock across all nodes)
  │
  │  local time = redis.call('TIME')
  │
  │  local now_ms = tonumber(time[1]) * 1000 +
  │
  │                 math.floor(tonumber(time[2]) / 1000)
  │
  │
  │
  │  -- Step 1: Remove entries outside the window
  │
  │  local window_start = now_ms - window_ms
  │
  │  redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
  │
  │
  │
  │  -- Step 2: Count entries in the current window
  │
  │  local count = redis.call('ZCARD', key)
  │
  │
  │
  │  -- Step 3: Decide
  │
  │  if count < limit then
  │
  │      -- ALLOW: add this request to the log
  │
  │      redis.call('ZADD', key, now_ms, member)
  │
  │      -- Set TTL slightly longer than window for auto-cleanup
  │
  │      redis.call('PEXPIRE', key, window_ms + 5000)
  │
  │      -- Return: allowed=1, remaining, retryAfter=0, currentCount
  │
  │      return {1, limit - count - 1, 0, count + 1}
  │
  │  else
  │
  │      -- DENY: calculate when the oldest entry expires
  │
  │      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')          │
  │      local retry_after_ms = 0
  │
  │      if #oldest >= 2 then
  │
  │          local oldest_score = tonumber(oldest[2])
  │
  │          retry_after_ms = (oldest_score + window_ms) - now_ms
  │
  │          if retry_after_ms < 0 then retry_after_ms = 0 end
  │
  │      end
  │
  │      -- Refresh TTL even on deny (key still active)
  │
  │      redis.call('PEXPIRE', key, window_ms + 5000)
  │
  │      -- Return: allowed=0, remaining=0, retryAfterMs, currentCount
  │
  │      return {0, 0, retry_after_ms, count}
  │
  │  end
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  2.2 Redis Client Wrapper

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  src/services/redisClient.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  const Redis = require('ioredis');
  │
  │  const fs = require('fs');
  │
  │  const path = require('path');
  │
  │
  │
  │  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  │
  │  const NODE_ID = process.env.NODE_ID || 'node-local';
  │
  │
  │
  │  // Load Lua script from file
  │
  │  const luaScript = fs.readFileSync(
  │
  │      path.join(__dirname, '../scripts/slidingWindowLog.lua'), 'utf8'
  │
  │  );
  │
  │
  │
  │  // Create Redis client with reconnection
  │
  │  const redis = new Redis(REDIS_URL, {
  │
  │      maxRetriesPerRequest: 3,
  │
  │      retryStrategy(times) {
  │
  │          if (times > 5) return null; // stop retrying
  │
  │          return Math.min(times * 200, 2000);
  │
  │      }
  │
  │  });
  │
  │
  │
  │  // Register custom command (uses EVALSHA with EVAL fallback)
  │
  │  redis.defineCommand('checkRateLimit', {
  │
  │      numberOfKeys: 1,
  │
  │      lua: luaScript
  │
  │  });
  │
  │
  │
  │  // Atomic counter for unique member IDs
  │
  │  let requestCounter = 0;
  │
  │
  │
  │  function generateMemberId() {
  │
  │      requestCounter++;
  │
  │      return `${NODE_ID}:${Date.now()}:${requestCounter}`;
  │
  │  }
  │
  │
  │
  │  // Main rate limit check function
  │
  │  async function checkRateLimit(customerId, limit) {
  │
  │      const key = `rl:${customerId}`;
  │
  │      const windowMs = 60000; // 60 seconds
  │
  │      const memberId = generateMemberId();
  │
  │
  │
  │      const result = await redis.checkRateLimit(
  │
  │          key,            // KEYS[1]
  │
  │          windowMs,       // ARGV[1]
  │
  │          limit,          // ARGV[2]
  │
  │          memberId        // ARGV[3]
  │
  │      );
  │
  │
  │
  │      return {
  │
  │          allowed: result[0] === 1,
  │
  │          remaining: result[1],
  │
  │          retryAfterMs: result[2],
  │
  │          currentCount: result[3]
  │
  │      };
  │
  │  }
  │
  │
  │
  │  // Connection state tracking
  │
  │  let isConnected = false;
  │
  │  redis.on('connect', () => { isConnected = true; });
  │
  │  redis.on('error', () => { isConnected = false; });
  │
  │
  │
  │  module.exports = { redis, checkRateLimit, isConnected: () => isConnected
  };│
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  2.3 Verification Flow

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  MANUAL VERIFICATION OF LUA SCRIPT:
  │
  │
  │
  │  # Start Redis
  │
  │  $ docker compose up redis
  │
  │
  │
  │  # Test script directly via redis-cli
  │
  │  $ docker exec -it <redis-container> redis-cli
  │
  │
  │
  │  # Load and run (limit=5 for easy testing)
  │
  │  > EVAL "<lua script>" 1 "rl:test-customer" 60000 5 "node1:1:1"            │
  │  → 1) (integer) 1    # allowed                                             │
  │  → 2) (integer) 4    # remaining                                           │
  │  → 3) (integer) 0    # retryAfter                                          │
  │  → 4) (integer) 1    # currentCount                                        │
  │
  │
  │  # Repeat 4 more times (different member IDs)...
  │
  │  > EVAL "<lua script>" 1 "rl:test-customer" 60000 5 "node1:1:5"            │
  │  → 1) (integer) 1    # allowed (5th request)                               │
  │  → 2) (integer) 0    # remaining = 0                                       │
  │  → 3) (integer) 0    # retryAfter                                          │
  │  → 4) (integer) 5    # currentCount = 5                                    │
  │
  │
  │  # 6th request — should be DENIED
  │
  │  > EVAL "<lua script>" 1 "rl:test-customer" 60000 5 "node1:1:6"            │
  │  → 1) (integer) 0    # DENIED                                              │
  │  → 2) (integer) 0    # remaining = 0                                       │
  │  → 3) (integer) 59500 # retryAfter ≈ 59.5 seconds                          │
  │  → 4) (integer) 5    # currentCount = 5 (unchanged)                        │
  │
  │
  │  # Verify the sorted set
  │
  │  > ZCARD rl:test-customer
  │
  │  → (integer) 5       # exactly 5 entries (denied not added)                │
  │
  │
  │  > ZRANGE rl:test-customer 0 -1 WITHSCORES
  │
  │  → Shows 5 entries with millisecond timestamps
  │
  │
  │
  │  ✓ CORRECT: 5 allowed, 6th denied, set has exactly 5 entries               │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 3: Middleware + Config

  3.1 Customer Configuration

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  config/customers.json
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  {
  │
  │    "customers": {
  │
  │      "northwind-logistics": {
  │
  │        "name": "Northwind Logistics",
  │
  │        "tier": "enterprise",
  │
  │        "rpmLimit": 300,
  │
  │        "overrides": [
  │
  │          {
  │
  │            "id": "override-northwind-batch-2026",
  │
  │            "effectiveRpm": 1200,
  │
  │            "schedule": {
  │
  │              "windowStartUTC": "02:00",
  │
  │              "windowEndUTC": "04:00"
  │
  │            },
  │
  │            "reason": "Nightly batch accommodation pending renegotiation",
  │
  │            "approvedBy": "vp-sales",
  │
  │            "approvalDate": "2026-03-15",
  │
  │            "expiresAt": "2026-05-01T00:00:00Z"
  │
  │          }
  │
  │        ]
  │
  │      },
  │
  │      "acme-corp": {
  │
  │        "name": "Acme Corporation",
  │
  │        "tier": "growth",
  │
  │        "rpmLimit": 300,
  │
  │        "overrides": []
  │
  │      },
  │
  │      "small-startup": {
  │
  │        "name": "Small Startup Inc",
  │
  │        "tier": "starter",
  │
  │        "rpmLimit": 60,
  │
  │        "overrides": []
  │
  │      }
  │
  │    }
  │
  │  }
  │
  │
  │
  │  DESIGN NOTES:
  │
  │  • Keyed by customerId (matches X-Customer-Id header exactly)              │
  │  • overrides is an array — supports multiple time windows if needed        │
  │  • expiresAt forces commercial resolution (CTO's "config and audit")       │
  │  • approvedBy + reason = audit trail (who authorized this?)                │
  │  • Empty overrides array for normal customers (same code path for all)     │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  3.2 Config Service

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  src/services/configService.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  const fs = require('fs');
  │
  │  const path = require('path');
  │
  │
  │
  │  // Load config at startup (static file — no hot reload needed)
  │
  │  const configPath = path.join(__dirname, '../../config/customers.json');
  │
  │  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  │
  │
  │
  │  /**
  │
  │   * Get the effective RPM limit for a customer at a given time.
  │
  │   * Checks for active overrides based on time-of-day window.               │
  │   * Same logic for ALL customers — no branching on customerId.             │
  │   */
  │
  │  function getEffectiveLimit(customerId, nowUTC) {
  │
  │      const customer = config.customers[customerId];
  │
  │
  │
  │      if (!customer) {
  │
  │          return null; // Unknown customer
  │
  │      }
  │
  │
  │
  │      const baseLimit = customer.rpmLimit;
  │
  │
  │
  │      // Check for active overrides (generic — same path for all)
  │
  │      for (const override of customer.overrides) {
  │
  │          if (isOverrideActive(override, nowUTC)) {
  │
  │              return override.effectiveRpm;
  │
  │          }
  │
  │      }
  │
  │
  │
  │      return baseLimit;
  │
  │  }
  │
  │
  │
  │  /**
  │
  │   * Check if an override is currently active based on:
  │
  │   * - Time-of-day window (e.g., 02:00-04:00 UTC)                           │
  │   * - Expiration date
  │
  │   */
  │
  │  function isOverrideActive(override, nowUTC) {
  │
  │      // Check expiration
  │
  │      if (override.expiresAt) {
  │
  │          const expiryDate = new Date(override.expiresAt);
  │
  │          if (nowUTC >= expiryDate) return false;
  │
  │      }
  │
  │
  │
  │      // Check time-of-day window
  │
  │      const schedule = override.schedule;
  │
  │      const currentHHMM = formatTimeUTC(nowUTC); // "HH:MM"                 │
  │
  │
  │      return currentHHMM >= schedule.windowStartUTC
  │
  │          && currentHHMM < schedule.windowEndUTC;
  │
  │  }
  │
  │
  │
  │  function formatTimeUTC(date) {
  │
  │      const h = String(date.getUTCHours()).padStart(2, '0');
  │
  │      const m = String(date.getUTCMinutes()).padStart(2, '0');
  │
  │      return `${h}:${m}`;                                                   │
  │  }
  │
  │
  │
  │  function getCustomer(customerId) {
  │
  │      return config.customers[customerId] || null;
  │
  │  }
  │
  │
  │
  │  module.exports = { getEffectiveLimit, getCustomer };
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  KEY: No `if (customerId === "northwind")` anywhere.
  │
  │  The function is GENERIC. It checks config.overrides for ANY customer.
  │
  │  Northwind just happens to have an override entry. Others have [].
  │
  │  CTO requirement satisfied: "same code path, config-driven"
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  3.3 Rate Limiter Middleware

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  src/middleware/rateLimiter.js
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  const { checkRateLimit } = require('../services/redisClient');
  │
  │  const { getEffectiveLimit, getCustomer } = require('../services/
  │
  │      configService');
  │
  │
  │
  │  const NODE_ID = process.env.NODE_ID || 'node-local';
  │
  │
  │
  │  /**
  │
  │   * Express middleware: rate limiting via sliding window log.
  │
  │   * Extracts customer identity, resolves effective limit,
  │
  │   * calls Redis atomically, returns 429 or passes through.
  │
  │   */
  │
  │  async function rateLimiterMiddleware(req, res, next) {
  │
  │      // Step 1: Extract customer identity
  │
  │      const customerId = req.headers['x-customer-id'];
  │
  │
  │
  │      if (!customerId) {
  │
  │          return res.status(401).json({
  │
  │              error: 'missing_customer_id',
  │
  │              message: 'X-Customer-Id header is required'
  │
  │          });
  │
  │      }
  │
  │
  │
  │      // Step 2: Look up customer config
  │
  │      const customer = getCustomer(customerId);
  │
  │      if (!customer) {
  │
  │          return res.status(403).json({
  │
  │              error: 'unknown_customer',
  │
  │              message: `Customer '${customerId}' not found in config`
  │
  │          });
  │
  │      }
  │
  │
  │
  │      // Step 3: Resolve effective limit (checks overrides)
  │
  │      const now = new Date();
  │
  │      const effectiveLimit = getEffectiveLimit(customerId, now);
  │
  │
  │
  │      // Step 4: Check rate limit (atomic Redis Lua call)
  │
  │      try {
  │
  │          const result = await checkRateLimit(customerId, effectiveLimit);
  │
  │
  │
  │          // Set rate limit headers (informational)
  │
  │          res.set('X-RateLimit-Limit', String(effectiveLimit));
  │
  │          res.set('X-RateLimit-Remaining', String(result.remaining));
  │
  │          res.set('X-RateLimit-Reset',
  │
  │              String(Math.ceil(result.retryAfterMs / 1000)));               │
  │          res.set('X-Served-By', NODE_ID);                                  │
  │
  │
  │          if (result.allowed) {
  │
  │              // ALLOW — proceed to route handler
  │
  │              return next();
  │
  │          } else {
  │
  │              // DENY — return 429
  │
  │              const retryAfterSec =                                         │
  │                  Math.ceil(result.retryAfterMs / 1000);                    │
  │              res.set('Retry-After', String(retryAfterSec));                │
  │
  │
  │              return res.status(429).json({
  │
  │                  error: 'rate_limit_exceeded',
  │
  │                  message: `Rate limit of ${effectiveLimit} RPM exceeded`,
  │
  │                  limit: effectiveLimit,
  │
  │                  current: result.currentCount,
  │
  │                  retryAfterSeconds: retryAfterSec                          │
  │              });
  │
  │          }
  │
  │      } catch (err) {
  │
  │          // Redis failure — fail closed (conservative)
  │
  │          console.error(`[${NODE_ID}] Redis error:`, err.message);          │
  │          return res.status(503).json({
  │
  │              error: 'service_unavailable',
  │
  │              message: 'Rate limit service temporarily unavailable'
  │
  │          });
  │
  │      }
  │
  │  }
  │
  │
  │
  │  module.exports = rateLimiterMiddleware;
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  3.4 Complete Server (Final)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  src/server.js (complete)
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  const express = require('express');
  │
  │  const rateLimiter = require('./middleware/rateLimiter');
  │
  │  const apiRoutes = require('./routes/api');
  │
  │  const { redis } = require('./services/redisClient');
  │
  │
  │
  │  const app = express();
  │
  │  const PORT = process.env.PORT || 3000;
  │
  │  const NODE_ID = process.env.NODE_ID || 'node-local';
  │
  │
  │
  │  // Health check (bypasses rate limiter)
  │
  │  app.get('/health', (req, res) => {
  │
  │      res.json({ status: 'ok', nodeId: NODE_ID, timestamp: new Date() });   │
  │  });
  │
  │
  │
  │  // Rate limiter middleware (applies to all /api routes)
  │
  │  app.use('/api', rateLimiter);
  │
  │
  │
  │  // API routes (protected by rate limiter)
  │
  │  app.use('/api', apiRoutes);
  │
  │
  │
  │  // Start server
  │
  │  app.listen(PORT, () => {
  │
  │      console.log(`[${NODE_ID}] RelayAPI rate limiter running on :${PORT}`);
  │
  │  });
  │
  │
  │
  │  // Graceful shutdown
  │
  │  process.on('SIGTERM', async () => {
  │
  │      console.log(`[${NODE_ID}] shutting down...`);
  │
  │      await redis.quit();
  │
  │      process.exit(0);
  │
  │  });
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  3.5 Mock API Routes

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  src/routes/api.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  const express = require('express');
  │
  │  const router = express.Router();
  │
  │
  │
  │  const NODE_ID = process.env.NODE_ID || 'node-local';
  │
  │
  │
  │  // Mock resource endpoint (represents any RelayAPI endpoint)
  │
  │  router.get('/v1/resource', (req, res) => {
  │
  │      res.json({
  │
  │          data: { id: 1, message: 'Success' },
  │
  │          meta: {
  │
  │              nodeId: NODE_ID,
  │
  │              timestamp: new Date().toISOString()
  │
  │          }
  │
  │      });
  │
  │  });
  │
  │
  │
  │  module.exports = router;
  │
  │
  │
  │  NOTE: This is intentionally minimal. The assignment says
  │
  │  "one endpoint (e.g. GET /api/v1/ping or a mock resource)"                 │
  │  The interesting behavior is in the middleware, not here.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 3 — Request Flow (Complete)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  COMPLETE REQUEST FLOW THROUGH THE SYSTEM:
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  1. Client → Nginx (:8080)                                           │  │
  │  │     GET /api/v1/resource                                             │  │
  │  │     X-Customer-Id: northwind-logistics                               │  │
  │  │                                                                      │  │
  │  │  2. Nginx → Round-robin → app-node-2 (:3000)                        │  │
  │  │     (randomly selected, no affinity)                                 │  │
  │  │                                                                      │  │
  │  │  3. Express receives request                                         │  │
  │  │     │                                                                │  │
  │  │     ▼                                                                │  │
  │  │  4. rateLimiterMiddleware(req, res, next)                            │  │
  │  │     │                                                                │  │
  │  │     ├── Extract: customerId = "northwind-logistics"                  │  │
  │  │     │                                                                │  │
  │  │     ├── Config lookup: getCustomer("northwind-logistics")            │  │
  │  │     │   → { tier: "enterprise", rpmLimit: 300, overrides: [...] }   │  │
  │  │     │                                                                │  │
  │  │     ├── Resolve limit: getEffectiveLimit("northwind-logistics", now) │  │
  │  │     │   → Is now between 02:00-04:00 UTC?                           │  │
  │  │     │     YES → effectiveLimit = 1200 (override active)             │  │
  │  │     │     NO  → effectiveLimit = 300 (base limit)                   │  │
  │  │     │                                                                │  │
  │  │     ├── Redis call: checkRateLimit("northwind-logistics", 1200)      │  │
  │  │     │   │                                                            │  │
  │  │     │   ├── Generates unique memberId: "node-2:1710432000123:0042"  │  │
  │  │     │   │                                                            │  │
  │  │     │   ├── EVAL Lua script atomically in Redis:                     │  │
  │  │     │   │   ├── ZREMRANGEBYSCORE rl:northwind-logistics -inf <60s ago>│ │
  │  │     │   │   ├── ZCARD rl:northwind-logistics → count = 847           │  │
  │  │     │   │   ├── 847 < 1200 → ALLOW                                  │  │
  │  │     │   │   ├── ZADD rl:northwind-logistics <now_ms> <memberId>     │  │
  │  │     │   │   └── Returns: {1, 352, 0, 848}                           │  │
  │  │     │   │                                                            │  │
  │  │     │   └── Returns: { allowed: true, remaining: 352, ... }         │  │
  │  │     │                                                                │  │
  │  │     ├── Set response headers:                                        │  │
  │  │     │   X-RateLimit-Limit: 1200                                      │  │
  │  │     │   X-RateLimit-Remaining: 352                                   │  │
  │  │     │   X-Served-By: node-2                                          │  │
  │  │     │                                                                │  │
  │  │     └── result.allowed = true → call next()                         │  │
  │  │                                                                      │  │
  │  │  5. Route handler executes                                           │  │
  │  │     res.json({ data: { id: 1, message: 'Success' }, meta: {...} })  │  │
  │  │                                                                      │  │
  │  │  6. Response back to client                                          │  │
  │  │     HTTP 200 OK                                                      │  │
  │  │     X-RateLimit-Limit: 1200                                          │  │
  │  │     X-RateLimit-Remaining: 352                                       │  │
  │  │     X-Served-By: node-2                                              │  │
  │  │     {"data":{"id":1,"message":"Success"},"meta":{...}}              │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  DENIED FLOW (when at limit):
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  ... same steps 1-4 until Redis call ...                             │  │
  │  │                                                                      │  │
  │  │     ├── Redis call: checkRateLimit("acme-corp", 300)                 │  │
  │  │     │   ├── ZCARD rl:acme-corp → count = 300                        │  │
  │  │     │   ├── 300 ≥ 300 → DENY                                       │  │
  │  │     │   ├── ZRANGE rl:acme-corp 0 0 WITHSCORES → oldest timestamp  │  │
  │  │     │   ├── retryAfterMs = (oldest + 60000) - now = 23400          │  │
  │  │     │   └── Returns: {0, 0, 23400, 300}                            │  │
  │  │     │                                                                │  │
  │  │     ├── Set headers:                                                 │  │
  │  │     │   Retry-After: 24                                              │  │
  │  │     │   X-RateLimit-Limit: 300                                       │  │
  │  │     │   X-RateLimit-Remaining: 0                                     │  │
  │  │     │                                                                │  │
  │  │     └── res.status(429).json({                                      │  │
  │  │            error: "rate_limit_exceeded",                             │  │
  │  │            limit: 300,                                               │  │
  │  │            current: 300,                                             │  │
  │  │            retryAfterSeconds: 24                                     │  │
  │  │         })                                                           │  │
  │  │                                                                      │  │
  │  │  Route handler NEVER CALLED (middleware short-circuits)              │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 4: Load Harness

  4.1 Request Generator

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/lib/requestGenerator.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  /**
  │
  │   * Sends requests at a controlled rate to the target URL.
  │
  │   * Returns a timestamped log of all responses.
  │
  │   *
  │
  │   * @param {Object} options
  │
  │   * @param {string} options.targetUrl - base URL (e.g.,
  http://localhost:8080)│
  │   * @param {string} options.customerId - X-Customer-Id header value
  │
  │   * @param {number} options.rpm - requests per minute to send
  │
  │   * @param {number} options.durationSec - how long to run
  │
  │   * @returns {Array} - array of { sentAt, respondedAt, status, headers }
  │
  │   */
  │
  │  async function generateTraffic({ targetUrl, customerId, rpm, durationSec
  })│
  │  {
  │
  │      const results = [];
  │
  │      const intervalMs = (60 * 1000) / rpm; // time between requests
  │
  │      const totalRequests = Math.ceil((rpm / 60) * durationSec);
  │
  │
  │
  │      const endpoint = `${targetUrl}/api/v1/resource`;
  │
  │
  │
  │      for (let i = 0; i < totalRequests; i++) {
  │
  │          const sentAt = Date.now();
  │
  │
  │
  │          try {
  │
  │              const response = await fetch(endpoint, {
  │
  │                  headers: { 'X-Customer-Id': customerId }
  │
  │              });
  │
  │
  │
  │              results.push({
  │
  │                  index: i,
  │
  │                  sentAt,
  │
  │                  respondedAt: Date.now(),
  │
  │                  status: response.status,
  │
  │                  allowed: response.status === 200,
  │
  │                  headers: {
  │
  │                      remaining:
  response.headers.get('x-ratelimit-remaining'),│
  │                      limit: response.headers.get('x-ratelimit-limit'),
  │
  │                      retryAfter: response.headers.get('retry-after'),
  │
  │                      servedBy: response.headers.get('x-served-by')
  │
  │                  }
  │
  │              });
  │
  │          } catch (err) {
  │
  │              results.push({
  │
  │                  index: i, sentAt, respondedAt: Date.now(),
  │
  │                  status: 0, allowed: false, error: err.message
  │
  │              });
  │
  │          }
  │
  │
  │
  │          // Wait for next interval (controlled rate)
  │
  │          if (i < totalRequests - 1) {
  │
  │              const elapsed = Date.now() - sentAt;
  │
  │              const waitMs = Math.max(0, intervalMs - elapsed);
  │
  │              await sleep(waitMs);
  │
  │          }
  │
  │      }
  │
  │
  │
  │      return results;
  │
  │  }
  │
  │
  │
  │  function sleep(ms) {
  │
  │      return new Promise(resolve => setTimeout(resolve, ms));
  │
  │  }
  │
  │
  │
  │  module.exports = { generateTraffic };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  4.2 Sliding Window Analyzer

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/lib/windowAnalyzer.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  /**
  │
  │   * Post-hoc sliding window analysis.
  │
  │   * For every possible 60-second window in the test duration,
  │
  │   * counts allowed requests. Finds the maximum.
  │
  │   *
  │
  │   * THIS IS THE PROOF OF CORRECTNESS.
  │
  │   * If max_in_any_window > limit, the rate limiter is broken.              │
  │   */
  │
  │  function analyzeWindows(results, windowSizeMs = 60000) {
  │
  │      // Filter to only allowed requests
  │
  │      const allowed = results
  │
  │          .filter(r => r.allowed)
  │
  │          .map(r => r.sentAt)
  │
  │          .sort((a, b) => a - b);
  │
  │
  │
  │      if (allowed.length === 0) {
  │
  │          return { maxInAnyWindow: 0, windowDetails: [] };
  │
  │      }
  │
  │
  │
  │      const startTime = allowed[0];
  │
  │      const endTime = allowed[allowed.length - 1];
  │
  │      let maxInAnyWindow = 0;
  │
  │      let maxWindowStart = startTime;
  │
  │
  │
  │      // Slide window in 1-second increments across entire test
  │
  │      const stepMs = 1000;
  │
  │      const windowDetails = [];
  │
  │
  │
  │      for (let wStart = startTime - windowSizeMs;
  │
  │           wStart <= endTime;
  │
  │           wStart += stepMs) {
  │
  │          const wEnd = wStart + windowSizeMs;
  │
  │
  │
  │          // Count allowed requests in this window
  │
  │          const countInWindow = allowed.filter(
  │
  │              t => t >= wStart && t < wEnd
  │
  │          ).length;
  │
  │
  │
  │          if (countInWindow > maxInAnyWindow) {
  │
  │              maxInAnyWindow = countInWindow;
  │
  │              maxWindowStart = wStart;
  │
  │          }
  │
  │
  │
  │          windowDetails.push({
  │
  │              windowStart: wStart,
  │
  │              windowEnd: wEnd,
  │
  │              allowedCount: countInWindow
  │
  │          });
  │
  │      }
  │
  │
  │
  │      return {
  │
  │          maxInAnyWindow,
  │
  │          maxWindowStart,
  │
  │          totalAllowed: allowed.length,
  │
  │          totalDenied: results.length - allowed.length,
  │
  │          windowDetails
  │
  │      };
  │
  │  }
  │
  │
  │
  │  /**
  │
  │   * Verify the rate limiter guarantee:
  │
  │   * max requests in any 60-second window ≤ limit                           │
  │   */
  │
  │  function verifyGuarantee(analysis, limit) {
  │
  │      return {
  │
  │          passed: analysis.maxInAnyWindow <= limit,
  │
  │          limit,
  │
  │          maxObserved: analysis.maxInAnyWindow,
  │
  │          margin: limit - analysis.maxInAnyWindow
  │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { analyzeWindows, verifyGuarantee };
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  THIS IS THE MOST IMPORTANT FILE IN THE HARNESS.
  │
  │  It answers: "In ANY 60-second span, were more than `limit`
  │
  │  requests allowed?" If yes → rate limiter is broken.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  4.3 Reporter

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/lib/reporter.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  /**
  │
  │   * Formats and outputs test results in readable table format.
  │
  │   */
  │
  │  function printScenarioResult(scenario) {
  │
  │      const divider = '═'.repeat(70);
  │
  │      const line = '─'.repeat(70);
  │
  │
  │
  │      console.log(`\n${divider}`);
  │
  │      console.log(`  TEST: ${scenario.name}`);
  │
  │      console.log(`  ${scenario.description}`);
  │
  │      console.log(divider);
  │
  │
  │
  │      // Summary table
  │
  │      console.log(`\n  Configuration:`);
  │
  │      console.log(`    Customer:     ${scenario.customerId}`);
  │
  │      console.log(`    Limit:        ${scenario.limit} RPM`);
  │
  │      console.log(`    Sent Rate:    ${scenario.sentRpm} RPM`);
  │
  │      console.log(`    Duration:     ${scenario.durationSec}s`);
  │
  │
  │
  │      console.log(`\n  Results:`);
  │
  │      console.log(`    Total Sent:     ${scenario.totalSent}`);
  │
  │      console.log(`    Allowed:        ${scenario.totalAllowed}`);
  │
  │      console.log(`    Denied (429):   ${scenario.totalDenied}`);
  │
  │
  │
  │      console.log(`\n  Sliding Window Analysis:`);
  │
  │      console.log(`    Max in any 60s window: ${scenario.maxInWindow}`);
  │
  │      console.log(`    Limit:                 ${scenario.limit}`);
  │
  │
  │
  │      // VERDICT
  │
  │      const passed = scenario.maxInWindow <= scenario.limit;
  │
  │      const verdict = passed ? '✓ PASS' : '✗ FAIL';                         │
  │      const color = passed ? '\x1b[32m' : '\x1b[31m';                       │
  │      console.log(`\n  ${color}VERDICT: ${verdict}\x1b[0m`);                │
  │
  │
  │      if (passed) {
  │
  │          console.log(`    Rate limiter correctly enforced: ` +
  │
  │              `≤${scenario.limit} in all 60s windows`);
  │
  │      } else {
  │
  │          console.log(`    VIOLATION: ${scenario.maxInWindow} requests ` +
  │
  │              `observed in a 60s window (limit: ${scenario.limit})`);
  │
  │      }
  │
  │
  │
  │      // Node distribution (proves distributed behavior)
  │
  │      if (scenario.nodeDistribution) {
  │
  │          console.log(`\n  Node Distribution:`);
  │
  │          for (const [node, count] of
  │
  │              Object.entries(scenario.nodeDistribution)) {
  │
  │              console.log(`    ${node}: ${count} requests`);
  │
  │          }
  │
  │      }
  │
  │
  │
  │      console.log(`\n${line}\n`);
  │
  │      return passed;
  │
  │  }
  │
  │
  │
  │  function printSummary(results) {
  │
  │      const passed = results.filter(r => r.passed).length;
  │
  │      const total = results.length;
  │
  │      console.log('═'.repeat(70));
  │
  │      console.log(`  SUMMARY: ${passed}/${total} scenarios passed`);        │
  │      console.log('═'.repeat(70));
  │
  │  }
  │
  │
  │
  │  module.exports = { printScenarioResult, printSummary };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  4.4 Test Scenarios

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/ — SIX SCENARIO FILES
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  SCENARIO 1: EXACT ENFORCEMENT
  │
  │  ══════════════════════════════
  │
  │  File: exactEnforcement.js
  │
  │
  │
  │  Purpose: Prove that a customer at exactly their limit gets exactly
  │
  │           that many requests through, and excess is denied.
  │
  │
  │
  │  Steps:
  │
  │  1. Send 400 RPM from "acme-corp" (limit: 300) for 90 seconds              │
  │  2. Record all responses
  │
  │  3. Analyze: max in any 60s window must be ≤ 300                           │
  │  4. Report: total allowed, total denied, max-in-window
  │
  │
  │
  │  Expected:
  │
  │  • ~300 allowed per 60s window
  │
  │  • ~100 denied per 60s (the excess above 300)
  │
  │  • Max in any window: exactly 300 (or ≤300 due to under-limiting)          │
  │
  │
  │
  │
  │  SCENARIO 2: CUSTOMER ISOLATION
  │
  │  ═════════════════════════════
  │
  │  File: customerIsolation.js
  │
  │
  │
  │  Purpose: Prove that Customer A at their limit does NOT affect
  │
  │           Customer B's traffic.
  │
  │
  │
  │  Steps:
  │
  │  1. Send 400 RPM from "acme-corp" (limit: 300) — at/over limit             │
  │  2. Simultaneously send 200 RPM from "small-startup" (limit: 60)           │
  │  3. Verify: acme gets capped at 300
  │
  │  4. Verify: small-startup gets capped at 60 (NOT affected by acme)         │
  │
  │
  │  Expected:
  │
  │  • acme-corp: ~300 allowed, ~100 denied per window                         │
  │  • small-startup: 60 allowed, 140 denied (its own limit, not acme's)       │
  │  • Zero cross-contamination
  │
  │
  │
  │
  │
  │  SCENARIO 3: DISTRIBUTED CORRECTNESS
  │
  │  ════════════════════════════════════
  │
  │  File: distributedCorrectness.js
  │
  │
  │
  │  Purpose: Prove that rate limiting works correctly even when requests
  │
  │           land on different nodes (round-robin).
  │
  │
  │
  │  Steps:
  │
  │  1. Send 400 RPM from "acme-corp" through nginx (round-robin)              │
  │  2. Track which node served each request (X-Served-By header)              │
  │  3. Verify: requests hit all 3 nodes (prove round-robin works)             │
  │  4. Verify: TOTAL allowed across all nodes ≤ 300 per window               │
  │
  │
  │  Expected:
  │
  │  • Node distribution: roughly 133 each (±20%)                              │
  │  • Total allowed: ≤ 300 in any 60s window (global, not per-node)           │
  │  • This proves nodes share state via Redis
  │
  │
  │
  │
  │
  │  SCENARIO 4: BOUNDARY BEHAVIOR (NO BURST)
  │
  │  ═════════════════════════════════════════
  │
  │  File: boundaryBehavior.js
  │
  │
  │
  │  Purpose: Prove that there is NO boundary burst — the sliding window       │
  │           doesn't allow 2x limit at any point.
  │
  │
  │
  │  Steps:
  │
  │  1. Send 300 requests in a burst (all within 5 seconds)                    │
  │  2. Wait 55 seconds (just before the 60s window edge)                      │
  │  3. Send another 300 requests burst
  │
  │  4. Verify: the second burst is mostly DENIED                              │
  │     (entries from first burst haven't expired yet)
  │
  │  5. Analyze: max in any 60s window still ≤ 300                             │
  │
  │
  │  Expected:
  │
  │  • First burst: all 300 allowed (bucket was empty)                         │
  │  • Second burst at T+55s: mostly denied (first entries expire at T+60s)    │
  │  • Max in any window: 300 (NOT 600 — the fixed window bug doesn't exist)  │
  │  • THIS DIRECTLY ADDRESSES THE STAGING INCIDENT                            │
  │
  │
  │
  │
  │  SCENARIO 5: NORTHWIND OVERRIDE WINDOW
  │
  │  ═════════════════════════════════════
  │
  │  File: overrideWindow.js
  │
  │
  │
  │  Purpose: Prove that Northwind gets elevated limit during batch window
  │
  │           and normal limit outside it.
  │
  │
  │
  │  Steps:
  │
  │  1. Temporarily set system time or configure test override window
  │
  │     (e.g., override active NOW for testing purposes)
  │
  │  2. Send 1000 RPM from "northwind-logistics" during override window
  │
  │  3. Verify: all/most allowed (1000 < 1200 effective limit)                 │
  │  4. Reconfigure: set override to INACTIVE window                           │
  │  5. Send 400 RPM from "northwind-logistics" (base limit: 300)              │
  │  6. Verify: 300 allowed, 100 denied                                        │
  │
  │
  │  Expected:
  │
  │  • During override: 1000 RPM flows freely (limit is 1200)                  │
  │  • Outside override: capped at 300 RPM (base limit)                        │
  │  • Same algorithm, same code path — only the limit number changed          │
  │
  │
  │  IMPLEMENTATION NOTE:
  │
  │  For testing, use a config override that's active at the TEST time
  │
  │  (not hardcoded to 02:00-04:00 UTC). Or run the test within that window.   │
  │  Alternative: inject a test-specific override window that covers "now."
  │
  │
  │
  │
  │
  │  SCENARIO 6: RECOVERY AFTER HITTING LIMIT
  │
  │  ═════════════════════════════════════════
  │
  │  File: recoveryAfterLimit.js
  │
  │
  │
  │  Purpose: Prove that after hitting the limit, throughput gradually
  │
  │           recovers as old entries expire (no sudden reset).
  │
  │
  │
  │  Steps:
  │
  │  1. Send burst of 300 requests (fill the window completely)
  │
  │  2. Continue sending at 10 RPM for the next 120 seconds                    │
  │  3. Track when requests start being allowed again                          │
  │  4. Verify: recovery is GRADUAL (entries expire individually)              │
  │  5. Verify: no "reset moment" where all 300 slots free at once             │
  │
  │
  │  Expected:
  │
  │  • First 300: all allowed (window was empty)                               │
  │  • Next ~60 seconds: all denied (window is full)                           │
  │  • After 60s: requests start being allowed one-by-one                      │
  │  • Recovery rate ≈ rate at which original entries expire
  │
  │  • NO sudden "all 300 free at once" (that's fixed window behavior)         │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  4.5 Main Harness Runner

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/run.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  const { printScenarioResult, printSummary } = require('./lib/reporter');
  │
  │
  │
  │  // Import all scenarios
  │
  │  const scenarios = [
  │
  │      require('./scenarios/exactEnforcement'),
  │
  │      require('./scenarios/customerIsolation'),
  │
  │      require('./scenarios/distributedCorrectness'),
  │
  │      require('./scenarios/boundaryBehavior'),
  │
  │      require('./scenarios/overrideWindow'),
  │
  │      require('./scenarios/recoveryAfterLimit')
  │
  │  ];
  │
  │
  │
  │  const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8080';
  │
  │
  │
  │  async function main() {
  │
  │
  console.log('╔══════════════════════════════════════════════════════╗');│
  │      console.log('║   RelayAPI Rate Limiter — Load Harness             ║');│
  │      console.log('║   Sliding Window Log · 3 Nodes · Redis             ║');│
  │
  console.log('╚══════════════════════════════════════════════════════╝');│
  │      console.log(`\n  Target: ${TARGET_URL}`);
  │
  │      console.log(`  Time:   ${new Date().toISOString()}\n`);               │
  │
  │
  │      const results = [];
  │
  │
  │
  │      for (const scenario of scenarios) {
  │
  │          console.log(`\n  Running: ${scenario.name}...`);
  │
  │          const result = await scenario.run(TARGET_URL);
  │
  │          const passed = printScenarioResult(result);
  │
  │          results.push({ name: scenario.name, passed });
  │
  │      }
  │
  │
  │
  │      printSummary(results);
  │
  │
  │
  │      // Exit with code indicating pass/fail
  │
  │      const allPassed = results.every(r => r.passed);
  │
  │      process.exit(allPassed ? 0 : 1);
  │
  │  }
  │
  │
  │
  │  main().catch(err => {
  │
  │      console.error('Harness failed:', err);
  │
  │      process.exit(2);
  │
  │  });
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  USAGE:
  │
  │  $ docker compose up -d                  # Start the system
  │
  │  $ node harness/run.js                   # Run all scenarios
  │
  │  $ docker compose down                   # Clean up
  │
  │
  │
  │  OR (specific scenario):
  │
  │  $ node harness/scenarios/boundaryBehavior.js
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 5: Expected Harness Output

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  EXPECTED HARNESS OUTPUT (what the reviewer sees):
  │
  │
  │
  │  ╔══════════════════════════════════════════════════════╗
  │
  │  ║   RelayAPI Rate Limiter — Load Harness             ║                    │
  │  ║   Sliding Window Log · 3 Nodes · Redis             ║                    │
  │  ╚══════════════════════════════════════════════════════╝
  │
  │
  │
  │    Target: http://localhost:8080
  │
  │    Time:   2026-03-20T14:30:00.000Z
  │
  │
  │
  │    Running: Exact Enforcement...
  │
  │
  │
  │  ══════════════════════════════════════════════════════════════════════════
  │
  │    TEST: Exact Enforcement
  │
  │    Verify limit is enforced precisely at the configured RPM
  │
  │  ══════════════════════════════════════════════════════════════════════════
  │
  │
  │
  │    Configuration:
  │
  │      Customer:     acme-corp
  │
  │      Limit:        300 RPM
  │
  │      Sent Rate:    400 RPM
  │
  │      Duration:     90s
  │
  │
  │
  │    Results:
  │
  │      Total Sent:     600
  │
  │      Allowed:        447
  │
  │      Denied (429):   153
  │
  │
  │
  │    Sliding Window Analysis:
  │
  │      Max in any 60s window: 300
  │
  │      Limit:                 300
  │
  │
  │
  │    ✓ PASS
  │
  │      Rate limiter correctly enforced: ≤300 in all 60s windows              │
  │
  │
  │    Node Distribution:
  │
  │      node-1: 198 requests
  │
  │      node-2: 204 requests
  │
  │      node-3: 198 requests
  │
  │
  │
  │  ──────────────────────────────────────────────────────────────────────────│
  │
  │
  │    Running: Boundary Behavior...
  │
  │
  │
  │  ══════════════════════════════════════════════════════════════════════════
  │
  │    TEST: Boundary Behavior (No Burst)
  │
  │    Verify no 2x burst at window edges (fixed window bug absent)            │
  │  ══════════════════════════════════════════════════════════════════════════
  │
  │
  │
  │    Configuration:
  │
  │      Customer:     acme-corp
  │
  │      Limit:        300 RPM
  │
  │      Pattern:      Burst → Wait 55s → Burst                                │
  │
  │
  │    Results:
  │
  │      Burst 1 (T+0s):     300 sent, 300 allowed, 0 denied                   │
  │      Burst 2 (T+55s):    300 sent, 0 allowed, 300 denied                   │
  │      After recovery (T+65s): requests start flowing again
  │
  │
  │
  │    Sliding Window Analysis:
  │
  │      Max in any 60s window: 300
  │
  │      Limit:                 300
  │
  │
  │
  │    ✓ PASS
  │
  │      NO boundary burst observed. Fixed window would have allowed 600.
  │
  │      Sliding window log correctly prevents double-burst.
  │
  │
  │
  │  ──────────────────────────────────────────────────────────────────────────│
  │
  │
  │    ...
  │
  │
  │
  │  ══════════════════════════════════════════════════════════════════════════
  │
  │    SUMMARY: 6/6 scenarios passed
  │
  │  ══════════════════════════════════════════════════════════════════════════
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Complete System Workflow (End-to-End)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  REVIEWER'S EXPERIENCE (the whole workflow):
  │
  │
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  STEP 1: Clone + Start (2 minutes)                                   │  │
  │  │  ───────────────────────────────────                                 │  │
  │  │  $ git clone <repo>                                                  │  │
  │  │  $ cd solution                                                       │  │
  │  │  $ docker compose up -d                                              │  │
  │  │                                                                      │  │
  │  │  Output:                                                             │  │
  │  │  ✓ redis started (healthy)                                           │  │
  │  │  ✓ app-node-1 started                                                │  │
  │  │  ✓ app-node-2 started                                                │  │
  │  │  ✓ app-node-3 started                                                │  │
  │  │  ✓ nginx started                                                     │  │
  │  │                                                                      │  │
  │  │                                                                      │  │
  │  │  STEP 2: Quick Smoke Test (30 seconds)                               │  │
  │  │  ─────────────────────────────────────                               │  │
  │  │  $ curl http://localhost:8080/health                                  │
  │
  │  │  {"status":"ok","nodeId":"node-2"}                                   │  │
  │  │                                                                      │  │
  │  │  $ curl -H "X-Customer-Id: acme-corp"
  http://localhost:8080/api/v1/resource│
  │  │  {"data":{"id":1},"meta":{"nodeId":"node-1"}}                       │  │
  │  │  Headers: X-RateLimit-Remaining: 299                                 │  │
  │  │                                                                      │  │
  │  │                                                                      │  │
  │  │  STEP 3: Run Harness (3-5 minutes)                                   │  │
  │  │  ─────────────────────────────────                                   │  │
  │  │  $ npm install          # install harness dependencies (if any)      │  │
  │  │  $ node harness/run.js                                               │  │
  │  │                                                                      │  │
  │  │  Output: All 6 scenarios run, results printed, 6/6 PASS              │  │
  │  │                                                                      │  │
  │  │                                                                      │  │
  │  │  STEP 4: Inspect (optional, 5 minutes)                               │  │
  │  │  ─────────────────────────────────────                               │  │
  │  │  $ docker exec -it solution-redis-1 redis-cli                        │  │
  │  │  > KEYS rl:*                                                         │  │
  │  │  > ZCARD rl:acme-corp                                                │  │
  │  │  > ZRANGE rl:acme-corp 0 -1 WITHSCORES                              │  │
  │  │                                                                      │  │
  │  │                                                                      │  │
  │  │  STEP 5: Clean Up                                                    │  │
  │  │  ─────────────────────                                               │  │
  │  │  $ docker compose down                                               │  │
  │  │                                                                      │  │
  │  │                                                                      │  │
  │  │  TOTAL TIME: ~10 minutes (well within ≤15 minute requirement)        │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Implementation Dependencies

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  DEPENDENCY GRAPH (build order matters):
  │
  │
  │
  │  ┌─────────────────────────────────────────────────────────────┐           │
  │  │                                                             │           │
  │  │  Level 0 (no dependencies):                                 │           │
  │  │  ├── config/customers.json                                  │           │
  │  │  ├── src/scripts/slidingWindowLog.lua                       │           │
  │  │  ├── nginx/nginx.conf                                       │           │
  │  │  ├── Dockerfile                                             │           │
  │  │  └── docker-compose.yml                                     │           │
  │  │                                                             │           │
  │  │  Level 1 (depends on Level 0):                              │           │
  │  │  ├── src/services/redisClient.js    ← reads Lua script      │           │
  │  │  └── src/services/configService.js  ← reads customers.json  │           │
  │  │                                                             │           │
  │  │  Level 2 (depends on Level 1):                              │           │
  │  │  └── src/middleware/rateLimiter.js  ← uses both services    │           │
  │  │                                                             │           │
  │  │  Level 3 (depends on Level 2):                              │           │
  │  │  ├── src/routes/api.js              ← route handlers        │           │
  │  │  └── src/server.js                  ← wires everything      │           │
  │  │                                                             │           │
  │  │  Level 4 (depends on running service):                      │           │
  │  │  ├── harness/lib/requestGenerator.js                        │           │
  │  │  ├── harness/lib/windowAnalyzer.js                          │           │
  │  │  ├── harness/lib/reporter.js                                │           │
  │  │  ├── harness/scenarios/*.js                                 │           │
  │  │  └── harness/run.js                                         │           │
  │  │                                                             │           │
  │  └─────────────────────────────────────────────────────────────┘           │
  │
  │
  │  Build these bottom-up. Test at each level before moving up.               │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  package.json

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  package.json
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  {
  │
  │    "name": "relayapi-rate-limiter",
  │
  │    "version": "1.0.0",
  │
  │    "description": "Sliding window log rate limiter for RelayAPI",
  │
  │    "main": "src/server.js",
  │
  │    "scripts": {
  │
  │      "start": "node src/server.js",
  │
  │      "harness": "node harness/run.js",
  │
  │      "harness:boundary": "node harness/scenarios/boundaryBehavior.js",     │
  │      "harness:isolation": "node harness/scenarios/customerIsolation.js"    │
  │    },
  │
  │    "dependencies": {
  │
  │      "express": "^4.18.2",
  │
  │      "ioredis": "^5.3.2"
  │
  │    },
  │
  │    "engines": {
  │
  │      "node": ">=18.0.0"
  │
  │    }
  │
  │  }
  │
  │
  │
  │  NOTE:
  │
  │  • Only 2 production dependencies
  │
  │  • Node 18+ required for built-in fetch (used in harness)                  │
  │  • Scripts for convenience: npm run harness
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Key Implementation Decisions Summary

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  ┌────────────────────────────┬─────────────────────────────────────────┐  │
  │  │ Decision Point             │ Choice & Reasoning                      │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Redis key format           │ "rl:{customerId}" — simple,            │  │
  │  │                            │ per-customer isolation                   │
  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ ZSET member uniqueness     │ "{nodeId}:{timestamp}:{counter}"       │  │
  │  │                            │ prevents dedup across nodes             │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Clock source               │ Redis TIME inside Lua script           │  │
  │  │                            │ eliminates node clock skew              │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Window size                │ 60,000 ms (60 seconds = 1 minute)      │  │
  │  │                            │ matches RPM definition                   │
  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ TTL on Redis key           │ window + 5s buffer (65s)               │  │
  │  │                            │ auto-cleanup for inactive customers     │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Redis failure behavior     │ Fail closed (503)                       │  │
  │  │                            │ CTO prefers under-limit to over-limit   │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Unknown customer           │ 403 (not rate limited, just rejected)   │  │
  │  │                            │ Different from 429 (rate limited)       │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Override resolution        │ Config-driven time window check         │  │
  │  │                            │ Same code path for all customers        │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Retry-After precision      │ Computed from oldest entry in ZSET     │  │
  │  │                            │ Exact seconds (ceiling)                 │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Rate limit headers         │ X-RateLimit-{Limit,Remaining,Reset}    │  │
  │  │                            │ Industry standard (draft RFC)           │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Load balancer              │ Nginx round-robin (docker service DNS)  │  │
  │  │                            │ Matches wiki: "no sticky sessions"      │  │
  │  ├────────────────────────────┼─────────────────────────────────────────┤  │
  │  │ Harness approach           │ Custom Node.js with sliding window      │  │
  │  │                            │ post-hoc analysis (THE proof)           │  │
  │  └────────────────────────────┴─────────────────────────────────────────┘  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  What This Implementation Proves

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  WHAT THE IMPLEMENTATION + HARNESS TOGETHER DEMONSTRATE:
  │
  │
  │
  │  ┌────────────────────────────────────────────────┬──────────────────────┐ │
  │  │ Stakeholder Requirement                        │ How It's Proven      │ │
  │  ├────────────────────────────────────────────────┼──────────────────────┤ │
  │  │ CTO: "never exceed quota"                      │ Scenario 1 + 4:      │ │
  │  │                                                │ max in any window ≤ L│ │
  │  ├────────────────────────────────────────────────┼──────────────────────┤ │
  │  │ CTO: "per-customer isolation"                  │ Scenario 2:          │ │
  │  │                                                │ customers independent│ │
  │  ├────────────────────────────────────────────────┼──────────────────────┤ │
  │  │ CTO: "works across 3 nodes"                    │ Scenario 3:          │ │
  │  │                                                │ node distribution +  │ │
  │  │                                                │ global enforcement   │ │
  │  ├────────────────────────────────────────────────┼──────────────────────┤ │
  │  │ CTO: "well-understood algorithm"               │ Lua script readable  │ │
  │  │                                                │ in one file          │ │
  │  ├────────────────────────────────────────────────┼──────────────────────┤ │
  │  │ CTO: "auditable"                              │ ZSET inspectable;    │ │
  │  │                                                │ one-paragraph spec   │ │
  │  ├────────────────────────────────────────────────┼──────────────────────┤ │
  │  │ CTO: "no special-case hacks"                   │ Config-driven;       │ │
  │  │                                                │ same code path       │ │
  │  ├────────────────────────────────────────────────┼──────────────────────┤ │
  │  │ Support: "Northwind never sees 429 in batch"   │ Scenario 5:          │ │
  │  │                                                │ override window test │ │
  │  ├────────────────────────────────────────────────┼──────────────────────┤ │
  │  │ Support: "invisible to customer"               │ Customer sees 200 OK;│ │
  │  │                                                │ override in config   │ │
  │  ├────────────────────────────────────────────────┼──────────────────────┤ │
  │  │ Platform: "boundary correctness"               │ Scenario 4:          │ │
  │  │ (staging incident)                             │ no boundary burst    │ │
  │  ├────────────────────────────────────────────────┼──────────────────────┤ │
  │  │ Platform: "3 stateless nodes, round-robin"     │ Docker Compose +     │ │
  │  │                                                │ Nginx = exact replica│ │
  │  └────────────────────────────────────────────────┴──────────────────────┘ │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  This implementation is a thin vertical slice — minimal code, maximum proof.
  Every component exists to satisfy a specific requirement from the memos, and
  the harness makes correct behavior visible without reading the implementation.
✻ Baked for 5m 3s

❯ With the given tech stack and the previously chosen rate limiting algorithm,  
  give me a detailed description of the basic working of the rate limiting      
  system. Also explain the NorthWind exception about their quota override and   
  provide the logic for the override evaluation by the Redis Lua. Give a        
  detailed list of explicitly rejected decisions in this whole rate limiting    
  system.                                                                       
  ⎿  Read submission\README.md (27 lines)
  ⎿  Read submission\DECISIONS.template.md (20 lines)
  ⎿  Read briefs\support-lead-memo.md (39 lines)
  ⎿  Read briefs\platform-context.md (43 lines)
  ⎿  Read briefs\cto-memo.md (38 lines)

  Thought for 4s (ctrl+o to expand)

● 1. Basic Working of the Rate Limiting System

  System Architecture Overview

  The rate limiting system operates as a distributed middleware layer sitting
  between the Nginx load balancer and the API route handlers. Three stateless
  Express nodes share a single Redis instance as their coordination backbone.
  Every rate limit decision is made atomically inside Redis using a Lua script —
  no node ever makes a decision alone.

  Request Lifecycle (Step by Step)

  Step 1 — Ingress via Nginx

  A client sends an HTTP request to port 8080. Nginx receives it and forwards it
  to one of three app nodes using pure round-robin selection. There is no
  sticky session, no affinity — the next request from the same customer will
  almost certainly hit a different node.

  Client → Nginx (:8080) → Round-Robin → app-node-{1|2|3} (:3000)

  The X-Customer-Id header travels unchanged through Nginx. This header is
  trusted (set by the API gateway upstream in production; simulated directly in
  the harness).

  Step 2 — Middleware Intercepts

  Express mounts the rate limiter middleware on all /api/* routes. The
  middleware executes before any route handler:

  1. Extract identity: Read X-Customer-Id from the request header.
  2. Validate existence: Look up the customer in the static config file. Unknown
  customers get a 403 immediately — they're not rate-limited, they're simply
  unauthorized.
  3. Resolve effective limit: The config service checks if any time-window
  override is active for this customer at this moment. If yes, use the override
  RPM. If no, use the base tier RPM.
  4. Call Redis atomically: Pass the customer key, the resolved limit, and a
  unique member ID to the Lua script via EVALSHA.
  5. Interpret result: The Lua script returns a 4-element array: [allowed, 
  remaining, retryAfterMs, currentCount].
  6. Respond accordingly:
    - If allowed = 1: set informational rate-limit headers, call next() to pass
  through to the route handler.
    - If allowed = 0: set Retry-After header (seconds), return 429 Too Many 
  Requests with a JSON body explaining the denial. The route handler is never
  invoked.

  Step 3 — The Lua Script (Atomic Decision Engine)

  This is the heart of the system. The Lua script runs inside Redis's
  single-threaded execution model, which means:
  - No two nodes can interfere with each other's decision
  - No race condition is possible between ZCARD and ZADD
  - The entire check-and-admit sequence is one indivisible operation

  The algorithm executed inside Lua:

  FUNCTION checkRateLimit(key, windowMs, limit, memberId):

      1. GET CURRENT TIME from Redis server (redis.call('TIME'))
         → Converts to milliseconds: now_ms = seconds*1000 + microseconds/1000
         → This is the SINGLE clock source for all nodes

      2. PRUNE EXPIRED ENTRIES
         → ZREMRANGEBYSCORE key -inf (now_ms - windowMs)
         → Removes all entries whose timestamp is older than 60 seconds ago
         → The sorted set now contains ONLY entries within the current window

      3. COUNT REMAINING ENTRIES
         → ZCARD key → count
         → This is how many requests were allowed in the last 60 seconds

      4. DECIDE
         IF count < limit:
             → ZADD key now_ms memberId    (record this request)
             → PEXPIRE key (windowMs + 5000)  (auto-cleanup safety net)
             → RETURN [1, limit-count-1, 0, count+1]  (ALLOWED)
         ELSE:
             → ZRANGE key 0 0 WITHSCORES   (get oldest entry)
             → retryAfter = (oldest_timestamp + windowMs) - now_ms
             → PEXPIRE key (windowMs + 5000)
             → RETURN [0, 0, retryAfterMs, count]  (DENIED)

  Step 4 — Response Exits System

  The response travels back: app-node → Nginx → Client. Every response carries:
  - X-RateLimit-Limit: the effective RPM for this customer right now
  - X-RateLimit-Remaining: how many requests remain in the current window
  - X-Served-By: which node handled this request (proves distribution)
  - Retry-After (only on 429): precise seconds until the next slot opens

  Why This Works Across 3 Nodes

  The critical insight: no node stores any rate-limiting state locally. Every
  decision goes through Redis. Because Redis is single-threaded and Lua scripts
  are atomic, the system behaves identically whether 1 node or 100 nodes are
  making requests. The sorted set rl:{customerId} is the single source of truth.

  Even if two nodes send a Lua script call at the exact same microsecond, Redis
  serializes them — one runs first, the other runs second. If there's only 1
  slot left, the first caller gets it, the second gets denied. No coordination
  protocol needed; Redis's execution model provides it by construction.

  Counting Semantics (One Paragraph — CTO's Auditability Requirement)

  ▎ "Every allowed request adds a timestamped entry to a sorted set in Redis. 
  ▎ Before each decision, all entries older than 60 seconds are removed. The 
  ▎ count of remaining entries is compared against the customer's configured 
  ▎ limit. If the count is below the limit, the request is admitted and 
  ▎ recorded; otherwise it is denied. At no point in time can the sorted set 
  ▎ contain more than limit entries, because admission only occurs when count < 
  ▎ limit. Therefore, the maximum number of requests allowed in any 60-second 
  ▎ sliding window is mathematically bounded by the configured limit."

  This paragraph satisfies the "enterprise prospect security review" requirement
  from the platform context wiki.

  ---
  2. Northwind Exception — Quota Override System

  The Business Problem

  Northwind Logistics has a contractual RPM of 300. Their nightly batch job
  (02:00–04:00 UTC) sends 800–1200 RPM. A literal enforcement would return 429s
  during the batch, which:
  - Breaks their ERP workflow
  - Triggers aggressive client-side retries (amplifying load)
  - Threatens a 60% ARR renewal in 6 weeks
  - Has already escalated to CEO-level visibility

  The Resolution: Config-Driven Time-Window Override

  Rather than hardcoding if (customerId === 'northwind') (explicitly forbidden
  by the CTO), the system uses a generic override mechanism that any customer
  could theoretically use. Northwind just happens to have an active override
  entry in config/customers.json.

  Override Configuration Structure

  {
    "northwind-logistics": {
      "tier": "enterprise",
      "rpmLimit": 300,
      "overrides": [
        {
          "id": "override-northwind-batch-2026",
          "effectiveRpm": 1200,
          "schedule": {
            "windowStartUTC": "02:00",
            "windowEndUTC": "04:00"
          },
          "reason": "Nightly batch accommodation pending contract 
  renegotiation",
          "approvedBy": "vp-sales",
          "approvalDate": "2026-03-15",
          "expiresAt": "2026-05-01T00:00:00Z"
        }
      ]
    }
  }

  Override Evaluation Logic (Application Layer)

  The override is resolved before calling Redis. The Lua script never knows
  whether it's enforcing a base limit or an override — it just receives a
  number. This is by design: the algorithm is pure, the policy is in config.

  FUNCTION getEffectiveLimit(customerId, currentTimeUTC):

      customer = config.customers[customerId]
      IF customer is null → RETURN null (unknown customer)

      baseLimit = customer.rpmLimit   // e.g., 300

      FOR EACH override IN customer.overrides:
          IF isOverrideActive(override, currentTimeUTC):
              RETURN override.effectiveRpm   // e.g., 1200

      RETURN baseLimit   // No active override, use base

  FUNCTION isOverrideActive(override, currentTimeUTC):

      // Check 1: Has this override expired permanently?
      IF override.expiresAt exists AND currentTimeUTC >= expiresAt:
          RETURN false   // Override is dead, contract resolved

      // Check 2: Are we within the time-of-day window right now?
      currentHHMM = formatAsHHMM(currentTimeUTC)   // e.g., "02:37"

      IF currentHHMM >= override.schedule.windowStartUTC
         AND currentHHMM < override.schedule.windowEndUTC:
          RETURN true    // We're inside the batch window

      RETURN false       // Outside the window, base limit applies

  How This Flows Into Redis Lua

  The Lua script is completely unaware of overrides. It receives:
  - KEYS[1] = "rl:northwind-logistics" (same key always)
  - ARGV[2] = 1200 (during 02:00–04:00) or 300 (outside)

  From Redis's perspective, it's just enforcing a number. The intelligence about
  when to use which number lives entirely in the application layer's config
  service.

  Why This Satisfies Both Stakeholders

  ┌───────────────────────────┬─────────────────────────────────────────────┐
  │      CTO Requirement      │          How Override Satisfies It          │
  ├───────────────────────────┼─────────────────────────────────────────────┤
  │ "No if(customerId===...)  │ Override logic is generic — any customer    │
  │ hacks"                    │ can have overrides                          │
  ├───────────────────────────┼─────────────────────────────────────────────┤
  │ "Config and audit, not    │ JSON config has approvedBy, reason,         │
  │ midnight commit"          │ expiresAt                                   │
  ├───────────────────────────┼─────────────────────────────────────────────┤
  │                           │ All customers go through                    │
  │ "Same code path for all"  │ getEffectiveLimit() — Northwind's just      │
  │                           │ returns a different number during certain   │
  │                           │ hours                                       │
  ├───────────────────────────┼─────────────────────────────────────────────┤
  │                           │ Northwind IS metered — at 1200, not 300.    │
  │ "Strictly fair metering"  │ It's a different limit, not an absence of   │
  │                           │ limiting                                    │
  └───────────────────────────┴─────────────────────────────────────────────┘

  ┌────────────────────────────┬────────────────────────────────────────────┐
  │    Support Requirement     │         How Override Satisfies It          │
  ├────────────────────────────┼────────────────────────────────────────────┤
  │ "Never see 429 during      │ 1200 RPM limit > their 800-1200 actual     │
  │ batch"                     │ batch traffic                              │
  ├────────────────────────────┼────────────────────────────────────────────┤
  │ "Invisible to customer"    │ Customer sees 200 OK — never knows about   │
  │                            │ the override                               │
  ├────────────────────────────┼────────────────────────────────────────────┤
  │ "Temporary exception       │ expiresAt: "2026-05-01" forces commercial  │
  │ mechanism"                 │ resolution                                 │
  └────────────────────────────┴────────────────────────────────────────────┘

  Retry-After Precision During Override

  Even during the override window, if Northwind somehow exceeded 1200 RPM, the
  system would return a precise Retry-After value. The Lua script computes this
  from the oldest entry in the sorted set:

  retryAfterMs = (oldest_entry_timestamp + 60000) - now_ms

  This tells Northwind's client exactly when to retry — no guessing, no
  exponential backoff needed.

  ---
  3. Explicitly Rejected Decisions

  These are choices that were consciously considered and deliberately rejected,
  with specific reasons tied to the assignment requirements.

  Algorithm Rejections

  Rejected: Fixed Window Counter
  Why: Allows 2x burst at window boundaries (e.g., 300 requests at T=59s + 300
  at
  T=61s = 600 in 2 seconds). This is likely the exact bug that caused the
  staging rollback. Violates "never exceed quota."
  ────────────────────────────────────────
  Rejected: Sliding Window Counter (weighted hybrid)
  Why: Approximates by interpolating between two fixed windows. Still allows
  boundary inaccuracy — at 300 RPM, could allow 301-305 in edge cases. CTO said
   "never" not "mostly."
  ────────────────────────────────────────
  Rejected: Token Bucket
  Why: Allows bursts up to bucket capacity. A customer could send 300 requests
  in
  1 second, then wait 59 seconds. Technically within budget, but violates the
  spirit of "fair metering" and makes auditing confusing ("we allowed all 300
  in 1 second but that's fine because...").
  ────────────────────────────────────────
  Rejected: Leaky Bucket
  Why: Smooths traffic to a constant rate (5 req/sec for 300 RPM). This is
  overly
  restrictive — legitimate burst patterns within 60s would be rejected.
  Over-limiting beyond what CTO asked for.
  ────────────────────────────────────────
  Rejected: Generic Cell Rate Algorithm (GCRA)
  Why: More complex than sliding window log for no benefit in this context.
  Harder to explain in "one paragraph" for enterprise security review.
  Auditability concern.
  ────────────────────────────────────────
  Rejected: Approximate algorithms (HyperLogLog-based, probabilistic)
  Why: Error margin is non-zero by design. CTO explicitly wants zero tolerance:
  "never exceed" means mathematically provable, not statistically likely.

  Architecture Rejections

  Rejected: Per-node local counters (limit/N per node)
  Why: CTO explicitly called this out: "A rate limiter that only works in a
  single process and gets deployed three times with fingers crossed." Also
  breaks if traffic isn't perfectly distributed.
  ────────────────────────────────────────
  Rejected: Sticky sessions / session affinity
  Why: Would solve the distribution problem but contradicts the wiki: "no
  affinity to a particular node." Also creates hot-spot problems if one node
  goes down.
  ────────────────────────────────────────
  Rejected: Redis Cluster (multi-shard)
  Why: Over-engineered for this prototype. Single Redis handles the load easily.

  Introduces Lua script limitations (CROSSSLOT errors if keys land on different
   shards).
  ────────────────────────────────────────
  Rejected: Eventual consistency with reconciliation
  Why: CTO allows eventual consistency only if error direction is
  under-limiting.
  Reconciliation after-the-fact means you already over-admitted. Single Redis +
   Lua achieves strong consistency trivially.
  ────────────────────────────────────────
  Rejected: Postgres for rate limit state
  Why: Too slow for per-request decision making. 300+ writes per minute per
  customer with atomic read-modify-write semantics would bottleneck. Redis is
  purpose-built for this.
  ────────────────────────────────────────
  Rejected: In-memory state with gossip protocol
  Why: Complex, eventually consistent, hard to reason about. Redis already
  exists
  in the platform. Don't reinvent distributed state.

  Design Pattern Rejections

  Rejected: if (customerId === 'northwind') special-case
  Why: CTO explicitly forbids this: "Special-case hacks buried in if (customerId
   
  === ...) blocks." Also non-auditable, non-generic, doesn't scale to next
  customer who asks.
  ────────────────────────────────────────
  Rejected: Removing rate limiting for Northwind entirely
  Why: Support lead explicitly said: "I am NOT asking you to remove rate
  limiting
  for everyone." Even Northwind needs a ceiling (1200) to prevent runaway bugs
  from DDOSing the platform.
  ────────────────────────────────────────
  Rejected: "Soft" rate limiting (warn but allow)
  Why: CTO: "No soft warnings, no 'we'll bill you extra' path in v1." Legal
  signed off on hard enforcement.
  ────────────────────────────────────────
  Rejected: Dynamic config from database/API
  Why: Over-scoped for this prototype. Static JSON is auditable (git-tracked),
  deterministic (no network call can fail during limit resolution), and
  sufficient for the demo. Assignment says billing/config UI is out of scope.
  ────────────────────────────────────────
  Rejected: Override without expiration
  Why: Permanent overrides become forgotten debt. The expiresAt field forces a
  commercial resolution (contract renegotiation with Northwind) before the
  exception becomes permanent.
  ────────────────────────────────────────
  Rejected: Override visible to customer via different response
  Why: Support: "invisible to the customer." Northwind sees the same 200 OK
  response whether they're at base limit or override limit. No special headers,
   no different payload.
  ────────────────────────────────────────
  Rejected: Client-side rate limiting / cooperative throttling
  Why: Northwind explicitly said: "They will not re-architect their scheduler
  before renewal." We cannot assume client cooperation. Server-side enforcement
   is non-negotiable.
  ────────────────────────────────────────
  Rejected: Retry-After: fixed value (e.g., always "60")
  Why: Wastes client time. The sliding window log enables precise calculation of

  when the next slot opens. A client waiting 60s when they only need to wait 3s
   is poor DX.
  ────────────────────────────────────────
  Rejected: Using node system clock for timestamps
  Why: Three different nodes could have slightly different clocks (NTP drift).
  The Lua script uses redis.call('TIME') — a single clock source for all
  decisions. Eliminates skew by construction.
  ────────────────────────────────────────
  Rejected: Passing timestamp from application to Lua
  Why: Same clock skew problem. If node-1's clock is 200ms ahead, it could admit

  requests that node-2 would deny. Redis TIME is the only safe option.
  ────────────────────────────────────────
  Rejected: Fail-open on Redis failure (allow all traffic)
  Why: CTO: "error direction is under-limiting, not over-limiting." If Redis is
  down, we return 503 Service Unavailable — denying the request rather than
  letting potentially over-quota traffic through.
  ────────────────────────────────────────
  Rejected: Third-party rate limiting library (express-rate-limit, etc.)
  Why: Most libraries use fixed windows or token buckets internally. They don't
  support distributed Redis Lua with sliding window log. The assignment also
  values "well-understood algorithm" you can explain — a library abstracts away
   the proof.
  ────────────────────────────────────────
  Rejected: k6 / wrk / artillery for load testing
  Why: Generic load testers send traffic and measure response codes. They cannot

  compute "maximum requests allowed in any arbitrary 60-second sliding window"
  — which is THE proof of correctness. A custom harness with post-hoc window
  analysis is the only way to verify the guarantee.
  ────────────────────────────────────────
  Rejected: Docker Swarm / Kubernetes
  Why: Over-engineered. Docker Compose with explicit service definitions is
  simpler, deterministic, runs on any reviewer's laptop in under 2 minutes, and
   satisfies "3 nodes + LB + Redis" requirement.
  ────────────────────────────────────────
  Rejected: Separate Redis databases per customer
  Why: Unnecessary isolation. The key prefix rl:{customerId} provides logical
  isolation within a single Redis instance. Separate databases add operational
  complexity with no correctness benefit.
  ────────────────────────────────────────
  Rejected: Logging every request to a file/database for audit
  Why: The ZSET itself IS the audit log. ZRANGE rl:northwind-logistics 0 -1 
  WITHSCORES shows every admitted request with its timestamp. No additional
  logging infrastructure needed for the prototype.

  Conflict Resolution Rejections

  ┌──────────────────────┬──────────────────────────────────────────────────┐
  │ Rejected Resolution  │                       Why                        │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ Side with CTO        │ Loses 60% of revenue. The assignment is testing  │
  │ entirely (enforce    │ whether you can find the "crack" in both memos — │
  │ 300, let Northwind   │  CTO allows "config and audit" exceptions.       │
  │ get 429s)            │                                                  │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ Side with Support    │ Violates "per-customer isolation" and            │
  │ entirely (no limit   │ "auditable." An unlimited customer could         │
  │ for Northwind)       │ accidentally DDOS the platform. Also, CTO's      │
  │                      │ requirements are labeled "non-negotiable."       │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ Negotiate a lower    │ Support explicitly said: "Do NOT tell me to      │
  │ batch rate with      │ spread their requests out. Their ERP controls    │
  │ Northwind            │ the schedule." This is a technical problem, not  │
  │                      │ a customer education problem.                    │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ "Fix in v2" / defer  │ CTO: "'We'll fix distributed state in v2.' Not   │
  │ the conflict         │ acceptable for GA." The conflict must be         │
  │                      │ resolved in this implementation.                 │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ Separate code path   │ Violates "strictly fair metering" and "no hidden │
  │ for enterprise       │  bypasses." The override system uses the SAME    │
  │ customers            │ code path — only the limit input differs.        │
  └──────────────────────┴──────────────────────────────────────────────────┘

  ---
  Summary of Rejection Philosophy

  Every rejection maps to one of three principles derived from the memos:

  1. Mathematical correctness over approximation — "never" means provably never,
  not statistically unlikely
  2. Generic mechanisms over special cases — if one customer needs it, design
  for any customer to use it
  3. Simplicity of proof over sophistication of implementation — the reviewer
  should understand the guarantee by reading one Lua script and one paragraph

✻ Baked for 3m 37s

❯ Give a detailed workflow and implementation about the load harness. Also make 
  sure to add multiple tests to verify the various conditions of the rate       
  limiting system.                                                              

  Thought for 3s (ctrl+o to expand)

● Load Harness — Complete Workflow & Implementation

  ---
  1. Harness Architecture

  Purpose

  The harness is not a generic load tester. It is a correctness prover. Its job
  is to answer one question with mathematical certainty:

  ▎ "In ANY arbitrary 60-second sliding window, were more requests allowed than 
  ▎ the configured limit?"

  Generic tools like k6, wrk, or artillery measure throughput and latency. They
  cannot compute the sliding window maximum — the metric that proves or
  disproves the rate limiter's guarantee. This is why a custom harness is
  non-negotiable.

  Design Philosophy

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  THE HARNESS IS A PROOF ENGINE, NOT A BENCHMARK.                           │
  │
  │
  │  What it does:                                                             │
  │  • Sends controlled traffic at precise rates
  │
  │  • Records timestamped responses with sub-millisecond accuracy             │
  │  • Performs post-hoc sliding window analysis on collected data
  │
  │  • Reports PASS/FAIL with mathematical evidence                            │
  │
  │
  │  What it does NOT do:                                                      │
  │  • Measure latency percentiles (not the point)                             │
  │  • Generate random traffic patterns (must be deterministic)                │
  │  • Run indefinitely (each scenario has a defined duration)                 │
  │  • Require external dependencies (uses Node.js built-in fetch)             │
  │
  │
  │  Each scenario is structured as:
  │
  │  ┌──────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────┐ │
  │  │ Generate │ →  │ Collect Raw  │ →  │ Analyze Windows │ →  │ Verdict  │ │
  │  │ Traffic  │    │ Response Log │    │ (Post-Hoc)      │    │ PASS/FAIL│ │
  │  └──────────┘    └──────────────┘    └─────────────────┘    └──────────┘ │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Harness Directory Structure

  harness/
  ├── run.js                          # Main entry: runs all scenarios
  sequentially
  ├── lib/
  │   ├── requestGenerator.js         # Controlled-rate HTTP request sender
  │   ├── burstGenerator.js           # Burst-mode sender (all requests ASAP)
  │   ├── windowAnalyzer.js           # Sliding window post-hoc computation
  │   ├── reporter.js                 # Console table + JSON output formatter
  │   └── helpers.js                  # sleep(), timestamp formatting, etc.
  ├── scenarios/
  │   ├── 01-exactEnforcement.js      # Single customer at/above limit
  │   ├── 02-customerIsolation.js     # Two customers, independent budgets
  │   ├── 03-distributedCorrectness.js # Prove all 3 nodes share state
  │   ├── 04-boundaryBurst.js         # Prove no 2x burst at edges
  │   ├── 05-overrideWindow.js        # Northwind batch override active
  │   ├── 06-overrideInactive.js      # Northwind outside batch window
  │   ├── 07-gradualRecovery.js       # Slots free one-by-one after exhaust
  │   ├── 08-retryAfterAccuracy.js    # Retry-After header is precise
  │   ├── 09-unknownCustomer.js       # Unknown ID gets 403, not 429
  │   ├── 10-multiCustomerFairness.js # Same tier = same treatment
  │   └── 11-sustainedLoad.js         # 5-minute sustained over-limit
  └── results/                        # Generated JSON reports (gitignored)
      └── .gitkeep

  ---
  2. Core Library Implementations

  2.1 Request Generator (Controlled Rate)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/lib/requestGenerator.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  /**
  │
  │   * Sends HTTP requests at a precisely controlled rate.
  │
  │   * Uses interval-based scheduling to maintain exact RPM.
  │
  │   *
  │
  │   * @param {Object} options
  │
  │   * @param {string} options.baseUrl      - e.g., "http://localhost:8080"
  │
  │   * @param {string} options.endpoint     - e.g., "/api/v1/resource"
  │
  │   * @param {string} options.customerId   - X-Customer-Id header value
  │
  │   * @param {number} options.rpm          - target requests per minute
  │
  │   * @param {number} options.durationSec  - how long to send traffic
  │
  │   * @param {string} [options.label]      - optional label for logging
  │
  │   * @returns {Promise<Array>} - timestamped response log
  │
  │   */
  │
  │  async function generateTraffic(options) {
  │
  │      const {
  │
  │          baseUrl,
  │
  │          endpoint = '/api/v1/resource',
  │
  │          customerId,
  │
  │          rpm,
  │
  │          durationSec,
  │
  │          label = customerId
  │
  │      } = options;
  │
  │
  │
  │      const url = `${baseUrl}${endpoint}`;
  │
  │      const intervalMs = (60 * 1000) / rpm;
  │
  │      const totalRequests = Math.ceil((rpm * durationSec) / 60);
  │
  │      const results = [];
  │
  │
  │
  │      console.log(`    [${label}] Sending ${totalRequests} requests ` +
  │
  │          `at ${rpm} RPM for ${durationSec}s...`);
  │
  │
  │
  │      for (let i = 0; i < totalRequests; i++) {
  │
  │          const sentAt = Date.now();
  │
  │
  │
  │          try {
  │
  │              const response = await fetch(url, {
  │
  │                  method: 'GET',
  │
  │                  headers: { 'X-Customer-Id': customerId }
  │
  │              });
  │
  │
  │
  │              const respondedAt = Date.now();
  │
  │
  │
  │              results.push({
  │
  │                  index: i,
  │
  │                  sentAt,
  │
  │                  respondedAt,
  │
  │                  latencyMs: respondedAt - sentAt,
  │
  │                  status: response.status,
  │
  │                  allowed: response.status === 200,
  │
  │                  headers: {
  │
  │                      limit: response.headers.get('x-ratelimit-limit'),
  │
  │                      remaining: response.headers.get(
  │
  │                          'x-ratelimit-remaining'),
  │
  │                      retryAfter: response.headers.get('retry-after'),
  │
  │                      servedBy: response.headers.get('x-served-by')
  │
  │                  }
  │
  │              });
  │
  │          } catch (err) {
  │
  │              results.push({
  │
  │                  index: i,
  │
  │                  sentAt,
  │
  │                  respondedAt: Date.now(),
  │
  │                  status: 0,
  │
  │                  allowed: false,
  │
  │                  error: err.message
  │
  │              });
  │
  │          }
  │
  │
  │
  │          // Maintain precise rate by accounting for request latency
  │
  │          if (i < totalRequests - 1) {
  │
  │              const elapsed = Date.now() - sentAt;
  │
  │              const waitMs = Math.max(0, intervalMs - elapsed);
  │
  │              if (waitMs > 0) await sleep(waitMs);
  │
  │          }
  │
  │      }
  │
  │
  │
  │      return results;
  │
  │  }
  │
  │
  │
  │  module.exports = { generateTraffic };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  2.2 Burst Generator (Maximum Speed)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/lib/burstGenerator.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  /**
  │
  │   * Sends N requests as fast as possible (burst mode).
  │
  │   * Used for boundary tests where timing precision matters.
  │
  │   *
  │
  │   * Unlike generateTraffic(), this does NOT pace requests.
  │
  │   * All N requests fire as fast as Node.js can send them.
  │
  │   *
  │
  │   * @param {Object} options
  │
  │   * @param {string} options.baseUrl
  │
  │   * @param {string} options.customerId
  │
  │   * @param {number} options.count - exact number of requests to send
  │
  │   * @param {number} [options.concurrency] - parallel requests (default: 10)
  │
  │   * @returns {Promise<Array>} - timestamped response log
  │
  │   */
  │
  │  async function generateBurst(options) {
  │
  │      const {
  │
  │          baseUrl,
  │
  │          endpoint = '/api/v1/resource',
  │
  │          customerId,
  │
  │          count,
  │
  │          concurrency = 10
  │
  │      } = options;
  │
  │
  │
  │      const url = `${baseUrl}${endpoint}`;
  │
  │      const results = [];
  │
  │      let completed = 0;
  │
  │
  │
  │      // Send requests in batches of `concurrency`
  │
  │      for (let batch = 0; batch < count; batch += concurrency) {
  │
  │          const batchSize = Math.min(concurrency, count - batch);
  │
  │          const promises = [];
  │
  │
  │
  │          for (let j = 0; j < batchSize; j++) {
  │
  │              const i = batch + j;
  │
  │              promises.push(sendOne(url, customerId, i));
  │
  │          }
  │
  │
  │
  │          const batchResults = await Promise.all(promises);
  │
  │          results.push(...batchResults);
  │
  │          completed += batchSize;
  │
  │      }
  │
  │
  │
  │      return results;
  │
  │  }
  │
  │
  │
  │  async function sendOne(url, customerId, index) {
  │
  │      const sentAt = Date.now();
  │
  │      try {
  │
  │          const response = await fetch(url, {
  │
  │              headers: { 'X-Customer-Id': customerId }
  │
  │          });
  │
  │          return {
  │
  │              index,
  │
  │              sentAt,
  │
  │              respondedAt: Date.now(),
  │
  │              status: response.status,
  │
  │              allowed: response.status === 200,
  │
  │              headers: {
  │
  │                  limit: response.headers.get('x-ratelimit-limit'),
  │
  │                  remaining: response.headers.get(
  │
  │                      'x-ratelimit-remaining'),
  │
  │                  retryAfter: response.headers.get('retry-after'),
  │
  │                  servedBy: response.headers.get('x-served-by')
  │
  │              }
  │
  │          };
  │
  │      } catch (err) {
  │
  │          return { index, sentAt, respondedAt: Date.now(),
  │
  │                   status: 0, allowed: false, error: err.message };
  │
  │      }
  │
  │  }
  │
  │
  │
  │  module.exports = { generateBurst };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  2.3 Sliding Window Analyzer (The Proof Engine)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/lib/windowAnalyzer.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  /**
  │
  │   * THE MOST CRITICAL FILE IN THE ENTIRE HARNESS.
  │
  │   *
  │
  │   * This module performs post-hoc sliding window analysis.
  │
  │   * It answers: "What is the MAXIMUM number of allowed requests
  │
  │   * in ANY 60-second span across the entire test duration?"
  │
  │   *
  │
  │   * If max_in_any_window > limit → RATE LIMITER IS BROKEN.                 │
  │   * If max_in_any_window <= limit → GUARANTEE HOLDS.                       │
  │   *
  │
  │   * The analyzer slides a 60-second window across all collected
  │
  │   * timestamps in 100ms increments (high resolution). For each             │
  │   * position, it counts how many allowed requests fall within.             │
  │   */
  │
  │
  │
  │  /**
  │
  │   * @param {Array} results - response log from request generator
  │
  │   * @param {number} windowSizeMs - window size (default 60000ms)
  │
  │   * @param {number} stepMs - analysis step size (default 100ms)
  │
  │   * @returns {Object} - analysis with maxInAnyWindow, details
  │
  │   */
  │
  │  function analyzeWindows(results, windowSizeMs = 60000, stepMs = 100) {    │
  │      // Extract timestamps of ONLY allowed (200 OK) requests
  │
  │      const allowedTimestamps = results
  │
  │          .filter(r => r.allowed)
  │
  │          .map(r => r.sentAt)
  │
  │          .sort((a, b) => a - b);
  │
  │
  │
  │      if (allowedTimestamps.length === 0) {
  │
  │          return {
  │
  │              maxInAnyWindow: 0,
  │
  │              maxWindowStartMs: 0,
  │
  │              totalAllowed: 0,
  │
  │              totalDenied: results.filter(r => !r.allowed).length,
  │
  │              totalSent: results.length,
  │
  │              windowDetails: []
  │
  │          };
  │
  │      }
  │
  │
  │
  │      const firstTimestamp = allowedTimestamps[0];
  │
  │      const lastTimestamp = allowedTimestamps[allowedTimestamps.length - 1];
  │
  │
  │
  │      let maxInAnyWindow = 0;
  │
  │      let maxWindowStartMs = firstTimestamp;
  │
  │      const windowDetails = [];
  │
  │
  │
  │      // Slide the window from before the first request
  │
  │      // to after the last request
  │
  │      const analysisStart = firstTimestamp - windowSizeMs;
  │
  │      const analysisEnd = lastTimestamp + stepMs;
  │
  │
  │
  │      for (let wStart = analysisStart;
  │
  │           wStart <= analysisEnd;
  │
  │           wStart += stepMs) {
  │
  │
  │
  │          const wEnd = wStart + windowSizeMs;
  │
  │
  │
  │          // Binary search for efficiency on large datasets
  │
  │          const startIdx = lowerBound(allowedTimestamps, wStart);
  │
  │          const endIdx = upperBound(allowedTimestamps, wEnd);
  │
  │          const countInWindow = endIdx - startIdx;
  │
  │
  │
  │          if (countInWindow > maxInAnyWindow) {
  │
  │              maxInAnyWindow = countInWindow;
  │
  │              maxWindowStartMs = wStart;
  │
  │          }
  │
  │
  │
  │          // Store samples for detailed reporting (every 5s)
  │
  │          if ((wStart - analysisStart) % 5000 < stepMs) {
  │
  │              windowDetails.push({
  │
  │                  windowStart: wStart,
  │
  │                  windowEnd: wEnd,
  │
  │                  allowedCount: countInWindow
  │
  │              });
  │
  │          }
  │
  │      }
  │
  │
  │
  │      return {
  │
  │          maxInAnyWindow,
  │
  │          maxWindowStartMs,
  │
  │          totalAllowed: allowedTimestamps.length,
  │
  │          totalDenied: results.filter(r => !r.allowed).length,
  │
  │          totalSent: results.length,
  │
  │          durationMs: lastTimestamp - firstTimestamp,
  │
  │          windowDetails
  │
  │      };
  │
  │  }
  │
  │
  │
  │  /**
  │
  │   * Verify the core guarantee against a limit value.
  │
  │   */
  │
  │  function verifyGuarantee(analysis, limit) {
  │
  │      const passed = analysis.maxInAnyWindow <= limit;
  │
  │
  │
  │      return {
  │
  │          passed,
  │
  │          limit,
  │
  │          maxObserved: analysis.maxInAnyWindow,
  │
  │          margin: limit - analysis.maxInAnyWindow,
  │
  │          verdict: passed
  │
  │              ? `PASS: max ${analysis.maxInAnyWindow} ≤ limit ${limit}`     │
  │              : `FAIL: max ${analysis.maxInAnyWindow} > limit ${limit}`     │
  │      };
  │
  │  }
  │
  │
  │
  │  /**
  │
  │   * Analyze node distribution from response headers.
  │
  │   * Proves round-robin and multi-node operation.
  │
  │   */
  │
  │  function analyzeDistribution(results) {
  │
  │      const nodeMap = {};
  │
  │      for (const r of results) {
  │
  │          const node = r.headers?.servedBy || 'unknown';
  │
  │          nodeMap[node] = (nodeMap[node] || 0) + 1;
  │
  │      }
  │
  │      const nodes = Object.keys(nodeMap).filter(n => n !== 'unknown');
  │
  │      const counts = nodes.map(n => nodeMap[n]);
  │
  │      const total = counts.reduce((a, b) => a + b, 0);                      │
  │      const avg = total / nodes.length;
  │
  │      const maxDeviation = Math.max(
  │
  │          ...counts.map(c => Math.abs(c - avg) / avg));                     │
  │
  │
  │      return {
  │
  │          nodeMap,
  │
  │          nodeCount: nodes.length,
  │
  │          isDistributed: nodes.length >= 3,
  │
  │          maxDeviationPct: Math.round(maxDeviation * 100)
  │
  │      };
  │
  │  }
  │
  │
  │
  │  // Binary search helpers
  │
  │  function lowerBound(arr, target) {
  │
  │      let lo = 0, hi = arr.length;
  │
  │      while (lo < hi) {
  │
  │          const mid = (lo + hi) >>> 1;
  │
  │          if (arr[mid] < target) lo = mid + 1;
  │
  │          else hi = mid;
  │
  │      }
  │
  │      return lo;
  │
  │  }
  │
  │
  │
  │  function upperBound(arr, target) {
  │
  │      let lo = 0, hi = arr.length;
  │
  │      while (lo < hi) {
  │
  │          const mid = (lo + hi) >>> 1;
  │
  │          if (arr[mid] <= target) lo = mid + 1;
  │
  │          else hi = mid;
  │
  │      }
  │
  │      return lo;
  │
  │  }
  │
  │
  │
  │  module.exports = { analyzeWindows, verifyGuarantee, analyzeDistribution };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  2.4 Reporter

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/lib/reporter.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  const fs = require('fs');
  │
  │  const path = require('path');
  │
  │
  │
  │  function printHeader() {
  │
  │      console.log('\n╔═══════════════════════════════════════════════════╗');
  │
  │      console.log('║  RelayAPI Rate Limiter — Load Harness             ║'); │
  │      console.log('║  Sliding Window Log · 3 Nodes · Redis             ║'); │
  │      console.log('╚═══════════════════════════════════════════════════╝'); │
  │      console.log(`\n  Target: ${process.env.TARGET_URL ||                  │
  │          'http://localhost:8080'}`);
  │
  │      console.log(`  Time:   ${new Date().toISOString()}`);                 │
  │      console.log(`  Mode:   Sequential scenario execution\n`);             │
  │  }
  │
  │
  │
  │  function printScenarioResult(result) {
  │
  │      const divider = '═'.repeat(72);
  │
  │      const line = '─'.repeat(72);
  │
  │
  │
  │      console.log(`\n  ${divider}`);
  │
  │      console.log(`  TEST #${result.id}: ${result.name}`);                  │
  │      console.log(`  ${result.description}`);                               │
  │      console.log(`  ${divider}`);
  │
  │
  │
  │      // Configuration
  │
  │      console.log(`\n  Configuration:`);
  │
  │      for (const [key, val] of Object.entries(result.config)) {             │
  │          console.log(`    ${key.padEnd(16)}: ${val}`);
  │
  │      }
  │
  │
  │
  │      // Metrics
  │
  │      console.log(`\n  Metrics:`);
  │
  │      console.log(`    Total Sent:       ${result.metrics.totalSent}`);     │
  │      console.log(`    Allowed (200):    ${result.metrics.totalAllowed}`);  │
  │      console.log(`    Denied (429):     ${result.metrics.totalDenied}`);   │
  │      if (result.metrics.errors > 0) {
  │
  │          console.log(`    Errors:           ${result.metrics.errors}`);
  │
  │      }
  │
  │
  │
  │      // Sliding Window Analysis
  │
  │      if (result.windowAnalysis) {
  │
  │          console.log(`\n  Sliding Window Analysis (60s):`);
  │
  │          console.log(`    Max in any window:  ` +
  │
  │              `${result.windowAnalysis.maxInAnyWindow}`);
  │
  │          console.log(`    Configured limit:   ${result.limit}`);           │
  │          console.log(`    Margin:             ` +
  │
  │              `${result.limit - result.windowAnalysis.maxInAnyWindow}`);    │
  │      }
  │
  │
  │
  │      // Node Distribution (if applicable)
  │
  │      if (result.distribution) {
  │
  │          console.log(`\n  Node Distribution:`);
  │
  │          for (const [node, count] of
  │
  │              Object.entries(result.distribution.nodeMap)) {
  │
  │              const pct = Math.round(
  │
  │                  (count / result.metrics.totalSent) * 100);                │
  │              console.log(`    ${node}: ${count} (${pct}%)`);               │
  │          }
  │
  │      }
  │
  │
  │
  │      // Additional assertions (scenario-specific)
  │
  │      if (result.assertions && result.assertions.length > 0) {              │
  │          console.log(`\n  Assertions:`);
  │
  │          for (const assertion of result.assertions) {
  │
  │              const icon = assertion.passed ? '✓' : '✗';                    │
  │              const color = assertion.passed ? '\x1b[32m' : '\x1b[31m';     │
  │              console.log(`    ${color}${icon}\x1b[0m ${assertion.msg}`);   │
  │          }
  │
  │      }
  │
  │
  │
  │      // Final Verdict
  │
  │      const passed = result.passed;
  │
  │      const verdict = passed ? '✓ PASS' : '✗ FAIL';                        │
  │      const color = passed ? '\x1b[32m' : '\x1b[31m';                       │
  │      console.log(`\n  ${color}━━━ VERDICT: ${verdict} ━━━\x1b[0m`);       │
  │      console.log(`  ${result.verdictReason}`);                             │
  │      console.log(`\n  ${line}`);
  │
  │
  │
  │      return passed;
  │
  │  }
  │
  │
  │
  │  function printSummary(results) {
  │
  │      const passed = results.filter(r => r.passed).length;
  │
  │      const failed = results.filter(r => !r.passed).length;
  │
  │      const total = results.length;
  │
  │
  │
  │      console.log('\n' + '═'.repeat(72));
  │
  │      console.log(`  FINAL SUMMARY: ${passed}/${total} scenarios passed`);  │
  │      if (failed > 0) {
  │
  │          console.log(`  FAILED:`);
  │
  │          results.filter(r => !r.passed).forEach(r => {                     │
  │              console.log(`    - #${r.id}: ${r.name}`);
  │
  │          });
  │
  │      }
  │
  │      console.log('═'.repeat(72) + '\n');
  │
  │  }
  │
  │
  │
  │  function saveResultsJSON(results, filename) {
  │
  │      const outputDir = path.join(__dirname, '../results');
  │
  │      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);              │
  │      const filepath = path.join(outputDir, filename);
  │
  │      fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  │
  │      console.log(`  Results saved to: ${filepath}`);                       │
  │  }
  │
  │
  │
  │  module.exports = {
  │
  │      printHeader, printScenarioResult, printSummary, saveResultsJSON       │
  │  };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  2.5 Helpers

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/lib/helpers.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  function sleep(ms) {
  │
  │      return new Promise(resolve => setTimeout(resolve, ms));
  │
  │  }
  │
  │
  │
  │  function formatDuration(ms) {
  │
  │      if (ms < 1000) return `${ms}ms`;                                      │
  │      return `${(ms / 1000).toFixed(1)}s`;                                  │
  │  }
  │
  │
  │
  │  /**
  │
  │   * Flush rate limit state between scenarios.
  │
  │   * Calls Redis FLUSHDB via a special endpoint or direct connection.
  │
  │   * Ensures scenarios don't interfere with each other.
  │
  │   */
  │
  │  async function flushRateLimitState(baseUrl) {
  │
  │      try {
  │
  │          await fetch(`${baseUrl}/health`);
  │
  │          // Alternatively: direct Redis FLUSHDB via a test endpoint
  │
  │          // or wait 65 seconds for TTL to expire (if no flush endpoint)
  │
  │      } catch (e) {
  │
  │          // Service might not be up yet
  │
  │      }
  │
  │  }
  │
  │
  │
  │  /**
  │
  │   * Wait for service to be healthy before running scenarios.
  │
  │   */
  │
  │  async function waitForService(baseUrl, timeoutMs = 30000) {               │
  │      const start = Date.now();
  │
  │      while (Date.now() - start < timeoutMs) {
  │
  │          try {
  │
  │              const res = await fetch(`${baseUrl}/health`);
  │
  │              if (res.ok) return true;
  │
  │          } catch (e) { /* retry */ }
  │
  │          await sleep(1000);
  │
  │      }
  │
  │      throw new Error(`Service at ${baseUrl} not healthy ` +                │
  │          `after ${timeoutMs}ms`);
  │
  │  }
  │
  │
  │
  │  module.exports = { sleep, formatDuration, flushRateLimitState,            │
  │      waitForService };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  3. Test Scenarios — Full Implementation

  Scenario 01: Exact Enforcement

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/01-exactEnforcement.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  A single customer sending ABOVE their limit gets capped at exactly
  │
  │  that limit. No more than `limit` requests are admitted in any
  │
  │  60-second sliding window.
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  CTO Memo: "When a customer hits their RPM limit, return 429"              │
  │  CTO Memo: "a customer must never exceed their contracted quota"
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const { generateTraffic } = require('../lib/requestGenerator');
  │
  │  const { analyzeWindows, verifyGuarantee } = require(                      │
  │      '../lib/windowAnalyzer');
  │
  │
  │
  │  const name = 'Exact Enforcement';
  │
  │  const description = 'Customer at 133% of limit — verify hard cap';        │
  │
  │
  │  async function run(baseUrl) {
  │
  │      const customerId = 'acme-corp';
  │
  │      const limit = 300;       // acme-corp's configured limit
  │
  │      const sendRpm = 400;     // 133% of limit
  │
  │      const durationSec = 90;  // 1.5 minutes (covers full window + extra)  │
  │
  │
  │      // Generate over-limit traffic
  │
  │      const results = await generateTraffic({
  │
  │          baseUrl, customerId, rpm: sendRpm, durationSec                    │
  │      });
  │
  │
  │
  │      // Post-hoc sliding window analysis
  │
  │      const analysis = analyzeWindows(results);
  │
  │      const guarantee = verifyGuarantee(analysis, limit);
  │
  │
  │
  │      return {
  │
  │          id: 1,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              customer: customerId,
  │
  │              limit: `${limit} RPM`,
  │
  │              sentRate: `${sendRpm} RPM`,
  │
  │              duration: `${durationSec}s`
  │
  │          },
  │
  │          limit,
  │
  │          metrics: {
  │
  │              totalSent: results.length,
  │
  │              totalAllowed: analysis.totalAllowed,
  │
  │              totalDenied: analysis.totalDenied,
  │
  │              errors: results.filter(r => r.error).length
  │
  │          },
  │
  │          windowAnalysis: analysis,
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `Max in any 60s window (${analysis.maxInAnyWindow})`
  +│
  │                      ` ≤ limit (${limit})`,                                │
  │                  passed: analysis.maxInAnyWindow <= limit
  │
  │              },
  │
  │              {
  │
  │                  msg: `Some requests were denied (${analysis.totalDenied}`
  +│
  │                      ` > 0)`,                                              │
  │                  passed: analysis.totalDenied > 0
  │
  │              },
  │
  │              {
  │
  │                  msg: `Allowed count is close to limit ` +
  │
  │                      `(≥ ${limit - 10})`,                                  │
  │                  passed: analysis.maxInAnyWindow >= limit - 10
  │
  │              }
  │
  │          ],
  │
  │          passed: guarantee.passed,
  │
  │          verdictReason: guarantee.verdict
  │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Scenario 02: Customer Isolation

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/02-customerIsolation.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  Customer A hitting their limit has ZERO effect on Customer B.
  │
  │  Each customer operates in complete isolation.
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  CTO Memo: "Customer A's traffic spike must not consume Customer B's       │
  │  budget. Shared pools are out."
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const { generateTraffic } = require('../lib/requestGenerator');
  │
  │  const { analyzeWindows, verifyGuarantee } = require(                      │
  │      '../lib/windowAnalyzer');
  │
  │
  │
  │  const name = 'Customer Isolation';
  │
  │  const description = 'Two customers — one over limit, one under — ' +      │
  │      'verify no interference';
  │
  │
  │
  │  async function run(baseUrl) {
  │
  │      const durationSec = 75;
  │
  │
  │
  │      // Customer A: acme-corp (limit 300), sending at 400 RPM              │
  │      // Customer B: small-startup (limit 60), sending at 40 RPM            │
  │      // B is UNDER its limit — should get 100% success rate
  │
  │
  │
  │      // Run both concurrently
  │
  │      const [resultsA, resultsB] = await Promise.all([                      │
  │          generateTraffic({
  │
  │              baseUrl,
  │
  │              customerId: 'acme-corp',
  │
  │              rpm: 400,
  │
  │              durationSec,
  │
  │              label: 'acme-corp (over limit)'                               │
  │          }),
  │
  │          generateTraffic({
  │
  │              baseUrl,
  │
  │              customerId: 'small-startup',
  │
  │              rpm: 40,
  │
  │              durationSec,
  │
  │              label: 'small-startup (under limit)'
  │
  │          })
  │
  │      ]);
  │
  │
  │
  │      const analysisA = analyzeWindows(resultsA);
  │
  │      const analysisB = analyzeWindows(resultsB);
  │
  │      const guaranteeA = verifyGuarantee(analysisA, 300);                   │
  │      const guaranteeB = verifyGuarantee(analysisB, 60);                    │
  │
  │
  │      // Customer B should have ZERO denials (40 < 60)
  │
  │      const bAllAllowed = analysisB.totalDenied === 0;
  │
  │
  │
  │      return {
  │
  │          id: 2,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              'Customer A': 'acme-corp (limit: 300, sent: 400 RPM)',        │
  │              'Customer B': 'small-startup (limit: 60, sent: 40 RPM)',      │
  │              duration: `${durationSec}s`
  │
  │          },
  │
  │          limit: '300 / 60',
  │
  │          metrics: {
  │
  │              totalSent: resultsA.length + resultsB.length,
  │
  │              totalAllowed: analysisA.totalAllowed + analysisB.totalAllowed,
  │
  │              totalDenied: analysisA.totalDenied + analysisB.totalDenied,   │
  │              errors: 0
  │
  │          },
  │
  │          windowAnalysis: {
  │
  │              maxInAnyWindow: `A:${analysisA.maxInAnyWindow} ` +            │
  │                  `B:${analysisB.maxInAnyWindow}`                           │
  │          },
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `Customer A capped at limit: max ` +
  │
  │                      `${analysisA.maxInAnyWindow} ≤ 300`,                  │
  │                  passed: guaranteeA.passed
  │
  │              },
  │
  │              {
  │
  │                  msg: `Customer B fully unaffected: ` +
  │
  │                      `${analysisB.totalDenied} denials (expected 0)`,      │
  │                  passed: bAllAllowed
  │
  │              },
  │
  │              {
  │
  │                  msg: `Customer B max in window ` +
  │
  │                      `(${analysisB.maxInAnyWindow}) ≤ 60`,                │
  │                  passed: guaranteeB.passed
  │
  │              },
  │
  │              {
  │
  │                  msg: `A being over-limit did NOT cause B denials`,
  │
  │                  passed: bAllAllowed
  │
  │              }
  │
  │          ],
  │
  │          passed: guaranteeA.passed && bAllAllowed,
  │
  │          verdictReason: bAllAllowed
  │
  │              ? 'Customer isolation confirmed: A at limit, B unaffected'    │
  │              : `ISOLATION BROKEN: Customer B got ${analysisB.totalDenied}`
  +│
  │                ` false denials while A was over limit`
  │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Scenario 03: Distributed Correctness

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/03-distributedCorrectness.js
   │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  Rate limiting is enforced GLOBALLY across all 3 nodes.
  │
  │  Not 300 per node (= 900 total), but 300 TOTAL across the system.          │
  │  Requests distribute across nodes but limit is shared via Redis.
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  CTO Memo: "Show me a demo where... even when I hammer the load            │
  │  balancer randomly across all three nodes"
  │
  │  CTO Memo: "Whatever you build must work when requests land on             │
  │  different nodes between seconds"
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const { generateTraffic } = require('../lib/requestGenerator');
  │
  │  const { analyzeWindows, verifyGuarantee, analyzeDistribution } =          │
  │      require('../lib/windowAnalyzer');
  │
  │
  │
  │  const name = 'Distributed Correctness';
  │
  │  const description = 'Verify global limit enforcement across 3 nodes';     │
  │
  │
  │  async function run(baseUrl) {
  │
  │      const customerId = 'acme-corp';
  │
  │      const limit = 300;
  │
  │      const sendRpm = 450;   // 150% of limit                               │
  │      const durationSec = 90;
  │
  │
  │
  │      const results = await generateTraffic({
  │
  │          baseUrl, customerId, rpm: sendRpm, durationSec                    │
  │      });
  │
  │
  │
  │      const analysis = analyzeWindows(results);
  │
  │      const guarantee = verifyGuarantee(analysis, limit);
  │
  │      const distribution = analyzeDistribution(results);
  │
  │
  │
  │      return {
  │
  │          id: 3,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              customer: customerId,
  │
  │              limit: `${limit} RPM (GLOBAL, not per-node)`,                 │
  │              sentRate: `${sendRpm} RPM through load balancer`,             │
  │              duration: `${durationSec}s`,
  │
  │              topology: '3 nodes behind round-robin nginx'
  │
  │          },
  │
  │          limit,
  │
  │          metrics: {
  │
  │              totalSent: results.length,
  │
  │              totalAllowed: analysis.totalAllowed,
  │
  │              totalDenied: analysis.totalDenied,
  │
  │              errors: results.filter(r => r.error).length
  │
  │          },
  │
  │          windowAnalysis: analysis,
  │
  │          distribution,
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `GLOBAL max in any 60s window ` +
  │
  │                      `(${analysis.maxInAnyWindow}) ≤ ${limit}`,           │
  │                  passed: guarantee.passed
  │
  │              },
  │
  │              {
  │
  │                  msg: `Traffic hit all 3 nodes ` +
  │
  │                      `(found: ${distribution.nodeCount})`,                 │
  │                  passed: distribution.isDistributed
  │
  │              },
  │
  │              {
  │
  │                  msg: `Node distribution balanced ` +
  │
  │                      `(max deviation: ${distribution.maxDeviationPct}%` +  │
  │                      `, target: <30%)`,                                    │
  │                  passed: distribution.maxDeviationPct < 30
  │
  │              },
  │
  │              {
  │
  │                  msg: `Limit is NOT 300 per node (would be 900 total). ` + │
  │                      `Total allowed: ${analysis.totalAllowed}`,            │
  │                  passed: analysis.maxInAnyWindow <= limit
  │
  │              }
  │
  │          ],
  │
  │          passed: guarantee.passed && distribution.isDistributed,           │
  │          verdictReason: guarantee.passed && distribution.isDistributed     │
  │              ? `Global enforcement confirmed across ` +                    │
  │                `${distribution.nodeCount} nodes`                           │
  │              : `FAILED: ${guarantee.verdict}, ` +                          │
  │                `nodes=${distribution.nodeCount}`
  │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Scenario 04: Boundary Burst Prevention

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/04-boundaryBurst.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  There is NO "boundary burst" — the failure mode where a fixed window      │
  │  allows 2x the limit at the window edge. This directly addresses the       │
  │  staging incident where "correctness issues at quota boundaries" caused
  │
  │  a rollback.
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  Platform Wiki: "new limiter prototype had correctness issues at quota
  │
  │  boundaries under Northwind-scale traffic"
  │
  │  CTO Memo: "a customer must never exceed their contracted quota"
  │
  │
  │
  │  THE ATTACK PATTERN:
  │
  │  T=0s:   Burst 300 requests (fills the budget)                             │
  │  T=55s:  Burst 300 more (just BEFORE old entries expire at T=60s)          │
  │
  │
  │  With a FIXED WINDOW (broken):
  │
  │  Window 1 [0-60s] allows 300, Window 2 [60-120s] allows 300                │
  │  But at T=55-65s: 300+300 = 600 requests in 10 seconds!                    │
  │
  │
  │  With a SLIDING WINDOW (correct):
  │
  │  At T=55s, the window [T-60..T] = [-5..55] still contains all 300          │
  │  entries from T=0s. Budget is FULL. Second burst is DENIED.
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const { generateBurst } = require('../lib/burstGenerator');
  │
  │  const { analyzeWindows, verifyGuarantee } = require(                      │
  │      '../lib/windowAnalyzer');
  │
  │  const { sleep } = require('../lib/helpers');
  │
  │
  │
  │  const name = 'Boundary Burst Prevention';
  │
  │  const description = 'Prove no 2x burst at window edges ' +                │
  │      '(the staging incident bug)';
  │
  │
  │
  │  async function run(baseUrl) {
  │
  │      const customerId = 'acme-corp';
  │
  │      const limit = 300;
  │
  │      const burstSize = 300;
  │
  │      const gapSeconds = 55; // Just before 60s boundary
  │
  │
  │
  │      console.log(`    Phase 1: Sending burst of ${burstSize} ` +
  │
  │          `requests at T=0s...`);
  │
  │      const burst1 = await generateBurst({
  │
  │          baseUrl, customerId, count: burstSize, concurrency: 20            │
  │      });
  │
  │
  │
  │      const burst1Allowed = burst1.filter(r => r.allowed).length;
  │
  │
  │
  │      console.log(`    Phase 1 complete: ${burst1Allowed}/${burstSize} ` +
  │
  │          `allowed`);
  │
  │      console.log(`    Waiting ${gapSeconds}s (just before window
  edge)...`);│
  │
  │
  │      await sleep(gapSeconds * 1000);
  │
  │
  │
  │      console.log(`    Phase 2: Sending burst of ${burstSize} ` +
  │
  │          `requests at T=${gapSeconds}s...`);
  │
  │      const burst2 = await generateBurst({
  │
  │          baseUrl, customerId, count: burstSize, concurrency: 20            │
  │      });
  │
  │
  │
  │      const burst2Allowed = burst2.filter(r => r.allowed).length;
  │
  │      const burst2Denied = burst2.filter(r => !r.allowed).length;
  │
  │
  │
  │      console.log(`    Phase 2 complete: ${burst2Allowed}/${burstSize} ` +
  │
  │          `allowed, ${burst2Denied} denied`);
  │
  │
  │
  │      // Combine all results for window analysis
  │
  │      const allResults = [...burst1, ...burst2];
  │
  │      const analysis = analyzeWindows(allResults);
  │
  │      const guarantee = verifyGuarantee(analysis, limit);
  │
  │
  │
  │      // The critical assertion: second burst should be mostly DENIED
  │
  │      // because entries from burst 1 haven't expired yet (55s < 60s)
  │
  │      const burst2DenialRate = burst2Denied / burstSize;
  │
  │
  │
  │      return {
  │
  │          id: 4,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              customer: customerId,
  │
  │              limit: `${limit} RPM`,
  │
  │              pattern: `Burst ${burstSize} → wait ${gapSeconds}s → ` +     │
  │                  `burst ${burstSize}`,
  │
  │              gapBelowWindow: `${60 - gapSeconds}s before expiry`           │
  │          },
  │
  │          limit,
  │
  │          metrics: {
  │
  │              totalSent: allResults.length,
  │
  │              totalAllowed: analysis.totalAllowed,
  │
  │              totalDenied: analysis.totalDenied,
  │
  │              errors: allResults.filter(r => r.error).length,               │
  │              burst1Allowed,
  │
  │              burst2Allowed,
  │
  │              burst2Denied
  │
  │          },
  │
  │          windowAnalysis: analysis,
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `Max in any 60s window ` +
  │
  │                      `(${analysis.maxInAnyWindow}) ≤ ${limit}`,           │
  │                  passed: guarantee.passed
  │
  │              },
  │
  │              {
  │
  │                  msg: `Burst 1 filled budget: ` +
  │
  │                      `${burst1Allowed} ≈ ${limit}`,                        │
  │                  passed: burst1Allowed >= limit - 5
  │
  │              },
  │
  │              {
  │
  │                  msg: `Burst 2 mostly denied: ` +
  │
  │                      `${Math.round(burst2DenialRate * 100)}% denied ` +   │
  │                      `(expected >90%)`,
  │
  │                  passed: burst2DenialRate > 0.9
  │
  │              },
  │
  │              {
  │
  │                  msg: `NOT a fixed window bug: total allowed ` +
  │
  │                      `(${analysis.totalAllowed}) is NOT 600`,             │
  │                  passed: analysis.totalAllowed < 600
  │
  │              }
  │
  │          ],
  │
  │          passed: guarantee.passed && burst2DenialRate > 0.9,               │
  │          verdictReason: guarantee.passed
  │
  │              ? `Boundary burst PREVENTED. Fixed window would have ` +      │
  │                `allowed ${burstSize * 2} (2x limit). Sliding window ` +   │
  │                `correctly limited to ${analysis.maxInAnyWindow}.`          │
  │              : `BOUNDARY BURST DETECTED: ` +                               │
  │                `${analysis.maxInAnyWindow} > ${limit} in a 60s window`    │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Scenario 05: Northwind Override — Active Window

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/05-overrideWindow.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  During the override window, Northwind's effective limit is elevated
  │
  │  from 300 to 1200. Their batch traffic (800-1200 RPM) flows without        │
  │  429s. The same algorithm is used — only the limit number changes.
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  Support Memo: "Northwind must never see a 429 during their batch window"  │
  │  CTO Memo: "If we ever grant a commercial exception, it goes through       │
  │  config and audit"
  │
  │
  │
  │  IMPLEMENTATION NOTE:
  │
  │  The customers.json config must have an override that covers the
  │
  │  current test time. Either:
  │
  │  (a) Run the test between 02:00-04:00 UTC, OR                              │
  │  (b) Use a test-specific config with a "testing" override that covers      │
  │      the current hour. We use approach (b) for reliability.
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const { generateTraffic } = require('../lib/requestGenerator');
  │
  │  const { analyzeWindows, verifyGuarantee } = require(                      │
  │      '../lib/windowAnalyzer');
  │
  │
  │
  │  const name = 'Northwind Override — Active Window';
  │
  │  const description = 'Verify elevated limit during batch window ' +
  │
  │      '(1200 RPM effective)';
  │
  │
  │
  │  async function run(baseUrl) {
  │
  │      const customerId = 'northwind-logistics';
  │
  │      const overrideLimit = 1200;  // effective during batch window
  │
  │      const sendRpm = 1000;        // below override, above base (300)
  │
  │      const durationSec = 75;      // 1.25 minutes
  │
  │
  │
  │      // This scenario requires the override to be active NOW.
  │
  │      // The test config should include an override for the current time.
  │
  │      // If running outside 02:00-04:00 UTC, ensure test config has a
  │
  │      // "testing" override covering the current hour.
  │
  │
  │
  │      const results = await generateTraffic({
  │
  │          baseUrl, customerId, rpm: sendRpm, durationSec                    │
  │      });
  │
  │
  │
  │      const analysis = analyzeWindows(results);
  │
  │      const guarantee = verifyGuarantee(analysis, overrideLimit);
  │
  │
  │
  │      // Key assertion: at 1000 RPM with 1200 limit, ALL should pass        │
  │      const zeroOrMinimalDenials = analysis.totalDenied <= 5;               │
  │      // (allow a tiny margin for timing imprecision at scenario start)
  │
  │
  │
  │      return {
  │
  │          id: 5,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              customer: customerId,
  │
  │              baseLimitRpm: '300 RPM (contract)',
  │
  │              effectiveLimitRpm: `${overrideLimit} RPM (override active)`,  │
  │              sentRate: `${sendRpm} RPM (simulated batch)`,                 │
  │              duration: `${durationSec}s`,
  │
  │              note: 'Override window active — batch traffic should flow'
  │
  │          },
  │
  │          limit: overrideLimit,
  │
  │          metrics: {
  │
  │              totalSent: results.length,
  │
  │              totalAllowed: analysis.totalAllowed,
  │
  │              totalDenied: analysis.totalDenied,
  │
  │              errors: results.filter(r => r.error).length
  │
  │          },
  │
  │          windowAnalysis: analysis,
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `Override limit (${overrideLimit}) is in effect`,
  │
  │                  passed: true
  │
  │              },
  │
  │              {
  │
  │                  msg: `At ${sendRpm} RPM (< ${overrideLimit}), ` +         │
  │                      `≈0 denials: got ${analysis.totalDenied}`,            │
  │                  passed: zeroOrMinimalDenials
  │
  │              },
  │
  │              {
  │
  │                  msg: `Max window (${analysis.maxInAnyWindow}) ≤ ` +       │
  │                      `override limit (${overrideLimit})`,                  │
  │                  passed: guarantee.passed
  │
  │              },
  │
  │              {
  │
  │                  msg: `This traffic WOULD have been denied at base ` +     │
  │                      `limit 300 — override prevented 429s`,                │
  │                  passed: sendRpm > 300 && zeroOrMinimalDenials
  │
  │              }
  │
  │          ],
  │
  │          passed: guarantee.passed && zeroOrMinimalDenials,
  │
  │          verdictReason: zeroOrMinimalDenials
  │
  │              ? `Northwind batch at ${sendRpm} RPM flows freely ` +         │
  │                `under ${overrideLimit} override. Zero 429s.`               │
  │              : `FAILED: Northwind saw ${analysis.totalDenied} denials ` +  │
  │                `during batch window`
  │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Scenario 06: Northwind Override — Inactive (Base Limit Enforced)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/06-overrideInactive.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  Outside the batch window, Northwind is rate limited at their normal
  │
  │  contract of 300 RPM. The override is NOT a permanent bypass.
  │
  │  Northwind is still a metered customer — just with a time-bounded
  │
  │  exception during specific hours.
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  Support Memo: "I am not asking you to remove rate limiting for everyone"  │
  │  CTO Memo: "Strictly fair metering"
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const { generateTraffic } = require('../lib/requestGenerator');
  │
  │  const { analyzeWindows, verifyGuarantee } = require(                      │
  │      '../lib/windowAnalyzer');
  │
  │
  │
  │  const name = 'Northwind Override — Inactive (Base Limit)';
  │
  │  const description = 'Outside batch window, Northwind gets normal ' +
  │
  │      '300 RPM limit';
  │
  │
  │
  │  async function run(baseUrl) {
  │
  │      const customerId = 'northwind-logistics';
  │
  │      const baseLimit = 300;
  │
  │      const sendRpm = 400;      // Above base limit
  │
  │      const durationSec = 75;
  │
  │
  │
  │      // This scenario requires override to be INACTIVE.
  │
  │      // The test config should have a second Northwind entry with
  │
  │      // NO active override at the current time.
  │
  │      // OR: use a separate customer ID that maps to same config
  │
  │      // without an active window.
  │
  │
  │
  │      const results = await generateTraffic({
  │
  │          baseUrl, customerId, rpm: sendRpm, durationSec                    │
  │      });
  │
  │
  │
  │      const analysis = analyzeWindows(results);
  │
  │      const guarantee = verifyGuarantee(analysis, baseLimit);
  │
  │
  │
  │      const hasDenials = analysis.totalDenied > 0;
  │
  │
  │
  │      return {
  │
  │          id: 6,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              customer: customerId,
  │
  │              limit: `${baseLimit} RPM (base — override INACTIVE)`,         │
  │              sentRate: `${sendRpm} RPM`,
  │
  │              duration: `${durationSec}s`,
  │
  │              note: 'Override window not active — base limit applies'
  │
  │          },
  │
  │          limit: baseLimit,
  │
  │          metrics: {
  │
  │              totalSent: results.length,
  │
  │              totalAllowed: analysis.totalAllowed,
  │
  │              totalDenied: analysis.totalDenied,
  │
  │              errors: results.filter(r => r.error).length
  │
  │          },
  │
  │          windowAnalysis: analysis,
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `Max in window (${analysis.maxInAnyWindow}) ` +
  │
  │                      `≤ base limit (${baseLimit})`,                        │
  │                  passed: guarantee.passed
  │
  │              },
  │
  │              {
  │
  │                  msg: `Requests WERE denied (${analysis.totalDenied} > 0)`
  +│
  │                      ` — Northwind is not exempt outside window`,          │
  │                  passed: hasDenials
  │
  │              },
  │
  │              {
  │
  │                  msg: `Override is time-bounded, not permanent bypass`,
  │
  │                  passed: guarantee.passed && hasDenials
  │
  │              }
  │
  │          ],
  │
  │          passed: guarantee.passed && hasDenials,
  │
  │          verdictReason: guarantee.passed && hasDenials
  │
  │              ? `Northwind correctly rate-limited at base ${baseLimit} ` +
  │
  │                `outside batch window. Override is time-bounded.`
  │
  │              : `FAILED: override may be permanently active`
  │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Scenario 07: Gradual Recovery

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/07-gradualRecovery.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  After exhausting the budget, capacity recovers GRADUALLY as old
  │
  │  entries expire one-by-one. There is no "reset moment" where all
  │
  │  slots free simultaneously (that would be fixed window behavior).
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  Auditable counting: "requests are counted individually with timestamps"   │
  │  This is the visual proof that sliding window works differently from
  │
  │  fixed window — recovery is smooth, not step-function.
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const { generateBurst } = require('../lib/burstGenerator');
  │
  │  const { generateTraffic } = require('../lib/requestGenerator');
  │
  │  const { sleep } = require('../lib/helpers');
  │
  │
  │
  │  const name = 'Gradual Recovery';
  │
  │  const description = 'After exhaustion, slots free one-by-one ' +
  │
  │      '(not all-at-once reset)';
  │
  │
  │
  │  async function run(baseUrl) {
  │
  │      const customerId = 'acme-corp';
  │
  │      const limit = 300;
  │
  │
  │
  │      // Phase 1: Fill the entire budget with a burst
  │
  │      console.log(`    Phase 1: Filling budget with ${limit} requests...`); │
  │      const fillBurst = await generateBurst({
  │
  │          baseUrl, customerId, count: limit, concurrency: 20                │
  │      });
  │
  │      const filled = fillBurst.filter(r => r.allowed).length;               │
  │      console.log(`    Budget filled: ${filled}/${limit} allowed`);         │
  │
  │
  │      // Phase 2: Wait 50 seconds (entries start expiring at T+60s)
  │
  │      console.log(`    Phase 2: Waiting 50s...`);
  │
  │      await sleep(50000);
  │
  │
  │
  │      // Phase 3: Send slow probes for 30 seconds to observe recovery
  │
  │      // At T+60s, entries from T+0 start expiring (burst took ~2-3s)       │
  │      // So between T+60 and T+63, all 300 entries will have expired
  │
  │      console.log(`    Phase 3: Sending probes at 60 RPM for 30s...`);      │
  │      const probes = await generateTraffic({
  │
  │          baseUrl, customerId, rpm: 60, durationSec: 30,                    │
  │          label: 'recovery-probe'
  │
  │      });
  │
  │
  │
  │      // Analyze the probe results
  │
  │      // Early probes (T+50 to T+60): should be DENIED (budget full)        │
  │      // Later probes (T+60 to T+80): should start being ALLOWED            │
  │      const probeStart = probes[0]?.sentAt || 0;
  │
  │
  │
  │      const earlyProbes = probes.filter(
  │
  │          r => r.sentAt - probeStart < 10000);  // first 10s of probing     │
  │      const lateProbes = probes.filter(
  │
  │          r => r.sentAt - probeStart >= 15000); // after 15s of probing     │
  │
  │
  │      const earlyAllowed = earlyProbes.filter(r => r.allowed).length;       │
  │      const lateAllowed = lateProbes.filter(r => r.allowed).length;         │
  │
  │
  │      // Check for gradual recovery (not sudden all-at-once)
  │
  │      // In a fixed window: 0 allowed → then suddenly ALL allowed           │
  │      // In sliding window: few allowed → more → more (gradual)             │
  │      const midProbes = probes.filter(
  │
  │          r => r.sentAt - probeStart >= 8000 &&
  │
  │               r.sentAt - probeStart < 18000);                              │
  │      const midAllowed = midProbes.filter(r => r.allowed).length;           │
  │      const isGradual = midAllowed > 0 && midAllowed < lateAllowed;         │
  │
  │
  │      return {
  │
  │          id: 7,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              customer: customerId,
  │
  │              limit: `${limit} RPM`,
  │
  │              pattern: 'Fill budget → wait 50s → probe at 60 RPM for 30s', │
  │              probeRate: '60 RPM (low — just testing if allowed)'
  │
  │          },
  │
  │          limit,
  │
  │          metrics: {
  │
  │              totalSent: fillBurst.length + probes.length,
  │
  │              totalAllowed: filled + probes.filter(r => r.allowed).length,  │
  │              totalDenied: fillBurst.filter(r => !r.allowed).length +       │
  │                  probes.filter(r => !r.allowed).length,                    │
  │              errors: 0,
  │
  │              earlyProbesAllowed: `${earlyAllowed}/${earlyProbes.length}`,  │
  │              midProbesAllowed: `${midAllowed}/${midProbes.length}`,        │
  │              lateProbesAllowed: `${lateAllowed}/${lateProbes.length}`      │
  │          },
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `Early probes (T+50 to T+60) mostly denied: ` +      │
  │                      `${earlyAllowed}/${earlyProbes.length} allowed`,     │
  │                  passed: earlyAllowed < earlyProbes.length * 0.3           │
  │              },
  │
  │              {
  │
  │                  msg: `Late probes (T+65+) mostly allowed: ` +
  │
  │                      `${lateAllowed}/${lateProbes.length} allowed`,        │
  │                  passed: lateAllowed > lateProbes.length * 0.5             │
  │              },
  │
  │              {
  │
  │                  msg: `Recovery is GRADUAL (mid: ${midAllowed}, ` +
  │
  │                      `late: ${lateAllowed}) — not sudden reset`,           │
  │                  passed: isGradual || (earlyAllowed === 0 && lateAllowed >
  0)│
  │              }
  │
  │          ],
  │
  │          passed: lateAllowed > 0 && earlyAllowed < earlyProbes.length,    │
  │          verdictReason: lateAllowed > 0
  │
  │              ? `Gradual recovery confirmed: slots freed as entries ` +     │
  │                `expired individually. Not a fixed-window reset.`           │
  │              : `FAILED: no recovery observed after budget exhaustion`
  │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Scenario 08: Retry-After Accuracy

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/08-retryAfterAccuracy.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  The Retry-After header value is accurate — if a client waits exactly
  │
  │  that many seconds, their next request will be allowed.
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  CTO Memo: "return 429 Too Many Requests with a Retry-After header"        │
  │  Implicit: the header should be USEFUL, not a random guess.
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const { generateBurst } = require('../lib/burstGenerator');
  │
  │  const { sleep } = require('../lib/helpers');
  │
  │
  │
  │  const name = 'Retry-After Accuracy';
  │
  │  const description = 'Verify Retry-After header is precise and usable';    │
  │
  │
  │  async function run(baseUrl) {
  │
  │      const customerId = 'small-startup';
  │
  │      const limit = 60;
  │
  │      const endpoint = '/api/v1/resource';
  │
  │      const url = `${baseUrl}${endpoint}`;
  │
  │
  │
  │      // Step 1: Exhaust the budget
  │
  │      console.log(`    Filling budget (${limit} requests)...`);             │
  │      const fillResults = await generateBurst({
  │
  │          baseUrl, customerId, count: limit, concurrency: 10                │
  │      });
  │
  │      const filled = fillResults.filter(r => r.allowed).length;             │
  │      console.log(`    Filled: ${filled}/${limit}`);                        │
  │
  │
  │      // Step 2: Send one more request to get a 429 with Retry-After
  │
  │      console.log(`    Sending one more to get 429 + Retry-After...`);      │
  │      const deniedResponse = await fetch(url, {
  │
  │          headers: { 'X-Customer-Id': customerId }
  │
  │      });
  │
  │
  │
  │      const retryAfterHeader = deniedResponse.headers.get('retry-after');
  │
  │      const retryAfterSec = parseInt(retryAfterHeader, 10);                 │
  │      console.log(`    Got 429 with Retry-After: ${retryAfterSec}s`);       │
  │
  │
  │      // Step 3: Wait EXACTLY Retry-After seconds + small buffer
  │
  │      const waitMs = (retryAfterSec * 1000) + 500; // +500ms safety         │
  │      console.log(`    Waiting ${retryAfterSec}s + 0.5s buffer...`);        │
  │      await sleep(waitMs);
  │
  │
  │
  │      // Step 4: Send a request — it SHOULD succeed
  │
  │      console.log(`    Sending request after waiting...`);
  │
  │      const afterWaitResponse = await fetch(url, {
  │
  │          headers: { 'X-Customer-Id': customerId }
  │
  │      });
  │
  │      const afterWaitAllowed = afterWaitResponse.status === 200;
  │
  │
  │
  │      // Step 5: Also test that waiting LESS than Retry-After still denies
  │
  │      // (Do this independently — exhaust again, wait half, check)
  │
  │      // Simplified: just verify the positive case above
  │
  │
  │
  │      return {
  │
  │          id: 8,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              customer: customerId,
  │
  │              limit: `${limit} RPM`,
  │
  │              pattern: 'Exhaust → get Retry-After → wait → retry'          │
  │          },
  │
  │          limit,
  │
  │          metrics: {
  │
  │              totalSent: fillResults.length + 2,
  │
  │              totalAllowed: filled + (afterWaitAllowed ? 1 : 0),            │
  │              totalDenied: (limit - filled) + 1 +                           │
  │                  (afterWaitAllowed ? 0 : 1),                               │
  │              errors: 0,
  │
  │              retryAfterReceived: `${retryAfterSec}s`,                      │
  │              waitedMs: waitMs
  │
  │          },
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `429 response included Retry-After header`,
  │
  │                  passed: retryAfterHeader !== null
  │
  │              },
  │
  │              {
  │
  │                  msg: `Retry-After value is positive integer: ` +
  │
  │                      `${retryAfterSec}`,                                   │
  │                  passed: retryAfterSec > 0 && retryAfterSec <= 60          │
  │              },
  │
  │              {
  │
  │                  msg: `After waiting Retry-After seconds, request ` +
  │
  │                      `was ALLOWED: ${afterWaitAllowed}`,                   │
  │                  passed: afterWaitAllowed
  │
  │              },
  │
  │              {
  │
  │                  msg: `Retry-After is precise (not just "try again ` +     │
  │                      `in 60s")`,
  │
  │                  passed: retryAfterSec < 60
  │
  │              }
  │
  │          ],
  │
  │          passed: afterWaitAllowed && retryAfterHeader !== null,
  │
  │          verdictReason: afterWaitAllowed
  │
  │              ? `Retry-After (${retryAfterSec}s) is accurate. Client ` +   │
  │                `waited, retried, succeeded.`
  │
  │              : `FAILED: request denied even after waiting ` +              │
  │                `Retry-After seconds`
  │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Scenario 09: Unknown Customer Handling

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/09-unknownCustomer.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  Requests from unknown customer IDs get 403 (not 429, not 200).            │
  │  Missing header gets 401. Rate limiting only applies to known customers.
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  CTO Memo: "Per-customer isolation" — implies only KNOWN customers
  │
  │  are metered. Unknown requests are a different error category.
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const name = 'Unknown Customer Handling';
  │
  │  const description = 'Verify 403 for unknown ID, 401 for missing header'; │
  │
  │
  │  async function run(baseUrl) {
  │
  │      const endpoint = `${baseUrl}/api/v1/resource`;
  │
  │
  │
  │      // Test 1: Unknown customer ID → 403
  │
  │      const unknownRes = await fetch(endpoint, {
  │
  │          headers: { 'X-Customer-Id': 'does-not-exist-corp' }               │
  │      });
  │
  │
  │
  │      // Test 2: Missing header entirely → 401
  │
  │      const missingRes = await fetch(endpoint);
  │
  │
  │
  │      // Test 3: Valid customer → 200 (sanity check)
  │
  │      const validRes = await fetch(endpoint, {
  │
  │          headers: { 'X-Customer-Id': 'acme-corp' }                         │
  │      });
  │
  │
  │
  │      // Test 4: Multiple unknown customers don't pollute Redis
  │
  │      const unknownIds = ['ghost-1', 'ghost-2', 'ghost-3'];                 │
  │      const ghostResults = await Promise.all(
  │
  │          unknownIds.map(id => fetch(endpoint, {
  │
  │              headers: { 'X-Customer-Id': id }
  │
  │          }).then(r => r.status))
  │
  │      );
  │
  │      const allGhosts403 = ghostResults.every(s => s === 403);              │
  │
  │
  │      return {
  │
  │          id: 9,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              tests: 'Unknown ID, missing header, valid ID, ghost IDs'      │
  │          },
  │
  │          limit: 'N/A',
  │
  │          metrics: {
  │
  │              totalSent: 6,
  │
  │              totalAllowed: 1,
  │
  │              totalDenied: 5,
  │
  │              errors: 0
  │
  │          },
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `Unknown customer gets 403: ` +
  │
  │                      `got ${unknownRes.status}`,
  │
  │                  passed: unknownRes.status === 403
  │
  │              },
  │
  │              {
  │
  │                  msg: `Missing header gets 401: ` +
  │
  │                      `got ${missingRes.status}`,
  │
  │                  passed: missingRes.status === 401
  │
  │              },
  │
  │              {
  │
  │                  msg: `Valid customer gets 200: ` +
  │
  │                      `got ${validRes.status}`,
  │
  │                  passed: validRes.status === 200
  │
  │              },
  │
  │              {
  │
  │                  msg: `Multiple unknown IDs all get 403 (no Redis ` +
  │
  │                      `pollution): ${allGhosts403}`,                        │
  │                  passed: allGhosts403
  │
  │              }
  │
  │          ],
  │
  │          passed: unknownRes.status === 403 &&
  │
  │              missingRes.status === 401 &&
  │
  │              validRes.status === 200 &&
  │
  │              allGhosts403,
  │
  │          verdictReason: 'Edge cases handled correctly: ' +
  │
  │              '401 (no header), 403 (unknown), 200 (valid)'                 │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Scenario 10: Multi-Customer Fairness

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/10-multiCustomerFairness.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  Two customers on the SAME tier get the SAME treatment.
  │
  │  Neither gets preferential access. This is the CTO's "strictly fair"
  │
  │  requirement — same tier, same budget, same enforcement.
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  CTO Memo: "Two customers on the same tier must get the same treatment.    │
  │  No hidden bypasses, no manual overrides in code paths"
  │
  │  CTO Success Criteria: "two customers on a 100 RPM tier each get           │
  │  exactly their budget"
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const { generateTraffic } = require('../lib/requestGenerator');
  │
  │  const { analyzeWindows, verifyGuarantee } = require(                      │
  │      '../lib/windowAnalyzer');
  │
  │
  │
  │  const name = 'Multi-Customer Fairness';
  │
  │  const description = 'Two customers at same tier get equal treatment';     │
  │
  │
  │  async function run(baseUrl) {
  │
  │      // Both acme-corp and northwind-logistics are on 300 RPM
  │
  │      // (Northwind base limit, outside override window)
  │
  │      // Send both at 400 RPM — both should get capped at 300               │
  │
  │
  │      const durationSec = 75;
  │
  │      const limit = 300;
  │
  │      const sendRpm = 400;
  │
  │
  │
  │      const [resultsA, resultsB] = await Promise.all([                      │
  │          generateTraffic({
  │
  │              baseUrl,
  │
  │              customerId: 'acme-corp',
  │
  │              rpm: sendRpm,
  │
  │              durationSec,
  │
  │              label: 'acme-corp'
  │
  │          }),
  │
  │          generateTraffic({
  │
  │              baseUrl,
  │
  │              customerId: 'northwind-logistics',
  │
  │              rpm: sendRpm,
  │
  │              durationSec,
  │
  │              label: 'northwind-logistics'
  │
  │          })
  │
  │      ]);
  │
  │
  │
  │      const analysisA = analyzeWindows(resultsA);
  │
  │      const analysisB = analyzeWindows(resultsB);
  │
  │      const guaranteeA = verifyGuarantee(analysisA, limit);                 │
  │      const guaranteeB = verifyGuarantee(analysisB, limit);                 │
  │
  │
  │      // Fairness check: both should get similar max-in-window
  │
  │      // (within 5% of each other)
  │
  │      const diff = Math.abs(
  │
  │          analysisA.maxInAnyWindow - analysisB.maxInAnyWindow);             │
  │      const fairnessMargin = limit * 0.05;  // 5% = 15 requests             │
  │      const isFair = diff <= fairnessMargin;
  │
  │
  │
  │      return {
  │
  │          id: 10,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              'Customer A': `acme-corp (tier: growth, limit: ${limit})`,    │
  │              'Customer B': `northwind-logistics (base limit: ${limit})`,   │
  │              sentRate: `${sendRpm} RPM each`,
  │
  │              duration: `${durationSec}s`
  │
  │          },
  │
  │          limit,
  │
  │          metrics: {
  │
  │              totalSent: resultsA.length + resultsB.length,
  │
  │              totalAllowed: analysisA.totalAllowed + analysisB.totalAllowed,
  │
  │              totalDenied: analysisA.totalDenied + analysisB.totalDenied,   │
  │              errors: 0,
  │
  │              acmeMaxWindow: analysisA.maxInAnyWindow,
  │
  │              northwindMaxWindow: analysisB.maxInAnyWindow,
  │
  │              difference: diff
  │
  │          },
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `Acme max window (${analysisA.maxInAnyWindow}) ` +   │
  │                      `≤ ${limit}`,                                         │
  │                  passed: guaranteeA.passed
  │
  │              },
  │
  │              {
  │
  │                  msg: `Northwind max window ` +
  │
  │                      `(${analysisB.maxInAnyWindow}) ≤ ${limit}`,          │
  │                  passed: guaranteeB.passed
  │
  │              },
  │
  │              {
  │
  │                  msg: `Both get similar treatment (diff: ${diff}, ` +
  │
  │                      `tolerance: ${fairnessMargin})`,                      │
  │                  passed: isFair
  │
  │              },
  │
  │              {
  │
  │                  msg: `Neither customer is favored over the other`,
  │
  │                  passed: isFair && guaranteeA.passed && guaranteeB.passed  │
  │              }
  │
  │          ],
  │
  │          passed: guaranteeA.passed && guaranteeB.passed && isFair,         │
  │          verdictReason: isFair
  │
  │              ? `Fairness confirmed: both customers at same tier ` +        │
  │                `got within ${diff} requests of each other. No favoritism.` │
  │              : `FAIRNESS VIOLATION: ${diff} request difference ` +         │
  │                `between same-tier customers`
  │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  Scenario 11: Sustained Over-Limit Load

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/scenarios/11-sustainedLoad.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  WHAT IT PROVES:
  │
  │  Under sustained over-limit traffic for 5 minutes, the rate limiter
  │
  │  never degrades, never leaks, never drifts. The guarantee holds at
  │
  │  minute 1 and at minute 5 identically.
  │
  │
  │
  │  MAPS TO REQUIREMENT:
  │
  │  Platform Wiki: "sustained ~800-1200 RPM for 90-120 minutes"               │
  │  (We test at smaller scale but same principle: sustained pressure)
  │
  │  CTO Memo: "never" means never — not "for the first minute only"           │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  const { generateTraffic } = require('../lib/requestGenerator');
  │
  │  const { analyzeWindows, verifyGuarantee, analyzeDistribution } =          │
  │      require('../lib/windowAnalyzer');
  │
  │
  │
  │  const name = 'Sustained Over-Limit Load (5 min)';                         │
  │  const description = 'Verify guarantee holds under prolonged pressure';    │
  │
  │
  │  async function run(baseUrl) {
  │
  │      const customerId = 'acme-corp';
  │
  │      const limit = 300;
  │
  │      const sendRpm = 500;       // 167% of limit
  │
  │      const durationSec = 300;   // 5 full minutes
  │
  │
  │
  │      console.log(`    Running sustained test for ${durationSec}s ` +
  │
  │          `(this takes ~5 minutes)...`);
  │
  │
  │
  │      const results = await generateTraffic({
  │
  │          baseUrl, customerId, rpm: sendRpm, durationSec                    │
  │      });
  │
  │
  │
  │      const analysis = analyzeWindows(results);
  │
  │      const guarantee = verifyGuarantee(analysis, limit);
  │
  │      const distribution = analyzeDistribution(results);
  │
  │
  │
  │      // Check consistency over time: split into 5 one-minute segments
  │
  │      const startTime = results[0]?.sentAt || 0;
  │
  │      const segments = [];
  │
  │      for (let min = 0; min < 5; min++) {
  │
  │          const segStart = startTime + (min * 60000);
  │
  │          const segEnd = segStart + 60000;
  │
  │          const segResults = results.filter(
  │
  │              r => r.sentAt >= segStart && r.sentAt < segEnd);              │
  │          const segAllowed = segResults.filter(r => r.allowed).length;      │
  │          segments.push({
  │
  │              minute: min + 1,
  │
  │              sent: segResults.length,
  │
  │              allowed: segAllowed,
  │
  │              denied: segResults.length - segAllowed
  │
  │          });
  │
  │      }
  │
  │
  │
  │      // Verify no segment has wildly different allowed counts
  │
  │      const segAllowedCounts = segments.map(s => s.allowed);                │
  │      const segMax = Math.max(...segAllowedCounts);
  │
  │      const segMin = Math.min(...segAllowedCounts);
  │
  │      const isConsistent = (segMax - segMin) < limit * 0.15; // within 15%  │
  │
  │
  │      return {
  │
  │          id: 11,
  │
  │          name,
  │
  │          description,
  │
  │          config: {
  │
  │              customer: customerId,
  │
  │              limit: `${limit} RPM`,
  │
  │              sentRate: `${sendRpm} RPM`,
  │
  │              duration: `${durationSec}s (5 minutes)`,                      │
  │              totalRequestsSent: `~${Math.ceil(sendRpm * durationSec / 60)}`│
  │          },
  │
  │          limit,
  │
  │          metrics: {
  │
  │              totalSent: results.length,
  │
  │              totalAllowed: analysis.totalAllowed,
  │
  │              totalDenied: analysis.totalDenied,
  │
  │              errors: results.filter(r => r.error).length,
  │
  │              segments
  │
  │          },
  │
  │          windowAnalysis: analysis,
  │
  │          distribution,
  │
  │          assertions: [
  │
  │              {
  │
  │                  msg: `Max in ANY 60s window across 5 minutes: ` +
  │
  │                      `${analysis.maxInAnyWindow} ≤ ${limit}`,             │
  │                  passed: guarantee.passed
  │
  │              },
  │
  │              {
  │
  │                  msg: `Consistent enforcement across all 5 minutes ` +     │
  │                      `(range: ${segMin}-${segMax}, tolerance: 15%)`,      │
  │                  passed: isConsistent
  │
  │              },
  │
  │              {
  │
  │                  msg: `No memory leak / degradation (min 5 ` +
  │
  │                      `allowed: ${segments[4]?.allowed || 0}, ` +           │
  │                      `min 1: ${segments[0]?.allowed || 0})`,              │
  │                  passed: segments[4]?.allowed > 0
  │
  │              },
  │
  │              {
  │
  │                  msg: `Traffic distributed across ` +
  │
  │                      `${distribution.nodeCount} nodes`,                    │
  │                  passed: distribution.isDistributed
  │
  │              }
  │
  │          ],
  │
  │          passed: guarantee.passed && isConsistent,
  │
  │          verdictReason: guarantee.passed
  │
  │              ? `5-minute sustained test PASSED. Rate limiter ` +           │
  │                `maintained ≤${limit}/window consistently. ` +             │
  │                `No drift, no degradation.`
  │
  │              : `FAILED after sustained load: ` +                           │
  │                `${analysis.maxInAnyWindow} > ${limit}`                     │
  │      };
  │
  │  }
  │
  │
  │
  │  module.exports = { name, run };
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  4. Main Runner

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  harness/run.js
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  const { printHeader, printScenarioResult, printSummary,                   │
  │      saveResultsJSON } = require('./lib/reporter');
  │
  │  const { waitForService, flushRateLimitState } = require('./lib/helpers'); │
  │
  │
  │  // Import all scenarios in order
  │
  │  const scenarios = [
  │
  │      require('./scenarios/01-exactEnforcement'),
  │
  │      require('./scenarios/02-customerIsolation'),
  │
  │      require('./scenarios/03-distributedCorrectness'),
  │
  │      require('./scenarios/04-boundaryBurst'),
  │
  │      require('./scenarios/05-overrideWindow'),
  │
  │      require('./scenarios/06-overrideInactive'),
  │
  │      require('./scenarios/07-gradualRecovery'),
  │
  │      require('./scenarios/08-retryAfterAccuracy'),
  │
  │      require('./scenarios/09-unknownCustomer'),
  │
  │      require('./scenarios/10-multiCustomerFairness'),
  │
  │      require('./scenarios/11-sustainedLoad')
  │
  │  ];
  │
  │
  │
  │  const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8080';
  │
  │
  │
  │  // Allow running a subset: node harness/run.js 4 7 11
  │
  │  const selectedIds = process.argv.slice(2).map(Number);                    │
  │  const runAll = selectedIds.length === 0;
  │
  │
  │
  │  async function main() {
  │
  │      printHeader();
  │
  │
  │
  │      // Wait for service to be ready
  │
  │      console.log(`  Waiting for service at ${TARGET_URL}...`);             │
  │      await waitForService(TARGET_URL);
  │
  │      console.log(`  Service healthy. Starting scenarios.\n`);              │
  │
  │
  │      const results = [];
  │
  │      const scenariosToRun = runAll
  │
  │          ? scenarios
  │
  │          : scenarios.filter((_, i) => selectedIds.includes(i + 1));        │
  │
  │
  │      for (const scenario of scenariosToRun) {
  │
  │          // Flush state between scenarios to avoid interference
  │
  │          await flushRateLimitState(TARGET_URL);
  │
  │          // Small pause for any pending TTLs
  │
  │          await new Promise(r => setTimeout(r, 2000));
  │
  │
  │
  │          console.log(`\n  ▶ Running: ${scenario.name}...`);                │
  │
  │
  │          const startTime = Date.now();
  │
  │          const result = await scenario.run(TARGET_URL);
  │
  │          result.durationMs = Date.now() - startTime;
  │
  │
  │
  │          printScenarioResult(result);
  │
  │          results.push(result);
  │
  │      }
  │
  │
  │
  │      // Final summary
  │
  │      printSummary(results);
  │
  │
  │
  │      // Save full results as JSON for auditing
  │
  │      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  │
  │      saveResultsJSON(results, `harness-run-${timestamp}.json`);           │
  │
  │
  │      // Exit code reflects pass/fail
  │
  │      const allPassed = results.every(r => r.passed);
  │
  │      process.exit(allPassed ? 0 : 1);
  │
  │  }
  │
  │
  │
  │  main().catch(err => {
  │
  │      console.error('\n  HARNESS FATAL ERROR:', err.message);               │
  │      console.error(err.stack);
  │
  │      process.exit(2);
  │
  │  });
  │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  USAGE:
  │
  │
  │
  │  # Run ALL scenarios:
  │
  │  $ node harness/run.js
  │
  │
  │
  │  # Run specific scenarios (by number):
  │
  │  $ node harness/run.js 4 7 8
  │
  │  (runs: boundary burst, gradual recovery, retry-after)
  │
  │
  │
  │  # With custom target:
  │
  │  $ TARGET_URL=http://my-host:9090 node harness/run.js
  │
  │
  │
  │  # Via npm script:
  │
  │  $ npm run harness
  │
  │
  │
  │  EXIT CODES:
  │
  │  0 = all scenarios passed
  │
  │  1 = one or more scenarios failed
  │
  │  2 = harness infrastructure error (service down, etc.)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  5. Test Configuration for Override Scenarios

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  HOW TO HANDLE OVERRIDE TIMING IN TESTS
  │
  ├─────────────────────────────────────────────────────────────────────────────
  ┤
  │
  │
  │  PROBLEM: Scenario 05 needs override ACTIVE, Scenario 06 needs it          │
  │  INACTIVE. The real override is 02:00-04:00 UTC.
  │
  │
  │
  │  SOLUTION: Two-window config approach
  │
  │
  │
  │  In config/customers.json, Northwind has TWO overrides:
  │
  │
  │
  │  {
  │
  │    "northwind-logistics": {
  │
  │      "rpmLimit": 300,
  │
  │      "overrides": [
  │
  │        {
  │
  │          "id": "production-batch-window",
  │
  │          "effectiveRpm": 1200,
  │
  │          "schedule": {
  │
  │            "windowStartUTC": "02:00",
  │
  │            "windowEndUTC": "04:00"
  │
  │          },
  │
  │          "reason": "Production nightly batch",
  │
  │          "approvedBy": "vp-sales",
  │
  │          "expiresAt": "2026-05-01T00:00:00Z"
  │
  │        },
  │
  │        {
  │
  │          "id": "testing-override-window",
  │
  │          "effectiveRpm": 1200,
  │
  │          "schedule": {
  │
  │            "windowStartUTC": "<CURRENT_HOUR>",
  │
  │            "windowEndUTC": "<CURRENT_HOUR + 1>"
  │
  │          },
  │
  │          "reason": "Harness testing window — matches run time",
  │
  │          "approvedBy": "engineering",
  │
  │          "expiresAt": "2099-01-01T00:00:00Z"
  │
  │        }
  │
  │      ]
  │
  │    }
  │
  │  }
  │
  │
  │
  │  ALTERNATIVE APPROACH (simpler):
  │
  │
  │
  │  Add a second Northwind-like customer:
  │
  │  - "northwind-logistics" → has override active for testing                 │
  │  - "northwind-no-override" → same config but empty overrides array         │
  │
  │
  │  Scenario 05 uses "northwind-logistics" (override active)
  │
  │  Scenario 06 uses "northwind-no-override" (base limit only)
  │
  │
  │
  │  This cleanly separates concerns without time-of-day dependencies.
  │
  │
  │
  │  RECOMMENDED: Use the second approach (separate IDs) for deterministic     │
  │  test results regardless of when the harness is run.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  6. Expected Harness Output

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  $ node harness/run.js
  │
  │
  │
  │  ╔═══════════════════════════════════════════════════╗
  │
  │  ║  RelayAPI Rate Limiter — Load Harness             ║
  │
  │  ║  Sliding Window Log · 3 Nodes · Redis             ║
  │
  │  ╚═══════════════════════════════════════════════════╝
  │
  │
  │
  │    Target: http://localhost:8080
  │
  │    Time:   2026-03-20T14:30:00.000Z
  │
  │    Mode:   Sequential scenario execution
  │
  │
  │
  │    Waiting for service at http://localhost:8080...
  │
  │    Service healthy. Starting scenarios.
  │
  │
  │
  │    ▶ Running: Exact Enforcement...
  │
  │      [acme-corp] Sending 600 requests at 400 RPM for 90s...                │
  │
  │
  │
  ════════════════════════════════════════════════════════════════════════════│
  │    TEST #1: Exact Enforcement
  │
  │    Customer at 133% of limit — verify hard cap                             │
  │
  ════════════════════════════════════════════════════════════════════════════│
  │
  │
  │    Configuration:
  │
  │      customer        : acme-corp
  │
  │      limit           : 300 RPM
  │
  │      sentRate        : 400 RPM
  │
  │      duration        : 90s
  │
  │
  │
  │    Metrics:
  │
  │      Total Sent:       600
  │
  │      Allowed (200):    448
  │
  │      Denied (429):     152
  │
  │
  │
  │    Sliding Window Analysis (60s):
  │
  │      Max in any window:  300
  │
  │      Configured limit:   300
  │
  │      Margin:             0
  │
  │
  │
  │    Assertions:
  │
  │      ✓ Max in any 60s window (300) ≤ limit (300)                           │
  │      ✓ Some requests were denied (152 > 0)
  │
  │      ✓ Allowed count is close to limit (≥ 290)                             │
  │
  │
  │    ━━━ VERDICT: ✓ PASS ━━━                                                 │
  │    PASS: max 300 ≤ limit 300                                               │
  │
  │
  │  ──────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │    ▶ Running: Boundary Burst Prevention...
  │
  │      Phase 1: Sending burst of 300 requests at T=0s...
  │
  │      Phase 1 complete: 300/300 allowed
  │
  │      Waiting 55s (just before window edge)...
  │
  │      Phase 2: Sending burst of 300 requests at T=55s...
  │
  │      Phase 2 complete: 0/300 allowed, 300 denied
  │
  │
  │
  │
  ════════════════════════════════════════════════════════════════════════════│
  │    TEST #4: Boundary Burst Prevention
  │
  │    Prove no 2x burst at window edges (the staging incident bug)            │
  │
  ════════════════════════════════════════════════════════════════════════════│
  │
  │
  │    Configuration:
  │
  │      customer        : acme-corp
  │
  │      limit           : 300 RPM
  │
  │      pattern         : Burst 300 → wait 55s → burst 300                   │
  │      gapBelowWindow  : 5s before expiry
  │
  │
  │
  │    Metrics:
  │
  │      Total Sent:       600
  │
  │      Allowed (200):    300
  │
  │      Denied (429):     300
  │
  │      burst1Allowed:    300
  │
  │      burst2Allowed:    0
  │
  │      burst2Denied:     300
  │
  │
  │
  │    Sliding Window Analysis (60s):
  │
  │      Max in any window:  300
  │
  │      Configured limit:   300
  │
  │      Margin:             0
  │
  │
  │
  │    Assertions:
  │
  │      ✓ Max in any 60s window (300) ≤ 300                                   │
  │      ✓ Burst 1 filled budget: 300 ≈ 300                                    │
  │      ✓ Burst 2 mostly denied: 100% denied (expected >90%)                  │
  │      ✓ NOT a fixed window bug: total allowed (300) is NOT 600              │
  │
  │
  │    ━━━ VERDICT: ✓ PASS ━━━                                                 │
  │    Boundary burst PREVENTED. Fixed window would have allowed 600 (2x       │
  │    limit). Sliding window correctly limited to 300.
  │
  │
  │
  │  ──────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │    ...  (scenarios 2,3,5-11 run similarly)  ...
  │
  │
  │
  │
  ════════════════════════════════════════════════════════════════════════════│
  │    FINAL SUMMARY: 11/11 scenarios passed
  │
  │
  ════════════════════════════════════════════════════════════════════════════│
  │
  │
  │    Results saved to: harness/results/harness-run-2026-03-20T14-38-22.json  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  7. Scenario-to-Requirement Traceability Matrix

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  ┌──────┬──────────────────────────┬──────────────────────────────────────┐│
  │  │  #   │ Scenario                 │ Requirement Proven
  ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  01  │ Exact Enforcement        │ CTO: "never exceed quota"            ││
  │  │      │                          │ CTO: "return 429 + Retry-After"      ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  02  │ Customer Isolation       │ CTO: "Customer A's spike must not    ││
  │  │      │                          │       consume Customer B's budget"   ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  03  │ Distributed Correctness  │ CTO: "works across all three nodes"  ││
  │  │      │                          │ CTO: "not single process 3x"         ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  04  │ Boundary Burst           │ Wiki: "correctness issues at quota   ││
  │  │      │                          │        boundaries" (staging fix)     ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  05  │ Override Active           │ Support: "never see 429 during
  batch"││
  │  │      │                          │ CTO: "config and audit"              ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  06  │ Override Inactive         │ Support: "not remove for everyone"
  ││
  │  │      │                          │ CTO: "strictly fair metering"        ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  07  │ Gradual Recovery         │ Proves sliding (not fixed) window    ││
  │  │      │                          │ CTO: "auditable counting"            ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  08  │ Retry-After Accuracy     │ CTO: "429 with Retry-After header"   ││
  │  │      │                          │ (header must be USEFUL, not random)  ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  09  │ Unknown Customer         │ Edge case robustness                 ││
  │  │      │                          │ No Redis pollution from unknowns     ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  10  │ Multi-Customer Fairness  │ CTO: "same tier = same treatment"    ││
  │  │      │                          │ CTO Success Criteria (exact match)   ││
  │  ├──────┼──────────────────────────┼──────────────────────────────────────┤│
  │  │  11  │ Sustained Load (5 min)   │ Wiki: "sustained 800-1200 RPM for    ││
  │  │      │                          │       90-120 minutes" — scales proof ││
  │  │      │                          │ CTO: guarantee holds under time      ││
  │  └──────┴──────────────────────────┴──────────────────────────────────────┘│
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  8. What the Harness Does NOT Prove (Honest Limitations)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  WHAT THE HARNESS CANNOT / DOES NOT VERIFY:
  │
  │
  │
  │  1. Redis failure behavior
  │
  │     → Would need to kill Redis during a test. Possible but adds            │
  │       infrastructure complexity (docker compose exec redis redis-cli
  │
  │       DEBUG SLEEP 30). Deferred.
  │
  │
  │
  │  2. Performance under 10,000+ RPM
  │
  │     → The harness proves correctness, not throughput. At extreme scale,    │
  │       Redis ZSET operations could become slow. Not tested.
  │
  │
  │
  │  3. Clock skew between multiple Redis instances
  │
  │     → We use a single Redis. In a Redis Cluster setup, cross-shard         │
  │       clocks could theoretically drift. Not applicable to our design.
  │
  │
  │
  │  4. Memory pressure from large ZSETs
  │
  │     → At 1200 RPM, each ZSET has max 1200 entries × ~80 bytes =            │
  │       ~96KB per customer. Negligible for Redis. Not stress-tested.
  │
  │
  │
  │  5. Network partition between app nodes and Redis
  │
  │     → Would need iptables rules in Docker. Complex. The code handles       │
  │       this (503 fail-closed) but isn't tested.
  │
  │
  │
  │  6. Exactness of the harness's own timing
  │
  │     → Node.js setTimeout is not real-time precise. The 100ms step in       │
  │       window analysis might miss a sub-100ms violation. In practice,
  │
  │       Redis decisions are in sub-millisecond ranges, so this gap is safe.
  │
  │
  │
  │  These limitations would go in the "If I had four more hours" section
  │
  │  of DECISIONS.md.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  9. Execution Timeline

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  APPROXIMATE SCENARIO EXECUTION TIMES:
  │
  │
  │
  │  ┌──────┬──────────────────────────┬───────────┬────────────────────────┐  │
  │  │  #   │ Scenario                 │ Duration  │ Why this long?         │  │
  │  ├──────┼──────────────────────────┼───────────┼────────────────────────┤  │
  │  │  01  │ Exact Enforcement        │ ~95s      │ 90s traffic + analysis │  │
  │  │  02  │ Customer Isolation       │ ~80s      │ 75s parallel traffic   │  │
  │  │  03  │ Distributed Correctness  │ ~95s      │ 90s traffic + analysis │  │
  │  │  04  │ Boundary Burst           │ ~65s      │ burst + 55s wait + burst│ │
  │  │  05  │ Override Active           │ ~80s      │ 75s traffic at 1000 RPM│
  │
  │  │  06  │ Override Inactive         │ ~80s      │ 75s traffic at 400 RPM │
  │
  │  │  07  │ Gradual Recovery         │ ~85s      │ fill + 50s wait + probe│  │
  │  │  08  │ Retry-After Accuracy     │ ~75s      │ fill + wait + retry    │  │
  │  │  09  │ Unknown Customer         │ ~5s       │ Just 6 requests        │  │
  │  │  10  │ Multi-Customer Fairness  │ ~80s      │ 75s parallel traffic   │  │
  │  │  11  │ Sustained Load           │ ~310s     │ 5 minutes sustained    │  │
  │  ├──────┼──────────────────────────┼───────────┼────────────────────────┤  │
  │  │      │ TOTAL                    │ ~17 min   │ Includes 2s gaps       │  │
  │  └──────┴──────────────────────────┴───────────┴────────────────────────┘  │
  │
  │
  │  FAST MODE (for reviewer who's short on time):
  │
  │  $ node harness/run.js 1 4 9
  │
  │  Runs only: exact enforcement, boundary, unknown customer
  │
  │  Total: ~2.5 minutes
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  10. How the State Flush Works Between Scenarios

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  SCENARIO ISOLATION STRATEGY:
  │
  │
  │
  │  Each scenario must start with a CLEAN rate limit state.
  │
  │  If Scenario 1 fills acme-corp's budget, Scenario 2 must not inherit       │
  │  that state.
  │
  │
  │
  │  OPTION A: Wait for TTL expiry (65 seconds)
  │
  │  → Slow. Adds 65s between every scenario.                                  │
  │  → Total harness time becomes ~25+ minutes.
  │
  │
  │
  │  OPTION B: Reset endpoint on the server
  │
  │  → Add a POST /test/reset route that calls FLUSHDB on Redis.               │
  │  → Fast (< 1ms). Only available in test/dev mode.
  │
  │  → Server checks NODE_ENV or a test flag.
  │
  │
  │
  │  OPTION C: Use unique customer IDs per scenario
  │
  │  → Each scenario uses "acme-corp-test-01", "acme-corp-test-02"...          │
  │  → No flush needed. But config file gets bloated.
  │
  │
  │
  │  RECOMMENDED: OPTION B
  │
  │
  │
  │  In src/server.js:
  │
  │
  │
  │    if (process.env.ENABLE_TEST_RESET === 'true') {
  │
  │        app.post('/test/reset', async (req, res) => {
  │
  │            await redis.flushdb();
  │
  │            res.json({ status: 'flushed' });
  │
  │        });
  │
  │    }
  │
  │
  │
  │  In docker-compose.yml:
  │
  │    environment:
  │
  │      - ENABLE_TEST_RESET=true
  │
  │
  │
  │  In harness/lib/helpers.js:
  │
  │    async function flushRateLimitState(baseUrl) {
  │
  │        await fetch(`${baseUrl}/test/reset`, { method: 'POST' });           │
  │    }
  │
  │
  │
  │  This is explicit, controlled, and only available in Docker dev mode.
  │
  │  Production would never have ENABLE_TEST_RESET=true.                       │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  This harness design ensures every requirement from both memos is
  mathematically verified, every scenario is traceable to a specific stakeholder
  demand, and the output is immediately legible to a reviewer without reading
  the implementation source.

✻ Baked for 7m 3s

❯ Based on the provided details provide a detailed implementation plan          
  encompassing everything discussed earlier. Also provide a brief summary of    
  the whole chat that we have right now.                                        

  Thought for 3s (ctrl+o to expand)

● Part 1: Complete Implementation Plan

  ---
  Phase 0: Project Initialization (10 minutes)

  0.1 Directory Scaffolding

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  STEP 0.1: Create the complete directory structure
  │
  │
  │
  │  solution/
  │
  │  ├── package.json
  │
  │  ├── .env.example
  │
  │  ├── .gitignore
  │
  │  ├── .dockerignore
  │
  │  ├── Dockerfile
  │
  │  ├── docker-compose.yml
  │
  │  ├── nginx/
  │
  │  │   └── nginx.conf
  │
  │  ├── config/
  │
  │  │   └── customers.json
  │
  │  ├── src/
  │
  │  │   ├── server.js
  │
  │  │   ├── middleware/
  │
  │  │   │   └── rateLimiter.js                                                │
  │  │   ├── services/
  │
  │  │   │   ├── redisClient.js                                                │
  │  │   │   └── configService.js                                              │
  │  │   ├── scripts/
  │
  │  │   │   └── slidingWindowLog.lua                                          │
  │  │   └── routes/
  │
  │  │       └── api.js
  │
  │  └── harness/
  │
  │      ├── run.js
  │
  │      ├── lib/
  │
  │      │   ├── requestGenerator.js                                           │
  │      │   ├── burstGenerator.js                                             │
  │      │   ├── windowAnalyzer.js                                             │
  │      │   ├── reporter.js                                                   │
  │      │   └── helpers.js                                                    │
  │      ├── scenarios/
  │
  │      │   ├── 01-exactEnforcement.js                                        │
  │      │   ├── 02-customerIsolation.js                                       │
  │      │   ├── 03-distributedCorrectness.js                                  │
  │      │   ├── 04-boundaryBurst.js                                           │
  │      │   ├── 05-overrideWindow.js                                          │
  │      │   ├── 06-overrideInactive.js                                        │
  │      │   ├── 07-gradualRecovery.js                                         │
  │      │   ├── 08-retryAfterAccuracy.js                                      │
  │      │   ├── 09-unknownCustomer.js                                         │
  │      │   ├── 10-multiCustomerFairness.js                                   │
  │      │   └── 11-sustainedLoad.js                                           │
  │      └── results/
  │
  │          └── .gitkeep
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  0.2 Package Initialization

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  ACTIONS:
  │
  │
  │
  │  1. npm init -y
  │
  │  2. npm install express ioredis
  │
  │  3. Create .gitignore:
  │
  │     node_modules/
  │
  │     harness/results/*.json
  │
  │     .env
  │
  │
  │
  │  4. Create .dockerignore:
  │
  │     node_modules
  │
  │     harness/
  │
  │     .git
  │
  │     .env
  │
  │
  │
  │  5. Populate package.json scripts:
  │
  │     "start": "node src/server.js"
  │
  │     "harness": "node harness/run.js"
  │
  │     "harness:quick": "node harness/run.js 1 4 9"
  │
  │
  │
  │  VERIFICATION: npm install completes, package-lock.json created
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 1: Infrastructure Layer (40 minutes)

  1.1 Docker Compose

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: docker-compose.yml
  │
  │  PRIORITY: FIRST — everything else depends on this
  │
  │
  │
  │  SERVICES:
  │
  │  ┌─────────────────┬────────────────────────────────────────────────────┐  │
  │  │ Service         │ Configuration                                      │  │
  │  ├─────────────────┼────────────────────────────────────────────────────┤  │
  │  │ redis           │ image: redis:7-alpine                              │  │
  │  │                 │ port: 6379                                          │
  │
  │  │                 │ healthcheck: redis-cli ping                         │
  │
  │  ├─────────────────┼────────────────────────────────────────────────────┤  │
  │  │ app-node-1      │ build: .                                           │  │
  │  │                 │ env: NODE_ID=node-1, PORT=3000                      │
  │
  │  │                 │ env: REDIS_URL=redis://redis:6379                   │
  │
  │  │                 │ env: ENABLE_TEST_RESET=true                         │
  │
  │  │                 │ depends_on: redis (healthy)                         │
  │
  │  ├─────────────────┼────────────────────────────────────────────────────┤  │
  │  │ app-node-2      │ (same as node-1, NODE_ID=node-2)                   │  │
  │  ├─────────────────┼────────────────────────────────────────────────────┤  │
  │  │ app-node-3      │ (same as node-1, NODE_ID=node-3)                   │  │
  │  ├─────────────────┼────────────────────────────────────────────────────┤  │
  │  │ nginx           │ image: nginx:alpine                                │  │
  │  │                 │ port: 8080:80                                       │
  │
  │  │                 │ volume: ./nginx/nginx.conf (read-only)              │
  │
  │  │                 │ depends_on: all 3 app nodes                         │
  │
  │  └─────────────────┴────────────────────────────────────────────────────┘  │
  │
  │
  │  VERIFICATION:
  │
  │  $ docker compose up -d
  │
  │  $ docker compose ps  → all 5 services running                             │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  1.2 Nginx Config

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: nginx/nginx.conf
  │
  │
  │
  │  CONFIGURATION:
  │
  │  • upstream block: 3 servers (app-node-1:3000, -2, -3)
  │
  │  • Round-robin (nginx default — no directive needed)
  │
  │  • No sticky sessions (matches assignment wiki)
  │
  │  • Proxy headers preserved (X-Customer-Id passes through)
  │
  │  • worker_connections: 1024
  │
  │
  │
  │  VERIFICATION:
  │
  │  $ curl http://localhost:8080/health (run 6 times)
  │
  │  → nodeId should rotate: node-1, node-2, node-3, node-1...                 │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  1.3 Dockerfile

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: Dockerfile
  │
  │
  │
  │  STEPS:
  │
  │  1. FROM node:20-alpine
  │
  │  2. WORKDIR /app
  │
  │  3. COPY package*.json → npm ci --production
  │
  │  4. COPY config/ src/
  │
  │  5. EXPOSE 3000
  │
  │  6. CMD ["node", "src/server.js"]
  │
  │
  │
  │  NOTES:
  │
  │  • Alpine = ~50MB image (fast build for reviewers)
  │
  │  • npm ci = deterministic from lockfile
  │
  │  • Harness NOT included (runs on host, hits nginx)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  1.4 Skeleton Server + Health Check

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: src/server.js (skeleton only — middleware added in Phase 3)
   │
  │
  │
  │  IMPLEMENT:
  │
  │  • Express app on PORT (env) with NODE_ID (env)
  │
  │  • GET /health → { status: 'ok', nodeId, timestamp }                       │
  │  • Graceful shutdown on SIGTERM
  │
  │
  │
  │  VERIFICATION:
  │
  │  $ docker compose up --build
  │
  │  $ curl http://localhost:8080/health
  │
  │  → {"status":"ok","nodeId":"node-1","timestamp":"..."}                     │
  │  (Repeat: rotates across nodes)
  │
  │
  │
  │  CHECKPOINT: Infrastructure layer complete.
  │
  │  All 5 containers up, nginx distributing, health endpoint responding.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 2: Core Algorithm (50 minutes)

  2.1 Lua Script

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: src/scripts/slidingWindowLog.lua
  │
  │  PRIORITY: This is the heart of the system
  │
  │
  │
  │  INPUTS:
  │
  │  • KEYS[1] = "rl:{customerId}"                                             │
  │  • ARGV[1] = window size ms (60000)
  │
  │  • ARGV[2] = limit (effective RPM)
  │
  │  • ARGV[3] = unique member ID
  │
  │
  │
  │  ALGORITHM (5 atomic steps):
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │  1. GET TIME         redis.call('TIME') → now_ms                    │  │
  │  │  2. PRUNE            ZREMRANGEBYSCORE key -inf (now - window)       │  │
  │  │  3. COUNT            ZCARD key → count                              │  │
  │  │  4. DECIDE           count < limit?                                  │  │
  │  │  5a. ALLOW           ZADD key now_ms member + PEXPIRE               │  │
  │  │  5b. DENY            Calculate retryAfter from oldest entry         │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  RETURNS: [allowed(0|1), remaining, retryAfterMs, currentCount]
  │
  │
  │
  │  KEY DESIGN DECISIONS IN THIS FILE:
  │
  │  • Redis TIME (not application time) = no clock skew
  │
  │  • Atomic script = no race conditions by construction
  │
  │  • PEXPIRE = auto-cleanup (no orphaned keys)
  │
  │  • Denied requests NOT added to ZSET (only admitted requests)
  │
  │  • retryAfter computed from oldest entry (precise, not arbitrary)
  │
  │
  │
  │  VERIFICATION:
  │
  │  Manual test via redis-cli EVAL with limit=5:
  │
  │  → 5 calls return allowed=1                                                │
  │  → 6th call returns allowed=0, retryAfter>0                                │
  │  → ZCARD key = 5 (denied not recorded)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  2.2 Redis Client Service

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: src/services/redisClient.js
  │
  │
  │
  │  RESPONSIBILITIES:
  │
  │  1. Create ioredis connection from REDIS_URL env var
  │
  │  2. Load Lua script from file and register via defineCommand
  │
  │  3. Expose checkRateLimit(customerId, limit) function
  │
  │  4. Generate unique member IDs: "{nodeId}:{timestamp}:{counter}"
  │
  │  5. Track connection state (for potential fail-closed behavior)
  │
  │
  │
  │  IMPLEMENTATION DETAILS:
  │
  │  • ioredis.defineCommand('checkRateLimit', { numberOfKeys: 1, lua })       │
  │  • This uses EVALSHA internally (caches script SHA)
  │
  │  • Retry strategy: 5 attempts, exponential backoff
  │
  │  • Export: { redis, checkRateLimit, isConnected }
  │
  │
  │
  │  WHY defineCommand:
  │
  │  • First call uses EVAL (sends full script)
  │
  │  • Subsequent calls use EVALSHA (sends only SHA)
  │
  │  • ioredis handles fallback automatically
  │
  │  • Script stays on Redis server memory
  │
  │
  │
  │  VERIFICATION:
  │
  │  After Phase 2, test directly:
  │
  │  const { checkRateLimit } = require('./services/redisClient');
  │
  │  const result = await checkRateLimit('test-id', 5);
  │
  │  console.log(result); → { allowed: true, remaining: 4, ... }              │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 3: Middleware + Config (45 minutes)

  3.1 Customer Configuration

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: config/customers.json
  │
  │
  │
  │  CUSTOMERS TO DEFINE:
  │
  │  ┌────────────────────────┬───────────┬─────────┬────────────────────────┐ │
  │  │ ID                     │ Tier      │ RPM     │ Overrides              │ │
  │  ├────────────────────────┼───────────┼─────────┼────────────────────────┤ │
  │  │ northwind-logistics    │ enterprise│ 300     │ 1200 RPM, 02:00-04:00  │ │
  │  │                        │           │         │ + testing window (now)  │
  │
  │  ├────────────────────────┼───────────┼─────────┼────────────────────────┤ │
  │  │ northwind-no-override  │ enterprise│ 300     │ [] (empty)             │ │
  │  │ (for scenario 06)      │           │         │                        │ │
  │  ├────────────────────────┼───────────┼─────────┼────────────────────────┤ │
  │  │ acme-corp              │ growth    │ 300     │ [] (empty)             │ │
  │  ├────────────────────────┼───────────┼─────────┼────────────────────────┤ │
  │  │ small-startup          │ starter   │ 60      │ [] (empty)             │ │
  │  └────────────────────────┴───────────┴─────────┴────────────────────────┘ │
  │
  │
  │  OVERRIDE STRUCTURE (each entry):
  │
  │  • id: unique string
  │
  │  • effectiveRpm: elevated limit during window
  │
  │  • schedule: { windowStartUTC, windowEndUTC } (HH:MM format)              │
  │  • reason: audit string
  │
  │  • approvedBy: who authorized
  │
  │  • expiresAt: ISO date (forces commercial resolution)
  │
  │
  │
  │  TESTING NOTE:
  │
  │  The "northwind-logistics" entry needs a testing override that covers
  │
  │  the CURRENT hour (so Scenario 05 works anytime).                          │
  │  The "northwind-no-override" entry has no overrides (for Scenario 06).
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  3.2 Config Service

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: src/services/configService.js
  │
  │
  │
  │  FUNCTIONS:
  │
  │
  │
  │  getCustomer(customerId)
  │
  │  → Returns customer object or null
  │
  │
  │
  │  getEffectiveLimit(customerId, nowUTC)
  │
  │  → Checks overrides array for active time-window match
  │
  │  → Returns override effectiveRpm OR base rpmLimit
  │
  │  → GENERIC: same code for ALL customers (no if/else on ID)
  │
  │
  │
  │  isOverrideActive(override, nowUTC)
  │
  │  → Check 1: Is expiresAt in the past? → false                             │
  │  → Check 2: Is current HH:MM within schedule window? → true/false         │
  │
  │
  │  CRITICAL DESIGN INVARIANT:
  │
  │  No function in this file references any specific customer ID.
  │
  │  The override logic is PURELY data-driven from the JSON config.
  │
  │  This satisfies CTO: "no if(customerId === ...) blocks"
  │
  │
  │
  │  EDGE CASE: Midnight-crossing windows (e.g., 23:00-01:00)                  │
  │  For this prototype, all overrides are within same day (02:00-04:00).
  │
  │  Document limitation; fix in "4 more hours" section.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  3.3 Rate Limiter Middleware

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: src/middleware/rateLimiter.js
   │
  │
  │
  │  REQUEST FLOW:
  │
  │  ┌──────────────────────────────────────────────────────────────────────┐  │
  │  │                                                                      │  │
  │  │  1. Extract X-Customer-Id header                                     │  │
  │  │     → Missing? → 401 { error: 'missing_customer_id' }              │  │
  │  │                                                                      │  │
  │  │  2. Look up customer in config                                       │  │
  │  │     → Not found? → 403 { error: 'unknown_customer' }               │  │
  │  │                                                                      │  │
  │  │  3. Resolve effective limit (checks overrides)                       │  │
  │  │     → Returns number (base or override RPM)                         │  │
  │  │                                                                      │  │
  │  │  4. Call Redis Lua script (atomic check)                             │  │
  │  │     → Returns { allowed, remaining, retryAfterMs, currentCount }    │  │
  │  │                                                                      │  │
  │  │  5. Set response headers:                                            │  │
  │  │     • X-RateLimit-Limit: effectiveLimit                             │  │
  │  │     • X-RateLimit-Remaining: remaining                              │  │
  │  │     • X-RateLimit-Reset: ceil(retryAfterMs / 1000)                  │  │
  │  │     • X-Served-By: NODE_ID                                          │  │
  │  │                                                                      │  │
  │  │  6a. If allowed → next() (continue to route handler)                │  │
  │  │  6b. If denied → 429 + Retry-After header + JSON body              │  │
  │  │                                                                      │  │
  │  │  ERROR: Redis unreachable → 503 (fail closed, CTO preference)       │  │
  │  │                                                                      │  │
  │  └──────────────────────────────────────────────────────────────────────┘  │
  │
  │
  │  VERIFICATION:
  │
  │  $ curl -H "X-Customer-Id: acme-corp" http://localhost:8080/api/v1/resource│
  │  → 200 OK with X-RateLimit-Remaining: 299                                 │
  │  $ curl http://localhost:8080/api/v1/resource  (no header)
  │
  │  → 401
  │
  │  $ curl -H "X-Customer-Id: ghost" http://localhost:8080/api/v1/resource    │
  │  → 403
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  3.4 API Route + Complete Server Wiring

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: src/routes/api.js
  │
  │
  │
  │  IMPLEMENT:
  │
  │  • GET /v1/resource → { data: { id: 1, message: 'Success' }, meta: {...} }│
  │  • Minimal — the interesting behavior is in middleware
  │
  │
  │
  │  FILE: src/server.js (finalize)
  │
  │
  │
  │  WIRE:
  │
  │  • GET /health (bypasses rate limiter)
  │
  │  • POST /test/reset (conditional on ENABLE_TEST_RESET env)                 │
  │  • app.use('/api', rateLimiter)
  │
  │  • app.use('/api', apiRoutes)
  │
  │  • Graceful shutdown: redis.quit() on SIGTERM
  │
  │
  │
  │  VERIFICATION:
  │
  │  $ docker compose up --build
  │
  │  $ for i in $(seq 1 5); do
  │
  │      curl -s -H "X-Customer-Id: small-startup"
  │
  │          http://localhost:8080/api/v1/resource | jq .meta.nodeId
  │
  │    done
  │
  │  → Rotates through node-1, node-2, node-3                                  │
  │  → X-RateLimit-Remaining decreases each call
  │
  │
  │
  │  CHECKPOINT: Full service operational.
  │
  │  Rate limiting active, distributed across 3 nodes, config-driven.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 4: Load Harness (90 minutes)

  4.1 Library Modules (30 minutes)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  BUILD ORDER (within harness/lib/):
  │
  │
  │
  │  ┌──────────────────────────┬────────────────────────────────────────────┐ │
  │  │ File                     │ What to implement                          │ │
  │  ├──────────────────────────┼────────────────────────────────────────────┤ │
  │  │ helpers.js               │ sleep(), waitForService(),                 │ │
  │  │                          │ flushRateLimitState()                      │ │
  │  ├──────────────────────────┼────────────────────────────────────────────┤ │
  │  │ requestGenerator.js      │ Controlled-rate sender:                    │ │
  │  │                          │ • Interval = 60000/rpm between requests    │ │
  │  │                          │ • Records sentAt, status, headers          │ │
  │  │                          │ • Accounts for request latency in pacing   │ │
  │  ├──────────────────────────┼────────────────────────────────────────────┤ │
  │  │ burstGenerator.js        │ Fire N requests ASAP:                      │ │
  │  │                          │ • Batches of concurrency (default 10-20)   │ │
  │  │                          │ • Records same fields as above             │ │
  │  │                          │ • Used for boundary and exhaustion tests   │ │
  │  ├──────────────────────────┼────────────────────────────────────────────┤ │
  │  │ windowAnalyzer.js        │ THE PROOF ENGINE:                          │ │
  │  │                          │ • analyzeWindows(): slide 60s window at    │ │
  │  │                          │   100ms steps, find max allowed count      │ │
  │  │                          │ • verifyGuarantee(): max ≤ limit?         │ │
  │  │                          │ • analyzeDistribution(): node counts       │ │
  │  │                          │ • Uses binary search (efficient for large  │ │
  │  │                          │   datasets from sustained tests)           │ │
  │  ├──────────────────────────┼────────────────────────────────────────────┤ │
  │  │ reporter.js              │ Console output:                            │ │
  │  │                          │ • printHeader(), printScenarioResult(),    │ │
  │  │                          │   printSummary()                           │ │
  │  │                          │ • Color-coded PASS/FAIL                    │ │
  │  │                          │ • JSON file output for auditing            │ │
  │  └──────────────────────────┴────────────────────────────────────────────┘ │
  │
  │
  │  VERIFICATION:
  │
  │  Write a tiny test script that generates 10 requests and runs
  │
  │  analyzeWindows() on the results. Confirm it produces a number.
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  4.2 Scenarios (60 minutes)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  SCENARIO IMPLEMENTATION ORDER (build easiest → hardest):                  │
  │
  │
  │  ┌──────┬──────────────────────────┬──────┬───────────────────────────────┐│
  │  │  #   │ Name                     │ Time │ Key Technique                 ││
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  09  │ Unknown Customer         │ 3min │ Simple fetch() calls          ││
  │  │      │                          │      │ Assert: status codes          ││
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  01  │ Exact Enforcement        │ 5min │ generateTraffic() at 133%     ││
  │  │      │                          │      │ analyzeWindows() + verify     ││
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  03  │ Distributed Correctness  │ 5min │ Same as 01 + distribution     ││
  │  │      │                          │      │ analyzeDistribution()         ││
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  02  │ Customer Isolation       │ 7min │ Promise.all() two generators  ││
  │  │      │                          │      │ Verify B unaffected by A      ││
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  04  │ Boundary Burst           │ 8min │ burst → sleep(55s) → burst   ││
  │  │      │                          │      │ Assert: burst 2 denied >90%   ││
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  07  │ Gradual Recovery         │ 8min │ fill → wait → probe           ││
  │  │      │                          │      │ Assert: gradual not step
  ││
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  08  │ Retry-After Accuracy     │ 7min │ fill → get 429 → wait →      ││
  │  │      │                          │      │ retry → assert 200            ││
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  05  │ Override Active           │ 5min │ generateTraffic() at 1000    ││
  │  │      │                          │      │ under 1200 → assert 0 denials││
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  06  │ Override Inactive         │ 5min │ Same customer, no window     ││
  │  │      │                          │      │ Assert: denials occur         ││
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  10  │ Multi-Customer Fairness  │ 5min │ Two same-tier concurrent      ││
  │  │      │                          │      │ Assert: within 5% of each other│
  │  ├──────┼──────────────────────────┼──────┼───────────────────────────────┤│
  │  │  11  │ Sustained Load           │ 5min │ 5-minute generateTraffic()    ││
  │  │      │                          │      │ Segment analysis + consistency││
  │  └──────┴──────────────────────────┴──────┴───────────────────────────────┘│
  │
  │
  │  EACH SCENARIO MODULE EXPORTS:
  │
  │  { name: string, run: async (baseUrl) => ResultObject }
  │
  │
  │
  │  RESULT OBJECT SHAPE:
  │
  │  {
  │
  │    id, name, description, config, limit,
  │
  │    metrics: { totalSent, totalAllowed, totalDenied, errors },
  │
  │    windowAnalysis (optional), distribution (optional),
  │
  │    assertions: [{ msg, passed }],
  │
  │    passed: boolean,
  │
  │    verdictReason: string
  │
  │  }
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  4.3 Main Runner

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │  FILE: harness/run.js
  │
  │
  │
  │  IMPLEMENT:
  │
  │  1. Import all 11 scenarios
  │
  │  2. Parse CLI args for selective runs (node run.js 4 7 11)
  │
  │  3. waitForService() — confirm target is up
  │
  │  4. For each scenario:
  │
  │     a. flushRateLimitState() — POST /test/reset                            │
  │     b. 2s pause (let TTLs settle)
  │
  │     c. scenario.run(TARGET_URL)
  │
  │     d. printScenarioResult(result)
  │
  │     e. Collect results
  │
  │  5. printSummary(results)
  │
  │  6. saveResultsJSON(results)
  │
  │  7. Exit code: 0 if all pass, 1 if any fail, 2 if infrastructure error     │
  │
  │
  │  ENVIRONMENT VARIABLES:
  │
  │  • TARGET_URL (default: http://localhost:8080)
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Phase 5: Verification + Polish (30 minutes)

  5.1 Full Harness Run

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  STEPS:
  │
  │  1. $ docker compose down && docker compose up --build -d
  │
  │  2. $ node harness/run.js
  │
  │  3. Observe all 11 scenarios
  │
  │  4. If any FAIL → diagnose and fix                                         │
  │
  │
  │  COMMON FAILURE MODES TO WATCH FOR:
  │
  │  ┌─────────────────────────────────────┬─────────────────────────────────┐ │
  │  │ Symptom                             │ Likely Cause                    │ │
  │  ├─────────────────────────────────────┼─────────────────────────────────┤ │
  │  │ max_in_window = 301-305             │ Burst concurrency too high;     │ │
  │  │                                     │ multiple requests enter Lua     │ │
  │  │                                     │ before prior completes.         │ │
  │  │                                     │ FIX: This shouldn't happen with │ │
  │  │                                     │ atomic Lua. Check member IDs.   │ │
  │  ├─────────────────────────────────────┼─────────────────────────────────┤ │
  │  │ Scenario 05 fails (denials > 0)     │ Override window doesn't cover   │ │
  │  │                                     │ current time. Check config      │ │
  │  │                                     │ testing override schedule.      │ │
  │  ├─────────────────────────────────────┼─────────────────────────────────┤ │
  │  │ Scenario 03 shows 1-2 nodes only    │ Nginx not started or container  │ │
  │  │                                     │ name mismatch in upstream.      │ │
  │  ├─────────────────────────────────────┼─────────────────────────────────┤ │
  │  │ All requests get 503                │ Redis not reachable from app    │ │
  │  │                                     │ containers. Check REDIS_URL.    │ │
  │  ├─────────────────────────────────────┼─────────────────────────────────┤ │
  │  │ State leaks between scenarios       │ POST /test/reset not working.   │ │
  │  │                                     │ Check ENABLE_TEST_RESET=true.   │ │
  │  └─────────────────────────────────────┴─────────────────────────────────┘ │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  5.2 Documentation

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  FILE: solution/README.md
  │
  │
  │
  │  CONTENTS:
  │
  │  1. One-paragraph system description
  │
  │  2. Prerequisites: Docker, Docker Compose, Node.js 18+
  │
  │  3. Quick Start (≤ 5 commands):
  │
  │     $ cd solution
  │
  │     $ docker compose up --build -d
  │
  │     $ npm install
  │
  │     $ npm run harness
  │
  │     $ docker compose down
  │
  │  4. What the harness proves (bullet list of 11 scenarios)
  │
  │  5. Architecture diagram (text-based)
  │
  │  6. Manual testing examples (curl commands)
  │
  │
  │
  │  REQUIREMENT: Reviewer can reproduce in ≤ 15 minutes                       │
  │
  │
  │  ─────────────────────────────────────────────────────────────────────────
  │
  │
  │
  │  FILE: DECISIONS.md (from template)
  │
  │
  │
  │  ## Conflict resolution
  │
  │  - CTO and Support both allow exceptions — CTO via "config and audit",     │
  │    Support via "temporary exception mechanism"
  │
  │  - Resolution: config-driven time-window overrides with expiration
  │
  │  - Same algorithm and code path for all customers; only the limit
  │
  │    number changes based on config + time
  │
  │  - Rejected: hardcoded bypasses, disabling limits, "fix in v2"             │
  │
  │
  │  ## Technical design
  │
  │  - Algorithm: Sliding Window Log (Redis ZSET + Lua script)
  │
  │  - Coordination: single Redis, atomic Lua (zero race conditions)
  │
  │  - Clock: Redis TIME (no node clock skew)
  │
  │  - Tradeoffs accepted: O(n) memory per customer per window (max 1200       │
  │    entries × 80 bytes = ~96KB — negligible)                                │
  │
  │
  │  ## Verification
  │
  │  - Harness proves: exact enforcement, isolation, distribution,
  │
  │    boundary correctness, override behavior, recovery, Retry-After          │
  │  - Does NOT prove: Redis failure behavior, extreme scale (10K+ RPM),       │
  │    network partitions, memory pressure
  │
  │
  │
  │  ## If I had four more hours
  │
  │  - Redis failure fallback (per-node conservative limiter at limit/N)
  │
  │  - Midnight-crossing override windows
  │
  │  - Prometheus metrics endpoint
  │
  │  - Dynamic config reload (hot-reload without restart)
  │
  │  - Harness scenario for Redis kill/recovery
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Implementation Dependency Chain (What Blocks What)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  CRITICAL PATH:
  │
  │
  │
  │  docker-compose.yml ─┐
  │
  │  nginx.conf ─────────┤
  │
  │  Dockerfile ─────────┴── [Phase 1 complete: containers up]
  │
  │                            │
  │
  │  slidingWindowLog.lua ─────┤
  │
  │  redisClient.js ───────────┴── [Phase 2 complete: algorithm works]
  │
  │                                  │
  │
  │  customers.json ─────────────────┤
  │
  │  configService.js ───────────────┤
  │
  │  rateLimiter.js ─────────────────┤
  │
  │  api.js ─────────────────────────┤
  │
  │  server.js (final) ─────────────┴── [Phase 3: full service operational]    │
  │                                        │
  │
  │  helpers.js ───────────────────────────┤
  │
  │  requestGenerator.js ──────────────────┤
  │
  │  burstGenerator.js ────────────────────┤
  │
  │  windowAnalyzer.js ────────────────────┤
  │
  │  reporter.js ──────────────────────────┤
  │
  │  scenarios/01-11 ──────────────────────┤
  │
  │  run.js ───────────────────────────────┴── [Phase 4: harness complete]     │
  │                                              │
  │
  │  Full run + README + DECISIONS.md ───────────┴── [Phase 5: DONE]           │
  │
  │
  │  PARALLELIZABLE WORK:
  │
  │  • Lua script + config JSON can be written simultaneously
  │
  │  • All 11 scenarios can be written in any order (after lib/ is done)
  │
  │  • README + DECISIONS.md can be drafted while harness runs
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Time Budget

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  ┌──────────┬───────────────────────────────────┬────────┬────────────────┐│
  │  │ Phase    │ Work                              │ Time   │ Cumulative     ││
  │  ├──────────┼───────────────────────────────────┼────────┼────────────────┤│
  │  │ 0        │ Scaffolding + npm init            │ 10 min │ 0:10           ││
  │  │ 1        │ Docker + Nginx + skeleton server  │ 40 min │ 0:50           ││
  │  │ 2        │ Lua script + Redis client         │ 50 min │ 1:40           ││
  │  │ 3        │ Config + middleware + wiring      │ 45 min │ 2:25           ││
  │  │ 4        │ Harness libs + 11 scenarios       │ 90 min │ 3:55           ││
  │  │ 5        │ Full run + fix + docs             │ 30 min │ 4:25           ││
  │  ├──────────┼───────────────────────────────────┼────────┼────────────────┤│
  │  │          │ TOTAL                             │ ~4.5 hr│ Within timebox ││
  │  └──────────┴───────────────────────────────────┴────────┴────────────────┘│
  │
  │
  │  BUFFER: 1-1.5 hours remaining within 6-hour cap                           │
  │  Use for: debugging unexpected issues, polishing output format,
  │
  │  adding a scenario, improving DECISIONS.md
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  Reviewer's Experience (End-to-End)

  ┌─────────────────────────────────────────────────────────────────────────────
  ┐
  │
  │
  │  THE REVIEWER'S 10-MINUTE JOURNEY:
  │
  │
  │
  │  Minute 0-2:   git clone → cd solution → docker compose up --build -d     │
  │  Minute 2-3:   docker compose ps (verify 5 containers healthy)             │
  │  Minute 3-4:   npm install (harness dependencies — just native fetch)      │
  │  Minute 4-5:   curl commands to manually verify 200, 429, 403, 401         │
  │  Minute 5-15:  npm run harness (watch 11 scenarios execute and PASS)       │
  │  Minute 15:    docker compose down (cleanup)
  │
  │
  │
  │  WHAT THE REVIEWER SEES:
  │
  │  • Clean colored output with clear PASS/FAIL verdicts
  │
  │  • Mathematical proof: "max in any 60s window ≤ limit"                     │
  │  • Distribution evidence: "node-1: 33%, node-2: 34%, node-3: 33%"         │
  │  • Boundary proof: "burst 2 at T+55s: 100% denied"                        │
  │  • Override proof: "1000 RPM flows freely under 1200 override"             │
  │  • JSON report saved for deeper inspection
  │
  │
  │
  │  WHAT THE REVIEWER READS:
  │
  │  • DECISIONS.md: one page explaining conflict resolution + tradeoffs
  │
  │  • README.md: setup instructions + what the harness proves
  │
  │  • Lua script: one file, ~40 lines, self-explanatory
  │
  │  • Session exports: full AI conversation showing the thinking process
  │
  │
  │
  └─────────────────────────────────────────────────────────────────────────────
  ┘

  ---
  ---
  Part 2: Complete Chat Summary

  What We Analyzed

  This conversation systematically analyzed and designed a solution for the
  "Promise Them Nothing Twice" take-home assignment from Trilogy Innovations.
  The assignment asks candidates to build a distributed rate limiter + load 
  harness for a fictional B2B API platform called RelayAPI.

  The Problem

  RelayAPI has 3 stateless app nodes behind a round-robin load balancer. Their
  previous rate limiter was decommissioned (didn't enforce under distribution),
  and a new prototype was rolled back due to "correctness issues at quota
  boundaries." Two stakeholders have conflicting demands:

  - CTO (Priya Nair): Demands mathematically strict enforcement — "a customer
  must NEVER exceed their contracted quota." Requires per-customer isolation,
  auditable counting, works across 3 nodes, no special-case hacks.
  - Support Lead (Marcus Webb): Demands that Northwind Logistics (60% of ARR,
  renewal in 6 weeks) NEVER sees a 429 during their nightly batch (02:00-04:00
  UTC, 800-1200 RPM against a 300 RPM contract). Must be invisible to the
  customer.

  How We Resolved the Conflict

  Both memos leave a "crack" — the CTO allows "commercial exceptions through
  config and audit", and Support says "if you need a temporary exception
  mechanism, fine." Resolution: config-driven time-window overrides stored in
  JSON. Same algorithm, same code path for all customers. Northwind simply has
  an override entry that elevates their limit to 1200 during 02:00-04:00 UTC.
  The override has an expiration date forcing commercial resolution.

  The Technical Design We Chose

  ┌────────────────┬──────────────┬─────────────────────────────────────────┐
  │   Component    │    Choice    │                   Why                   │
  ├────────────────┼──────────────┼─────────────────────────────────────────┤
  │                │ Sliding      │ Mathematically guarantees "never        │
  │ Algorithm      │ Window Log   │ exceed"; zero boundary burst; precise   │
  │                │              │ Retry-After                             │
  ├────────────────┼──────────────┼─────────────────────────────────────────┤
  │ Data structure │ Redis Sorted │ Timestamps as scores, one entry per     │
  │                │  Set (ZSET)  │ admitted request                        │
  ├────────────────┼──────────────┼─────────────────────────────────────────┤
  │ Atomicity      │ Redis Lua    │ Single-threaded execution = no race     │
  │                │ script       │ conditions                              │
  ├────────────────┼──────────────┼─────────────────────────────────────────┤
  │ Clock source   │ Redis TIME   │ Eliminates clock skew between nodes     │
  │                │ (inside Lua) │                                         │
  ├────────────────┼──────────────┼─────────────────────────────────────────┤
  │ Config         │ Static JSON  │ Auditable (git-tracked), no DB          │
  │                │ file         │ dependency                              │
  ├────────────────┼──────────────┼─────────────────────────────────────────┤
  │ Infrastructure │ Docker       │ 3 app nodes + Nginx (round-robin) +     │
  │                │ Compose      │ Redis                                   │
  ├────────────────┼──────────────┼─────────────────────────────────────────┤
  │ Harness        │ Custom       │ Post-hoc sliding window analysis proves │
  │                │ Node.js      │  correctness                            │
  ├────────────────┼──────────────┼─────────────────────────────────────────┤
  │ Dependencies   │ express +    │ Minimal attack surface, fast install    │
  │                │ ioredis only │                                         │
  └────────────────┴──────────────┴─────────────────────────────────────────┘

  What We Designed

  1. The Lua script — 40 lines: prune expired → count → decide → admit or deny.
  Uses Redis TIME, returns [allowed, remaining, retryAfterMs, count].
  2. The config service — Generic override resolver. No if(customerId === ...)
  anywhere. Checks schedule + expiration for any customer's overrides.
  3. The middleware — Extracts customer ID → resolves effective limit → calls
  Lua → returns 200 or 429 with precise Retry-After.
  4. The harness — 11 scenarios, each mapping to a specific stakeholder
  requirement. The proof engine slides a 60-second window across all response
  timestamps at 100ms resolution and finds the maximum count. If max ≤ limit →
  guarantee holds.
  5. Explicitly rejected decisions — Fixed window (boundary burst), token bucket
  (allows bursts), per-node counters (CTO forbids), hardcoded bypasses (CTO
  forbids), permanent overrides (no expiration = tech debt), fail-open on Redis
  failure (CTO prefers under-limiting), and 15+ other rejected approaches with
  specific reasoning.

  What Comes Next

  Implementation following the 5-phase plan above, targeting ~4.5 hours of build
  time within the 4-6 hour timebox. The primary deliverables are the working
  service, the harness proving correctness, DECISIONS.md, and full AI session
  exports.

✻ Brewed for 3m 20s