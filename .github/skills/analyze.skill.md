---
name: analyze
description: Deep analysis of code, issues, or requirements with structured output
trigger:
  - "analyze"
  - "investigate"
  - "understand"
  - "why"
  - "what is"
  - "how does"
phases:
  - gather_context
  - examine_code
  - identify_issues
  - document_findings
inputs:
  - target (file path or system component)
  - focus (specific aspect to analyze)
outputs:
  - analysis_report
  - issue_list
  - recommendations
verification:
  - All aspects examined
  - Findings documented
  - Recommendations actionable
---

# Analyze Skill

## Purpose

Perform **deep, structured analysis** of code, systems, or issues to produce actionable findings.

## When to Use

- Understanding unfamiliar code
- Investigating bugs or issues
- Evaluating code quality
- Assessing performance
- Security review
- Architecture review

## Process

### Phase 1: Gather Context

```yaml
Questions:
  - What is being analyzed?
  - Why is it being analyzed?
  - What is the expected behavior?
  - What is the actual behavior?
  - What is the scope of analysis?

Actions:
  - Read related files
  - Check git history
  - Review documentation
  - Understand dependencies
  - Identify stakeholders
```

### Phase 2: Examine Code

```yaml
Examine:
  - File structure and organization
  - Function/method signatures
  - Type definitions
  - Data flow
  - Control flow
  - Error handling
  - Security boundaries
  - Performance characteristics

Tools:
  - grep_search for patterns
  - read_file for content
  - vscode_listCodeUsages for references
  - sequential-thinking for reasoning
```

### Phase 3: Identify Issues

```yaml
Categories:
  Correctness:
    - Logic errors
    - Edge cases missed
    - Race conditions
    - Null references
    - Off-by-one errors

  Security:
    - SQL injection
    - XSS vulnerabilities
    - Authentication bypass
    - Authorization issues
    - Secrets exposure

  Performance:
    - N+1 queries
    - Inefficient algorithms
    - Missing indexes
    - Memory leaks
    - Unnecessary re-renders

  Maintainability:
    - Code duplication
    - Long methods
    - Complex conditionals
    - Poor naming
    - Missing tests

  Reliability:
    - Unhandled errors
    - Missing timeouts
    - No retry logic
    - No circuit breakers
```

### Phase 4: Document Findings

```yaml
Report Structure:
  Summary:
    - What was analyzed
    - Overall assessment
    - Critical issues count

  Findings:
    - Each issue with:
      - Severity (Critical/High/Medium/Low)
      - Location (file:line)
      - Description
      - Impact
      - Recommendation

  Recommendations:
    - Prioritized action items
    - Quick wins
    - Long-term improvements

  Metrics:
    - Lines of code
    - Complexity score
    - Test coverage
    - Dependency count
```

## Output Template

```markdown
## Analysis Report: [Target]

### Summary
[1-2 sentence overview]

### Scope
[What was analyzed]

### Findings

#### 🔴 Critical Issues
1. **[Issue Name]** - `file:line`
   - Description: ...
   - Impact: ...
   - Recommendation: ...

#### 🟠 High Priority
1. **[Issue Name]** - `file:line`
   - Description: ...
   - Impact: ...
   - Recommendation: ...

#### 🟡 Medium Priority
[Issues]

#### 🟢 Low Priority
[Issues]

### Metrics
- Files analyzed: N
- Lines of code: N
- Issues found: N
- Test coverage: X%

### Recommendations
1. **Immediate**: [actions]
2. **Short-term**: [actions]
3. **Long-term**: [actions]
```

## Verification Checklist

- [ ] All relevant files examined
- [ ] Issues categorized by severity
- [ ] Recommendations actionable
- [ ] Metrics included
- [ ] Output is clear and structured

## Example Usage

```yaml
User Request: "Analyze the authentication module"

Agent Invocation:
  1. Identify target: authentication module
  2. Find relevant files: auth.ts, auth.test.ts, middleware/
  3. Examine each file systematically
  4. Categorize findings by severity
  5. Produce structured report
```
