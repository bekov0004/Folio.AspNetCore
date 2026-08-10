# Folio.AspNetCore

An embeddable OpenAPI documentation and testing UI for ASP.NET Core,
packaged as middleware: no separate infrastructure, no static hosting —
just a NuGet package.

## Screenshots

*Rendered from a sample e-commerce API spec — see [`docs/demo-openapi.json`](docs/demo-openapi.json).*

**Endpoint list, model catalog and a request in flight:**

![Welcome screen](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/01-home.png)

**Query parameters, headers from the spec, and the generated response schema:**

![GET endpoint](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/02-endpoint-get.png)

**Type-aware request body builder with nested objects and multiple response codes:**

![POST endpoint with request body](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/03-endpoint-post-body.png)

**Executing a request from the browser — status, timing, headers and generated cURL:**

![Executed response](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/04-execute-response.png)

**Full model catalog, resolved and searchable:**

![Model catalog](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/05-schema-models.png)

**Authorization against the spec's security schemes:**

![Authorize modal](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/06-authorize.png)

**Instant endpoint search:**

![Search](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/07-search.png)

**Dark mode:**

![Dark mode](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/08-dark-mode.png)

## Installation

```bash
dotnet add package Folio.AspNetCore
```

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

The package's static assets are built from a single source tree shared
with the standalone version of the UI, with no manual duplication between
repositories.

## Requirements

- ASP.NET Core, .NET 6, 7, 8, or 9.
- No internet connection required at all: fonts, Tailwind CSS, marked.js,
  and flatpickr are all bundled locally and embedded into the package
  assembly along with the rest of the UI — zero external requests, both at
  build time and in the user's browser.
