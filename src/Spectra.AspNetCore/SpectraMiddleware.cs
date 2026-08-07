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

namespace Spectra.AspNetCore;

/// <summary>
/// Отдаёт встроенный в сборку UI Spectra: index.html (с подставленным
/// конфигом — URL спецификации и заголовок) и статику (css/js) —
/// через штатный <see cref="StaticFileMiddleware"/>, настроенный поверх
/// эмбеддед-ресурсов сборки, для честного кеширования/условных запросов
/// вместо самодельной раздачи файлов.
/// </summary>
public sealed class SpectraMiddleware
{
    private readonly RequestDelegate _next;
    private readonly PathString _matchPath;
    private readonly StaticFileMiddleware _staticFileMiddleware;
    private readonly byte[] _indexHtmlBytes;

    /// <summary>
    /// Создаётся фреймворком через <c>UseMiddleware&lt;SpectraMiddleware&gt;</c> —
    /// вызывать напрямую не нужно, используйте <see cref="SpectraMiddlewareExtensions.UseSpectra"/>.
    /// </summary>
    public SpectraMiddleware(
        RequestDelegate next,
        IWebHostEnvironment hostingEnvironment,
        ILoggerFactory loggerFactory,
        SpectraOptions options)
    {
        ArgumentNullException.ThrowIfNull(next);
        ArgumentNullException.ThrowIfNull(hostingEnvironment);
        ArgumentNullException.ThrowIfNull(loggerFactory);
        ArgumentNullException.ThrowIfNull(options);

        _next = next;
        _matchPath = "/" + options.RoutePrefix.Trim('/');

        var fileProvider = new ManifestEmbeddedFileProvider(typeof(SpectraMiddleware).Assembly, "wwwroot");

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

    /// <summary>Точка входа конвейера ASP.NET Core middleware.</summary>
    public async Task Invoke(HttpContext httpContext)
    {
        var request = httpContext.Request;

        if (!request.Path.StartsWithSegments(_matchPath, out var remaining))
        {
            await _next(httpContext);
            return;
        }

        // Без завершающего слэша относительные пути ("css/layout.css")
        // внутри index.html разрешились бы мимо префикса — редиректим.
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

    private static byte[] BuildIndexHtml(IFileProvider fileProvider, SpectraOptions options)
    {
        var fileInfo = fileProvider.GetFileInfo("index.html");
        if (!fileInfo.Exists)
        {
            throw new InvalidOperationException(
                "Встроенный ресурс 'wwwroot/index.html' не найден в сборке Spectra.AspNetCore. " +
                "Пакет собран некорректно.");
        }

        string html;
        using (var stream = fileInfo.CreateReadStream())
        using (var reader = new StreamReader(stream, Encoding.UTF8))
        {
            html = reader.ReadToEnd();
        }

        var config = new SpectraClientConfig(options.SpecUrl, options.Title);
        var configJson = JsonSerializer.Serialize(config, SpectraJsonContext.Default.SpectraClientConfig);
        var configScript = $"<script>window.__SPECTRA_CONFIG__ = {configJson};</script>";

        const string marker = "<head>";
        var idx = html.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        html = idx >= 0
            ? html.Insert(idx + marker.Length, "\n  " + configScript)
            : configScript + html;

        return Encoding.UTF8.GetBytes(html);
    }
}

internal sealed record SpectraClientConfig(string SpecUrl, string? Title);

[JsonSerializable(typeof(SpectraClientConfig))]
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    GenerationMode = JsonSourceGenerationMode.Serialization)]
internal partial class SpectraJsonContext : JsonSerializerContext
{
}
