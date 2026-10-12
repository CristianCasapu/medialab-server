using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace MediaBrowser.Controller.Medialab;

/// <summary>
/// Scripts that plugins add to the web client (medialab Server, capability "plugin-web-scripts").
/// </summary>
/// <remarks>
/// A plugin registers a script it serves itself (a path on this server, e.g. "/ShareLinks/Assets/menu.js") and the web
/// client loads it after start-up, on every page. Plugins call <see cref="Register"/> through reflection, so the same
/// plugin build still loads on official Jellyfin, where it falls back to its own pages.
/// </remarks>
public static partial class WebScripts
{
    private static readonly ConcurrentDictionary<string, byte> _scripts = new(StringComparer.Ordinal);

    /// <summary>
    /// Gets the registered scripts, in a stable order.
    /// </summary>
    public static IReadOnlyList<string> All => _scripts.Keys.Order(StringComparer.Ordinal).ToArray();

    /// <summary>
    /// Registers a script served by this server. Only same-server ".js" paths are accepted.
    /// </summary>
    /// <param name="path">The server-relative path, e.g. "/ShareLinks/Assets/menu.js".</param>
    /// <returns><c>true</c> if the path is valid and registered.</returns>
    public static bool Register(string path)
    {
        if (!IsValid(path))
        {
            return false;
        }

        _scripts[path.StartsWith('/') ? path : "/" + path] = 0;
        return true;
    }

    /// <summary>
    /// Removes a script, e.g. when its plugin is disabled.
    /// </summary>
    /// <param name="path">The path given to <see cref="Register"/>.</param>
    public static void Unregister(string path)
    {
        if (!string.IsNullOrEmpty(path))
        {
            _scripts.TryRemove(path.StartsWith('/') ? path : "/" + path, out _);
        }
    }

    /// <summary>
    /// Checks that a path stays on this server and points to a script.
    /// </summary>
    /// <param name="path">The path to check.</param>
    /// <returns><c>true</c> for a plain server-relative ".js" path.</returns>
    public static bool IsValid(string? path) =>
        !string.IsNullOrEmpty(path) && path.Length <= 256 && !path.Contains("..", StringComparison.Ordinal) && !path.StartsWith("//", StringComparison.Ordinal)
        && ScriptPath().IsMatch(path);

    [GeneratedRegex(@"^/?[A-Za-z0-9_\-]+(/[A-Za-z0-9_\-.]+)*\.js$")]
    private static partial Regex ScriptPath();
}
