using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Model.Updates;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Server.Medialab
{
    /// <summary>
    /// Adds the medialab.works plugin catalog as the first plugin repository, once (capability "medialab-catalog").
    /// </summary>
    /// <remarks>
    /// The catalog is added only after its public manifest answers, and only once per server: if the administrator removes
    /// it later, it is not added again (a marker file in the data folder remembers it was done).
    /// </remarks>
    public sealed class MedialabCatalogHost : IHostedService
    {
        /// <summary>
        /// The repository name shown in the dashboard.
        /// </summary>
        public const string CatalogName = "medialab.works";

        /// <summary>
        /// The public manifest (no license key; licensed users can still add their own keyed manifest).
        /// </summary>
        public const string CatalogUrl = "https://medialab.works/jellyfin/manifest.json";

        private const string MarkerFile = "medialab-catalog-added";

        private readonly IServerConfigurationManager _config;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<MedialabCatalogHost> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="MedialabCatalogHost"/> class.
        /// </summary>
        /// <param name="config">The server configuration manager.</param>
        /// <param name="httpClientFactory">The HTTP client factory.</param>
        /// <param name="logger">The logger.</param>
        public MedialabCatalogHost(IServerConfigurationManager config, IHttpClientFactory httpClientFactory, ILogger<MedialabCatalogHost> logger)
        {
            _config = config;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        /// <summary>
        /// Puts the medialab catalog first in a repository list, unless it is already there.
        /// </summary>
        /// <param name="repositories">The current repositories.</param>
        /// <returns>The new list, or <c>null</c> if the catalog is already configured.</returns>
        public static RepositoryInfo[]? WithCatalogFirst(RepositoryInfo[] repositories)
        {
            ArgumentNullException.ThrowIfNull(repositories);
            if (repositories.Any(r => r.Url is not null && r.Url.StartsWith(CatalogUrl, StringComparison.OrdinalIgnoreCase)))
            {
                return null;
            }

            return [new RepositoryInfo { Name = CatalogName, Url = CatalogUrl, Enabled = true }, .. repositories];
        }

        /// <inheritdoc />
        public Task StartAsync(CancellationToken cancellationToken)
        {
            var marker = Path.Combine(_config.ApplicationPaths.DataPath, MarkerFile);
            if (!File.Exists(marker))
            {
                _ = Task.Run(() => AddCatalogAsync(marker, CancellationToken.None), CancellationToken.None);
            }

            return Task.CompletedTask;
        }

        /// <inheritdoc />
        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

        private async Task AddCatalogAsync(string marker, CancellationToken cancellationToken)
        {
            try
            {
                var configuration = _config.Configuration;
                var updated = WithCatalogFirst(configuration.PluginRepositories);
                if (updated is not null)
                {
                    using var response = await _httpClientFactory.CreateClient(NamedClient.Default)
                        .GetAsync(new Uri(CatalogUrl), cancellationToken).ConfigureAwait(false);
                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogInformation("medialab.works catalog not available yet (HTTP {Status}); will try again at the next start", (int)response.StatusCode);
                        return;
                    }

                    var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
                    using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
                    if (doc.RootElement.ValueKind != JsonValueKind.Array)
                    {
                        _logger.LogInformation("medialab.works catalog is not a plugin manifest yet; will try again at the next start");
                        return;
                    }

                    configuration.PluginRepositories = updated;
                    _config.SaveConfiguration();
                    _logger.LogInformation("Added the medialab.works plugin catalog as the first plugin repository");
                }

                await File.WriteAllTextAsync(marker, CatalogUrl, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or IOException)
            {
                _logger.LogInformation("medialab.works catalog not reachable ({Message}); will try again at the next start", ex.Message);
            }
        }
    }
}
