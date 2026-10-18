using System.Text;
using MediaBrowser.Common.Api;
using MediaBrowser.Common.Extensions;
using MediaBrowser.Controller.Authentication;
using MediaBrowser.Controller.Net;
using MediaBrowser.Controller.Session;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using MediaLabTv.Core;
using MediaLabTv.Licensing;
using MediaLabTv.Localization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediaLabTv.Api;

public sealed class LogoUpload
{
    public string DataUrl { get; set; } = string.Empty;
}

public sealed class TvLoginRequest
{
    public string? Username { get; set; }

    public string? Pw { get; set; }

    /// <summary>Tokenul widget-ului Turnstile (cf-turnstile-response).</summary>
    public string? Turnstile { get; set; }
}

public sealed class TvLoginError
{
    public string Error { get; set; } = string.Empty;
}

public sealed class TurnstileStatus
{
    public bool Enabled { get; set; }

    /// <summary>Activ = pornit si cu ambele chei (proprii sau din Registration).</summary>
    public bool Active { get; set; }

    public bool FromRegistration { get; set; }

    /// <summary>Plugin-ul Registration e instalat si poate da cheile.</summary>
    public bool RegistrationAvailable { get; set; }

    /// <summary>Registration are ambele chei setate.</summary>
    public bool RegistrationHasKeys { get; set; }

    /// <summary>Cheile de test Cloudflare (trec sau pica mereu): doar pentru probe.</summary>
    public bool TestKeys { get; set; }
}

public sealed class LogoResult
{
    public bool Ok { get; set; }

    public string? Error { get; set; }

    public bool Custom { get; set; }

    public int Version { get; set; }
}

public sealed class AccessPathStatus
{
    public string Slug { get; set; } = string.Empty;

    public bool Valid { get; set; }

    /// <summary>/web/&lt;cale&gt;/ (cu BaseUrl-ul Jellyfin); gol = fara cale proprie.</summary>
    public string Path { get; set; } = string.Empty;

    /// <summary>Calea exista deja in interfata web Jellyfin: nu se acopera (alege alta).</summary>
    public bool Conflict { get; set; }

    public string BaseUrl { get; set; } = string.Empty;

    public bool Licensed { get; set; }
}

/// <summary>Aplicatia TV (/MediaLabTv/…), tema, sigla si endpoint-urile paginii de administrare.</summary>
[ApiController]
[Route("MediaLabTv")]
public sealed class TvController : ControllerBase
{
    private static readonly Dictionary<string, string> Files = new(StringComparer.Ordinal)
    {
        ["tv.js"] = "text/javascript; charset=utf-8",
        ["app.css"] = "text/css; charset=utf-8",
        ["browse.js"] = "text/javascript; charset=utf-8",
        ["browse.css"] = "text/css; charset=utf-8",
        // hls.js 1.5.20 (Apache-2.0, nemodificat; THIRD-PARTY-NOTICES.txt): playerul interfetei MediaLab TV.
        ["hls.js"] = "text/javascript; charset=utf-8",
        ["icon-128.png"] = "image/png",
        ["icon-256.png"] = "image/png",
        ["icon-512.png"] = "image/png",
        ["icon.svg"] = "image/svg+xml",
    };

    private readonly IServerConfigurationManager _config;
    private readonly ILogger<TvController> _logger;
    private readonly ISessionManager _sessions;
    private readonly IAuthorizationContext _authorization;

    public TvController(IServerConfigurationManager config, ILogger<TvController> logger, ISessionManager sessions, IAuthorizationContext authorization)
    {
        _config = config;
        _logger = logger;
        _sessions = sessions;
        _authorization = authorization;
    }

    private string BaseUrl => (_config.GetNetworkConfiguration().BaseUrl ?? string.Empty).TrimEnd('/');

    /// <summary>/MediaLabTv → /MediaLabTv/ (adresele relative din pagina).</summary>
    [HttpGet("")]
    [AllowAnonymous]
    public ActionResult GetRoot()
    {
        var path = Request.Path.Value ?? string.Empty;
        return Redirect(path.EndsWith('/') ? "index.html" : "MediaLabTv/");
    }

    [HttpGet("{name}")]
    [AllowAnonymous]
    public ActionResult GetFile([FromRoute] string name)
    {
        var plugin = Plugin.Instance;
        if (plugin == null)
        {
            return NotFound();
        }

        switch (name)
        {
            case "index.html":
                // Fara licenta: ecran neutru, fara numele sau sigla clientului.
                if (!LicenseGate.AllowsFull)
                {
                    return Send(ReadResource("unavailable.html"), "text/html; charset=utf-8", cache: false);
                }

                var values = plugin.Values();
                var html = Branding.RenderIndex(Encoding.UTF8.GetString(ReadResource("index.html")), values, "jellyfin", BaseUrl, LicenseConfig.PluginVersion);
                return Send(Encoding.UTF8.GetBytes(html), "text/html; charset=utf-8", cache: false, turnstile: values.TurnstileSiteKey.Length > 0);
            case "browse.html":
                // Interfata stil Netflix: aceeasi pagina pe ambele platforme; datele vin din API-ul Jellyfin cu tokenul utilizatorului.
                if (!LicenseGate.AllowsFull)
                {
                    return Send(ReadResource("unavailable.html"), "text/html; charset=utf-8", cache: false);
                }

                var page = Branding.RenderIndex(Encoding.UTF8.GetString(ReadResource("browse.html")), plugin.Values(), "jellyfin", BaseUrl, LicenseConfig.PluginVersion);
                return Send(Encoding.UTF8.GetBytes(page), "text/html; charset=utf-8", cache: false, player: true);
            case "browse-theme.css":
                return Send(Encoding.UTF8.GetBytes(Branding.BrowseThemeCss(plugin.Values())), "text/css; charset=utf-8", cache: true);
            case "theme.css":
                return Send(Encoding.UTF8.GetBytes(Branding.ThemeCss(plugin.Values())), "text/css; charset=utf-8", cache: true);
            case "logo":
                var file = plugin.Configuration.LogoFile;
                if (file is "logo.png" or "logo.svg" && System.IO.File.Exists(System.IO.Path.Combine(plugin.BrandingDirectory, file)))
                {
                    var data = System.IO.File.ReadAllBytes(System.IO.Path.Combine(plugin.BrandingDirectory, file));
                    if (file == "logo.png")
                    {
                        return Send(data, "image/png", cache: true);
                    }

                    // Siglele incarcate inainte de 1.2.2 trec acum prin lista permisa; una refuzata nu se mai arata.
                    var clean = SvgSanitizer.Sanitize(data);
                    if (clean != null)
                    {
                        return Send(clean, "image/svg+xml", cache: true);
                    }
                }

                return Send(ReadResource("icon-256.png"), "image/png", cache: true);
        }

        return Files.TryGetValue(name, out var type) ? Send(ReadResource(name), type, cache: true) : NotFound();
    }

    /// <summary>
    /// K20: conectarea paginii TV cand Turnstile e activ. Anonim; limita pe IP si pe server; tokenul se verifica la
    /// Cloudflare cu IP-ul clientului (Jellyfin crede antetele de proxy doar de la KnownProxies); apoi exact calea lui
    /// /Users/AuthenticateByName (ISessionManager.AuthenticateNewSession: blocarea dupa parole gresite, conturi
    /// dezactivate), cu acelasi rezultat JSON.
    /// </summary>
    [HttpPost("Login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthenticationResult>> Login([FromBody] TvLoginRequest request)
    {
        var plugin = Plugin.Instance;
        if (plugin == null || !LicenseGate.AllowsFull)
        {
            return StatusCode(503, new TvLoginError { Error = "unavailable" });
        }

        var keys = plugin.TurnstileKeys();
        if (keys == null)
        {
            // Turnstile oprit: pagina foloseste /Users/AuthenticateByName; endpoint-ul nu e o a doua usa fara verificare.
            return StatusCode(404, new TvLoginError { Error = "disabled" });
        }

        var client = HttpContext.GetNormalizedRemoteIP().ToString();
        if (!LoginLimiter.Shared.TryAcquire(client, DateTimeOffset.UtcNow))
        {
            _logger.LogInformation("MediaLab TV: prea multe încercări de conectare de la {Client}", client);
            return StatusCode(429, new TvLoginError { Error = "too_many" });
        }

        var hosts = Turnstile.Hosts(Request.Headers.Host.ToString()); // ML-01: doar Host (nu X-Forwarded-Host/Origin, controlate de client)
        var outcome = await Turnstile.VerifyAsync(keys.SecretKey, request?.Turnstile, client, hosts, HttpContext.RequestAborted).ConfigureAwait(false);
        if (outcome != TurnstileOutcome.Ok)
        {
            _logger.LogInformation("MediaLab TV: conectare refuzată de Turnstile ({Outcome}) de la {Client}", outcome, client);
            return StatusCode(400, new TvLoginError { Error = "turnstile" });
        }

        var auth = await _authorization.GetAuthorizationInfo(Request).ConfigureAwait(false);
        try
        {
            return await _sessions.AuthenticateNewSession(new AuthenticationRequest
            {
                App = auth.Client,
                AppVersion = auth.Version,
                DeviceId = auth.DeviceId,
                DeviceName = auth.Device,
                Password = request!.Pw,
                RemoteEndPoint = client,
                Username = request.Username,
            }).ConfigureAwait(false);
        }
        catch (System.Security.SecurityException ex)
        {
            throw new System.Security.SecurityException("[" + client + "] " + ex.Message, ex);
        }
    }

    [HttpGet("Admin/Turnstile")]
    [Authorize(Policy = Policies.RequiresElevation)]
    public TurnstileStatus GetTurnstile()
    {
        var plugin = Plugin.Instance!;
        var keys = plugin.TurnstileKeys();
        var shared = Turnstile.RegistrationKeys();
        return new TurnstileStatus
        {
            Enabled = plugin.Configuration.TurnstileEnabled,
            Active = keys != null,
            FromRegistration = keys?.FromRegistration == true,
            RegistrationAvailable = Turnstile.RegistrationAvailable(),
            RegistrationHasKeys = shared is { Length: >= 2 } && !string.IsNullOrWhiteSpace(shared[0]) && !string.IsNullOrWhiteSpace(shared[1]),
            TestKeys = keys != null && Turnstile.IsTestSecret(keys.SecretKey),
        };
    }

    [HttpGet("Admin/AccessPath")]
    [Authorize(Policy = Policies.RequiresElevation)]
    public AccessPathStatus GetAccessPath()
    {
        var c = Plugin.Instance?.Configuration ?? new PluginConfiguration();
        var slug = Branding.Slug(c.AccessSlug);
        var web = _config.ApplicationPaths.WebPath;
        return new AccessPathStatus
        {
            Slug = slug ?? string.Empty,
            Valid = slug != null,
            Path = slug is { Length: > 0 } ? BaseUrl + "/web/" + slug + "/" : string.Empty,
            Conflict = slug is { Length: > 0 } && !string.IsNullOrEmpty(web) && (Directory.Exists(System.IO.Path.Combine(web, slug)) || System.IO.File.Exists(System.IO.Path.Combine(web, slug))),
            BaseUrl = BaseUrl,
            Licensed = LicenseGate.AllowsFull,
        };
    }

    [HttpPost("Admin/Logo")]
    [Authorize(Policy = Policies.RequiresElevation)]
    public LogoResult PostLogo([FromBody] LogoUpload upload)
    {
        var plugin = Plugin.Instance!;
        var raw = Branding.DecodeUpload(upload?.DataUrl);
        var logo = raw == null ? null : Branding.PrepareLogo(raw);
        if (logo == null)
        {
            return new LogoResult { Error = L.T("Sigla trebuie să fie PNG sau SVG (fără scripturi), cel mult 512 KB.", "The logo must be PNG or SVG (no scripts), at most 512 KB."), Custom = plugin.Configuration.LogoFile.Length > 0, Version = plugin.Configuration.LogoVersion };
        }

        Directory.CreateDirectory(plugin.BrandingDirectory);
        foreach (var old in Directory.GetFiles(plugin.BrandingDirectory, "logo.*"))
        {
            System.IO.File.Delete(old);
        }

        var (kind, data) = logo.Value;
        var file = "logo." + kind;
        System.IO.File.WriteAllBytes(System.IO.Path.Combine(plugin.BrandingDirectory, file), data);
        plugin.Configuration.LogoFile = file;
        plugin.Configuration.LogoVersion++;
        plugin.SaveConfiguration();
        _logger.LogInformation("MediaLab TV: sigla nouă {File} ({Bytes} octeți)", file, data.Length);
        return new LogoResult { Ok = true, Custom = true, Version = plugin.Configuration.LogoVersion };
    }

    [HttpDelete("Admin/Logo")]
    [Authorize(Policy = Policies.RequiresElevation)]
    public LogoResult DeleteLogo()
    {
        var plugin = Plugin.Instance!;
        if (Directory.Exists(plugin.BrandingDirectory))
        {
            foreach (var old in Directory.GetFiles(plugin.BrandingDirectory, "logo.*"))
            {
                System.IO.File.Delete(old);
            }
        }

        plugin.Configuration.LogoFile = string.Empty;
        plugin.Configuration.LogoVersion++;
        plugin.SaveConfiguration();
        return new LogoResult { Ok = true, Custom = false, Version = plugin.Configuration.LogoVersion };
    }

    private FileContentResult Send(byte[] data, string type, bool cache, bool player = false, bool turnstile = false)
    {
        var svg = type.StartsWith("image/svg", StringComparison.Ordinal);
        Response.Headers["Content-Security-Policy"] = Branding.ContentSecurityPolicy(svg, player, turnstile);
        if (svg)
        {
            Response.Headers["Content-Disposition"] = "inline; filename=logo.svg";
        }

        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        // Adresele cu ?v= se schimba la fiecare versiune / sigla / tema noua.
        Response.Headers["Cache-Control"] = cache ? "max-age=300" : "no-cache";
        return File(data, type);
    }

    private static byte[] ReadResource(string name)
    {
        using var stream = typeof(TvController).Assembly.GetManifestResourceStream("MediaLabTv.Tv." + name)
            ?? throw new FileNotFoundException(name);
        using var copy = new MemoryStream();
        stream.CopyTo(copy);
        return copy.ToArray();
    }
}
