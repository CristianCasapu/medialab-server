namespace MediaBrowser.Controller.Medialab;

/// <summary>
/// A link in the user menu.
/// </summary>
/// <param name="Name">The text shown in the menu.</param>
/// <param name="Url">The server-relative path or web client route.</param>
/// <param name="Icon">The Material icon name.</param>
/// <param name="AdminOnly">Whether only administrators see it.</param>
public sealed record UserMenuLink(string Name, string Url, string Icon, bool AdminOnly);
