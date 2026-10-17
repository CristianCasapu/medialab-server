using MediaBrowser.Controller.Configuration;

namespace MediaLabTv.Localization;

/// <summary>
/// Textele vizibile pentru utilizator, in romana sau engleza, dupa limba interfetei serverului
/// Jellyfin (Setari → Server → Limba). "ro*" → romana, altfel engleza; cat timp limba nu e
/// cunoscuta (configuratia nu a fost inca injectata, ex. in teste) ramane romana.
/// Nu se folosesc pentru mesajele din jurnalul Jellyfin (ILogger).
/// </summary>
public static class L
{
    private static Func<string?>? _culture;

    /// <summary>Se apeleaza o singura data, din punctul de intrare, cu configuratia serverului.</summary>
    public static void Use(IServerConfigurationManager configuration) =>
        _culture = () => configuration.Configuration?.UICulture;

    /// <summary>Doar pentru teste: limba fixa (null = implicit, romana).</summary>
    internal static void UseCulture(string? culture) =>
        _culture = culture == null ? null : () => culture;

    public static bool IsRomanian
    {
        get
        {
            string? culture;
            try
            {
                culture = _culture?.Invoke();
            }
            catch (Exception)
            {
                culture = null;
            }

            return string.IsNullOrWhiteSpace(culture) || culture.StartsWith("ro", StringComparison.OrdinalIgnoreCase);
        }
    }

    public static string T(string ro, string en) => IsRomanian ? ro : en;
}
