namespace Folio.AspNetCore;

/// <summary>
/// A single account accepted by the built-in Folio login page. Configured
/// via <see cref="FolioAuthOptions.Users"/>, typically bound from
/// configuration (e.g. an appsettings.json section).
/// </summary>
/// <param name="Username">The username entered on the login page.</param>
/// <param name="Password">
/// The matching password. Stored in plain text and compared as-is —
/// fine for gating an internal docs UI behind a shared login, not
/// intended as a substitute for a real user/identity system.
/// </param>
public sealed record FolioUser(string Username, string Password);

/// <summary>
/// Settings for the self-contained cookie-based login gate added by
/// <see cref="FolioAuthServiceCollectionExtensions.AddFolioAuth"/> and
/// <see cref="FolioAuthMiddlewareExtensions.UseFolioAuth"/>.
/// </summary>
/// <remarks>
/// This is the "I have no auth system yet and just want to gate the docs"
/// path. If your app already has its own authentication (ASP.NET Core
/// Identity, JWT bearer, an external provider, ...), use
/// <see cref="FolioOptions.AuthorizationPolicy"/> directly instead — it
/// integrates with whatever you already have rather than adding a second,
/// separate login system.
/// </remarks>
public sealed class FolioAuthOptions
{
    /// <summary>
    /// The accounts accepted by the login page. Empty by default — set
    /// this (typically from configuration) or nobody can sign in.
    /// </summary>
    public List<FolioUser> Users { get; set; } = [];

    /// <summary>
    /// Path the login page is served at. Defaults to "/folio/login" — note
    /// this is independent of <see cref="FolioOptions.RoutePrefix"/>, so if
    /// you change that away from the "folio" default, set this to match
    /// (e.g. "/docs/login") for the two to stay consistent.
    /// </summary>
    public string LoginPath { get; set; } = "/folio/login";

    /// <summary>
    /// Path that signs the current user out and redirects back to
    /// <see cref="LoginPath"/>. Defaults to "/folio/logout" — same
    /// independence from <see cref="FolioOptions.RoutePrefix"/> as
    /// <see cref="LoginPath"/>.
    /// </summary>
    public string LogoutPath { get; set; } = "/folio/logout";

    /// <summary>Name of the authentication cookie. Defaults to "Folio.Auth".</summary>
    public string CookieName { get; set; } = "Folio.Auth";

    /// <summary>
    /// Brand text shown on the login page. Defaults to "Folio" if not set —
    /// note this is a separate setting from <see cref="FolioOptions.Title"/>
    /// (the two are configured independently, before and after
    /// <c>builder.Build()</c> respectively), so set both if you want the
    /// same title in both places.
    /// </summary>
    public string? Title { get; set; }
}

/// <summary>Well-known names used to wire <see cref="FolioAuthOptions"/> into <see cref="FolioOptions"/> automatically.</summary>
internal static class FolioAuthDefaults
{
    public const string AuthenticationScheme = "Folio.Auth";
    public const string PolicyName = "Folio.Auth.RequireUser";
}
