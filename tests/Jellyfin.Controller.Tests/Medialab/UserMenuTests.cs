using MediaBrowser.Controller.Medialab;
using Xunit;

namespace Jellyfin.Controller.Tests.Medialab;

public class UserMenuTests
{
    [Theory]
    [InlineData("/Headend/Tv")]
    [InlineData("Headend/Tv/")]
    [InlineData("#/configurationpage?name=headend")]
    [InlineData("/Registration/Account?tab=plan")]
    public void AcceptsSameServerUrls(string url) => Assert.True(UserMenu.IsValidUrl(url));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("https://evil.example/x")]
    [InlineData("//evil.example/x")]
    [InlineData("/Headend/../System/Info")]
    [InlineData("javascript:alert(1)")]
    [InlineData("/Headend/Tv?x=<b>")]
    public void RejectsEverythingElse(string? url) => Assert.False(UserMenu.IsValidUrl(url));

    [Fact]
    public void RegisterNormalizesReplacesAndFiltersAdminLinks()
    {
        Assert.True(UserMenu.Register("TV", "Test/Tv", "live_tv", false));
        Assert.True(UserMenu.Register("TV live", "/Test/Tv", "LIVE TV!", false));
        Assert.True(UserMenu.Register("Admin tool", "/Test/Admin", null, true));
        Assert.False(UserMenu.Register(" ", "/Test/Empty", null, false));
        Assert.False(UserMenu.Register("Bad", "https://evil.example", null, false));

        var tv = Assert.Single(UserMenu.All, l => l.Url == "/Test/Tv");
        Assert.Equal("TV live", tv.Name);
        Assert.Equal("extension", tv.Icon);
        Assert.DoesNotContain(UserMenu.For(false), l => l.Url == "/Test/Admin");
        Assert.Contains(UserMenu.For(true), l => l.Url == "/Test/Admin");

        UserMenu.Unregister("Test/Tv");
        UserMenu.Unregister("/Test/Admin");
        Assert.DoesNotContain(UserMenu.All, l => l.Url.StartsWith("/Test/", System.StringComparison.Ordinal));
    }
}
