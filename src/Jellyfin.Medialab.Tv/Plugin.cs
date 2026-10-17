using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using MediaLabTv.Core;
using MediaLabTv.Secrets;

namespace MediaLabTv;

/// <summary>
/// medialab Server: the built-in host of MediaLab TV. It stands in for the jf-tvapp plugin class, so the shared plugin code
/// (Shared/, copied unchanged by sync/sync-tv.sh) runs natively: settings live in the server configuration folder
/// (medialabtv.xml), data (logo, encrypted secrets) in &lt;data&gt;/medialab-tv. No license check: free in the fork.
/// </summary>
/// <remarks>Values, TurnstileKeys, InitSecrets and AbsorbSecrets mirror MediaLabTv/Plugin.cs of the plugin; keep them in step.</remarks>
public sealed class Plugin
{
    /// <summary>The jf-tvapp plugin id: the plugin manager does not load that plugin on medialab Server.</summary>
    public static readonly Guid PluginId = new("690b15d6-5a98-4abb-bf1a-bffaecfc48d5");

    public const string ConfigFileName = "medialabtv.xml";

    private readonly IXmlSerializer _xml;
    private readonly string _configFile;
    private readonly object _gate = new();
    private SecretStore? _secrets;

    internal Plugin(IXmlSerializer xml, string configDirectory, string dataDirectory)
    {
        _xml = xml;
        _configFile = Path.Combine(configDirectory, ConfigFileName);
        DataFolderPath = dataDirectory;
        Configuration = Load();
    }

    public static Plugin? Instance { get; internal set; }

    public string Name => "MediaLab TV";

    public string DataFolderPath { get; }

    public PluginConfiguration Configuration { get; private set; }

    public event EventHandler<BasePluginConfiguration>? ConfigurationChanged;

    public string BrandingDirectory => Path.Combine(DataFolderPath, "branding");

    public bool HasSavedConfiguration => File.Exists(_configFile);

    public SecretStore? Secrets => _secrets;

    public static string Secret(string name) => Instance?._secrets?.Get(name) ?? string.Empty;

    public static readonly SecretField<PluginConfiguration>[] SecretFields =
    {
        new(nameof(PluginConfiguration.TurnstileSecretKey), c => c.TurnstileSecretKey, (c, v) => c.TurnstileSecretKey = v),
    };

    public BrandingValues Values()
    {
        var c = Configuration;
        var name = Branding.Text(c.AppName, 40);
        var shortName = Branding.Text(c.ShortName, 30);
        return new BrandingValues
        {
            Name = name.Length > 0 ? name : Branding.DefaultName,
            ShortName = shortName.Length > 0 ? shortName : (name.Length > 0 ? name : Branding.DefaultName),
            Tagline = Branding.Text(c.Tagline, 80),
            Footer = Branding.Text(c.Footer, 120),
            Accent = Branding.Color(c.AccentColor, Branding.DefaultAccent),
            Background = Branding.Color(c.BackgroundColor, Branding.DefaultBackground),
            Language = Branding.Language(c.Language),
            Phone = c.ShowPhoneSignIn,
            Register = c.ShowRegistration,
            LogoVersion = c.LogoVersion,
            AfterSignIn = Branding.AfterSignIn(c.AfterSignIn),
            LiveTv = c.ShowLiveTv,
            RememberPassword = c.RememberPassword,
            TurnstileSiteKey = TurnstileKeys()?.SiteKey ?? string.Empty,
        };
    }

    public TurnstileKeys? TurnstileKeys()
    {
        var c = Configuration;
        return Turnstile.Resolve(c.TurnstileEnabled, c.TurnstileUseRegistration, c.TurnstileSiteKey, Secret(nameof(PluginConfiguration.TurnstileSecretKey)), Turnstile.RegistrationKeys);
    }

    public void SaveConfiguration()
    {
        lock (_gate)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_configFile)!);
            _xml.SerializeToFile(Configuration, _configFile);
        }

        ConfigurationChanged?.Invoke(this, Configuration);
    }

    /// <summary>Saves the settings sent by the admin page; new secret values go to the encrypted store, never to the XML.</summary>
    public void UpdateConfiguration(PluginConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        if (_secrets != null)
        {
            var (_, names) = SecretIntake.Absorb(configuration, _secrets, SecretFields, configuration.SecretsClear);
            configuration.SecretsSet = names;
            configuration.SecretsClear = string.Empty;
        }

        // values only the server changes
        configuration.LogoFile = Configuration.LogoFile;
        configuration.LogoVersion = Configuration.LogoVersion;
        Configuration = configuration;
        SaveConfiguration();
    }

    /// <summary>Opens the encrypted secret store (bound to the server id) and moves any secret left in the XML into it.</summary>
    public void InitSecrets(string serverId, Action<string> log)
    {
        if (_secrets != null)
        {
            return;
        }

        var store = new SecretStore(DataFolderPath, serverId, "medialabtv");
        store.Warning += log;
        _secrets = store;
        var config = Configuration;
        var (changed, names) = SecretIntake.Absorb(config, store, SecretFields, null);
        if (changed || config.SecretsSet != names || !string.IsNullOrEmpty(config.SecretsClear))
        {
            config.SecretsSet = names;
            config.SecretsClear = string.Empty;
            SaveConfiguration();
        }
    }

    /// <summary>
    /// First start after an upgrade from the jf-tvapp plugin: takes over its settings, logo and Turnstile secret, so the
    /// TVs keep the same look and address. Runs only while the built-in settings were never saved.
    /// </summary>
    /// <returns>A description of what was imported, or null when nothing was.</returns>
    public string? ImportFromPlugin(string pluginsDirectory, string serverId)
    {
        if (HasSavedConfiguration)
        {
            return null;
        }

        var xml = Path.Combine(pluginsDirectory, "configurations", "MediaLabTv.xml");
        if (!File.Exists(xml))
        {
            return null;
        }

        if (_xml.DeserializeFromFile(typeof(PluginConfiguration), xml) is not PluginConfiguration imported)
        {
            return null;
        }

        var parts = new List<string> { "settings" };
        var pluginData = Path.Combine(pluginsDirectory, "MediaLabTv");
        var oldBranding = Path.Combine(pluginData, "branding");
        if (imported.LogoFile is "logo.png" or "logo.svg" && File.Exists(Path.Combine(oldBranding, imported.LogoFile)))
        {
            Directory.CreateDirectory(BrandingDirectory);
            File.Copy(Path.Combine(oldBranding, imported.LogoFile), Path.Combine(BrandingDirectory, imported.LogoFile), true);
            parts.Add("logo");
        }
        else
        {
            imported.LogoFile = string.Empty;
        }

        if (File.Exists(Path.Combine(pluginData, SecretStore.FileName)))
        {
            try
            {
                var secret = new SecretStore(pluginData, serverId, "medialabtv").Get(nameof(PluginConfiguration.TurnstileSecretKey));
                if (!string.IsNullOrEmpty(secret))
                {
                    imported.TurnstileSecretKey = secret; // InitSecrets moves it into the built-in store
                    parts.Add("Turnstile key");
                }
            }
            catch (Exception)
            {
                // a store that cannot be read (other server id, damaged file): the admin enters the key again
            }
        }

        imported.SecretsSet = string.Empty;
        imported.SecretsClear = string.Empty;
        // not saved here: the caller runs InitSecrets first (the secret leaves the XML), then saves
        Configuration = imported;
        return string.Join(", ", parts);
    }

    private PluginConfiguration Load()
    {
        try
        {
            if (File.Exists(_configFile) && _xml.DeserializeFromFile(typeof(PluginConfiguration), _configFile) is PluginConfiguration c)
            {
                return c;
            }
        }
        catch (Exception)
        {
            // a damaged file: defaults (the admin page saves a new one)
        }

        return new PluginConfiguration();
    }
}
