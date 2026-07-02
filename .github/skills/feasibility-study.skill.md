---
name: feasibility-study
description: Conduct comprehensive feasibility study with SWOT, ROI, and risk analysis
trigger:
  - "feasibility study"
  - "viability analysis"
  - "project evaluation"
  - "should we build"
  - "go/no-go decision"
phases:
  - define_scope
  - analyze_market
  - analyze_technical
  - analyze_operational
  - analyze_financial
  - analyze_legal
  - assess_risks
  - make_recommendation
inputs:
  - project_description
  - market_context
  - constraints
outputs:
  - feasibility_report
  - go_no_go_recommendation
  - risk_register
verification:
  - All dimensions analyzed
  - Risks identified with mitigation
  - Recommendation justified
---

# Feasibility Study Skill

## Purpose

Conduct **comprehensive feasibility study** covering all dimensions (market, technical, operational, financial, legal) to support go/no-go decisions.

## When to Use

- Starting new project
- Major architectural change
- New feature investment
- Strategic decision
- Stakeholder communication

## Process

### Phase 1: Define Scope

```yaml
Project Understanding:
  Problem Statement:
    - What problem are we solving?
    - Who has this problem?
    - How big is the problem?
    - What's the cost of not solving it?

  Proposed Solution:
    - What are we building?
    - How does it solve the problem?
    - What's different from existing solutions?
    - What's our unique value?

  Scope:
    In Scope:
      - Features included
      - Users targeted
      - Geography
      - Time period
    Out of Scope:
      - Features excluded
      - Users not targeted
      - Future phases
```

### Phase 2: Analyze Market (MARKET)

```yaml
Market Analysis:

  Market Size:
    TAM (Total Addressable Market):
      - Total market size
      - Growth rate
      - Trends

    SAM (Serviceable Available Market):
      - Market we can reach
      - Segments we serve
      - Geographic limits

    SOM (Serviceable Obtainable Market):
      - Market we can capture
      - Realistic in 3 years

  Competition:
    Direct Competitors:
      - Market share
      - Features
      - Pricing
      - Strengths/weaknesses

    Indirect Competitors:
      - Alternative solutions
      - Why users choose them

    Competitive Advantages:
      - What we do better
      - What's unique
      - Moat (if any)

  Customer Analysis:
    Target Segments:
      - Demographics
      - Psychographics
      - Behaviors
      - Needs/pains

    Customer Journey:
      - Awareness
      - Consideration
      - Purchase
      - Retention
      - Advocacy

  Differentiation:
    - Functional
    - Emotional
    - Social
    - Economic
```

### Phase 3: Analyze Technical (TECHNICAL)

```yaml
Technical Feasibility:

  Architecture:
    - High-level design
    - Components
    - Data flow
    - Third-party services
    - Scalability approach

  Tech Stack:
    Frontend:
      - Framework (React 19, Vite 7)
      - State management
      - UI library (shadcn/ui, Tailwind)

    Backend:
      - Runtime (Node.js 20)
      - Framework (Express 5)
      - API style (REST)
      - Validation (Zod)

    Database:
      - Type (PostgreSQL 17)
      - Schema design
      - Migrations
      - Performance

  Technical Risks:
    - Scalability limits
    - Performance issues
    - Security vulnerabilities
    - Integration complexity
    - Technology obsolescence

  Feasibility Score:
    - Existing expertise (High/Medium/Low)
    - Technology maturity (High/Medium/Low)
    - Implementation complexity (High/Medium/Low)
    - Time to market (Fast/Medium/Slow)

  Standards Compliance:
    - IEEE standards (829-2008, 29119)
    - ISTQB testing standards
    - Google Style Guide
    - WCAG accessibility
    - OWASP security
```

### Phase 4: Analyze Operational (OPERATIONAL)

```yaml
Operational Feasibility:

  Team:
    - Required skills
    - Team size
    - Hiring plan
    - Training needs

  Processes:
    - Development workflow
    - Deployment pipeline
    - Monitoring & alerting
    - Incident response
    - Backup & recovery

  Infrastructure:
    - Hosting requirements
    - Scaling strategy
    - Backup strategy
    - Disaster recovery

  Support:
    - Documentation
    - User support
    - Maintenance windows
    - Update strategy

  Operational Readiness:
    - Current state vs desired state
    - Gaps
    - Time to close gaps
    - Investment needed
```

### Phase 5: Analyze Financial (FINANCIAL)

```yaml
Financial Feasibility:

  Costs:
    Development:
      - Team salaries
      - Contractors
      - Tools and licenses

    Infrastructure:
      - Hosting
      - Database
      - CDN
      - Monitoring

    Operations:
      - Support staff
      - Maintenance
      - Training

    Marketing:
      - User acquisition
      - Brand building
      - Content

  Revenue:
    Direct Revenue:
      - Subscription
      - Transaction fees
      - Premium features

    Indirect Revenue:
      - Reduced costs
      - Increased efficiency
      - Competitive advantage

  ROI Analysis:
    Total Investment:
      - Year 1: $X
      - Year 2: $Y
      - Year 3: $Z

    Expected Returns:
      - Year 1: $A
      - Year 2: $B
      - Year 3: $C

    Break-Even:
      - Month X

    NPV (Net Present Value):
      - Discount rate: Y%
      - NPV: $Z

    IRR (Internal Rate of Return):
      - IRR: Z%
```

### Phase 6: Analyze Legal (LEGAL)

```yaml
Legal Feasibility:

  Compliance:
    Data Protection:
      - GDPR (EU)
      - CCPA (California)
      - Local laws (Yemen, MENA)

    Industry Specific:
      - PCI DSS (payments)
      - HIPAA (healthcare)
      - Local regulations

  Intellectual Property:
    - Patents needed?
    - Trademarks
    - Copyrights
    - Open source licenses

  Contracts:
    - Customer agreements
    - Vendor contracts
    - Employment contracts

  Risk Areas:
    - Multi-jurisdiction
    - Data residency
    - Cross-border data
    - Government regulations
```

### Phase 7: Assess Risks

```yaml
Risk Assessment:

  Risk Categories:

    Technical:
      - Scalability issues
      - Performance bottlenecks
      - Security vulnerabilities
      - Technology obsolescence

    Market:
      - Competition
      - Market decline
      - Changing customer needs

    Financial:
      - Cost overruns
      - Revenue shortfall
      - Funding gaps

    Operational:
      - Key person dependency
      - Process failures
      - Team capacity

    Legal:
      - Regulatory changes
      - Compliance failures
      - IP disputes

  Risk Matrix:
    | Risk | Probability | Impact | Score | Mitigation |
    |------|-------------|--------|-------|------------|
    | ...  | Low/Med/High | Low/Med/High | 1-9 | ...        |

  Top Risks:
    1. [Risk 1]
       - Probability: ...
       - Impact: ...
       - Mitigation: ...

    2. [Risk 2]
       - ...
```

### Phase 8: Make Recommendation

```yaml
Decision Framework:

  Options:
    Option A: Full Implementation
      - Cost: $X
      - Timeline: Y months
      - Risk: High/Medium/Low
      - Expected ROI: Z%

    Option B: Phased Approach
      - Cost: $X (Phase 1) + $Y (Phase 2)
      - Timeline: Y1 + Y2 months
      - Risk: Lower
      - Expected ROI: Z%

    Option C: MVP First
      - Cost: $X
      - Timeline: 3 months
      - Risk: Lowest
      - Expected ROI: Medium

    Option D: Don't Build
      - Cost: $0
      - Opportunity cost: ...

  Scoring:
    | Criterion | Weight | Option A | Option B | Option C |
    |-----------|--------|----------|----------|----------|
    | Strategic Fit | 25% | 8 | 7 | 6 |
    | ROI | 25% | 7 | 8 | 6 |
    | Risk | 20% | 4 | 7 | 9 |
    | Time to Value | 15% | 5 | 7 | 10 |
    | Cost | 15% | 5 | 7 | 9 |
    | Total | 100% | 6.0 | 7.3 | 7.7 |

  Recommendation:
    Choose: Option [X]
    Rationale: [Why]

  Success Criteria:
    - [Criterion 1]
    - [Criterion 2]
```

## Feasibility Report Template

```markdown

# Feasibility Study: [Project Name]

## Executive Summary

- **Recommendation**: Go / No-go / Conditional
- **Estimated Investment**: $X
- **Expected ROI**: Y%
- **Timeline**: Z months
- **Key Risk**: [Top risk]

## Market Analysis

- Market size (TAM/SAM/SOM)
- Competition
- Target customers
- Differentiation

## Technical Analysis

- Architecture
- Tech stack
- Implementation complexity
- Technical risks

## Operational Analysis

- Team requirements
- Processes
- Infrastructure
- Operational readiness

## Financial Analysis

- Costs
- Revenue
- ROI
- NPV / IRR

## Legal Analysis

- Compliance requirements
- IP considerations
- Contract needs

## Risk Assessment

[Risk matrix with top 10 risks]

## Recommendation

[Detailed recommendation with rationale]

## Next Steps

1. [Step 1]
2. [Step 2]
```

## Nouf-ex Project Context

Based on `docs/MASTER_PLAN.md`, `docs/planning/competitive-analysis.md`, and project documentation:

```yaml
Current State (2026-07-02):
  Tech Stack:
    - Frontend: React 19.2.0 + Vite 7.3.5 + TypeScript 5.x
    - Backend: Node.js 20.18.1 + Express 5.2.1
    - Database: PostgreSQL 17 (30 tables, 13 functions, 10 triggers)
    - Testing: Vitest 4.1.9 (732 tests passing)
    - Build: TypeScript 0 errors, ESLint 0 warnings, Build OK

  Project Metrics:
    - 91 server endpoints (19 route files)
    - 23 React routes (22 explicit + NotFound)
    - 22 wired pages + 5 orphaned admin pages
    - 30 DB tables (17 schema + 10 schema-extra + 3 migrations)
    - i18n: EN=828, AR=970, ZH=895 keys

  Completed:
    - Phase A (P0 fixes): 6/6 ✅
    - Phase B (P1 docs): 30/30 ✅
    - Phase C (P1 features): 4/4 ✅
    - Phase D (GitHub/CI): 8/8 ✅

  Pending:
    - Phase E (P2 docs): 5 tasks ⏳
    - Phase F (P2 UX): 6 tasks ⏳
    - Phase G (P2 quality): 6 tasks ⏳
    - Phase J (P3 improvements): 3 tasks ⏳

  Backlog:
    - 14 functional features missing (P1: 4, P2: 6, P3: 4)
    - 8 YER hardcoding locations
    - 5 orphaned admin pages
    - 6 Phase K gap remediation tasks

Competitive Position (from docs/planning/competitive-analysis.md):
  - vs Alibaba/Amazon/Shopify: 65% ready (need XL investment)
  - vs Saleor/Medusa: can reach 85% in 12 months
  - Differentiators: Arabic i18n, COD integration, Yemen market

Standards Applied:
  - IEEE 829-2008 (test documentation)
  - ISO/IEC/IEEE 29119 (testing)
  - ISTQB CTFL (testing)
  - Google Style Guide
  - Microsoft Docs .NET Architecture
  - Diátaxis (documentation)
  - Keep a Changelog
```

## Output Template

```markdown

## Feasibility Study Report

### Project

[Name and description]

### Recommendation

[Go / No-go / Conditional]

### Key Findings

#### Market

- TAM: $X
- SAM: $Y
- SOM: $Z
- Competition: [Assessment]

#### Technical

- Architecture: [Assessment]
- Risks: [List]
- Complexity: [Score]

#### Operational

- Team: [Assessment]
- Processes: [Assessment]
- Infrastructure: [Assessment]

#### Financial

- Investment: $X
- Expected Revenue: $Y
- ROI: Z%
- Break-even: [When]

#### Legal

- Compliance: [Status]
- IP: [Status]
- Risks: [List]

### Risk Matrix

| Risk | Probability | Impact | Mitigation |

### Recommendation

[Detailed recommendation]

### Success Criteria

- [List]
```

## Verification Checklist

- [ ] All dimensions analyzed
- [ ] Risks identified with probability and impact
- [ ] Mitigation strategies defined
- [ ] Recommendation clear
- [ ] Success criteria defined
- [ ] Stakeholders identified
- [ ] Costs and benefits quantified

## Anti-Patterns to Avoid

```yaml
Don't:
  - Skip dimensions
  - Ignore risks
  - Be unrealistic with timelines
  - Underestimate costs
  - Overestimate revenue
  - Skip legal/compliance
  - Make recommendations without evidence
  - Forget follow-up actions
```
