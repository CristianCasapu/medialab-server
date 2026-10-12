namespace Jellyfin.Server.Medialab
{
    /// <summary>
    /// Identifies a medialab Server build (a fork of Jellyfin).
    /// </summary>
    /// <remarks>
    /// The wire identity (ProductName "Jellyfin Server") is deliberately unchanged so that official
    /// Jellyfin clients keep connecting. Plugins detect the fork in-process via reflection on this type,
    /// clients via the <see cref="HeaderName"/> response header.
    /// </remarks>
    public static class MedialabEdition
    {
        /// <summary>
        /// The response header carrying the medialab revision.
        /// </summary>
        public const string HeaderName = "X-Medialab-Server";

        /// <summary>
        /// The medialab revision, e.g. "12.2-ml.1".
        /// </summary>
        /// <remarks>Bumped by sync/weekly-sync.sh; the upstream AssemblyVersion stays untouched so plugin targetAbi checks keep working.</remarks>
        public const string Revision = "12.2-ml.1";
    }
}
