using MediaBrowser.Controller.Medialab;
using Xunit;

namespace Jellyfin.Controller.Tests.Medialab;

public class WebScriptsTests
{
    [Theory]
    [InlineData("/ShareLinks/Assets/menu.js")]
    [InlineData("Registration/Assets/login.js")]
    [InlineData("/web-scripts/a_b-c.v2.js")]
    public void AcceptsSameServerScripts(string path) => Assert.True(WebScripts.IsValid(path));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("https://evil.example/x.js")]
    [InlineData("//evil.example/x.js")]
    [InlineData("/ShareLinks/../System/x.js")]
    [InlineData("/ShareLinks/Assets/menu.css")]
    [InlineData("/ShareLinks/Assets/menu.js?x=1")]
    [InlineData("javascript:alert(1)")]
    public void RejectsEverythingElse(string? path) => Assert.False(WebScripts.IsValid(path));

    [Fact]
    public void RegisterNormalizesAndDeduplicates()
    {
        Assert.True(WebScripts.Register("Test/Assets/one.js"));
        Assert.True(WebScripts.Register("/Test/Assets/one.js"));
        Assert.False(WebScripts.Register("../x.js"));
        Assert.Single(WebScripts.All, p => p == "/Test/Assets/one.js");
        WebScripts.Unregister("Test/Assets/one.js");
        Assert.DoesNotContain("/Test/Assets/one.js", WebScripts.All);
    }
}
