using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;

namespace Folio.AspNetCore;

/// <summary>
/// Reads which roles are already required to reach each endpoint, straight
/// from the app's own routing metadata — <c>[Authorize(Roles = "...")]</c>
/// or an equivalent <see cref="IAuthorizeData"/> already on the endpoint.
/// This is the single source of truth for "what roles does this endpoint
/// require": nothing is invented or duplicated, and nothing needs to change
/// in the host app's OpenAPI generation for it to show up here — Folio
/// reads the live route table directly, not the generated spec.
/// </summary>
internal static class FolioRoleReader
{
    /// <summary>
    /// Builds a map of <c>"METHOD /route/pattern"</c> (matching the key
    /// format already used client-side for the open endpoint, e.g.
    /// <c>"GET /products/{productId}"</c>) to the distinct role names
    /// required for that endpoint. Endpoints with no role requirement are
    /// omitted entirely — the map only ever contains endpoints that
    /// actually restrict access by role today.
    /// </summary>
    public static Dictionary<string, string[]> BuildRoleMap(IEnumerable<EndpointDataSource> dataSources)
    {
        var map = new Dictionary<string, string[]>(StringComparer.Ordinal);

        foreach (var dataSource in dataSources)
        {
            foreach (var endpoint in dataSource.Endpoints)
            {
                if (endpoint is not RouteEndpoint routeEndpoint)
                {
                    continue;
                }

                var methods = endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods;
                if (methods is null || methods.Count == 0)
                {
                    continue;
                }

                var roles = endpoint.Metadata
                    .OfType<IAuthorizeData>()
                    .SelectMany(a => (a.Roles ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    .Distinct(StringComparer.Ordinal)
                    .ToArray();

                if (roles.Length == 0)
                {
                    continue;
                }

                var path = "/" + (routeEndpoint.RoutePattern.RawText ?? string.Empty).TrimStart('/');
                foreach (var method in methods)
                {
                    map[$"{method.ToUpperInvariant()} {path}"] = roles;
                }
            }
        }

        return map;
    }
}
