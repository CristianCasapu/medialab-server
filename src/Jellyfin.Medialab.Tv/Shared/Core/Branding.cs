using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace MediaLabTv.Core;

/// <summary>Valorile de branding curatate, gata de pus in pagina (fara Emby/Jellyfin: aceeasi clasa pe ambele platforme).</summary>
public sealed class BrandingValues
{
    public string Name { get; init; } = Branding.DefaultName;

    public string ShortName { get; init; } = Branding.DefaultName;

    public string Tagline { get; init; } = string.Empty;

    /// <summary>Gol = textul implicit al aplicatiei (in limba televizorului).</summary>
    public string Footer { get; init; } = string.Empty;

    public string Accent { get; init; } = Branding.DefaultAccent;

    public string Background { get; init; } = Branding.DefaultBackground;

    /// <summary>auto, ro sau en.</summary>
    public string Language { get; init; } = "auto";

    public bool Phone { get; init; } = true;

    public bool Register { get; init; } = true;

    public int LogoVersion { get; init; }

    /// <summary>Dupa conectare: „ui” (interfata MediaLab TV) sau „web” (interfata web a serverului).</summary>
    public string AfterSignIn { get; init; } = "ui";

    /// <summary>Randurile de TV in direct in interfata MediaLab TV.</summary>
    public bool LiveTv { get; init; } = true;

    /// <summary>Televizoarele pastreaza si parola (implicit nu: doar tokenul serverului).</summary>
    public bool RememberPassword { get; init; }

    /// <summary>Cheia publica Cloudflare Turnstile cand protectia e activa (setata si cu ambele chei); gol = fara.</summary>
    public string TurnstileSiteKey { get; init; } = string.Empty;
}

/// <summary>Curatarea setarilor, pagina aplicatiei si tema (culorile) generate din ele.</summary>
public static partial class Branding
{
    public const string DefaultName = "MediaLab TV";

    public const string DefaultAccent = "#52b54b";

    public const string DefaultBackground = "#101418";

    public const int MaxLogoBytes = 512 * 1024;

    [GeneratedRegex("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")]
    private static partial Regex ColorPattern();

    [GeneratedRegex("^[a-z0-9][a-z0-9_-]{0,39}$")]
    private static partial Regex SlugPattern();

    /// <summary>#rrggbb (litere mici); orice altceva = <paramref name="fallback"/>.</summary>
    public static string Color(string? value, string fallback)
    {
        var v = (value ?? string.Empty).Trim();
        if (!ColorPattern().IsMatch(v))
        {
            return fallback;
        }

        if (v.Length == 4)
        {
            v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        }

        return v.ToLowerInvariant();
    }

    /// <summary>Text pe un singur rand, fara caractere de control, cel mult <paramref name="max"/> caractere.</summary>
    public static string Text(string? value, int max)
    {
        var sb = new StringBuilder();
        foreach (var c in (value ?? string.Empty).Trim())
        {
            if (!char.IsControl(c))
            {
                sb.Append(c);
            }
        }

        var s = sb.ToString().Trim();
        return s.Length <= max ? s : s[..max].TrimEnd();
    }

    public static string Language(string? value) => (value ?? string.Empty).Trim().ToLowerInvariant() switch
    {
        "ro" => "ro",
        "en" => "en",
        _ => "auto",
    };

    /// <summary>„web” ramane „web”; orice altceva = „ui” (interfata MediaLab TV, implicit).</summary>
    public static string AfterSignIn(string? value) => string.Equals((value ?? string.Empty).Trim(), "web", StringComparison.OrdinalIgnoreCase) ? "web" : "ui";

    /// <summary>Calea de acces: „tv”, „/web/tv/”, „TV” → „tv”. Gol → gol (fara cale proprie). Invalid → null.</summary>
    public static string? Slug(string? value)
    {
        var v = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (v.StartsWith("/web/", StringComparison.Ordinal))
        {
            v = v[5..];
        }
        else if (v.StartsWith("web/", StringComparison.Ordinal))
        {
            v = v[4..];
        }

        v = v.Trim('/');
        if (v.Length == 0)
        {
            return string.Empty;
        }

        if (v.EndsWith("/index.html", StringComparison.Ordinal))
        {
            v = v[..^"/index.html".Length];
        }

        return SlugPattern().IsMatch(v) ? v : null;
    }

    /// <summary>Luminanta relativa (WCAG) a unei culori #rrggbb.</summary>
    public static double Luminance(string color)
    {
        static double Channel(string hex)
        {
            var c = int.Parse(hex, NumberStyles.HexNumber, CultureInfo.InvariantCulture) / 255.0;
            return c <= 0.03928 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);
        }

        return (0.2126 * Channel(color.Substring(1, 2))) + (0.7152 * Channel(color.Substring(3, 2))) + (0.0722 * Channel(color.Substring(5, 2)));
    }

    /// <summary>Textul care se citeste pe fundalul dat: deschis pe fundal inchis si invers.</summary>
    public static string ReadableOn(string background) => Luminance(background) > 0.4 ? "#111111" : "#ffffff";

    /// <summary>
    /// Tema: culorile setate peste app.css (fara variabile CSS, ca sa mearga si in browserele vechi ale televizoarelor).
    /// </summary>
    public static string ThemeCss(BrandingValues b)
    {
        var light = Luminance(b.Background) > 0.4;
        var text = light ? "#151515" : "#f2f2f2";
        var muted = light ? "#4a5056" : "#8a9199";
        var soft = light ? "#2f3438" : "#cfcfcf";
        var field = light ? "#ffffff" : "#1d2329";
        var border = light ? "#c4cad0" : "#2a3138";
        var focus = light ? "#111111" : "#ffffff";
        var onAccent = ReadableOn(b.Accent);
        var css = new StringBuilder();
        css.Append("/* Tema generata din setarile plugin-ului. */\n");
        css.Append("html, body { background: ").Append(b.Background).Append("; color: ").Append(text).Append("; }\n");
        css.Append(".site { color: ").Append(b.Accent).Append("; }\n");
        css.Append("#status, label, #qrState, #qrText { color: ").Append(soft).Append("; }\n");
        css.Append(".hint { color: ").Append(muted).Append("; }\n");
        css.Append("#footer { color: ").Append(muted).Append("; }\n");
        css.Append("input { background: ").Append(field).Append("; color: ").Append(text).Append("; }\n");
        css.Append("input, button { border-color: ").Append(border).Append("; }\n");
        css.Append("button { background: ").Append(b.Accent).Append("; color: ").Append(onAccent).Append("; }\n");
        css.Append("button.secondary { background: ").Append(border).Append("; color: ").Append(text).Append("; }\n");
        css.Append("input:focus, button:focus, .focus { border-color: ").Append(focus).Append("; box-shadow: 0 0 0 4px ").Append(b.Accent).Append("; }\n");
        css.Append("#qr.noimg #qrCode { color: ").Append(text).Append("; }\n");
        return css.ToString();
    }

    /// <summary>
    /// Tema interfetei MediaLab TV (stil Netflix): mereu inchisa; fundalul setat doar daca e inchis, accentul pe butoane,
    /// focus si barele de progres. Fara variabile CSS (browserele vechi ale televizoarelor).
    /// </summary>
    public static string BrowseThemeCss(BrandingValues b)
    {
        var bg = Luminance(b.Background) < 0.05 ? b.Background : "#141414";
        var onAccent = ReadableOn(b.Accent);
        var css = new StringBuilder();
        css.Append("/* Tema generata din setarile plugin-ului. */\n");
        css.Append("html, body, .ml-screen, .ml-fade { background-color: ").Append(bg).Append("; }\n");
        css.Append(".ml-hero-shade { background-image: linear-gradient(to right, ").Append(bg).Append(" 0%, rgba(0,0,0,0) 65%), linear-gradient(to top, ").Append(bg).Append(" 0%, rgba(0,0,0,0) 40%); }\n");
        css.Append(".ml-btn.primary, .ml-key:focus, .ml-chip.on { background: ").Append(b.Accent).Append("; color: ").Append(onAccent).Append("; }\n");
        css.Append(".ml-progress span, .ml-osd-bar span, .ml-nav a.on:after { background: ").Append(b.Accent).Append("; }\n");
        css.Append(".f:focus, .ml-card:focus .ml-img, .ml-person:focus .ml-face, .ml-profile:focus .ml-avatar { outline-color: ").Append(b.Accent).Append("; }\n");
        css.Append(".ml-ep:focus, .ml-chip:focus, .ml-menu a:focus, .ml-track-opt:focus { box-shadow: 0 0 0 3px ").Append(b.Accent).Append("; }\n");
        return css.ToString();
    }

    public static string Html(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

    /// <summary>
    /// CSP-ul paginilor: o sigla SVG deschisa direct nu poate rula nimic (sandbox); playerul (hls.js) lucreaza cu blob-uri
    /// si un worker; cu Turnstile activ pagina de conectare incarca scriptul si cadrul Cloudflare (doar atunci).
    /// </summary>
    public static string ContentSecurityPolicy(bool svg, bool player, bool turnstile)
    {
        if (svg)
        {
            return "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";
        }

        if (player)
        {
            return "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
        }

        return turnstile
            ? "default-src 'self'; script-src 'self' " + TurnstileOrigin + "; frame-src " + TurnstileOrigin + "; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
            : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
    }

    public const string TurnstileOrigin = "https://challenges.cloudflare.com";

    /// <summary>Pagina aplicatiei din sablonul index.html: valorile intra doar HTML-codificate.</summary>
    /// <param name="template">Tv/index.html.</param>
    /// <param name="b">Brandingul curatat.</param>
    /// <param name="platform">emby sau jellyfin.</param>
    /// <param name="apiPath">Calea de baza a API-ului (Jellyfin: BaseUrl, ex. „” sau „/jellyfin”; Emby: gol, se deduce din adresa paginii).</param>
    /// <param name="version">Versiunea plugin-ului (ocoleste cache-ul la actualizari).</param>
    public static string RenderIndex(string template, BrandingValues b, string platform, string apiPath, string version)
    {
        var lang = b.Language == "auto" ? "en" : b.Language;
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["lang"] = lang,
            ["langSetting"] = b.Language,
            ["api"] = apiPath,
            ["platform"] = platform,
            ["client"] = b.ShortName,
            ["phone"] = b.Phone ? "1" : "0",
            ["register"] = b.Register ? "1" : "0",
            ["footerSet"] = b.Footer.Length > 0 ? "1" : "0",
            ["name"] = b.Name,
            ["subtitle"] = b.Tagline,
            ["subtitleClass"] = b.Tagline.Length > 0 ? string.Empty : " hidden",
            ["footer"] = b.Footer,
            ["logoVersion"] = b.LogoVersion.ToString(CultureInfo.InvariantCulture),
            ["themeVersion"] = ThemeVersion(b),
            ["version"] = version,
            ["after"] = b.AfterSignIn,
            ["livetv"] = b.LiveTv ? "1" : "0",
            ["remember"] = b.RememberPassword ? "1" : "0",
            ["turnstile"] = b.TurnstileSiteKey,
        };
        return Placeholder().Replace(template, m => values.TryGetValue(m.Groups[1].Value, out var v) ? Html(v) : m.Value);
    }

    [GeneratedRegex(@"\{\{([a-zA-Z]+)\}\}")]
    private static partial Regex Placeholder();

    private static string ThemeVersion(BrandingValues b) =>
        (b.Accent + b.Background).Replace("#", string.Empty, StringComparison.Ordinal);

    /// <summary>Tipul siglei incarcate: „png”, „svg” sau null (refuzata: alt format, prea mare, SVG cu continut activ).</summary>
    public static string? LogoKind(byte[] data) => PrepareLogo(data)?.Kind;

    /// <summary>
    /// Sigla de salvat: PNG-ul neschimbat sau SVG-ul rescris de <see cref="SvgSanitizer"/> (lista permisa de elemente si
    /// atribute, fara DTD, fara adrese externe). Null = refuzata.
    /// </summary>
    public static (string Kind, byte[] Data)? PrepareLogo(byte[] data)
    {
        if (data.Length == 0 || data.Length > MaxLogoBytes)
        {
            return null;
        }

        if (data.Length > 8 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 && data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A)
        {
            return ("png", data);
        }

        try
        {
            _ = new UTF8Encoding(false, true).GetString(data);
        }
        catch (ArgumentException)
        {
            return null;
        }

        var clean = SvgSanitizer.Sanitize(data);
        return clean == null ? null : ("svg", clean);
    }

    /// <summary>Datele dintr-un data URL (data:image/png;base64,…) sau din base64 simplu; null daca nu se pot citi.</summary>
    public static byte[]? DecodeUpload(string? dataUrl)
    {
        var v = (dataUrl ?? string.Empty).Trim();
        var comma = v.IndexOf(',', StringComparison.Ordinal);
        if (v.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && comma > 0)
        {
            if (!v[..comma].EndsWith(";base64", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            v = v[(comma + 1)..];
        }

        if (v.Length == 0 || v.Length > (MaxLogoBytes * 4 / 3) + 8)
        {
            return null;
        }

        try
        {
            return Convert.FromBase64String(v);
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
