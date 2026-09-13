using Folio.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

// User list for the Folio login gate, read from appsettings.json's "Users"
// section — everything else (cookie issuance, the login/logout routes and
// pages, wiring into UseFolio below) is handled by AddFolioAuth/UseFolioAuth.
builder.Services.AddFolioAuth(options =>
{
    options.Users = builder.Configuration.GetSection("Users").Get<List<FolioUser>>() ?? [];
    options.Title = "Folio Sample API";
});

var app = builder.Build();

app.MapOpenApi();

app.UseFolioAuth();

app.UseFolio(options =>
{
    options.SpecUrl = "/openapi/v1.json";
    options.Title = "Folio Sample API";
});

app.MapGet("/api/hello", (string? name) => Results.Ok(new { message = $"Hello, {name ?? "world"}!" }))
    .WithName("SayHello")
    .WithSummary("Greeting")
    .WithDescription("Returns a greeting message.");

app.MapGet("/api/items/{id:int}", (int id) => Results.Ok(new { id, name = $"Item {id}" }))
    .WithName("GetItemById");

app.MapPost("/api/items", (CreateItemRequest request) => Results.Created($"/api/items/1", new { id = 1, request.Name }))
    .WithName("CreateItem");

/* ── 2xx-family sample endpoints ──
   /api/hello (200) and the items endpoints above already cover the
   plain success case — these round out the rest of the 2xx range. */
app.MapGet("/api/success/201", () => Results.Json(
        new { id = 42, name = "New Item" },
        statusCode: StatusCodes.Status201Created))
    .WithName("CreatedExample")
    .WithSummary("201 Created")
    .WithDescription("Simulates a resource creation response (same status as POST /api/items).");

app.MapGet("/api/success/202", () => Results.Json(
        new { jobId = "job_8f2a1c", status = "queued", message = "The request has been accepted for background processing." },
        statusCode: StatusCodes.Status202Accepted))
    .WithName("AcceptedExample")
    .WithSummary("202 Accepted")
    .WithDescription("Simulates an async job accepted for processing, not yet complete.");

app.MapGet("/api/success/204", () => Results.NoContent())
    .WithName("NoContentExample")
    .WithSummary("204 No Content")
    .WithDescription("Simulates a successful request with an empty response body (e.g. after a DELETE).");

/* ── Error-status sample endpoints ──
   Each just returns a fixed status + JSON body — for eyeballing how
   the UI renders every common status family (2xx/4xx/5xx) without
   needing a real backend to fail on demand. */
app.MapGet("/api/errors/400", () => Results.Json(
        new { error = "bad_request", message = "The 'quantity' field must be a positive integer." },
        statusCode: StatusCodes.Status400BadRequest))
    .WithName("BadRequestExample")
    .WithSummary("400 Bad Request")
    .WithDescription("Simulates a validation error on the request.");

app.MapGet("/api/errors/404", () => Results.Json(
        new { error = "not_found", message = "No item exists with the given id." },
        statusCode: StatusCodes.Status404NotFound))
    .WithName("NotFoundExample")
    .WithSummary("404 Not Found")
    .WithDescription("Simulates a missing resource.");

app.MapGet("/api/errors/500", () => Results.Json(
        new { error = "internal_server_error", message = "Something went wrong on our end." },
        statusCode: StatusCodes.Status500InternalServerError))
    .WithName("InternalServerErrorExample")
    .WithSummary("500 Internal Server Error")
    .WithDescription("Simulates an unhandled server-side error.");

app.MapGet("/", () => Results.Redirect("/folio/"));

app.Run();

internal sealed record CreateItemRequest(string Name, decimal Price);
