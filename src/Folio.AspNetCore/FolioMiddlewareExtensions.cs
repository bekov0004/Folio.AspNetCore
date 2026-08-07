using Microsoft.AspNetCore.Builder;

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

        if (string.IsNullOrWhiteSpace(options.SpecUrl))
        {
            throw new ArgumentException(
                $"{nameof(FolioOptions.SpecUrl)} is required — set it to your app's OpenAPI document URL.",
                nameof(configure));
        }

        return app.UseMiddleware<FolioMiddleware>(options);
    }
}
