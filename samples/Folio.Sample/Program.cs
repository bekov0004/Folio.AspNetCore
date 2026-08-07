using Folio.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

app.MapOpenApi();

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

app.MapGet("/", () => Results.Redirect("/folio/"));

app.Run();

internal sealed record CreateItemRequest(string Name, decimal Price);
