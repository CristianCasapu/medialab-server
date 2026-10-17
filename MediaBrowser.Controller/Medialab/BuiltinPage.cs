using System;
using System.Reflection;
using MediaBrowser.Model.Plugins;

namespace MediaBrowser.Controller.Medialab;

/// <summary>
/// A dashboard page of a built-in feature.
/// </summary>
/// <param name="Page">The page description.</param>
/// <param name="Assembly">The assembly holding the page resource.</param>
/// <param name="OwnerId">The id reported as the page's plugin id.</param>
public sealed record BuiltinPage(PluginPageInfo Page, Assembly Assembly, Guid OwnerId);
