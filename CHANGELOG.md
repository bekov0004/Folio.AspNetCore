# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- UI assets (`index.html`, `css/`, `js/`, `fonts/`) are now vendored into this repo under `assets/ui/` instead of being embedded directly from the private prototype repo at build time — everything compiled into the package is now visible in this public repo

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
