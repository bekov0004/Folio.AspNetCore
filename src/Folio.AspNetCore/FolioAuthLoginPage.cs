using System.Net;

namespace Folio.AspNetCore;

/// <summary>
/// Builds the login page served at <see cref="FolioAuthOptions.LoginPath"/> —
/// styled to match Folio's own dark theme (same colors as the UI's
/// variables.css :root.dark block) instead of a bare unstyled &lt;form&gt;,
/// since this is the first thing a gated visitor sees. Self-contained (no
/// external CSS/font requests), matching the package's own fully-offline
/// design.
/// </summary>
internal static class FolioAuthLoginPage
{
    public static string Build(string title, string loginPath, bool showError, string? returnUrl) => $$"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sign in · {{WebUtility.HtmlEncode(title)}}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
            background: #070b14; color: #d8e0f8;
            font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
          }
          .card {
            width: 100%; max-width: 440px;
            background: #0d1120; border: 1px solid #1a2340; border-radius: 14px;
            padding: 32px 28px; box-shadow: 0 24px 60px rgba(0,0,0,0.4);
          }
          .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
          .brand-logo {
            width: 32px; height: 32px; border-radius: 8px; background: #5b7fff;
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          }
          .brand-logo svg { width: 18px; height: 18px; color: white; }
          .brand-title { font-size: 15px; font-weight: 700; letter-spacing: 0.2px; }
          h1 { font-size: 19px; font-weight: 700; margin-bottom: 6px; }
          .subtitle { font-size: 13px; color: #8b97c0; margin-bottom: 22px; line-height: 1.5; }
          .error {
            background: rgba(255,94,122,0.1); border: 1px solid rgba(255,94,122,0.3);
            color: #ff8fa0; border-radius: 8px; padding: 9px 12px;
            font-size: 12.5px; margin-bottom: 18px;
          }
          label { display: block; font-size: 12px; font-weight: 600; color: #8b97c0; margin-bottom: 6px; }
          .field { margin-bottom: 16px; }
          input {
            width: 100%; background: #111827; border: 1px solid #1a2340; border-radius: 8px;
            padding: 10px 12px; font-size: 13.5px; color: #d8e0f8; outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          input:focus { border-color: #5b7fff; box-shadow: 0 0 0 3px rgba(91,127,255,0.15); }
          button {
            width: 100%; margin-top: 6px; padding: 10px; border: none; border-radius: 8px;
            background: #5b7fff; color: white; font-size: 13.5px; font-weight: 600;
            cursor: pointer; transition: background 0.15s;
          }
          button:hover { background: #7090ff; }
        </style>
        </head>
        <body>
          <div class="card">
            <div class="brand">
              <div class="brand-logo">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <span class="brand-title">{{WebUtility.HtmlEncode(title)}}</span>
            </div>
            <h1>Sign in</h1>
            <p class="subtitle">Sign in to view the API docs.</p>
            {{(showError ? "<div class=\"error\">Wrong username or password.</div>" : "")}}
            <form method="post" action="{{WebUtility.HtmlEncode(loginPath)}}">
              {{(string.IsNullOrEmpty(returnUrl) ? "" : "<input type=\"hidden\" name=\"ReturnUrl\" value=\"" + WebUtility.HtmlEncode(returnUrl) + "\">")}}
              <div class="field">
                <label for="user">Username</label>
                <input id="user" name="user" autocomplete="username" autofocus>
              </div>
              <div class="field">
                <label for="pass">Password</label>
                <input id="pass" name="pass" type="password" autocomplete="current-password">
              </div>
              <button type="submit">Sign in</button>
            </form>
          </div>
        </body>
        </html>
        """;
}
