using System;
using System.IO;
using Emby.Server.Implementations.Serialization;
using MediaBrowser.Controller.Medialab;
using MediaLabTv;
using MediaLabTv.Licensing;
using MediaLabTv.Secrets;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Jellyfin.Medialab.Tv.Tests;

public sealed class BuiltinTvTests : IDisposable
{
    private const string ServerId = "0123456789abcdef0123456789abcdef";
    private readonly string _root = Path.Combine(Path.GetTempPath(), "mltv-builtin-" + Guid.NewGuid().ToString("N"));

    private string Config => Path.Combine(_root, "config");

    private string Data => Path.Combine(_root, "data");

    private string Plugins => Path.Combine(_root, "plugins");

    public void Dispose()
    {
        Plugin.Instance = null;
        BuiltinPages.Clear();
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, true);
        }
    }

    [Fact]
    public void FreshInstallHasDefaultsAdminPagesAndOpenGate()
    {
        var imported = MedialabTv.Add(new ServiceCollection(), new MyXmlSerializer(), Config, Data, Plugins, ServerId, "12.2-ml.8", _ => { });
        Assert.Null(imported);
        Assert.True(LicenseGate.AllowsFull);
        Assert.Equal("12.2-ml.8", LicenseConfig.PluginVersion);
        Assert.Equal("MediaLab TV", Plugin.Instance!.Values().Name);
        Assert.NotNull(BuiltinPages.Find("medialabtv"));
        using var page = BuiltinPages.Open(BuiltinPages.Find("medialabtvjs")!);
        Assert.NotNull(page);
        var js = new StreamReader(page!).ReadToEnd();
        Assert.Contains("MediaLabTv/Admin/Configuration", js, StringComparison.Ordinal);
        Assert.DoesNotContain("PluginConfiguration(PID", js, StringComparison.Ordinal);
    }

    [Fact]
    public void TakesOverThePluginSettingsLogoAndTurnstileSecret()
    {
        var pluginData = Path.Combine(Plugins, "MediaLabTv");
        Directory.CreateDirectory(Path.Combine(pluginData, "branding"));
        Directory.CreateDirectory(Path.Combine(Plugins, "configurations"));
        File.WriteAllBytes(Path.Combine(pluginData, "branding", "logo.png"), new byte[] { 0x89, 0x50, 0x4E, 0x47 });
        new SecretStore(pluginData, ServerId, "medialabtv").Set("TurnstileSecretKey", "0x4AAAAAAAsecret-from-plugin");
        var old = new PluginConfiguration { AppName = "Casapu Media", AccessSlug = "tv", LogoFile = "logo.png", LogoVersion = 4, TurnstileEnabled = true, TurnstileSiteKey = "0x4AAAAAAAsite" };
        new MyXmlSerializer().SerializeToFile(old, Path.Combine(Plugins, "configurations", "MediaLabTv.xml"));

        var imported = MedialabTv.Add(new ServiceCollection(), new MyXmlSerializer(), Config, Data, Plugins, ServerId, "12.2-ml.8", _ => { });

        Assert.Equal("settings, logo, Turnstile key", imported);
        var host = Plugin.Instance!;
        Assert.Equal("Casapu Media", host.Configuration.AppName);
        Assert.True(File.Exists(Path.Combine(host.BrandingDirectory, "logo.png")));
        Assert.Equal("0x4AAAAAAAsecret-from-plugin", Plugin.Secret("TurnstileSecretKey"));
        Assert.NotNull(host.TurnstileKeys());
        var xml = File.ReadAllText(Path.Combine(Config, Plugin.ConfigFileName));
        Assert.DoesNotContain("secret-from-plugin", xml, StringComparison.Ordinal);

        // a second start keeps the built-in settings (no new import)
        Plugin.Instance = null;
        Assert.Null(MedialabTv.Add(new ServiceCollection(), new MyXmlSerializer(), Config, Data, Plugins, ServerId, "12.2-ml.8", _ => { }));
        Assert.Equal("Casapu Media", Plugin.Instance!.Configuration.AppName);
    }

    [Fact]
    public void AdminSaveKeepsSecretsOutOfTheXmlAndKeepsTheLogo()
    {
        MedialabTv.Add(new ServiceCollection(), new MyXmlSerializer(), Config, Data, Plugins, ServerId, "12.2-ml.8", _ => { });
        var host = Plugin.Instance!;
        host.Configuration.LogoFile = "logo.svg";
        host.Configuration.LogoVersion = 7;
        var changed = 0;
        host.ConfigurationChanged += (_, _) => changed++;

        host.UpdateConfiguration(new PluginConfiguration { AppName = "Hotel TV", TurnstileSecretKey = "0x4AAAAAAAnew-secret", LogoFile = string.Empty, LogoVersion = 0 });

        Assert.Equal(1, changed);
        Assert.Equal("Hotel TV", host.Configuration.AppName);
        Assert.Equal("logo.svg", host.Configuration.LogoFile);
        Assert.Equal(7, host.Configuration.LogoVersion);
        Assert.Equal("TurnstileSecretKey", host.Configuration.SecretsSet);
        Assert.Equal("0x4AAAAAAAnew-secret", Plugin.Secret("TurnstileSecretKey"));
        Assert.DoesNotContain("new-secret", File.ReadAllText(Path.Combine(Config, Plugin.ConfigFileName)), StringComparison.Ordinal);
    }
}
