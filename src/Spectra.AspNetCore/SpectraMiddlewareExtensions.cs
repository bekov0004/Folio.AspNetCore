using Microsoft.AspNetCore.Builder;

namespace Spectra.AspNetCore;

/// <summary>Точка подключения UI Spectra к конвейеру ASP.NET Core.</summary>
public static class SpectraMiddlewareExtensions
{
    /// <summary>
    /// Подключает UI Spectra — интерфейс документации и тестирования OpenAPI.
    /// </summary>
    /// <param name="app">Конвейер приложения.</param>
    /// <param name="configure">
    /// Настройка <see cref="SpectraOptions"/>: как минимум нужно указать
    /// <see cref="SpectraOptions.SpecUrl"/> — адрес вашего OpenAPI-документа
    /// (например, от Swashbuckle или встроенного Microsoft.AspNetCore.OpenApi).
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
                $"{nameof(SpectraOptions.SpecUrl)} обязателен — укажите адрес OpenAPI-документа вашего приложения.",
                nameof(configure));
        }

        return app.UseMiddleware<SpectraMiddleware>(options);
    }
}
