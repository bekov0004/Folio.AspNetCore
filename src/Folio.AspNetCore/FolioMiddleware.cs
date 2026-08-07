using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.FileProviders.Embedded;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Folio.AspNetCore;

/// <summary>
/// Serves the Folio UI embedded in the assembly: index.html (with the
/// config — spec URL and title — injected) and static assets (css/js) —
/// through the standard <see cref="StaticFileMiddleware"/> configured on
/// top of the assembly's embedded resources, for proper caching/conditional
/// requests instead of hand-rolled file serving.
/// </summary>
public sealed class FolioMiddleware
{
    private readonly RequestDelegate _next;
    private readonly PathString _matchPath;
    private readonly StaticFileMiddleware _staticFileMiddleware;
    private readonly byte[] _indexHtmlBytes;

    /// <summary>
    /// Created by the framework via <c>UseMiddleware&lt;FolioMiddleware&gt;</c> —
    /// don't call this directly, use <see cref="FolioMiddlewareExtensions.UseFolio"/>.
    /// </summary>
    public FolioMiddleware(
        RequestDelegate next,
        IWebHostEnvironment hostingEnvironment,
        ILoggerFactory loggerFactory,
        FolioOptions options)
    {
        ArgumentNullException.ThrowIfNull(next);
        ArgumentNullException.ThrowIfNull(hostingEnvironment);
        ArgumentNullException.ThrowIfNull(loggerFactory);
        ArgumentNullException.ThrowIfNull(options);

        _next = next;
        _matchPath = "/" + options.RoutePrefix.Trim('/');

        var fileProvider = new ManifestEmbeddedFileProvider(typeof(FolioMiddleware).Assembly, "wwwroot");

        var staticFileOptions = new StaticFileOptions
        {
            RequestPath = _matchPath,
            FileProvider = fileProvider,
            ServeUnknownFileTypes = false,
        };
        _staticFileMiddleware = new StaticFileMiddleware(
            next, hostingEnvironment, Options.Create(staticFileOptions), loggerFactory);

        _indexHtmlBytes = BuildIndexHtml(fileProvider, options);
    }

    /// <summary>Entry point of the ASP.NET Core middleware pipeline.</summary>
    public async Task Invoke(HttpContext httpContext)
    {
        var request = httpContext.Request;

        if (!request.Path.StartsWithSegments(_matchPath, out var remaining))
        {
            await _next(httpContext);
            return;
        }

        // Without a trailing slash, relative paths ("css/layout.css") inside
        // index.html would resolve outside the prefix — redirect instead.
        if (remaining == PathString.Empty && request.Path.Value is { } p && !p.EndsWith('/'))
        {
            var target = request.PathBase + request.Path + "/" + request.QueryString;
            httpContext.Response.Redirect(target);
            return;
        }

        if (remaining == PathString.Empty || remaining == "/" || remaining == "/index.html")
        {
            await WriteIndexHtmlAsync(httpContext);
            return;
        }

        await _staticFileMiddleware.Invoke(httpContext);
    }

    private async Task WriteIndexHtmlAsync(HttpContext httpContext)
    {
        var response = httpContext.Response;
        response.StatusCode = StatusCodes.Status200OK;
        response.ContentType = "text/html; charset=utf-8";
        response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        response.ContentLength = _indexHtmlBytes.Length;
        await response.Body.WriteAsync(_indexHtmlBytes, httpContext.RequestAborted);
    }

    private static byte[] BuildIndexHtml(IFileProvider fileProvider, FolioOptions options)
    {
        var fileInfo = fileProvider.GetFileInfo("index.html");
        if (!fileInfo.Exists)
        {
            throw new InvalidOperationException(
                "Embedded resource 'wwwroot/index.html' was not found in the Folio.AspNetCore assembly. " +
                "The package appears to be built incorrectly.");
        }

        string html;
        using (var stream = fileInfo.CreateReadStream())
        using (var reader = new StreamReader(stream, Encoding.UTF8))
        {
            html = reader.ReadToEnd();
        }

        var config = new FolioClientConfig(options.SpecUrl, options.Title);
        var configJson = JsonSerializer.Serialize(config, FolioJsonContext.Default.FolioClientConfig);
        var configScript = $"<script>window.__SPECTRA_CONFIG__ = {configJson};</script>";

        const string marker = "<head>";
        var idx = html.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        html = idx >= 0
            ? html.Insert(idx + marker.Length, "\n  " + configScript)
            : configScript + html;

        return Encoding.UTF8.GetBytes(html);
    }
}

internal sealed record FolioClientConfig(string SpecUrl, string? Title);

[JsonSerializable(typeof(FolioClientConfig))]
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    GenerationMode = JsonSourceGenerationMode.Serialization)]
internal partial class FolioJsonContext : JsonSerializerContext
{
}
