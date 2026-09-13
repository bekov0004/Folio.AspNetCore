using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;

namespace Folio.AspNetCore;

/// <summary>
/// Serves the login/logout routes for the self-contained Folio auth gate:
/// GET <see cref="FolioAuthOptions.LoginPath"/> shows the login page; POST
/// to the same path checks the submitted credentials and, on a match,
/// signs the user in via cookie authentication. GET
/// <see cref="FolioAuthOptions.LogoutPath"/> signs them out. Everything
/// else passes through unchanged.
/// </summary>
public sealed class FolioAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly FolioAuthOptions _options;
    private readonly string _title;

    /// <summary>
    /// Created by the framework via <c>UseMiddleware&lt;FolioAuthMiddleware&gt;</c> —
    /// don't call this directly, use <see cref="FolioAuthMiddlewareExtensions.UseFolioAuth"/>.
    /// </summary>
    public FolioAuthMiddleware(RequestDelegate next, FolioAuthOptions options)
    {
        ArgumentNullException.ThrowIfNull(next);
        ArgumentNullException.ThrowIfNull(options);

        _next = next;
        _options = options;
        _title = options.Title ?? "Folio";
    }

    /// <summary>Entry point of the ASP.NET Core middleware pipeline.</summary>
    public async Task Invoke(HttpContext httpContext)
    {
        var path = httpContext.Request.Path;

        if (path.Equals(_options.LoginPath, StringComparison.OrdinalIgnoreCase))
        {
            if (HttpMethods.IsPost(httpContext.Request.Method))
            {
                await HandleLoginSubmitAsync(httpContext);
            }
            else
            {
                await WriteLoginPageAsync(httpContext, showError: false, GetReturnUrl(httpContext.Request.Query));
            }

            return;
        }

        if (path.Equals(_options.LogoutPath, StringComparison.OrdinalIgnoreCase))
        {
            await httpContext.SignOutAsync(FolioAuthDefaults.AuthenticationScheme);
            httpContext.Response.Redirect(_options.LoginPath);
            return;
        }

        await _next(httpContext);
    }

    private async Task HandleLoginSubmitAsync(HttpContext httpContext)
    {
        // Credentials travel in the POST body, not the query string, so
        // they don't end up in server/proxy access logs or browser history.
        var form      = await httpContext.Request.ReadFormAsync(httpContext.RequestAborted);
        var user      = form["user"].ToString();
        var pass      = form["pass"].ToString();
        var returnUrl = GetReturnUrl(form);

        var matchedUser = _options.Users.FirstOrDefault(candidate => Matches(candidate, user, pass));

        if (matchedUser is null)
        {
            await WriteLoginPageAsync(httpContext, showError: true, returnUrl);
            return;
        }

        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.Name, matchedUser.Username)],
            FolioAuthDefaults.AuthenticationScheme);
        await httpContext.SignInAsync(FolioAuthDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

        httpContext.Response.Redirect(IsLocalUrl(returnUrl) ? returnUrl! : "/");
    }

    private async Task WriteLoginPageAsync(HttpContext httpContext, bool showError, string? returnUrl)
    {
        httpContext.Response.ContentType = "text/html; charset=utf-8";
        var html = FolioAuthLoginPage.Build(_title, _options.LoginPath, showError, returnUrl);
        await httpContext.Response.WriteAsync(html, httpContext.RequestAborted);
    }

    private static string? GetReturnUrl(IQueryCollection query) =>
        query.TryGetValue("ReturnUrl", out var v) && v.ToString() is { Length: > 0 } s ? s : null;

    private static string? GetReturnUrl(IFormCollection form) =>
        form.TryGetValue("ReturnUrl", out var v) && v.ToString() is { Length: > 0 } s ? s : null;

    /// <summary>
    /// Username and password are compared in constant time, independent of
    /// where the first mismatching byte falls, so response timing can't be
    /// used to guess credentials one character at a time.
    /// </summary>
    private static bool Matches(FolioUser candidate, string user, string pass) =>
        FixedTimeEquals(candidate.Username, user) && FixedTimeEquals(candidate.Password, pass);

    private static bool FixedTimeEquals(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));

    /// <summary>
    /// True only for a same-app absolute-path URL ("/foo") — rejects
    /// absolute URLs and, critically, protocol-relative ones
    /// ("//evil.com/x"): browsers treat a leading "//" as "same scheme,
    /// different host", so naively checking only
    /// <see cref="Uri.IsWellFormedUriString(string?, UriKind)"/> with
    /// <see cref="UriKind.Relative"/> would let an attacker-supplied
    /// ReturnUrl bounce a freshly-authenticated user straight to an
    /// external site. Every ReturnUrl this middleware itself hands out
    /// (see <see cref="GetReturnUrl(IQueryCollection)"/>) is always such a
    /// path, so this only ever rejects a tampered-with value.
    /// </summary>
    private static bool IsLocalUrl(string? url) =>
        !string.IsNullOrEmpty(url) && url[0] == '/' && (url.Length == 1 || (url[1] != '/' && url[1] != '\\'));
}
