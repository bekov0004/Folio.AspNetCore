# Folio.AspNetCore

An embeddable OpenAPI documentation and testing UI for ASP.NET Core,
packaged as middleware: no separate infrastructure, no static hosting —
just a NuGet package.

## Screenshots

*Rendered from a sample e-commerce API spec — see [`docs/demo-openapi.json`](docs/demo-openapi.json). Click a thumbnail for the full-size screenshot.*

<table>
<tr>
<td width="25%" align="center">
<a href="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/01-home.png"><img src="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/01-home.png" alt="Welcome screen" /></a>
<br />Endpoint list &amp; model catalog
</td>
<td width="25%" align="center">
<a href="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/02-endpoint-get.png"><img src="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/02-endpoint-get.png" alt="GET endpoint" /></a>
<br />GET endpoint &amp; response schema
</td>
<td width="25%" align="center">
<a href="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/03-endpoint-post-body.png"><img src="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/03-endpoint-post-body.png" alt="POST endpoint with request body" /></a>
<br />Type-aware request body builder
</td>
<td width="25%" align="center">
<a href="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/04-execute-response.png"><img src="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/04-execute-response.png" alt="Executed response" /></a>
<br />Request execution &amp; generated cURL
</td>
</tr>
<tr>
<td width="25%" align="center">
<a href="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/05-schema-models.png"><img src="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/05-schema-models.png" alt="Model catalog" /></a>
<br />Full, searchable model catalog
</td>
<td width="25%" align="center">
<a href="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/06-authorize.png"><img src="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/06-authorize.png" alt="Authorize modal" /></a>
<br />Authorization against security schemes
</td>
<td width="25%" align="center">
<a href="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/07-search.png"><img src="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/07-search.png" alt="Search" /></a>
<br />Instant endpoint search
</td>
<td width="25%" align="center">
<a href="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/08-dark-mode.png"><img src="https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/08-dark-mode.png" alt="Dark mode" /></a>
<br />Dark mode
</td>
</tr>
</table>

## Installation

```bash
dotnet add package Folio.AspNetCore
```

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Usage

The package doesn't care how you generate your OpenAPI document — it just
renders whatever you point it at via `SpecUrl`. Any source works: the
built-in `Microsoft.AspNetCore.OpenApi`, Swashbuckle, NSwag, or a static
file.

### With built-in Microsoft.AspNetCore.OpenApi (.NET 9+)

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();

var app = builder.Build();

app.MapOpenApi(); // publishes /openapi/v1.json

app.UseFolio(options =>
{
    options.RoutePrefix = "docs";           // UI will be at /docs
    options.SpecUrl     = "/openapi/v1.json";
    options.Title       = "My API";          // optional
});

app.Run();
```

### With Swashbuckle

```csharp
builder.Services.AddSwaggerGen();
// ...
app.UseSwagger(); // publishes /swagger/v1/swagger.json

app.UseFolio(options =>
{
    options.SpecUrl = "/swagger/v1/swagger.json";
});
```

Open `/docs` (or your configured `RoutePrefix`) — you'll see the endpoint
list, model schemas, a type-aware request builder, in-browser request
execution with generated cURL, environment support, and authorization
against the spec's security schemes (`apiKey`, HTTP Bearer/Basic).

## Options (`FolioOptions`)

| Property      | Default               | Description                                                          |
|---------------|------------------------|------------------------------------------------------------------------|
| `RoutePrefix` | `"folio"`             | Path the UI is served under (no leading/trailing slashes).            |
| `SpecUrl`     | `"/openapi/v1.json"`  | URL of the OpenAPI document — required for a real project.            |
| `Title`       | `null`                | Page/header title. Falls back to the spec's `info.title` if not set.  |

## How it works

The UI (HTML/CSS/JS) is embedded into the package assembly as embedded
resources and served through the standard `StaticFileMiddleware` on top of
a `ManifestEmbeddedFileProvider` — with proper `ETag`/`Last-Modified`/
conditional requests, not hand-rolled file serving. `index.html` is served
by a small dedicated handler that injects configuration (`SpecUrl`, `Title`)
into a `<script>` tag on the fly before the rest of the scripts load — the
UI itself hardcodes nothing and works with whatever OpenAPI document you
point it at.

The package's static assets live in this repo under [`assets/ui/`](assets/ui/)
so everything embedded in the published package is visible right here —
nothing is pulled in from an external source at build time.

## Requirements

- ASP.NET Core, .NET 6, 7, 8, or 9.
- No internet connection required at all: fonts, Tailwind CSS, marked.js,
  and flatpickr are all bundled locally and embedded into the package
  assembly along with the rest of the UI — zero external requests, both at
  build time and in the user's browser.
