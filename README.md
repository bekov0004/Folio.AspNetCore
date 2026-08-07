# Spectra.AspNetCore

Встраиваемый в ASP.NET Core интерфейс документации и тестирования OpenAPI —
альтернатива Swagger UI и Scalar. Тот же UI, что и в
[Spectra](https://github.com/), упакованный как middleware: никакой
отдельной инфраструктуры, никакого статического хостинга — просто
NuGet-пакет.

## Установка

```bash
dotnet add package Spectra.AspNetCore
```

## Использование

Пакет ничего не знает о том, как вы генерируете OpenAPI-документ — он
только отображает то, что вы укажете в `SpecUrl`. Подходит любой источник:
встроенный `Microsoft.AspNetCore.OpenApi`, Swashbuckle, NSwag или статический
файл.

### С встроенным Microsoft.AspNetCore.OpenApi (.NET 9+)

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();

var app = builder.Build();

app.MapOpenApi(); // публикует /openapi/v1.json

app.UseSpectra(options =>
{
    options.RoutePrefix = "docs";           // UI будет на /docs
    options.SpecUrl     = "/openapi/v1.json";
    options.Title       = "My API";          // необязательно
});

app.Run();
```

### Со Swashbuckle

```csharp
builder.Services.AddSwaggerGen();
// ...
app.UseSwagger(); // публикует /swagger/v1/swagger.json

app.UseSpectra(options =>
{
    options.SpecUrl = "/swagger/v1/swagger.json";
});
```

Откройте `/docs` (или заданный `RoutePrefix`) — увидите список эндпоинтов,
схему моделей, конструктор запросов по типам полей, выполнение запросов
прямо из браузера с генерацией cURL, поддержку окружений и авторизации по
security schemes спецификации (`apiKey`, HTTP Bearer/Basic).

## Опции (`SpectraOptions`)

| Свойство      | По умолчанию         | Описание                                                              |
|---------------|-----------------------|------------------------------------------------------------------------|
| `RoutePrefix` | `"spectra"`           | Путь, под которым откроется UI (без слэшей по краям).                 |
| `SpecUrl`     | `"/openapi/v1.json"`  | Адрес OpenAPI-документа — обязателен для реального проекта.           |
| `Title`       | `null`                | Заголовок страницы/шапки. Если не задан — берётся `info.title` спека. |

## Как это устроено

UI (HTML/CSS/JS) встроен в сборку пакета как embedded-ресурсы и раздаётся
через штатный `StaticFileMiddleware` поверх `ManifestEmbeddedFileProvider` —
с корректными `ETag`/`Last-Modified`/условными запросами, без самодельной
раздачи файлов. `index.html` отдаётся отдельным лёгким обработчиком, который
на лету подставляет конфигурацию (`SpecUrl`, `Title`) в `<script>` перед
загрузкой остальных скриптов — сам UI ничего не хардкодит и работает с
любым OpenAPI-документом, который вы укажете.

Источник статики пакета — тот же `htdocs`, что и у standalone-прототипа
Spectra: один набор файлов, без ручного дублирования между репозиториями.

## Требования

- ASP.NET Core, .NET 8 или .NET 9.
- Интернет не нужен вообще: шрифты, Tailwind CSS, marked.js и flatpickr
  собраны локально и встроены в сборку пакета вместе с остальным UI — ни
  одного внешнего запроса ни при сборке проекта, ни в браузере пользователя.
