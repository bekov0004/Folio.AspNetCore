using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Folio.AspNetCore;

/// <summary>Wires the Folio UI into the ASP.NET Core pipeline.</summary>
public static class FolioMiddlewareExtensions
{
    /// <summary>
    /// Adds the Folio UI — an OpenAPI documentation and testing interface.
    /// </summary>
    /// <param name="app">The application pipeline builder.</param>
    /// <param name="configure">
    /// Configures <see cref="FolioOptions"/>: at minimum you must set
    /// <see cref="FolioOptions.SpecUrl"/> — the URL of your OpenAPI document
    /// (e.g. from Swashbuckle or the built-in Microsoft.AspNetCore.OpenApi).
    /// </param>
    /// <example>
    /// <code>
    /// app.UseFolio(options =>
    /// {
    ///     options.RoutePrefix = "docs";
    ///     options.SpecUrl = "/openapi/v1.json";
    ///     options.Title = "My API";
    /// });
    /// </code>
    /// </example>
    public static IApplicationBuilder UseFolio(this IApplicationBuilder app, Action<FolioOptions>? configure = null)
    {
        ArgumentNullException.ThrowIfNull(app);

        var options = new FolioOptions();
        configure?.Invoke(options);

        ValidateOptions(options, nameof(configure));
        return app.UseMiddleware<FolioMiddleware>(options);
    }

    /// <summary>
    /// Adds the Folio UI, giving the configuration callback access to the
    /// app's <see cref="IConfiguration"/> and <see cref="IWebHostEnvironment"/>
    /// via <paramref name="configure"/>'s <see cref="FolioConfigurationContext"/>
    /// parameter — most commonly to explicitly opt into binding settings
    /// from <c>appsettings.json</c> via <see cref="FolioOptions.ReadFrom"/>.
    /// </summary>
    /// <param name="app">The application pipeline builder.</param>
    /// <param name="configure">Configures <see cref="FolioOptions"/>, with access to the app's configuration and environment.</param>
    /// <example>
    /// <code>
    /// app.UseFolio((context, options) =>
    /// {
    ///     options.SpecUrl = "/openapi/v1.json";
    ///     options.ReadFrom.Configuration(context.Configuration, "Folio");
    /// });
    /// </code>
    /// </example>
    public static IApplicationBuilder UseFolio(this IApplicationBuilder app, Action<FolioConfigurationContext, FolioOptions> configure)
    {
        ArgumentNullException.ThrowIfNull(app);
        ArgumentNullException.ThrowIfNull(configure);

        var options = new FolioOptions();
        var context = new FolioConfigurationContext(
            app.ApplicationServices.GetRequiredService<IConfiguration>(),
            app.ApplicationServices.GetRequiredService<IWebHostEnvironment>());

        configure(context, options);

        ValidateOptions(options, nameof(configure));
        return app.UseMiddleware<FolioMiddleware>(options);
    }

    private static void ValidateOptions(FolioOptions options, string paramName)
    {
        if (string.IsNullOrWhiteSpace(options.SpecUrl))
        {
            throw new ArgumentException(
                $"{nameof(FolioOptions.SpecUrl)} is required — set it to your app's OpenAPI document URL.",
                paramName);
        }
    }
}

/// <summary>
/// Gives a Folio configuration callback access to the app's own
/// <see cref="IConfiguration"/> and <see cref="IWebHostEnvironment"/>, e.g.
/// to explicitly bind <c>appsettings.json</c> via
/// <see cref="FolioOptions.ReadFrom"/>. See
/// <see cref="FolioMiddlewareExtensions.UseFolio(IApplicationBuilder, Action{FolioConfigurationContext, FolioOptions})"/>.
/// </summary>
public sealed class FolioConfigurationContext
{
    /// <summary>The application's configuration.</summary>
    public IConfiguration Configuration { get; }

    /// <summary>The application's hosting environment.</summary>
    public IWebHostEnvironment Environment { get; }

    internal FolioConfigurationContext(IConfiguration configuration, IWebHostEnvironment environment)
    {
        Configuration = configuration;
        Environment = environment;
    }
}
