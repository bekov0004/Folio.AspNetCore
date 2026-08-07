namespace Spectra.AspNetCore;

/// <summary>
/// Настройки UI Spectra, задаются в <see cref="SpectraMiddlewareExtensions.UseSpectra"/>.
/// </summary>
public sealed class SpectraOptions
{
    /// <summary>
    /// Путь, под которым будет доступен UI (без ведущего и завершающего слэша).
    /// По умолчанию — "spectra", т.е. UI откроется на "/spectra".
    /// </summary>
    public string RoutePrefix { get; set; } = "spectra";

    /// <summary>
    /// URL документа OpenAPI (JSON), который UI загрузит и отобразит.
    /// Может быть как относительным ("/openapi/v1.json"), так и абсолютным.
    /// Обязателен для указания — без него UI не сможет загрузить спецификацию.
    /// </summary>
    public string SpecUrl { get; set; } = "/openapi/v1.json";

    /// <summary>
    /// Заголовок страницы и текст в шапке UI. Если не задан — используется
    /// заголовок ("info.title") из самой OpenAPI-спецификации после её загрузки.
    /// </summary>
    public string? Title { get; set; }
}
