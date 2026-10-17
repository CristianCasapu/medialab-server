namespace MediaLabTv.Licensing;

/// <summary>medialab Server: MediaLab TV is built in and free, so the license gate of the jf-tvapp plugin is always open.</summary>
public static class LicenseGate
{
    public static bool AllowsFull => true;
}

/// <summary>The version the TV pages show and use for cache busting: the medialab revision (set at startup).</summary>
public static class LicenseConfig
{
    public static string PluginVersion { get; internal set; } = "0.0.0";
}
