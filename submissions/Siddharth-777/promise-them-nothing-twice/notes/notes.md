# Promise Them Nothing Twice
" My own working notes "

Company -> RelayAPI - B2B API platform
Service -> Metered HTTP API

Each customer has a contracted RPM quota - Requests per Minute

Incoming HTTP requests are distributed across 3 servers, and those servers don't keep user-specific state in their own memory.

System is :
1. 3 Application Nodes
2. They are Stateless
3. No Sticky Sessions

Largest Customer -> Northwind Logistics
They account for the 60% of the recurring revenue of RelayAPI

Problem :
Nightly batch job -> 2:00 to 4:00 UTC 
Traffic spikes above the contracted RPM

Can't lose Northwind's partnership -> Big loss

Instructions :
Team -> Technical and Support
Contradicting instructions are given and both are non negotiable

Our Job :
Resolve the conflict explicitly
Build a thin vertical slice
Prove our limiter works at boundary conditions

# WHAT TO BUILD


1. A rate-limiting HTTP API 
2. A rate-limiting algorithm along with documentation
3. Build a Load Harness

# DELIVERABLES

### 1. Working artifact (`solution/`)
A readme file with setup and how to run the service and harness. A reviewer should be able to run this under 15 mins with only free tools.
### 2. AI session exports (`sessions/`)
It is a PRIMARY DELIVERABLE. Export the working session used to build this assignment along with user prompts and agent outputs.
Name them in chronological order. Heavy AI use required
### 3. Decisions note (`DECISIONS.md`)
- What you decided about the CTO vs. support conflict — and what you explicitly rejected.
- Algorithm and distributed-coordination choices.
- What your harness proves and what it does *not* prove.
- What you would build next with another four hours.

# EVALUATION CRITERIA

1. Understanding of the problem statement and conflicts
2. Prompting efficiently
3. Critical review of wrong designs
4. Debugging the code
5. Sequenced work with multiple phases
6. Strong Communication

---

# PLATFORM CONTEXT

# RelayAPI

## Traffic and topology

| Fact              | Detail                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| App tier          | 3 stateless nodes behind round-robin LB                                                                                                               |
| Data stores       | Postgres (billing, config), Redis (cache — **may or may not** be available in your slice; do not assume ops will provision new infra for a prototype) |
| Request path      | TLS termination at LB → app node → upstream API handlers                                                                                              |
| Customer identity | `X-Customer-Id` header (trusted from API gateway today)                                                                                               |
|                   |                                                                                                                                                       |
## Customer tiers (simplified)

| Tier | RPM | Notes |
| ---- | --- | ----- |
| Starter | 60 | Long tail of small customers |
| Growth | 300 | Default new signup |
| Enterprise | custom | Negotiated; Northwind is Enterprise |
## Northwind Logistics

- **~60% of ARR.** Renewal conversation active; CEO involved.
- Contracted **300 RPM** Enterprise tier.
- Nightly batch **02:00–04:00 UTC**: sustained **~800–1200 RPM** for 90–120 minutes depending on queue depth.
- Batch is business-critical; retries on 429 amplify load (their client retries aggressively).
- Northwind's engineering contact has said they will not re-architect their scheduler before renewal.

# PAIN POINTS

1. Previous limiter did not correctly enforce limits under LB distribution. It allowed traffic above the contract
2. A new limiter prototype also failed at the boundary conditions under Northwind scale traffic
3. The enterprise customer wants a **simple, precise explanation of what your system considers a "request" and how it counts those requests**.
---

# CTO MEMO - BREAKDOWN

CTO : Priya Nair
SLA : A customer must never exceed their contracted quota

# REQUIREMENTS

1. Hard enforcement : The system must work properly for the contracted RPM and it must stop accepting requests above the limit. The system should return " TOO MANY REQUESTS - RETURN AFTER " header. 
2. Per customer Isolation : One customer's traffic must not affect another customer. The rate limiter needs PER-CUSTOMER STATE.
3. Strictly fair metering : Two customers on the same tier gets same treatment. We have to make an explicit documented rule rather than hardcoded statements in backend.
4. Auditable : We should have a clear deterministic counting rule for the rate limiter and can explain/reconstruct a customer's request count without hand-waving.

# TECHNICAL CONTEXT :
1. Stateless app nodes : The nodes does not store the rate-limit state in their own memory. Basically they are asking us to use a shared state - Redis. 
2. If the distributed system has to make an error, I prefer the system to reject too many requests rather than allow too many requests. False rejection is preferable to quota leakage. OVER LIMITING IS ALLOWED. UNDER LIMITING IS NOT ALLOWED.
3. Use a well understood algorithm : Here we most preferably choose SLIDING WINDOW LOG along with REDIS and LUA SCRIPT for the atomic operations.

# SUCCESS CRITERIA
A demo where two customers on a 100 RPM tier each get exactly their budget, and a third customer who exceeds 100 RPM gets cut off - **even when I hammer the load balancer randomly across all three nodes**.


---


# SUPPORT LEAD MEMO - BREAKDOWN

Support lead : Marcus Webb

New Rate-limiter deployed -> Sent 429 errors to NorthWind
Northwind would want to revisit the partnership if this persists

# Support Team Demand 

**Northwind must never see a 429 during their batch window.**
Support is essentially asking for an **exception/bypass**. 

Guarantee Northwind's batch window works - every night
Northwind will not reduce or distribute their traffic. Our system has to deal with the traffic **as it arrives**.
Our exception mechanism should be invisible to Northwind. Northwind shouldn't know that your system is treating them differently.


They understand that the system still needs rate limiting.
They're saying Northwind is strategically important, so **their batch must succeed even if it conflicts with the standard RPM limit**.