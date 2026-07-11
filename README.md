# Nouf-ex

> B2B/B2C e-commerce marketplace targeting Yemen and the Middle East, modelled on Alibaba/Taobao. React + Vite front-end, Express + PostgreSQL back-end.

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Changelog](https://img.shields.io/badge/keep--a--changelog-1.1.0-blue)](CHANGELOG.md)
[![Code of Conduct](https://img.shields.io/badge/contributor--covenant-3.0-purple)](.github/CODE_OF_CONDUCT.md)
[![Conventional Commits](https://img.shields.io/badge/conventional--commits-1.0.0-blue)](https://www.conventionalcommits.org/)
[![Diátaxis](https://img.shields.io/badge/Di%C3%A1taxis-compliant-purple)](https://diataxis.fr/)

**[Full documentation →](docs/README.md)** · [Contributing →](.github/CONTRIBUTING.md) · [Security →](.github/SECURITY.md) · [Changelog →](CHANGELOG.md)

---

## What it is

A single Node/Express API talks to one external PostgreSQL database, and a React/Vite SPA talks to that API. The whole thing runs as one Docker image when deployed.

| Layer | Tech |
|---|---|
| Database | PostgreSQL 17 (external, database `noufex_db`) — 32 tables (16 + 10 + 6 in migrations), 32 triggers (18 + 14 in migrations) |
| API | Node 20 + Express 5 + `pg`, scrypt, HMAC-SHA256, Zod |
| Frontend | React 19 + React Router 7 + Vite 7 + Tailwind 3 + shadcn/ui |
| i18n | i18next — Arabic (RTL default) / English / Chinese |
| Auth | HttpOnly-cookie session + scrypt + optional TOTP 2FA |
| Container | `node:20-alpine` + tini PID 1 |

## Quick start

```sh
cp .env.example .env             # fill in your DB password
cd app && npm install
npm run db:setup                 # applies database/*.sql
docker compose up -d --build     # API image
```

→ open `http://localhost:3000`.

Without Docker:
```sh
cd app && npm run api            # Express on :3000
cd app && npm run dev            # Vite on :5173 (separate terminal)
```

Full guide: [docs/README.md → Getting started](docs/README.md#1-tutorials-learning-oriented).

## Documentation map

| I want to… | Read |
|---|---|
| Get the project running | [docs/README.md §1](docs/README.md#1-tutorials-learning-oriented) |
| Learn the architecture | [docs/README.md §3 — Reference](docs/README.md#3-reference-information-oriented) |
| Deploy to production | [docs/README.md §2.4 — Deployment](docs/README.md#24-deployment) |
| Find an API endpoint | [docs/README.md §3.1 — API](docs/README.md#31-api-reference) |
| Read the security model | [docs/README.md §3.3 — Security](docs/README.md#33-security-model) |
| Understand a design decision | [docs/README.md §4 — Architecture decisions](docs/README.md#4-explanation-understanding-oriented) |
| See the active backlog | [docs/README.md §5.2 — Roadmap](docs/README.md#52-roadmap) |
| Report a vulnerability | [.github/SECURITY.md](.github/SECURITY.md) |
| Contribute code | [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) |

## License

[MIT](LICENSE) — see the file for the full text.

---

<!-- Schema.org structured data for search-engine crawlers -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Nouf-ex",
  "alternateName": "noufex",
  "description": "B2B/B2C e-commerce marketplace platform for Yemen and the Middle East. React 19 + Vite 7 + Express 5 + PostgreSQL 17.",
  "url": "https://github.com/nashwanzaher/nouf-ex",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "E-commerce Marketplace",
  "operatingSystem": "Cross-platform (Node.js 20.18+, PostgreSQL 17)",
  "softwareRequirements": "Node.js >= 20.18.0, npm >= 10.0.0, PostgreSQL 17",
  "programmingLanguage": ["TypeScript", "SQL", "PL/pgSQL"],
  "runtimePlatform": ["Node.js", "Vite", "Express"],
  "license": "https://github.com/nashwanzaher/nouf-ex/blob/main/LICENSE",
  "codeRepository": "https://github.com/nashwanzaher/nouf-ex",
  "issueTracker": "https://github.com/nashwanzaher/nouf-ex/issues",
  "documentation": "https://github.com/nashwanzaher/nouf-ex/blob/main/docs/README.md",
  "datePublished": "2026-06-01",
  "dateModified": "2026-07-11",
  "author": {"@type": "Organization", "name": "Nouf-ex Team", "url": "https://github.com/nashwanzaher/nouf-ex"},
  "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD", "availability": "https://schema.org/InStock"},
  "keywords": "ecommerce, marketplace, b2b, b2c, yemen, middle-east, react, express, postgresql, i18n, arabic, rtl",
  "inLanguage": ["ar", "en", "zh"]
}
</script>

<meta name="description" content="Nouf-ex — open-source B2B/B2C e-commerce marketplace reference implementation for Yemen and the Middle East. React 19 + Vite 7 + Express 5 + PostgreSQL 17.">
<meta name="keywords" content="ecommerce, marketplace, b2b, b2c, yemen, middle-east, react, vite, express, postgresql, typescript, i18n, arabic, rtl">
<meta name="robots" content="index, follow">
