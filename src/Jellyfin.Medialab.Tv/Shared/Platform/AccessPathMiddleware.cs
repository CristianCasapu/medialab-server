using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using MediaLabTv.Core;
using MediaLabTv.Localization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace MediaLabTv.Platform;

/// <summary>
/// Calea de acces /web/&lt;cale&gt;/ pe Jellyfin: cererile ei se rescriu, inainte ca Jellyfin sa le vada, spre /MediaLabTv/
/// (adresa din bara ramane /web/&lt;cale&gt;/). Nu se scrie nimic in folderul interfetei web, deci nu e nimic de refacut
/// dupa actualizarile Jellyfin; merge la fel pe Jellyfin oficial si pe medialab Server.
/// O cale care exista deja in interfata web (folder sau fisier) nu se acopera niciodata.
/// </summary>
public static class AccessPathRewrite
{
    /// <summary>Ce face cererea: null = nimic; „redirect:&lt;cale&gt;” sau „rewrite:&lt;cale&gt;”.</summary>
    public static string? Decide(string? path, string baseUrl, string? slug, Func<string, bool> existsInWeb)
    {
        if (string.IsNullOrEmpty(path) || string.IsNullOrEmpty(slug))
        {
            return null;
        }

        var prefix = baseUrl.TrimEnd('/') + "/web/" + slug;
        if (!path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var rest = path[prefix.Length..];
        if (rest.Length > 0 && rest[0] != '/')
        {
            return null;
        }

        if (existsInWeb(slug))
        {
            return null;
        }

        if (rest.Length == 0)
        {
            return "redirect:" + prefix + "/";
        }

        rest = rest[1..];
        if (rest.Length == 0)
        {
            rest = "index.html";
        }

        // Doar fisierele aplicatiei (un singur nivel): restul ramane al lui Jellyfin (404).
        if (rest.Contains('/', StringComparison.Ordinal) || rest.Contains("..", StringComparison.Ordinal))
        {
            return null;
        }

        return "rewrite:" + baseUrl.TrimEnd('/') + "/MediaLabTv/" + rest;
    }
}

/// <summary>Pune rescrierea la inceputul cererilor Jellyfin.</summary>
public sealed class AccessPathStartupFilter : IStartupFilter
{
    private readonly IServerConfigurationManager _config;

    public AccessPathStartupFilter(IServerConfigurationManager config)
    {
        _config = config;
        // Textele pentru admin in limba interfetei serverului.
        L.Use(config);
    }

    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use((context, nextMiddleware) =>
        {
            try
            {
                if (Apply(context))
                {
                    return Task.CompletedTask;
                }
            }
            catch (Exception)
            {
                // Calea proprie e o comoditate: orice problema lasa cererea exact cum a venit.
            }

            return nextMiddleware(context);
        });
        next(app);
    };

    /// <summary>true = raspunsul e dat aici (redirectionare spre /web/&lt;cale&gt;/).</summary>
    private bool Apply(HttpContext context)
    {
        var settings = Plugin.Instance?.Configuration;
        var path = context.Request.Path.Value;
        if (settings == null || path == null || path.IndexOf("/web/", StringComparison.OrdinalIgnoreCase) < 0)
        {
            return false;
        }

        var webPath = _config.ApplicationPaths.WebPath;
        var decision = AccessPathRewrite.Decide(path, _config.GetNetworkConfiguration().BaseUrl ?? string.Empty, Branding.Slug(settings.AccessSlug),
            slug => !string.IsNullOrEmpty(webPath) && (Directory.Exists(Path.Combine(webPath, slug)) || File.Exists(Path.Combine(webPath, slug))));
        if (decision == null)
        {
            return false;
        }

        if (decision.StartsWith("redirect:", StringComparison.Ordinal))
        {
            context.Response.StatusCode = StatusCodes.Status302Found;
            context.Response.Headers.Location = decision["redirect:".Length..] + context.Request.QueryString;
            return true;
        }

        context.Request.Path = decision["rewrite:".Length..];
        return false;
    }
}
