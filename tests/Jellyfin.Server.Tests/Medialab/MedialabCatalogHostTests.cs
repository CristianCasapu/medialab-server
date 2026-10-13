using Jellyfin.Server.Medialab;
using MediaBrowser.Model.Updates;
using Xunit;

namespace Jellyfin.Server.Tests.Medialab;

public class MedialabCatalogHostTests
{
    [Fact]
    public void PutsTheCatalogFirstAndKeepsTheOthers()
    {
        var stable = new RepositoryInfo { Name = "Jellyfin Stable", Url = "https://repo.jellyfin.org/releases/plugin/manifest-stable.json", Enabled = true };
        var list = MedialabCatalogHost.WithCatalogFirst([stable]);

        Assert.NotNull(list);
        Assert.Equal(2, list.Length);
        Assert.Equal(MedialabCatalogHost.CatalogUrl, list[0].Url);
        Assert.Equal(MedialabCatalogHost.CatalogName, list[0].Name);
        Assert.True(list[0].Enabled);
        Assert.Same(stable, list[1]);
    }

    [Fact]
    public void LeavesAnExistingCatalogAlone()
    {
        // e.g. the keyed manifest a licensed user added (…/manifest.json?key=…), possibly disabled or moved by the admin
        var keyed = new RepositoryInfo { Name = "mine", Url = MedialabCatalogHost.CatalogUrl + "?key=abc", Enabled = false };
        Assert.Null(MedialabCatalogHost.WithCatalogFirst([new RepositoryInfo { Name = "x", Url = "https://example.org/m.json" }, keyed]));
    }

    [Fact]
    public void WorksOnAnEmptyList() => Assert.Single(MedialabCatalogHost.WithCatalogFirst([])!);
}
