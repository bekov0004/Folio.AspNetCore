using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;

namespace Folio.AspNetCore;

/// <summary>
/// Folio UI settings, configured in <see cref="FolioMiddlewareExtensions.UseFolio(IApplicationBuilder, Action{FolioOptions})"/>.
/// </summary>
public sealed class FolioOptions
{
    /// <summary>
    /// The path the UI will be served under (no leading or trailing slash).
    /// Defaults to "folio", i.e. the UI opens at "/folio".
    /// </summary>
    public string RoutePrefix { get; set; } = "folio";

    /// <summary>
    /// URL of the OpenAPI (JSON) document the UI will fetch and render.
    /// Can be relative ("/openapi/v1.json") or absolute.
    /// Required — without it the UI has nothing to load.
    /// </summary>
    public string SpecUrl { get; set; } = "/openapi/v1.json";

    /// <summary>
    /// Page title and header text for the UI. If not set, falls back to the
    /// OpenAPI spec's own title ("info.title") once it's loaded.
    /// </summary>
    public string? Title { get; set; }

    /// <summary>
    /// Name of an ASP.NET Core authorization policy that must be satisfied
    /// to access the Folio UI. Unset by default — the UI is open to anyone
    /// who can reach the route.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Requires authentication middleware (<c>app.UseAuthentication()</c>)
    /// to run before <c>app.UseFolio(...)</c> so <c>HttpContext.User</c> is
    /// populated, and <c>builder.Services.AddAuthorization()</c> (plus the
    /// named policy, if it isn't a built-in one) to be registered. An
    /// unauthenticated request gets challenged (e.g. redirected to your
    /// login page for cookie auth, or a 401 for JWT bearer) exactly like a
    /// normal <c>[Authorize]</c> endpoint; an authenticated-but-unauthorized
    /// request gets a 403 — this is the same behavior your other endpoints
    /// already have, not a separate auth system.
    /// </para>
    /// <para>
    /// <b>This only gates the Folio UI itself.</b> It does not protect the
    /// underlying OpenAPI document (<see cref="SpecUrl"/>, typically served
    /// by <c>MapOpenApi()</c> or Swashbuckle) or your actual API endpoints —
    /// anyone who requests that JSON directly still gets the full endpoint
    /// list and schemas, and your API endpoints still respond however they
    /// already do. Protect those the same way you'd protect any other
    /// endpoint (e.g. <c>.RequireAuthorization()</c> on the spec endpoint).
    /// </para>
    /// </remarks>
    public string? AuthorizationPolicy { get; set; }

    /// <summary>
    /// URL to send the user to when they click "Log out" in the Folio
    /// header. Unset by default — no logout button is shown. Typically set
    /// alongside <see cref="AuthorizationPolicy"/>, pointing at whatever
    /// endpoint your app's auth scheme uses to sign out (e.g. a cookie
    /// sign-out endpoint, or your identity provider's logout URL).
    /// </summary>
    public string? LogoutUrl { get; set; }

    /// <summary>
    /// Shows the "Send request" button, letting users execute real requests
    /// against your API from the UI. Default: <c>true</c>.
    /// </summary>
    public bool ShowTryItOut { get; set; } = true;

    /// <summary>
    /// Shows the required-role badges/popover derived from your endpoints'
    /// own <c>[Authorize(Roles = "...")]</c> metadata (see
    /// <see cref="FolioRoleReader"/>). Default: <c>true</c>.
    /// </summary>
    public bool ShowRoles { get; set; } = true;

    /// <summary>
    /// Shows the multi-language code generator (cURL/JS/Python/C#/Go/PowerShell)
    /// in the request panel. Default: <c>true</c>.
    /// </summary>
    public bool ShowCodeGenerator { get; set; } = true;

    /// <summary>
    /// Shows the Schema tab for viewing a request/response model's JSON
    /// schema. Default: <c>true</c>.
    /// </summary>
    public bool ShowSchema { get; set; } = true;

    /// <summary>
    /// Shows the "Home" button in the toolbar, which returns to the welcome
    /// screen. Default: <c>true</c>.
    /// </summary>
    public bool ShowHome { get; set; } = true;

    /// <summary>
    /// Shows the environment switcher (the base-URL selector, including
    /// adding/editing environments and importing servers from the spec).
    /// Default: <c>true</c>.
    /// </summary>
    public bool ShowEnvironmentSwitcher { get; set; } = true;

    /// <summary>
    /// Shows the "Global headers" button, letting users configure headers
    /// sent with every request (e.g. an API key), independent of any single
    /// endpoint. Default: <c>true</c>.
    /// </summary>
    public bool ShowGlobalHeaders { get; set; } = true;

    /// <summary>
    /// Shows the "Authorization" button for the spec's OpenAPI security
    /// schemes (e.g. entering a bearer token). Only ever appears when the
    /// spec actually declares a security scheme — this flag lets you force
    /// it off even then. Default: <c>true</c>.
    /// </summary>
    public bool ShowAuthorize { get; set; } = true;

    /// <summary>
    /// Shows "Save example" and "My examples" — saving a filled-in request
    /// as a named, reusable example. Default: <c>true</c>.
    /// </summary>
    public bool ShowExamples { get; set; } = true;

    /// <summary>
    /// Shows the "Copy endpoint link" (share) button. Default: <c>true</c>.
    /// </summary>
    public bool ShowShare { get; set; } = true;

    /// <summary>
    /// Binds settings from an external configuration source (e.g.
    /// <c>appsettings.json</c>) onto these options. Folio never reads
    /// configuration on its own — this only runs when you call it
    /// explicitly, the same way Serilog's
    /// <c>configuration.ReadFrom.Configuration(...)</c> works.
    /// </summary>
    /// <example>
    /// <code>
    /// app.UseFolio((context, options) =>
    /// {
    ///     options.SpecUrl = "/openapi/v1.json";
    ///     options.ReadFrom.Configuration(context.Configuration, "Folio");
    /// });
    /// </code>
    /// </example>
    public FolioOptionsReadFrom ReadFrom => new(this);
}

/// <summary>
/// Explicit configuration-binding entry point for <see cref="FolioOptions"/>,
/// reached via <see cref="FolioOptions.ReadFrom"/>.
/// </summary>
public readonly struct FolioOptionsReadFrom
{
    private readonly FolioOptions _options;

    internal FolioOptionsReadFrom(FolioOptions options) => _options = options;

    /// <summary>
    /// Binds the given <paramref name="sectionName"/> section of
    /// <paramref name="configuration"/> onto these options, by property name
    /// (e.g. a JSON <c>"ShowTryItOut": false</c> sets
    /// <see cref="FolioOptions.ShowTryItOut"/>). Only touches properties
    /// present in the section — anything already set in code beforehand, or
    /// left at its default, is preserved for keys the section doesn't
    /// contain.
    /// </summary>
    /// <param name="configuration">The configuration to read from — typically your app's own, e.g. from a <c>context</c> parameter or <c>builder.Configuration</c>.</param>
    /// <param name="sectionName">The section name to bind. Defaults to <c>"Folio"</c>.</param>
    public void Configuration(IConfiguration configuration, string sectionName = "Folio")
    {
        ArgumentNullException.ThrowIfNull(configuration);
        configuration.GetSection(sectionName).Bind(_options);
    }
}
