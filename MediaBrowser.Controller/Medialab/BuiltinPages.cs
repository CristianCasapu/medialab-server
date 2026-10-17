using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using MediaBrowser.Model.Plugins;

namespace MediaBrowser.Controller.Medialab;

/// <summary>
/// Dashboard pages of features built into medialab Server (capability "builtin-tv"), served like plugin pages.
/// </summary>
/// <remarks>
/// A built-in feature (e.g. MediaLab TV) keeps the page names of the plugin it replaces, so links and the web client's
/// "__plugin/name" controllers keep working. The replaced plugin itself is not loaded (see <see cref="ReplacedPlugins"/>).
/// </remarks>
public static class BuiltinPages
{
    private static readonly ConcurrentDictionary<string, BuiltinPage> _pages = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Gets the plugins replaced by built-in features: the plugin manager skips them (id → feature name).
    /// </summary>
    public static IReadOnlyDictionary<Guid, string> ReplacedPlugins { get; } = new Dictionary<Guid, string>
    {
        [new Guid("690b15d6-5a98-4abb-bf1a-bffaecfc48d5")] = "MediaLab TV",
    };

    /// <summary>
    /// Gets the registered pages.
    /// </summary>
    public static IReadOnlyList<BuiltinPage> All => _pages.Values.OrderBy(p => p.Page.Name, StringComparer.Ordinal).ToArray();

    /// <summary>
    /// Registers (or replaces) a page whose content is an embedded resource of <paramref name="assembly"/>.
    /// </summary>
    /// <param name="page">The page (name, display name, resource path, menu settings).</param>
    /// <param name="assembly">The assembly holding the resource.</param>
    /// <param name="ownerId">The id shown as the page's plugin id (the replaced plugin's id).</param>
    /// <returns><c>true</c> if the page was registered.</returns>
    public static bool Register(PluginPageInfo page, Assembly assembly, Guid ownerId)
    {
        ArgumentNullException.ThrowIfNull(page);
        ArgumentNullException.ThrowIfNull(assembly);
        if (string.IsNullOrWhiteSpace(page.Name) || string.IsNullOrWhiteSpace(page.EmbeddedResourcePath))
        {
            return false;
        }

        _pages[page.Name] = new BuiltinPage(page, assembly, ownerId);
        return true;
    }

    /// <summary>
    /// Finds a page by name.
    /// </summary>
    /// <param name="name">The page name.</param>
    /// <returns>The page, or null.</returns>
    public static BuiltinPage? Find(string? name) => name is not null && _pages.TryGetValue(name, out var page) ? page : null;

    /// <summary>
    /// Opens the content of a page.
    /// </summary>
    /// <param name="page">The page.</param>
    /// <returns>The stream, or null when the resource is missing.</returns>
    public static Stream? Open(BuiltinPage page)
    {
        ArgumentNullException.ThrowIfNull(page);
        return page.Assembly.GetManifestResourceStream(page.Page.EmbeddedResourcePath);
    }

    /// <summary>
    /// Removes every page (tests).
    /// </summary>
    public static void Clear() => _pages.Clear();
}
