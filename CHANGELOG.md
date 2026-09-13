# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Multi-language code generation for the "Send request" panel — the previous cURL-only block is now a "Code" block with a language picker (the site's own custom select, styled to match the rest of the UI) covering cURL, JavaScript (fetch), Python (requests), C# (HttpClient), Go (net/http), and PowerShell (Invoke-RestMethod)
- The code snippet now shows before the request is ever sent, reflecting the current form state (params, headers, body) as you fill it in, not just after hitting Execute

### Changed
- Response headers moved out of the colored response body box into their own neutral, collapsed-by-default section, so they no longer compete with the response body for attention
- Removed the redundant response-code badge next to the "Response" section title (the spec's documented code) — it sat right above the actual executed status once you hit Execute, showing what looked like two different "200"s at once
- Response block is now colored by status code family instead of a binary success/error split — 2xx green, 3xx blue, 4xx amber, 5xx (and network errors) red

### Fixed
- Response block had a large unexplained gap between the status line and the body — the container had `white-space: pre` intended for its `<pre>` content, but applied at the wrong level it also preserved the whitespace/newlines between the status row and the body in the template markup as visible blank space
- Response headers rendered as bare key/value pairs with no separator between them (e.g. `content-type` directly followed by `application/json...` with no colon), making long values hard to tell apart from the header name
- The endpoint panel's "Headers" section always rendered, even with zero headers configured — showing a bare "No headers" label with no way to act on it. It's now hidden entirely until there's something to show

---

## [1.0.4] - 2026-09-13

### Fixed
- Screenshots section on nuget.org rendering as literal HTML tag text instead of an image gallery — nuget.org's README renderer escapes raw HTML (unlike GitHub's), so the hand-written `<table>` markup never rendered; switched to plain Markdown pipe-tables with `![]()` images, which render identically on both platforms. This was meant to ship in 1.0.3 but that publish still had the pre-fix README baked in, so 1.0.3 was unlisted and this fix went out as 1.0.4 instead.

---

## [1.0.3] - 2026-09-13

### Changed
- UI assets (`index.html`, `css/`, `js/`, `fonts/`) are now vendored into this repo under `assets/ui/` instead of being embedded directly from the private prototype repo at build time — everything compiled into the package is now visible in this public repo

### Fixed
- Horizontal page scroll — `body` was missing `overflow-x: hidden`, so the sidebar resizer's `-8px` offset extended the document's scrollable width; also fixed the mobile environment dropdown using a `100vw`-based width anchored to a non-viewport parent, which could push it past the screen edge
- "Send request" button stuck in the mobile "More" overflow menu instead of taking over the Schema button's slot in the main panel row while an endpoint is open — a prior UI commit had accidentally moved the Schema button's bar anchor into the overflow container along with it

> **Note:** unlisted on nuget.org — the published package still had the pre-fix README with the broken screenshots table (see 1.0.4).

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
