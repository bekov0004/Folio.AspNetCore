namespace Spectra.AspNetCore;

/// <summary>
/// Spectra UI settings, configured in <see cref="SpectraMiddlewareExtensions.UseSpectra"/>.
/// </summary>
public sealed class SpectraOptions
{
    /// <summary>
    /// The path the UI will be served under (no leading or trailing slash).
    /// Defaults to "spectra", i.e. the UI opens at "/spectra".
    /// </summary>
    public string RoutePrefix { get; set; } = "spectra";

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
}
