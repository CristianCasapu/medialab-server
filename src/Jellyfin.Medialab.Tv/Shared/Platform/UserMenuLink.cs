using MediaBrowser.Model.Plugins;
using MediaLabTv.Core;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace MediaLabTv.Platform;

/// <summary>
/// Pe medialab Server (capabilitatea „plugin-user-menu”): intrarea „&lt;numele aplicatiei&gt;” in meniul utilizatorului din
/// Jellyfin Web deschide interfata MediaLab TV. Prin reflectie (UserMenu.Register): pe Jellyfin oficial tipul lipseste si
/// nu se intampla nimic - interfata ramane la /MediaLabTv/browse.html si la calea de acces.
/// </summary>
public sealed class UserMenuLink : IHostedService
{
    public const string Url = "/MediaLabTv/browse.html";

    private readonly ILogger<UserMenuLink> _logger;
    private readonly MediaBrowser.Controller.IServerApplicationHost _appHost;

    public UserMenuLink(ILogger<UserMenuLink> logger, MediaBrowser.Controller.IServerApplicationHost appHost)
    {
        _logger = logger;
        _appHost = appHost;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (Plugin.Instance is { } plugin)
        {
            // Cheia secreta Turnstile: criptata in secrets.enc.json, legata de id-ul serverului.
            try
            {
                plugin.InitSecrets(_appHost.SystemId, m => _logger.LogInformation("{Message}", m));
            }
            catch (Exception ex)
            {
                _logger.LogWarning("MediaLab TV: depozitul de secrete nu a putut fi deschis: {Message}", ex.Message);
            }

            plugin.ConfigurationChanged += OnConfigurationChanged;
        }

        Register(false);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        if (Plugin.Instance is { } plugin)
        {
            plugin.ConfigurationChanged -= OnConfigurationChanged;
        }

        return Task.CompletedTask;
    }

    private void OnConfigurationChanged(object? sender, BasePluginConfiguration e) => Register(true);

    private void Register(bool quiet)
    {
        try
        {
            var menu = Type.GetType("MediaBrowser.Controller.Medialab.UserMenu, MediaBrowser.Controller", throwOnError: false);
            var register = menu?.GetMethod("Register", new[] { typeof(string), typeof(string), typeof(string), typeof(bool) });
            var name = Plugin.Instance?.Values().Name ?? Branding.DefaultName;
            if (register?.Invoke(null, new object?[] { name, Url, "smart_display", false }) is true && !quiet)
            {
                _logger.LogInformation("MediaLab TV: intrarea „{Name}” din meniul utilizatorului e înregistrată (medialab Server)", name);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "MediaLab TV: meniul utilizatorului nu e disponibil");
        }
    }
}
