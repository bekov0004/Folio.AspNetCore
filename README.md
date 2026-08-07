# Spectra.AspNetCore

An embeddable OpenAPI documentation and testing UI for ASP.NET Core — an
alternative to Swagger UI and Scalar. The same UI as
[Spectra](https://github.com/), packaged as middleware: no separate
infrastructure, no static hosting — just a NuGet package.

## Installation

```bash
dotnet add package Spectra.AspNetCore
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

app.UseSpectra(options =>
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

app.UseSpectra(options =>
{
    options.SpecUrl = "/swagger/v1/swagger.json";
});
```

Open `/docs` (or your configured `RoutePrefix`) — you'll see the endpoint
list, model schemas, a type-aware request builder, in-browser request
execution with generated cURL, environment support, and authorization
against the spec's security schemes (`apiKey`, HTTP Bearer/Basic).

## Options (`SpectraOptions`)

| Property      | Default               | Description                                                          |
|---------------|------------------------|------------------------------------------------------------------------|
| `RoutePrefix` | `"spectra"`           | Path the UI is served under (no leading/trailing slashes).            |
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

The package's static assets come from the same `htdocs` as the standalone
Spectra prototype: a single set of files, no manual duplication between
repositories.

## Requirements

- ASP.NET Core, .NET 8 or .NET 9.
- No internet connection required at all: fonts, Tailwind CSS, marked.js,
  and flatpickr are all bundled locally and embedded into the package
  assembly along with the rest of the UI — zero external requests, both at
  build time and in the user's browser.
