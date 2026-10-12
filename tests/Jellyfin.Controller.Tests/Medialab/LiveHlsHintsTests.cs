using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.MediaEncoding;
using MediaBrowser.Controller.Streaming;
using MediaBrowser.Model.Dto;
using Moq;
using Xunit;

namespace Jellyfin.Controller.Tests.Medialab;

public class LiveHlsHintsTests
{
    private static StreamState State(StreamingRequestDto request, MediaSourceInfo source) =>
        new(Mock.Of<IMediaSourceManager>(), TranscodingJobType.Hls, Mock.Of<ITranscodeManager>())
        {
            Request = request,
            MediaSource = source,
        };

    [Fact]
    public void LiveSourceHintsApplyWhenTheClientAsksNothing()
    {
        var state = State(new VideoRequestDto(), new MediaSourceInfo { IsInfiniteStream = true, LiveSegmentLength = 1, LiveMinSegments = 1 });
        Assert.Equal(1, state.SegmentLength);
        Assert.Equal(1, state.MinSegments);
    }

    [Fact]
    public void TheClientRequestWins()
    {
        var state = State(new VideoRequestDto { SegmentLength = 6, MinSegments = 2 }, new MediaSourceInfo { IsInfiniteStream = true, LiveSegmentLength = 1, LiveMinSegments = 1 });
        Assert.Equal(6, state.SegmentLength);
        Assert.Equal(2, state.MinSegments);
    }

    [Fact]
    public void UpstreamDefaultsWithoutHintsOrForRecordedMedia()
    {
        var noHints = State(new VideoRequestDto(), new MediaSourceInfo { IsInfiniteStream = true });
        var notLive = State(new VideoRequestDto(), new MediaSourceInfo { IsInfiniteStream = false, LiveSegmentLength = 1, LiveMinSegments = 1 });
        Assert.Equal(3, noHints.SegmentLength);
        Assert.Equal(3, noHints.MinSegments);
        Assert.Equal(3, notLive.SegmentLength);
        Assert.Equal(3, notLive.MinSegments);
    }
}
