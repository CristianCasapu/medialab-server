using System;
using System.IO;
using MediaBrowser.Controller.Medialab;
using MediaBrowser.Model.Plugins;
using Xunit;

namespace Jellyfin.Controller.Tests.Medialab;

public class BuiltinPagesTests
{
    [Fact]
    public void RegistersFindsAndRejectsIncompletePages()
    {
        BuiltinPages.Clear();
        var owner = Guid.NewGuid();
        var asm = typeof(BuiltinPagesTests).Assembly;
        Assert.True(BuiltinPages.Register(new PluginPageInfo { Name = "testpage", EmbeddedResourcePath = "Missing.Resource.html" }, asm, owner));
        Assert.False(BuiltinPages.Register(new PluginPageInfo { Name = string.Empty, EmbeddedResourcePath = "x" }, asm, owner));
        Assert.False(BuiltinPages.Register(new PluginPageInfo { Name = "noresource" }, asm, owner));

        var page = BuiltinPages.Find("TESTPAGE");
        Assert.NotNull(page);
        Assert.Equal(owner, page!.OwnerId);
        Assert.Null(BuiltinPages.Find("other"));
        Assert.Null(BuiltinPages.Find(null));
        Assert.Single(BuiltinPages.All);
        Assert.Null(BuiltinPages.Open(page));
        BuiltinPages.Clear();
    }

    [Fact]
    public void MediaLabTvPluginIsReplaced() =>
        Assert.Equal("MediaLab TV", BuiltinPages.ReplacedPlugins[new Guid("690b15d6-5a98-4abb-bf1a-bffaecfc48d5")]);
}
