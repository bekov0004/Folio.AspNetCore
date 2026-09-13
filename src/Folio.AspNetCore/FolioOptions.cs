namespace Folio.AspNetCore;

/// <summary>
/// Folio UI settings, configured in <see cref="FolioMiddlewareExtensions.UseFolio"/>.
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
}
