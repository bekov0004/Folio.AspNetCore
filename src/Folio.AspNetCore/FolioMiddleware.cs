using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.DependencyInjection;
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
    private readonly string? _authorizationPolicy;
    private readonly string? _authenticationScheme;
    private readonly PathString? _folioAuthLoginPath;
    private readonly PathString? _folioAuthLogoutPath;

    /// <summary>
    /// Created by the framework via <c>UseMiddleware&lt;FolioMiddleware&gt;</c> —
    /// don't call this directly, use <see cref="FolioMiddlewareExtensions.UseFolio"/>.
    /// </summary>
    public FolioMiddleware(
        RequestDelegate next,
        IWebHostEnvironment hostingEnvironment,
        ILoggerFactory loggerFactory,
        FolioOptions options,
        FolioAuthOptions? folioAuthOptions = null)
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

        // AddFolioAuth()/UseFolioAuth() registers FolioAuthOptions in DI —
        // when present, wire the resulting policy/logout URL automatically
        // instead of making the caller repeat the policy name and path on
        // both calls. AddFolioAuth() deliberately doesn't become the app's
        // default authentication scheme (see its own comment for why), so
        // when it's in play we authenticate against its scheme by name
        // rather than relying on HttpContext.User having been populated by
        // whatever scheme the app-wide default happens to be.
        var authorizationPolicy = options.AuthorizationPolicy
            ?? (folioAuthOptions is not null ? FolioAuthDefaults.PolicyName : null);
        var logoutUrl = options.LogoutUrl ?? folioAuthOptions?.LogoutPath;
        var authenticationScheme = folioAuthOptions is not null ? FolioAuthDefaults.AuthenticationScheme : null;

        _indexHtmlBytes = BuildIndexHtml(fileProvider, options, logoutUrl);
        _authorizationPolicy = authorizationPolicy;
        _authenticationScheme = authenticationScheme;

        // FolioAuthMiddleware (added by UseFolioAuth()) owns these two
        // paths and must be the one to handle them, whichever order it and
        // UseFolio() were registered in. If UseFolio() happened to be
        // registered first and didn't know to exempt them, this gate would
        // challenge a request to the login page itself — an infinite
        // redirect loop, since the browser can never reach a page that
        // would let it authenticate. Skipping straight to _next() here
        // lets the request continue on to wherever FolioAuthMiddleware
        // actually sits in the pipeline, before or after this one.
        if (folioAuthOptions is not null)
        {
            _folioAuthLoginPath = "/" + folioAuthOptions.LoginPath.Trim('/');
            _folioAuthLogoutPath = "/" + folioAuthOptions.LogoutPath.Trim('/');
        }
    }

    /// <summary>Entry point of the ASP.NET Core middleware pipeline.</summary>
    public async Task Invoke(HttpContext httpContext)
    {
        var request = httpContext.Request;

        if (request.Path == _folioAuthLoginPath || request.Path == _folioAuthLogoutPath)
        {
            await _next(httpContext);
            return;
        }

        if (!request.Path.StartsWithSegments(_matchPath, out var remaining))
        {
            await _next(httpContext);
            return;
        }

        if (_authorizationPolicy is { } policy && !await IsAuthorizedAsync(httpContext, policy, _authenticationScheme))
        {
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

    /// <summary>
    /// Checks the given authorization policy against the current user via
    /// the app's own <see cref="IAuthorizationService"/> — resolved
    /// per-request from <see cref="HttpContext.RequestServices"/> rather
    /// than injected into the constructor, since it's typically a scoped
    /// service and this middleware instance is a singleton.
    /// </summary>
    /// <param name="httpContext">The current request.</param>
    /// <param name="policy">Name of the authorization policy to check.</param>
    /// <param name="authenticationScheme">
    /// When set (only for the <c>AddFolioAuth()</c>/<c>UseFolioAuth()</c>
    /// gate — see the constructor), the user is (re-)authenticated against
    /// this specific scheme instead of trusting the ambient
    /// <see cref="HttpContext.User"/>, since Folio's own cookie scheme is
    /// deliberately never made the app's default scheme. For a
    /// caller-supplied <see cref="FolioOptions.AuthorizationPolicy"/> this
    /// is null, and the ambient user (populated by whatever the host app's
    /// own default scheme is) is used instead, exactly like a normal
    /// <c>[Authorize]</c> endpoint would.
    /// </param>
    /// <remarks>
    /// On failure, challenges (unauthenticated) or forbids (authenticated
    /// but not permitted) exactly like a normal <c>[Authorize]</c> endpoint
    /// would, and returns false so the caller stops processing the request.
    /// </remarks>
    private static async Task<bool> IsAuthorizedAsync(HttpContext httpContext, string policy, string? authenticationScheme)
    {
        var authorizationService = httpContext.RequestServices.GetService<IAuthorizationService>();
        if (authorizationService is null)
        {
            throw new InvalidOperationException(
                $"{nameof(FolioOptions.AuthorizationPolicy)} is set but no {nameof(IAuthorizationService)} is " +
                $"registered — call builder.Services.AddAuthorization() before app.UseFolio(...).");
        }

        ClaimsPrincipal user;
        if (authenticationScheme is not null)
        {
            var authenticateResult = await httpContext.AuthenticateAsync(authenticationScheme);
            user = authenticateResult.Succeeded ? authenticateResult.Principal! : new ClaimsPrincipal(new ClaimsIdentity());
        }
        else
        {
            user = httpContext.User;
        }

        var result = await authorizationService.AuthorizeAsync(user, policy);
        if (result.Succeeded)
        {
            return true;
        }

        if (user.Identity?.IsAuthenticated == true)
        {
            await httpContext.ForbidAsync(authenticationScheme);
        }
        else
        {
            await httpContext.ChallengeAsync(authenticationScheme);
        }

        return false;
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

    private static byte[] BuildIndexHtml(IFileProvider fileProvider, FolioOptions options, string? logoutUrl)
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

        var config = new FolioClientConfig(options.SpecUrl, options.Title, logoutUrl);
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

internal sealed record FolioClientConfig(string SpecUrl, string? Title, string? LogoutUrl);

[JsonSerializable(typeof(FolioClientConfig))]
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    GenerationMode = JsonSourceGenerationMode.Serialization)]
internal partial class FolioJsonContext : JsonSerializerContext
{
}
