# Folio.AspNetCore

An embeddable OpenAPI documentation and testing UI for ASP.NET Core,
packaged as middleware: no separate infrastructure, no static hosting —
just a NuGet package.

## Screenshots

*Rendered from a sample e-commerce API spec — see [`docs/demo-openapi.json`](docs/demo-openapi.json). Click a thumbnail for the full-size screenshot.*

| ![Welcome screen](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/01-home.png) | ![GET endpoint](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/02-endpoint-get.png) | ![POST endpoint with request body](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/03-endpoint-post-body.png) | ![Executed response](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/04-execute-response.png) |
|:---:|:---:|:---:|:---:|
| Endpoint list & model catalog | GET endpoint & response schema | Type-aware request body builder | Request execution & generated cURL |

| ![Model catalog](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/05-schema-models.png) | ![Authorize modal](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/06-authorize.png) | ![Search](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/07-search.png) | ![Dark mode](https://raw.githubusercontent.com/bekov0004/Folio.AspNetCore/main/docs/screenshots/08-dark-mode.png) |
|:---:|:---:|:---:|:---:|
| Full, searchable model catalog | Authorization against security schemes | Instant endpoint search | Dark mode |

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

| Property             | Default               | Description                                                            |
|----------------------|------------------------|--------------------------------------------------------------------------|
| `RoutePrefix`        | `"folio"`             | Path the UI is served under (no leading/trailing slashes).              |
| `SpecUrl`            | `"/openapi/v1.json"`  | URL of the OpenAPI document — required for a real project.              |
| `Title`              | `null`                | Page/header title. Falls back to the spec's `info.title` if not set.    |
| `AuthorizationPolicy`| `null`                | Name of an ASP.NET Core authorization policy the UI is gated behind. See [Authorization](#authorization). |
| `LogoutUrl`          | `null`                | Shows a "Log out" button in the header, pointing here. Hidden if unset. |

## Authorization

By default the UI is open to anyone who can reach the route. Two ways to gate it:

**You already have auth in your app** (cookie, JWT bearer, ASP.NET Core
Identity, an external provider, ...) — point `AuthorizationPolicy` at a
policy name and Folio integrates with it the same way a normal
`[Authorize]` endpoint would:

```csharp
builder.Services.AddAuthorization(options =>
    options.AddPolicy("FolioAccess", policy => policy.RequireAuthenticatedUser()));

app.UseAuthentication();
app.UseAuthorization();

app.UseFolio(options =>
{
    options.SpecUrl = "/openapi/v1.json";
    options.AuthorizationPolicy = "FolioAccess";
    options.LogoutUrl = "/account/logout"; // wherever your app signs out
});
```

> **Note:** this only gates the Folio UI itself — it doesn't protect the
> underlying OpenAPI document or your actual API endpoints. Protect those
> the same way you'd protect any other endpoint.

**You have no auth system yet** and just want to put a login in front of
the docs — `AddFolioAuth`/`UseFolioAuth` is a self-contained alternative:
give it a list of users and it handles cookie issuance, a login page
(styled to match Folio's own dark theme), and the login/logout routes,
wiring itself into `UseFolio(...)` automatically:

```csharp
builder.Services.AddFolioAuth(options =>
{
    options.Users = builder.Configuration.GetSection("Users").Get<List<FolioUser>>() ?? [];
});

var app = builder.Build();

app.UseFolioAuth();
app.UseFolio(options => options.SpecUrl = "/openapi/v1.json");
```

```json
// appsettings.json
{
  "Users": [
    { "Username": "admin", "Password": "correct-horse-battery-staple" }
  ]
}
```

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
