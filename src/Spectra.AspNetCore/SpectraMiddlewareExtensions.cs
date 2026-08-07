using Microsoft.AspNetCore.Builder;

namespace Spectra.AspNetCore;

/// <summary>Wires the Spectra UI into the ASP.NET Core pipeline.</summary>
public static class SpectraMiddlewareExtensions
{
    /// <summary>
    /// Adds the Spectra UI — an OpenAPI documentation and testing interface.
    /// </summary>
    /// <param name="app">The application pipeline builder.</param>
    /// <param name="configure">
    /// Configures <see cref="SpectraOptions"/>: at minimum you must set
    /// <see cref="SpectraOptions.SpecUrl"/> — the URL of your OpenAPI document
    /// (e.g. from Swashbuckle or the built-in Microsoft.AspNetCore.OpenApi).
    /// </param>
    /// <example>
    /// <code>
    /// app.UseSpectra(options =>
    /// {
    ///     options.RoutePrefix = "docs";
    ///     options.SpecUrl = "/openapi/v1.json";
    ///     options.Title = "My API";
    /// });
    /// </code>
    /// </example>
    public static IApplicationBuilder UseSpectra(this IApplicationBuilder app, Action<SpectraOptions>? configure = null)
    {
        ArgumentNullException.ThrowIfNull(app);

        var options = new SpectraOptions();
        configure?.Invoke(options);

        if (string.IsNullOrWhiteSpace(options.SpecUrl))
        {
            throw new ArgumentException(
                $"{nameof(SpectraOptions.SpecUrl)} is required — set it to your app's OpenAPI document URL.",
                nameof(configure));
        }

        return app.UseMiddleware<SpectraMiddleware>(options);
    }
}
