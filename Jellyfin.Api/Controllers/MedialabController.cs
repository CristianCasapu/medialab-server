using System.Collections.Generic;
using MediaBrowser.Controller.Medialab;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Api.Controllers;

/// <summary>
/// medialab Server extension points for plugins.
/// </summary>
[Route("MedialabEdition")]
public class MedialabController : BaseJellyfinApiController
{
    /// <summary>
    /// Gets the scripts plugins add to the web client.
    /// </summary>
    /// <remarks>Anonymous: some scripts work on the sign-in page (e.g. a sign-up button). The list holds only paths.</remarks>
    /// <response code="200">The server-relative script paths.</response>
    /// <returns>The list of scripts.</returns>
    [HttpGet("WebScripts")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<string>> GetWebScripts() => Ok(WebScripts.All);
}
