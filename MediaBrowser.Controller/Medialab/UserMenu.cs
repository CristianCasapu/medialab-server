using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace MediaBrowser.Controller.Medialab;

/// <summary>
/// Links that plugins add to the user menu of the web client (medialab Server, capability "plugin-user-menu").
/// </summary>
/// <remarks>
/// Official Jellyfin shows plugin pages only in the admin dashboard; a plugin page meant for every user (e.g. a TV
/// guide at "/Headend/Tv") needs a link in the side menu. Plugins call <see cref="Register"/> through reflection, so the
/// same plugin build still loads on official Jellyfin, where the admin can add the link to the web config (menuLinks).
/// </remarks>
public static partial class UserMenu
{
    private static readonly ConcurrentDictionary<string, UserMenuLink> _links = new(StringComparer.Ordinal);

    /// <summary>
    /// Gets the registered links, in a stable order.
    /// </summary>
    public static IReadOnlyList<UserMenuLink> All => _links.Values.OrderBy(l => l.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(l => l.Url, StringComparer.Ordinal).ToArray();

    /// <summary>
    /// Gets the links a user sees.
    /// </summary>
    /// <param name="isAdministrator">Whether the user is an administrator (admin-only links are hidden from others).</param>
    /// <returns>The links.</returns>
    public static IReadOnlyList<UserMenuLink> For(bool isAdministrator) => All.Where(l => isAdministrator || !l.AdminOnly).ToArray();

    /// <summary>
    /// Registers (or replaces) a link. Only same-server paths ("/Headend/Tv") and web client routes ("#/...") are accepted.
    /// </summary>
    /// <param name="name">The text shown in the menu (1-40 characters).</param>
    /// <param name="url">The server-relative path or web client route.</param>
    /// <param name="icon">A Material icon name, e.g. "live_tv"; null or invalid uses "extension".</param>
    /// <param name="adminOnly">Show the link to administrators only.</param>
    /// <returns><c>true</c> if the link is valid and registered.</returns>
    public static bool Register(string name, string url, string? icon, bool adminOnly)
    {
        if (!IsValidName(name) || !IsValidUrl(url))
        {
            return false;
        }

        var link = new UserMenuLink(name.Trim(), Normalize(url), icon is not null && IconName().IsMatch(icon) ? icon : "extension", adminOnly);
        _links[link.Url] = link;
        return true;
    }

    /// <summary>
    /// Removes a link, e.g. when its plugin is disabled.
    /// </summary>
    /// <param name="url">The url given to <see cref="Register"/>.</param>
    public static void Unregister(string url)
    {
        if (!string.IsNullOrEmpty(url))
        {
            _links.TryRemove(Normalize(url), out _);
        }
    }

    /// <summary>
    /// Checks that a url stays on this server: a plain path or a web client route.
    /// </summary>
    /// <param name="url">The url to check.</param>
    /// <returns><c>true</c> for a valid same-server url.</returns>
    public static bool IsValidUrl(string? url) =>
        !string.IsNullOrEmpty(url) && url.Length <= 256 && !url.Contains("..", StringComparison.Ordinal) && !url.StartsWith("//", StringComparison.Ordinal)
        && LinkUrl().IsMatch(url);

    private static bool IsValidName(string? name) =>
        !string.IsNullOrWhiteSpace(name) && name.Trim().Length <= 40 && !name.Any(char.IsControl);

    private static string Normalize(string url) => url.StartsWith('/') || url.StartsWith('#') ? url : "/" + url;

    [GeneratedRegex(@"^(#/|/)?[A-Za-z0-9_\-]+(/[A-Za-z0-9_\-.]+)*/?(\?[A-Za-z0-9_\-.=&%]*)?$")]
    private static partial Regex LinkUrl();

    [GeneratedRegex(@"^[a-z0-9_]{1,40}$")]
    private static partial Regex IconName();
}
