using System;

namespace MediaBrowser.Controller.Medialab;

/// <summary>
/// The medialab signature state of an installed plugin.
/// </summary>
/// <param name="Id">The plugin id.</param>
/// <param name="Version">The plugin version.</param>
/// <param name="Name">The plugin name.</param>
/// <param name="Trust">Verified, Unsigned or Modified.</param>
public sealed record PluginTrustInfo(Guid Id, string Version, string Name, string Trust);
