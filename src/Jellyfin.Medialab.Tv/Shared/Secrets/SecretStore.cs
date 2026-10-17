using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MediaLabTv.Secrets;

/// <summary>
/// Secretele plugin-ului (parole, chei API, tokenuri) criptate la repaus, in afara configuratiei serverului:
/// fisierul <c>secrets.enc.json</c> din folderul de date al plugin-ului, fiecare valoare AES-256-GCM cu cheia
/// HKDF-SHA256(secret aleator de 32 de octeti din <c>secrets.key</c>, sare = produs + id-ul serverului) si cu numele
/// secretului ca date asociate. Ambele fisiere au drepturile 600 (doar utilizatorul serverului). O copie a configuratiei
/// (backup, export, captura de ecran, GET /Plugins/.../Configuration) nu mai contine secretele; fara fisierul cheii si
/// fara acelasi id de server, valorile nu se pot decripta. Un utilizator root local le poate totusi recupera.
/// Sursa comuna: plugin-store/tools/secrets/SecretStore.cs (copiata in fiecare plugin cu namespace-ul lui).
/// </summary>
public sealed class SecretStore
{
    public const string FileName = "secrets.enc.json";
    public const string KeyFileName = "secrets.key";
    private const string Prefix = "v1:";

    private readonly string _folder;
    private readonly string _serverId;
    private readonly string _product;
    private readonly object _lock = new();
    private Dictionary<string, string>? _items;
    private byte[]? _key;

    public SecretStore(string folder, string serverId, string product)
    {
        _folder = folder;
        _serverId = serverId ?? string.Empty;
        _product = product;
    }

    /// <summary>Mesaj pentru jurnal cand un secret exista, dar nu se mai poate decripta (cheie lipsa/alt server).</summary>
    public event Action<string>? Warning;

    private string FilePath => Path.Combine(_folder, FileName);

    private string KeyPath => Path.Combine(_folder, KeyFileName);

    /// <summary>Valoarea in clar sau sir gol (nesetat sau nedecriptabil).</summary>
    public string Get(string name)
    {
        lock (_lock)
        {
            var items = Load();
            if (!items.TryGetValue(name, out var stored))
            {
                return string.Empty;
            }

            try
            {
                var raw = Convert.FromBase64String(stored[Prefix.Length..]);
                var plain = new byte[raw.Length - 28];
                using var aes = new AesGcm(Key(), 16);
                aes.Decrypt(raw.AsSpan(0, 12), raw.AsSpan(28), raw.AsSpan(12, 16), plain, Aad(name));
                return Encoding.UTF8.GetString(plain);
            }
            catch (Exception ex) when (ex is CryptographicException or FormatException or ArgumentException)
            {
                Warning?.Invoke("secretul " + name + " nu se poate decripta (cheia sau id-ul serverului s-a schimbat); reintrodu-l in pagina plugin-ului");
                return string.Empty;
            }
        }
    }

    public bool Has(string name)
    {
        lock (_lock)
        {
            return Load().ContainsKey(name);
        }
    }

    /// <summary>Numele secretelor salvate (fara valori), pentru pagina: „setat ✓”.</summary>
    public IReadOnlyList<string> Names()
    {
        lock (_lock)
        {
            return Load().Keys.OrderBy(k => k, StringComparer.Ordinal).ToList();
        }
    }

    /// <summary>Salveaza valoarea (criptata); null sau gol sterge secretul.</summary>
    public void Set(string name, string? value)
    {
        lock (_lock)
        {
            var items = Load();
            if (string.IsNullOrEmpty(value))
            {
                if (!items.Remove(name))
                {
                    return;
                }
            }
            else
            {
                var data = Encoding.UTF8.GetBytes(value);
                var nonce = RandomNumberGenerator.GetBytes(12);
                var cipher = new byte[data.Length];
                var tag = new byte[16];
                using (var aes = new AesGcm(Key(), 16))
                {
                    aes.Encrypt(nonce, data, cipher, tag, Aad(name));
                }

                items[name] = Prefix + Convert.ToBase64String(nonce.Concat(tag).Concat(cipher).ToArray());
            }

            Save(items);
        }
    }

    private byte[] Aad(string name) => Encoding.UTF8.GetBytes(_product + "|" + name);

    private Dictionary<string, string> Load()
    {
        if (_items != null)
        {
            return _items;
        }

        var items = new Dictionary<string, string>(StringComparer.Ordinal);
        try
        {
            if (File.Exists(FilePath))
            {
                var parsed = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(FilePath));
                if (parsed != null)
                {
                    foreach (var kv in parsed.Where(kv => kv.Value != null && kv.Value.StartsWith(Prefix, StringComparison.Ordinal)))
                    {
                        items[kv.Key] = kv.Value;
                    }
                }
            }
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            Warning?.Invoke("fisierul " + FileName + " nu se poate citi: " + ex.Message);
        }

        return _items = items;
    }

    private void Save(Dictionary<string, string> items)
    {
        Directory.CreateDirectory(_folder);
        var tmp = FilePath + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(items));
        Restrict(tmp);
        File.Move(tmp, FilePath, true);
        _items = items;
    }

    private byte[] Key()
    {
        if (_key != null)
        {
            return _key;
        }

        byte[] secret;
        if (File.Exists(KeyPath))
        {
            secret = Convert.FromBase64String(File.ReadAllText(KeyPath).Trim());
        }
        else
        {
            Directory.CreateDirectory(_folder);
            secret = RandomNumberGenerator.GetBytes(32);
            var tmp = KeyPath + ".tmp";
            File.WriteAllText(tmp, Convert.ToBase64String(secret));
            Restrict(tmp);
            File.Move(tmp, KeyPath, true);
        }

        return _key = HKDF.DeriveKey(HashAlgorithmName.SHA256, secret, 32, Encoding.UTF8.GetBytes(_product + ":" + _serverId), Encoding.UTF8.GetBytes("plugin-secrets"));
    }

    private static void Restrict(string path)
    {
        if (!OperatingSystem.IsWindows())
        {
            File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        }
    }
}

/// <summary>Un camp secret din configuratia plugin-ului: numele (cheia in fisier) si cum se citeste/goleste in configuratie.</summary>
public sealed record SecretField<TConfig>(string Name, Func<TConfig, string?> Read, Action<TConfig, string> Write);

/// <summary>
/// Mutarea secretelor din configuratie in <see cref="SecretStore"/>: la salvarea din pagina (valorile noi tastate) si la
/// prima pornire dupa actualizare (valorile vechi din XML). In configuratie raman doar sirurile goale si lista
/// numelor setate (<c>SecretsSet</c>), ca pagina sa arate „setat ✓ / inlocuieste / sterge”.
/// </summary>
public static class SecretIntake
{
    /// <summary>
    /// Muta valorile ne-goale in depozit si le goleste in <paramref name="config"/>; sterge secretele din
    /// <paramref name="clear"/> (nume separate prin virgula). Intoarce lista numelor setate dupa operatie.
    /// </summary>
    public static (bool Changed, string SetNames) Absorb<TConfig>(TConfig config, SecretStore store, IEnumerable<SecretField<TConfig>> fields, string? clear)
    {
        var changed = false;
        var toClear = (clear ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var f in fields)
        {
            var value = f.Read(config)?.Trim();
            if (!string.IsNullOrEmpty(value))
            {
                store.Set(f.Name, value);
                f.Write(config, string.Empty);
                changed = true;
            }
            else if (toClear.Contains(f.Name, StringComparer.Ordinal))
            {
                store.Set(f.Name, null);
                changed = true;
            }

            if (f.Read(config) == null)
            {
                f.Write(config, string.Empty);
            }
        }

        return (changed, string.Join(",", store.Names()));
    }
}
