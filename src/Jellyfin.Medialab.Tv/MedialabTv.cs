using MediaBrowser.Controller.Medialab;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using MediaLabTv.Licensing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace MediaLabTv;

/// <summary>medialab Server: wires the built-in MediaLab TV into the server (called once from Startup.ConfigureServices).</summary>
public static class MedialabTv
{
    /// <summary>The capability id listed in MedialabEdition.Features.</summary>
    public const string Feature = "builtin-tv";

    /// <summary>The assembly with the TV controllers (added as an MVC application part).</summary>
    public static System.Reflection.Assembly Assembly => typeof(MedialabTv).Assembly;

    /// <summary>Creates the host, takes over a previous jf-tvapp install and registers the services, the admin page and the /web/&lt;path&gt;/ filter.</summary>
    /// <returns>What was imported from the plugin, or null.</returns>
    public static string? Add(IServiceCollection services, IXmlSerializer xml, string configDirectory, string dataDirectory, string pluginsDirectory, string serverId, string revision, Action<string> log)
    {
        LicenseConfig.PluginVersion = revision;
        var host = new Plugin(xml, configDirectory, Path.Combine(dataDirectory, "medialab-tv"));
        Plugin.Instance = host;
        string? imported = null;
        try
        {
            imported = host.ImportFromPlugin(pluginsDirectory, serverId);
            host.InitSecrets(serverId, log);
            if (imported != null)
            {
                host.SaveConfiguration();
            }
        }
        catch (Exception ex)
        {
            log("MediaLab TV: " + ex.Message);
        }

        BuiltinPages.Register(new PluginPageInfo { Name = "medialabtv", DisplayName = "MediaLab TV", EmbeddedResourcePath = "MediaLabTv.Configuration.medialabtv.html", EnableInMainMenu = true, MenuIcon = "tv" }, Assembly, Plugin.PluginId);
        BuiltinPages.Register(new PluginPageInfo { Name = "medialabtvjs", EmbeddedResourcePath = "MediaLabTv.Configuration.medialabtv.js" }, Assembly, Plugin.PluginId);
        services.AddHostedService<Platform.UserMenuLink>();
        services.AddTransient<IStartupFilter, Platform.AccessPathStartupFilter>();
        return imported;
    }
}
