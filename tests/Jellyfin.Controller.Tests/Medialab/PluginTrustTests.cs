using System;
using System.IO;
using System.Security.Cryptography;
using MediaBrowser.Controller.Medialab;
using Xunit;

namespace Jellyfin.Controller.Tests.Medialab;

public sealed class PluginTrustTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "ml-trust-" + Guid.NewGuid().ToString("N"));

    public PluginTrustTests() => Directory.CreateDirectory(_dir);

    public void Dispose() => Directory.Delete(_dir, true);

    private static string Sign(ECDsa key, byte[] data)
        => Convert.ToBase64String(key.SignData(data, HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence));

    [Fact]
    public void VerifiesWithTheMatchingKeyOnly()
    {
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        using var other = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var pub = Convert.ToBase64String(key.ExportSubjectPublicKeyInfo());
        var otherPub = Convert.ToBase64String(other.ExportSubjectPublicKeyInfo());
        var data = new byte[] { 1, 2, 3, 4 };
        var sig = Sign(key, data);

        Assert.True(PluginTrust.Verify(data, sig, [pub]));
        Assert.True(PluginTrust.Verify(data, sig + "\n", [otherPub, pub]));
        Assert.False(PluginTrust.Verify(data, sig, [otherPub]));
        Assert.False(PluginTrust.Verify([1, 2, 3, 5], sig, [pub]));
        Assert.False(PluginTrust.Verify(data, "not base64!", [pub]));
        Assert.False(PluginTrust.Verify(data, Convert.ToBase64String([1, 2, 3]), [pub]));
    }

    [Fact]
    public void FileWithoutSignatureIsUnsigned()
    {
        var dll = Path.Combine(_dir, "a.dll");
        File.WriteAllBytes(dll, [1, 2, 3]);
        Assert.Equal(PluginTrustState.Unsigned, PluginTrust.CheckFile(dll));
        Assert.Equal(PluginTrustState.Unsigned, PluginTrust.CheckFile(Path.Combine(_dir, "missing.dll")));
        Assert.Equal(PluginTrustState.Unsigned, PluginTrust.CheckPlugin([dll]));
        Assert.Equal(PluginTrustState.Unsigned, PluginTrust.CheckPlugin([]));
    }

    [Fact]
    public void ForeignOrStaleSignatureIsModified()
    {
        // signed with a key that is not medialab's: same as a DLL changed after signing
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var dll = Path.Combine(_dir, "b.dll");
        var unsigned = Path.Combine(_dir, "c.dll");
        File.WriteAllBytes(dll, [9, 9, 9]);
        File.WriteAllBytes(unsigned, [7]);
        File.WriteAllText(dll + PluginTrust.SignatureExtension, Sign(key, [9, 9, 9]));

        Assert.Equal(PluginTrustState.Modified, PluginTrust.CheckFile(dll));
        Assert.Equal(PluginTrustState.Modified, PluginTrust.CheckPlugin([unsigned, dll]));
    }

    [Fact]
    public void ServerTypesAreNotMedialabPlugins()
    {
        Assert.False(PluginTrust.IsMedialab(typeof(PluginTrust)));
        Assert.False(PluginTrust.IsMedialab(null));
        Assert.Equal(1, PluginTrust.PriorityOf("x"));
        Assert.Equal(1, PluginTrust.PriorityOf(null));
    }
}
