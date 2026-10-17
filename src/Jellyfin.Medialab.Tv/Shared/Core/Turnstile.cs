using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MediaLabTv.Core;

/// <summary>Cheile Turnstile folosite efectiv: ale plugin-ului sau cele din Registration („Folosește cheile din Înregistrare”).</summary>
public sealed record TurnstileKeys(string SiteKey, string SecretKey, bool FromRegistration);

/// <summary>Rezultatul verificarii unui token Turnstile.</summary>
public enum TurnstileOutcome
{
    Ok,

    /// <summary>Lipseste tokenul (sau e prea lung).</summary>
    Missing,

    /// <summary>Cloudflare a raspuns success=false (token invalid, expirat, deja folosit, cheie gresita).</summary>
    Rejected,

    /// <summary>Tokenul a fost obtinut pe alt site decat acesta.</summary>
    WrongHost,

    /// <summary>Tokenul a fost obtinut pentru alta actiune decat conectarea de pe televizor.</summary>
    WrongAction,

    /// <summary>Cloudflare nu raspunde: cererea se refuza (fail closed).</summary>
    Unavailable,
}

/// <summary>
/// Cloudflare Turnstile la conectarea de pe televizor (K20): verificarea server-side a tokenului (siteverify, cu IP-ul
/// real al clientului, success + hostname + actiune) si cheile partajate cu plugin-ul Registration. Aceeasi clasa pe
/// Emby si Jellyfin.
/// </summary>
public static partial class Turnstile
{
    public const string VerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    /// <summary>Actiunea pusa de pagina in widget (tv.js) si verificata aici.</summary>
    public const string Action = "tv-login";

    internal static readonly HttpClient Http = CreateClient();

    // Cheile de test documentate de Cloudflare (1x… trece mereu, 2x… pica mereu, 3x… „token deja folosit”); raspunsul lor
    // are hostname „example.com” si actiunea goala, deci acestea nu se verifica pentru ele.
    [GeneratedRegex("^[123]x0{31}AA$")]
    private static partial Regex TestSecret();

    public static bool IsTestSecret(string? secret) => secret != null && TestSecret().IsMatch(secret);

    private static HttpClient CreateClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("medialab-tv-plugin");
        return client;
    }

    /// <summary>
    /// Cheile active: null daca protectia e oprita sau nu exista ambele chei (pagina se poarta atunci ca inainte; panoul
    /// arata avertismentul).
    /// </summary>
    public static TurnstileKeys? Resolve(bool enabled, bool useRegistration, string? siteKey, string? secretKey, Func<string[]?> registration)
    {
        if (!enabled)
        {
            return null;
        }

        if (useRegistration)
        {
            var shared = registration();
            return shared is { Length: >= 2 } && Valid(shared[0]) && Valid(shared[1]) ? new TurnstileKeys(shared[0].Trim(), shared[1].Trim(), true) : null;
        }

        return Valid(siteKey) && Valid(secretKey) ? new TurnstileKeys(siteKey!.Trim(), secretKey!.Trim(), false) : null;
    }

    private static bool Valid(string? key) => !string.IsNullOrWhiteSpace(key) && key.Trim().Length <= 200 && key.Trim().All(c => c > ' ' && c < 127 && c != '"' && c != '<' && c != '>');

    /// <summary>
    /// Cheile Turnstile din Registration (<c>Registration.Integration.SharedTurnstile.Get()</c>, assembly „Registration”,
    /// ambele platforme), prin reflexie: fara dependinta de plugin-ul Registration. Null daca nu e instalat, e o versiune
    /// fara aceasta functie sau nu are chei.
    /// </summary>
    public static string[]? RegistrationKeys()
    {
        foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
        {
            try
            {
                if (!string.Equals(assembly.GetName().Name, "Registration", StringComparison.Ordinal))
                {
                    continue;
                }

                var method = assembly.GetType("Registration.Integration.SharedTurnstile", false)?.GetMethod("Get", BindingFlags.Public | BindingFlags.Static, Type.EmptyTypes);
                if (method?.Invoke(null, null) is string[] { Length: >= 2 } keys)
                {
                    return keys;
                }
            }
            catch (Exception)
            {
                // alta versiune, alta semnatura: ca si cum n-ar exista
            }
        }

        return null;
    }

    /// <summary>Registration e incarcat si expune functia (chiar fara chei setate).</summary>
    public static bool RegistrationAvailable() =>
        AppDomain.CurrentDomain.GetAssemblies().Any(a =>
        {
            try
            {
                return string.Equals(a.GetName().Name, "Registration", StringComparison.Ordinal)
                    && a.GetType("Registration.Integration.SharedTurnstile", false)?.GetMethod("Get", BindingFlags.Public | BindingFlags.Static, Type.EmptyTypes) != null;
            }
            catch (Exception)
            {
                return false;
            }
        });

    /// <summary>Verifica tokenul la Cloudflare. <paramref name="hosts"/> = numele de host sub care a fost deschisa pagina.</summary>
    public static async Task<TurnstileOutcome> VerifyAsync(string secret, string? token, string? remoteIp, IReadOnlyCollection<string> hosts, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 2048)
        {
            return TurnstileOutcome.Missing;
        }

        try
        {
            var form = new Dictionary<string, string> { ["secret"] = secret, ["response"] = token };
            if (!string.IsNullOrEmpty(remoteIp))
            {
                form["remoteip"] = remoteIp;
            }

            using var content = new FormUrlEncodedContent(form);
            using var response = await Http.PostAsync(VerifyUrl, content, cancellationToken).ConfigureAwait(false);
            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            return Evaluate(body, secret, hosts);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException)
        {
            return TurnstileOutcome.Unavailable;
        }
    }

    /// <summary>Raspunsul siteverify: success, apoi (in afara cheilor de test) hostname-ul si actiunea.</summary>
    public static TurnstileOutcome Evaluate(string body, string secret, IReadOnlyCollection<string> hosts)
    {
        try
        {
            using var json = JsonDocument.Parse(body);
            var root = json.RootElement;
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("success", out var success) || success.ValueKind != JsonValueKind.True)
            {
                return TurnstileOutcome.Rejected;
            }

            if (IsTestSecret(secret))
            {
                return TurnstileOutcome.Ok;
            }

            var hostname = root.TryGetProperty("hostname", out var h) && h.ValueKind == JsonValueKind.String ? h.GetString() ?? string.Empty : string.Empty;
            if (hosts.Count > 0 && !hosts.Any(x => string.Equals(x, hostname, StringComparison.OrdinalIgnoreCase)))
            {
                return TurnstileOutcome.WrongHost;
            }

            var action = root.TryGetProperty("action", out var a) && a.ValueKind == JsonValueKind.String ? a.GetString() ?? string.Empty : string.Empty;
            return action.Length == 0 || action == Action ? TurnstileOutcome.Ok : TurnstileOutcome.WrongAction;
        }
        catch (JsonException)
        {
            return TurnstileOutcome.Rejected;
        }
    }

    /// <summary>
    /// Numele de host sub care browserul a deschis pagina: Host, X-Forwarded-Host (reverse proxy) si Origin; fara port.
    /// </summary>
    public static IReadOnlyCollection<string> Hosts(params string?[] values)
    {
        var hosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var raw in values)
        {
            foreach (var part in (raw ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var v = part;
                if (v.Contains("://", StringComparison.Ordinal))
                {
                    if (!Uri.TryCreate(v, UriKind.Absolute, out var uri))
                    {
                        continue;
                    }

                    v = uri.Host;
                }
                else if (v.StartsWith('['))
                {
                    var end = v.IndexOf(']', StringComparison.Ordinal);
                    v = end > 0 ? v[1..end] : v;
                }
                else if (v.Count(c => c == ':') == 1)
                {
                    v = v[..v.IndexOf(':', StringComparison.Ordinal)];
                }

                if (v.Length > 0 && v.Length <= 253)
                {
                    hosts.Add(v);
                }
            }
        }

        return hosts;
    }
}
