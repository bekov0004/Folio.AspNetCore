using Microsoft.AspNetCore.Builder;

namespace Folio.AspNetCore;

/// <summary>Wires the self-contained Folio login gate into the ASP.NET Core pipeline.</summary>
public static class FolioAuthMiddlewareExtensions
{
    /// <summary>
    /// Adds authentication/authorization middleware and the login/logout
    /// routes for the Folio auth gate configured via
    /// <see cref="FolioAuthServiceCollectionExtensions.AddFolioAuth"/>.
    /// <c>UseFolio(...)</c> picks up the resulting policy and logout URL
    /// automatically, with no need to set
    /// <see cref="FolioOptions.AuthorizationPolicy"/> or
    /// <see cref="FolioOptions.LogoutUrl"/> yourself — in either call order;
    /// <c>UseFolio</c>'s own gate always lets the login/logout paths through
    /// to whichever middleware actually owns them. Calling this one first is
    /// still the clearer read, though.
    /// </summary>
    public static IApplicationBuilder UseFolioAuth(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.UseAuthentication();
        app.UseAuthorization();
        app.UseMiddleware<FolioAuthMiddleware>();

        return app;
    }
}
