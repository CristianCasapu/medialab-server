using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;

namespace MediaBrowser.Controller.Medialab;

/// <summary>
/// The signature state of a plugin assembly (medialab Server, capability "plugin-signatures").
/// </summary>
public enum PluginTrustState
{
    /// <summary>No signature file next to the assembly.</summary>
    Unsigned,

    /// <summary>Signed by medialab and unchanged since.</summary>
    Verified,

    /// <summary>A signature file exists but does not match the assembly (changed after signing, or another key).</summary>
    Modified
}

/// <summary>
/// Verifies the medialab signatures of plugin assemblies.
/// </summary>
/// <remarks>
/// A medialab release ships "&lt;assembly&gt;.dll.sig" next to each assembly: the base64 ECDSA P-256 / SHA-256 signature
/// (DER) of the file, made by medialab's release tooling. Verified plugins are shown as "Verified – medialab" and come
/// first by default (load order, tuner types, guide and subtitle providers); the administrator can still reorder them.
/// </remarks>
public static class PluginTrust
{
    // SubjectPublicKeyInfo (DER, base64) of the medialab plugin signing keys; a new key is added before the old one is retired.
    private static readonly string[] _publicKeys =
    [
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE6atpbV9k6l5vY2mYAf4DVLf1rU6OOONziDjbOXWf/oq/kkRlIadmDCmNRoXMcZgeWSL1EMOR9HZ78c7k9JhLEg=="
    ];

    private static readonly ConcurrentDictionary<string, (long Length, DateTime Written, PluginTrustState State)> _cache = new(StringComparer.Ordinal);

    /// <summary>
    /// Gets the signature file extension appended to the assembly file name.
    /// </summary>
    public const string SignatureExtension = ".sig";

    /// <summary>
    /// Checks one assembly file.
    /// </summary>
    /// <param name="path">The assembly path.</param>
    /// <returns>The state.</returns>
    public static PluginTrustState CheckFile(string? path)
    {
        if (string.IsNullOrEmpty(path) || !File.Exists(path))
        {
            return PluginTrustState.Unsigned;
        }

        var sigPath = path + SignatureExtension;
        if (!File.Exists(sigPath))
        {
            return PluginTrustState.Unsigned;
        }

        var info = new FileInfo(path);
        var sigWritten = File.GetLastWriteTimeUtc(sigPath);
        var written = info.LastWriteTimeUtc > sigWritten ? info.LastWriteTimeUtc : sigWritten;
        if (_cache.TryGetValue(path, out var cached) && cached.Length == info.Length && cached.Written == written)
        {
            return cached.State;
        }

        var state = Verify(File.ReadAllBytes(path), File.ReadAllText(sigPath), _publicKeys) ? PluginTrustState.Verified : PluginTrustState.Modified;
        _cache[path] = (info.Length, written, state);
        return state;
    }

    /// <summary>
    /// Checks all assemblies of a plugin: verified only if every one is verified; modified if any one is.
    /// </summary>
    /// <param name="dllFiles">The plugin's assembly paths.</param>
    /// <returns>The state.</returns>
    public static PluginTrustState CheckPlugin(IEnumerable<string> dllFiles)
    {
        ArgumentNullException.ThrowIfNull(dllFiles);
        var any = false;
        var allVerified = true;
        foreach (var file in dllFiles)
        {
            any = true;
            var state = CheckFile(file);
            if (state == PluginTrustState.Modified)
            {
                return PluginTrustState.Modified;
            }

            allVerified &= state == PluginTrustState.Verified;
        }

        return any && allVerified ? PluginTrustState.Verified : PluginTrustState.Unsigned;
    }

    /// <summary>
    /// Checks a plugin by its assembly list, or, when the list is empty (a plugin not loaded yet, e.g. an update waiting
    /// for a restart), by the assemblies in its folder.
    /// </summary>
    /// <param name="dllFiles">The plugin's assembly paths (may be empty).</param>
    /// <param name="pluginPath">The plugin folder.</param>
    /// <returns>The state.</returns>
    public static PluginTrustState CheckPlugin(IReadOnlyCollection<string> dllFiles, string? pluginPath)
    {
        ArgumentNullException.ThrowIfNull(dllFiles);
        if (dllFiles.Count == 0 && !string.IsNullOrEmpty(pluginPath) && Directory.Exists(pluginPath))
        {
            return CheckPlugin(Directory.GetFiles(pluginPath, "*.dll", SearchOption.TopDirectoryOnly));
        }

        return CheckPlugin(dllFiles);
    }

    /// <summary>
    /// Gets a value indicating whether a type comes from a verified medialab plugin assembly.
    /// </summary>
    /// <param name="type">The type (e.g. a provider implementation).</param>
    /// <returns><c>true</c> if its assembly is verified.</returns>
    public static bool IsMedialab(Type? type)
    {
        if (type is null || type.Assembly.IsDynamic)
        {
            return false;
        }

        try
        {
            return CheckFile(type.Assembly.Location) == PluginTrustState.Verified;
        }
        catch (IOException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }
    }

    /// <summary>
    /// Verifies a plugin zip archive: every DLL in it must have a matching .sig next to it, signed by medialab.
    /// </summary>
    /// <param name="zipStream">The zip package.</param>
    /// <returns><c>true</c> when every DLL is signed by medialab.</returns>
    public static bool VerifyPackage(Stream zipStream)
    {
        ArgumentNullException.ThrowIfNull(zipStream);
        using var zip = new System.IO.Compression.ZipArchive(zipStream, System.IO.Compression.ZipArchiveMode.Read, leaveOpen: true);
        var entries = zip.Entries.ToDictionary(e => e.FullName, e => e, StringComparer.OrdinalIgnoreCase);
        var any = false;
        foreach (var dll in zip.Entries.Where(e => e.FullName.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)))
        {
            if (!entries.TryGetValue(dll.FullName + SignatureExtension, out var sigEntry))
            {
                return false;
            }

            using var dllBytes = new MemoryStream();
            using (var dllStream = dll.Open())
            {
                dllStream.CopyTo(dllBytes);
            }

            string signature;
            using (var reader = new StreamReader(sigEntry.Open()))
            {
                signature = reader.ReadToEnd();
            }

            if (!Verify(dllBytes.ToArray(), signature, _publicKeys))
            {
                return false;
            }

            any = true;
        }

        return any;
    }

    /// <summary>
    /// Gets the default order key: medialab plugins first (0), everything else after (1).
    /// </summary>
    /// <param name="instance">A provider instance.</param>
    /// <returns>The order key.</returns>
    public static int PriorityOf(object? instance) => IsMedialab(instance?.GetType()) ? 0 : 1;

    /// <summary>
    /// Verifies a signature against a set of public keys.
    /// </summary>
    /// <param name="data">The signed bytes.</param>
    /// <param name="signatureBase64">The base64 DER signature (whitespace ignored).</param>
    /// <param name="publicKeys">Base64 SubjectPublicKeyInfo keys.</param>
    /// <returns><c>true</c> if one of the keys verifies it.</returns>
    public static bool Verify(byte[] data, string signatureBase64, IEnumerable<string> publicKeys)
    {
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(publicKeys);
        byte[] signature;
        try
        {
            signature = Convert.FromBase64String((signatureBase64 ?? string.Empty).Trim());
        }
        catch (FormatException)
        {
            return false;
        }

        foreach (var key in publicKeys)
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(key), out _);
            try
            {
                if (ecdsa.VerifyData(data, signature, HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence))
                {
                    return true;
                }
            }
            catch (CryptographicException)
            {
                // malformed signature: not verified by this key
            }
        }

        return false;
    }
}
