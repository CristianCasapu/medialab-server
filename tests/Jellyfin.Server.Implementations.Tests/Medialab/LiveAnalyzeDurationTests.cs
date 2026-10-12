using System.Collections.Generic;
using Emby.Server.Implementations.Library;
using MediaBrowser.Model.Entities;
using Xunit;

namespace Jellyfin.Server.Implementations.Tests.Medialab
{
    public class LiveAnalyzeDurationTests
    {
        private static List<MediaStream> Streams(int videoIndex, int audioIndex) =>
        [
            new MediaStream { Type = MediaStreamType.Video, Index = videoIndex },
            new MediaStream { Type = MediaStreamType.Audio, Index = audioIndex },
        ];

        [Fact]
        public void RequestedDurationIsKeptWhenIndexesAreKnown()
            => Assert.Equal(500, MediaSourceManager.LiveAnalyzeDurationMs(500, Streams(1, 2)));

        [Theory]
        [InlineData(null)]
        [InlineData(0)]
        [InlineData(5000)]
        public void UpstreamDefaultWithoutAShorterRequest(int? requested)
            => Assert.Equal(3000, MediaSourceManager.LiveAnalyzeDurationMs(requested, Streams(1, 2)));

        [Fact]
        public void UpstreamDefaultWhenAnIndexIsUnknown()
        {
            Assert.Equal(3000, MediaSourceManager.LiveAnalyzeDurationMs(500, Streams(-1, 2)));
            Assert.Equal(3000, MediaSourceManager.LiveAnalyzeDurationMs(500, []));
        }
    }
}
