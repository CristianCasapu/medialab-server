using MediaBrowser.Common.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediaLabTv.Api;

/// <summary>medialab Server: the settings of the built-in MediaLab TV (the plugin uses the plugin configuration API instead).</summary>
[ApiController]
[Route("MediaLabTv/Admin/Configuration")]
[Authorize(Policy = Policies.RequiresElevation)]
public sealed class TvAdminController : ControllerBase
{
    [HttpGet]
    public ActionResult<PluginConfiguration> Get() => Plugin.Instance is { } p ? p.Configuration : NotFound();

    [HttpPost]
    public ActionResult Post([FromBody] PluginConfiguration configuration)
    {
        if (Plugin.Instance is not { } p)
        {
            return NotFound();
        }

        p.UpdateConfiguration(configuration);
        return NoContent();
    }
}
