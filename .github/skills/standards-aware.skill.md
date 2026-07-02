---
name: standards-aware
description: Apply international engineering standards (IEEE, ISO, ISTQB) systematically
trigger:
  - "standards"
  - "ieee"
  - "iso"
  - "best practices"
  - "compliance"
phases:
  - identify_applicable_standards
  - apply_requirements
  - document_compliance
  - verify_adherence
inputs:
  - task_type
  - scope
outputs:
  - standards_compliant_solution
  - compliance_documentation
verification:
  - All applicable standards identified
  - Requirements applied
  - Compliance documented
  - Verified against standards
---

# Standards-Aware Skill

## Purpose

Apply **international engineering standards** (IEEE, ISO, ISTQB, etc.) systematically to ensure quality and compliance.

## When to Use

- Any development task
- Quality assurance
- Documentation
- Testing
- Architecture decisions
- Compliance verification

## Applicable Standards

### Software Testing Standards

#### IEEE 829-2008 - Standard for Software Test Documentation

```yaml
Test Documentation Required:
  - Test Plan (IEEE 829-2008 Section 7)
  - Test Design (Section 8)
  - Test Cases (Section 9)
  - Test Procedures (Section 10)
  - Test Logs (Section 11)
  - Test Incident Reports (Section 12)
  - Test Summary Reports (Section 13)

When to Apply:
  - Planning tests for new features
  - Documenting test procedures
  - Reporting test results
  - Investigating defects
```

#### ISO/IEC/IEEE 29119 - Software Testing Standard

```yaml
Test Process (ISO 29119-2):
  - Organizational Test Process
  - Test Management Process
  - Dynamic Test Process

Test Documentation (ISO 29119-3):
  - Test Plan
  - Test Design
  - Test Execution
  - Test Completion

Test Techniques (ISO 29119-4):
  - Specification-based (equivalence partitioning, boundary value)
  - Structure-based (statement, branch coverage)
  - Experience-based (error guessing, exploratory)

When to Apply:
  - All testing activities
  - Test planning
  - Test design and execution
```

#### ISTQB CTFL - Certified Tester Foundation Level

```yaml
Testing Principles:
  - Testing shows presence of defects, not absence
  - Exhaustive testing is impossible
  - Early testing saves time and money
  - Defects cluster together
  - Beware of pesticide paradox
  - Testing is context-dependent
  - Absence-of-errors is a fallacy

Test Types:
  - Functional (what system does)
  - Non-functional (how well it does it)
  - Structural (how it's built)
  - Change-related (confirm/confirm regression)

Test Levels:
  - Unit
  - Integration
  - System
  - Acceptance

Test Techniques:
  Black-box: equivalence partitioning, boundary value, decision table, state transition
  White-box: statement, branch, path coverage
  Experience-based: error guessing, exploratory, checklist-based

When to Apply:
  - Test design
  - Test execution
  - Test strategy
```

### Code Quality Standards

#### Google Style Guide

```yaml
When to Apply:
  - TypeScript/JavaScript code style
  - Naming conventions
  - File organization
  - Comments and documentation

Key Rules:
  - camelCase for variables and functions
  - PascalCase for classes and types
  - UPPER_SNAKE_CASE for constants
  - 80-100 character line limit
  - Imports organized
  - JSDoc for public APIs
```

#### Microsoft .NET Architecture Guides

```yaml
When to Apply:
  - System architecture
  - Design patterns
  - Best practices

Key Areas:
  - Microservices patterns
  - Containerized applications
  - Event-driven architecture
  - CQRS pattern
  - Domain-driven design
```

### Documentation Standards

#### Diátaxis Documentation Framework

```yaml
Four Documentation Types:
  - Tutorial (learning-oriented)
    - Goal: Teach
    - Style: Lesson
    - Example: "Getting Started"
    - When to use: New users

  - How-to Guide (problem-oriented)
    - Goal: Solve
    - Style: Recipe
    - Example: "How to deploy"
    - When to use: Specific tasks

  - Reference (information-oriented)
    - Goal: Describe
    - Style: Technical
    - Example: API docs
    - When to use: Look up info

  - Explanation (understanding-oriented)
    - Goal: Discuss
    - Style: Discussion
    - Example: Architecture docs
    - When to use: Understanding

When to Apply:
  - All documentation
  - Choose right type for purpose
  - Don't mix types in same doc
```

#### Keep a Changelog

```yaml
Format Requirements:
  - Header: Project name + description
  - Version: Semantic versioning
  - Date: YYYY-MM-DD
  - Sections: Added, Changed, Deprecated, Removed, Fixed, Security
  - Unreleased section for in-progress

When to Apply:
  - Every code change
  - Release notes
  - API changes
  - Breaking changes
```

### Security Standards

#### OWASP Top 10 (2021)

```yaml
A01: Broken Access Control
A02: Cryptographic Failures
A03: Injection
A04: Insecure Design
A05: Security Misconfiguration
A06: Vulnerable and Outdated Components
A07: Identification and Authentication Failures
A08: Software and Data Integrity Failures
A09: Security Logging and Monitoring Failures
A10: Server-Side Request Forgery (SSRF)

When to Apply:
  - All code with security implications
  - Authentication/authorization
  - Data handling
  - API design
  - Configuration
```

#### WCAG 2.1 - Web Content Accessibility Guidelines

```yaml
Level AA (Target for Nouf-ex):
  Perceivable:
    - Text alternatives for images
    - Captions for video
    - Sufficient color contrast (4.5:1)
    - Resizable text

  Operable:
    - Keyboard accessible
    - Sufficient time for interactions
    - No seizure-inducing content
    - Navigable

  Understandable:
    - Readable text
    - Predictable functionality
    - Input assistance

  Robust:
    - Compatible with assistive technologies

When to Apply:
  - All UI components
  - Forms
  - Navigation
  - Media content
```

### Database Standards

#### PostgreSQL Best Practices

```yaml
Naming Conventions:
  - Tables: lowercase, snake_case, plural
  - Columns: lowercase, snake_case, singular
  - Indexes: idx_{table}_{column(s)}
  - Constraints: chk_{table}_{column}
  - Triggers: {table}_{event}

Schema Best Practices:
  - UUID for primary keys
  - TIMESTAMPTZ for timestamps
  - NOT NULL constraints
  - CHECK constraints for validation
  - Foreign keys with ON DELETE/UPDATE

Performance:
  - Indexes for WHERE/ORDER BY
  - EXPLAIN ANALYZE for queries
  - Materialized views for reports
  - Partitioning for large tables

When to Apply:
  - All database work
  - Schema design
  - Query optimization
```

### Agile/Scrum Standards

#### Scrum Guide

```yaml
Sprint Planning:
  - Sprint goal
  - Sprint backlog
  - Capacity planning
  - Task estimation

Daily Standup:
  - What I did yesterday
  - What I will do today
  - Impediments

Sprint Review:
  - Demo completed work
  - Stakeholder feedback

Sprint Retrospective:
  - What went well
  - What went poorly
  - What to improve
```

## Standards Application Framework

```yaml
When Starting Any Task:

  Step 1: Identify Applicable Standards
    What standards apply to this task?
    What documentation is required?
    What testing is required?
    What security considerations?

  Step 2: Apply Requirements
    Follow coding standards
    Use proper documentation framework
    Apply testing standards
    Address security requirements

  Step 3: Document Compliance
    Reference standards in commit messages
    Include compliance in CHANGELOG
    Document decisions with rationale
    Update relevant docs

  Step 4: Verify Compliance
    Run linting (Google Style)
    Run type check (TypeScript)
    Run tests (Vitest with ISTQB techniques)
    Check accessibility (WCAG)
    Check security (OWASP)
```

## Standards Quick Reference

```yaml
Documentation:
  Use Diátaxis framework (tutorial/how-to/reference/explanation)
  Keep a Changelog format
  JSDoc for public APIs
  Mermaid for diagrams

Code:
  Google Style Guide
  TypeScript strict mode
  SOLID principles
  DRY, KISS, YAGNI

Testing:
  IEEE 829 test documentation
  ISO/IEC/IEEE 29119 process
  ISTQB techniques
  80%+ coverage

Security:
  OWASP Top 10
  WCAG 2.1 AA
  Defense in depth
  Principle of least privilege

Database:
  PostgreSQL conventions
  UUID, TIMESTAMPTZ
  Constraints everywhere
  Indexes for performance
```

## Project Context

Nouf-ex applies these standards:
- **IEEE 829-2008**: Test documentation
- **ISO/IEC/IEEE 29119**: Testing process
- **ISTQB CTFL**: Testing techniques
- **Google Style Guide**: Code style
- **Microsoft .NET Architecture**: Architecture patterns
- **Diátaxis**: Documentation framework
- **Keep a Changelog**: Version history
- **OWASP**: Security awareness
- **WCAG**: Accessibility
- **PostgreSQL**: Database standards

## Output Template

```markdown

## Standards-Compliant Solution

### Task

[Description]

### Applicable Standards

- [List of standards that apply]

### Compliance Approach

[How each standard is addressed]

### Implementation

[Code with standards compliance]

### Documentation

[Documentation following standards]

### Testing

[Test approach following standards]

### Verification

- [Checklist of compliance items]
```

## Verification Checklist

```yaml
Code Standards:
  - [ ] Google Style Guide followed
  - [ ] TypeScript strict mode
  - [ ] JSDoc for public APIs
  - [ ] No lint errors
  - [ ] No type errors

Documentation Standards:
  - [ ] Diátaxis: Right type used
  - [ ] Keep a Changelog updated
  - [ ] Clear and complete
  - [ ] Examples provided

Testing Standards:
  - [ ] IEEE 829: Test cases documented
  - [ ] ISO 29119: Process followed
  - [ ] ISTQB: Techniques applied
  - [ ] Coverage meets target

Security Standards:
  - [ ] OWASP Top 10 considered
  - [ ] Input validated
  - [ ] Auth/authz enforced
  - [ ] Secrets handled properly

Accessibility Standards:
  - [ ] WCAG 2.1 AA
  - [ ] Semantic HTML
  - [ ] Keyboard navigation
  - [ ] Screen reader compatible

Database Standards:
  - [ ] PostgreSQL conventions
  - [ ] Constraints applied
  - [ ] Indexes created
  - [ ] Performance considered
```

## Anti-Patterns to Avoid

```yaml
Don't:
  - Skip standards documentation
  - Mix documentation types
  - Use wrong standard for the task
  - Cherry-pick standards
  - Ignore validation
  - Skip verification
  - Mix concerns in documentation
```
