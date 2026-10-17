using MediaBrowser.Model.Plugins;

namespace MediaLabTv;

/// <summary>
/// Setarile plugin-ului: brandingul aplicatiei TV (nume, sigla, culori, limba, texte) si calea de acces sub interfata web.
/// Valorile se curata la afisare (Core/Branding), deci o valoare invalida nu strica pagina: se foloseste cea implicita.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>Numele aplicatiei: titlul paginii si antetul de pe televizor.</summary>
    public string AppName { get; set; } = "MediaLab TV";

    /// <summary>Numele scurt: clientul din lista de dispozitive a serverului si numele aplicatiei salvate pe televizor.</summary>
    public string ShortName { get; set; } = "MediaLab TV";

    /// <summary>Randul de sub nume pe ecranul de pornire (ex. adresa site-ului). Gol = nimic.</summary>
    public string Tagline { get; set; } = string.Empty;

    /// <summary>Randul din subsol (ex. suport). Gol = textul implicit „Aplicatie neoficiala, compatibila cu serverele …”.</summary>
    public string Footer { get; set; } = string.Empty;

    /// <summary>Culoarea de accent (butoane, focus), #rrggbb.</summary>
    public string AccentColor { get; set; } = "#52b54b";

    /// <summary>Culoarea de fundal, #rrggbb.</summary>
    public string BackgroundColor { get; set; } = "#101418";

    /// <summary>Limba aplicatiei: auto (a browserului televizorului), ro sau en.</summary>
    public string Language { get; set; } = "auto";

    /// <summary>Sigla incarcata de admin (logo.png / logo.svg in folderul de date al plugin-ului). Gol = sigla implicita.</summary>
    public string LogoFile { get; set; } = string.Empty;

    /// <summary>Creste la fiecare sigla noua (adresa sigla?v=… ocoleste cache-ul televizoarelor).</summary>
    public int LogoVersion { get; set; }

    /// <summary>Butonul „Conectare cu telefonul” cand Quick Connect este instalat si activ.</summary>
    public bool ShowPhoneSignIn { get; set; } = true;

    /// <summary>Butonul „Cont nou (de pe telefon)” cand Inregistrarea este instalata si deschisa.</summary>
    public bool ShowRegistration { get; set; } = true;

    /// <summary>Ce se deschide dupa conectare: „ui” = interfata MediaLab TV (stil Netflix, implicit), „web” = Jellyfin Web.</summary>
    public string AfterSignIn { get; set; } = "ui";

    /// <summary>Randurile de TV in direct (canale, filme in seara asta, sport, copii) in interfata MediaLab TV, cand serverul are canale.</summary>
    public bool ShowLiveTv { get; set; } = true;

    /// <summary>
    /// „Tine minte parola pe televizoare”: implicit oprit - dupa conectare televizorul pastreaza doar tokenul serverului
    /// (si numele, pentru formular). Pornit: si parola, pentru televizoarele al caror browser pierde tokenul.
    /// </summary>
    public bool RememberPassword { get; set; }

    // --- Cloudflare Turnstile la conectarea de pe televizor (K20) ---

    /// <summary>
    /// Verificarea anti-robot Turnstile pe pagina de conectare a televizorului (implicit oprita). Pagina foloseste atunci
    /// /MediaLabTv/Login (token verificat pe server, limita pe IP) in locul lui /Users/AuthenticateByName. Este doar o
    /// frana pentru aceasta pagina: /Users/AuthenticateByName al serverului ramane accesibil.
    /// </summary>
    public bool TurnstileEnabled { get; set; }

    /// <summary>Cheile din plugin-ul Registration (Registration.Integration.SharedTurnstile) in locul celor de mai jos.</summary>
    public bool TurnstileUseRegistration { get; set; }

    /// <summary>Cheia publica (site key) din Cloudflare → Turnstile.</summary>
    public string TurnstileSiteKey { get; set; } = string.Empty;

    /// <summary>Cheia secreta: in configuratie ramane goala, valoarea e criptata in secrets.enc.json (SecretStore).</summary>
    public string TurnstileSecretKey { get; set; } = string.Empty;

    /// <summary>
    /// Calea de acces sub interfata web: /web/&lt;AccessSlug&gt;/ arata aplicatia (servita direct de plugin, fara fisiere in
    /// folderul interfetei web, deci nimic de refacut dupa actualizarile Jellyfin). Gol = doar /MediaLabTv/.
    /// </summary>
    public string AccessSlug { get; set; } = "tv";

    // --- Secrete (criptate in secrets.enc.json din folderul de date, nu in aceasta configuratie) ---

    /// <summary>Numele secretelor salvate (doar informativ pentru pagina: „setat ✓”); valorile nu ajung niciodata aici.</summary>
    public string SecretsSet { get; set; } = string.Empty;

    /// <summary>Trimis de pagina la salvare: secretele de sters (nume separate prin virgula).</summary>
    public string SecretsClear { get; set; } = string.Empty;
}
