# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.3] - 2026-09-13

### Changed
- UI assets (`index.html`, `css/`, `js/`, `fonts/`) are now vendored into this repo under `assets/ui/` instead of being embedded directly from the private prototype repo at build time — everything compiled into the package is now visible in this public repo

### Fixed
- Horizontal page scroll — `body` was missing `overflow-x: hidden`, so the sidebar resizer's `-8px` offset extended the document's scrollable width; also fixed the mobile environment dropdown using a `100vw`-based width anchored to a non-viewport parent, which could push it past the screen edge
- "Send request" button stuck in the mobile "More" overflow menu instead of taking over the Schema button's slot in the main panel row while an endpoint is open — a prior UI commit had accidentally moved the Schema button's bar anchor into the overflow container along with it
- Screenshots section on nuget.org rendering as literal HTML tag text instead of an image gallery — nuget.org's README renderer escapes raw HTML (unlike GitHub's), so the hand-written `<table>` markup never rendered; switched to plain Markdown pipe-tables with `![]()` images, which render identically on both platforms

---

## [1.0.2] - 2026-08-10

### Fixed
- README screenshots not rendering on nuget.org — switched to absolute `raw.githubusercontent.com` URLs (nuget.org's readme renderer doesn't resolve relative paths)

---

## [1.0.1] - 2026-08-08

### Fixed
- Package description on nuget.org still referenced "an alternative to Swagger UI and Scalar" from the 1.0.0 publish

---

## [1.0.0] - 2026-08-08

### Added
- Initial release as `Folio.AspNetCore`
- `app.UseFolio(options => {...})` middleware embedding a fully offline OpenAPI documentation and testing UI
- Multi-target support: net6.0, net7.0, net8.0, net9.0
- `FolioOptions`: `RoutePrefix`, `SpecUrl`, `Title`
- Self-hosted fonts and vendored JS/CSS — zero CDN dependencies
