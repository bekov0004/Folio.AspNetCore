using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.DependencyInjection;

namespace Folio.AspNetCore;

/// <summary>Registers the services behind the self-contained Folio login gate.</summary>
public static class FolioAuthServiceCollectionExtensions
{
    /// <summary>
    /// Adds cookie authentication and an authorization policy dedicated to
    /// gating the Folio UI, configured from <see cref="FolioAuthOptions"/>.
    /// Call this on <c>builder.Services</c> — authentication schemes must be
    /// registered before the app is built. Pair it with
    /// <see cref="FolioAuthMiddlewareExtensions.UseFolioAuth"/> on the built
    /// app, and <c>UseFolio(...)</c> picks up the resulting policy and
    /// logout URL automatically — no need to set
    /// <see cref="FolioOptions.AuthorizationPolicy"/> or
    /// <see cref="FolioOptions.LogoutUrl"/> yourself.
    /// </summary>
    /// <example>
    /// <code>
    /// builder.Services.AddFolioAuth(options =>
    /// {
    ///     options.Users = builder.Configuration.GetSection("Users").Get&lt;List&lt;FolioUser&gt;&gt;() ?? [];
    /// });
    /// // ...
    /// var app = builder.Build();
    /// app.UseFolioAuth();
    /// app.UseFolio(options => options.SpecUrl = "/openapi/v1.json");
    /// </code>
    /// </example>
    public static IServiceCollection AddFolioAuth(this IServiceCollection services, Action<FolioAuthOptions> configure)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configure);

        var options = new FolioAuthOptions();
        configure(options);

        services.AddSingleton(options);

        // Deliberately NOT services.AddAuthentication(FolioAuthDefaults.AuthenticationScheme) —
        // that overload sets the *app-wide default* authentication scheme,
        // which would silently hijack it out from under a host app that
        // registers its own auth (e.g. JWT bearer for its real API) either
        // before or after this call, depending on call order. Registering
        // the scheme by name only, without touching the default, keeps
        // this gate self-contained: FolioMiddleware always authenticates
        // against FolioAuthDefaults.AuthenticationScheme explicitly rather
        // than relying on HttpContext.User being populated by whatever the
        // app-wide default happens to be.
        services.AddAuthentication()
            .AddCookie(FolioAuthDefaults.AuthenticationScheme, cookieOptions =>
            {
                cookieOptions.LoginPath = options.LoginPath;
                cookieOptions.Cookie.Name = options.CookieName;
            });

        services.AddAuthorization(authorizationOptions =>
            authorizationOptions.AddPolicy(FolioAuthDefaults.PolicyName, policy => policy.RequireAuthenticatedUser()));

        return services;
    }
}
