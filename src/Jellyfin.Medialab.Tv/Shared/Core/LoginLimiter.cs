namespace MediaLabTv.Core;

/// <summary>
/// Limita incercarilor la /MediaLabTv/Login (K20): pe adresa clientului si pe tot serverul (protejeaza si apelurile catre
/// Cloudflare). Ferestre glisante in memorie; numarul de adrese urmarite e plafonat. Aceeasi clasa pe Emby si Jellyfin.
/// </summary>
public sealed class LoginLimiter
{
    private readonly int _perClient;
    private readonly TimeSpan _clientWindow;
    private readonly int _global;
    private readonly TimeSpan _globalWindow;
    private readonly int _maxClients;
    private readonly Dictionary<string, Queue<DateTimeOffset>> _clients = new(StringComparer.Ordinal);
    private readonly Queue<DateTimeOffset> _all = new();
    private readonly object _lock = new();

    public LoginLimiter(int perClient = 10, TimeSpan? clientWindow = null, int global = 120, TimeSpan? globalWindow = null, int maxClients = 10000)
    {
        _perClient = perClient;
        _clientWindow = clientWindow ?? TimeSpan.FromMinutes(10);
        _global = global;
        _globalWindow = globalWindow ?? TimeSpan.FromMinutes(1);
        _maxClients = maxClients;
    }

    /// <summary>Limitele folosite de endpoint: 10 incercari / 10 minute pe adresa, 120 / minut pe server.</summary>
    public static LoginLimiter Shared { get; } = new();

    public int Tracked
    {
        get
        {
            lock (_lock)
            {
                return _clients.Count;
            }
        }
    }

    /// <summary>true = incercarea e permisa (si se numara); false = prea multe (HTTP 429).</summary>
    public bool TryAcquire(string? client, DateTimeOffset now)
    {
        var key = string.IsNullOrEmpty(client) ? "?" : client;
        lock (_lock)
        {
            Trim(_all, now - _globalWindow);
            if (_all.Count >= _global)
            {
                return false;
            }

            if (!_clients.TryGetValue(key, out var hits))
            {
                if (_clients.Count >= _maxClients)
                {
                    Prune(now);
                }

                hits = new Queue<DateTimeOffset>();
                _clients[key] = hits;
            }

            Trim(hits, now - _clientWindow);
            if (hits.Count >= _perClient)
            {
                return false;
            }

            hits.Enqueue(now);
            _all.Enqueue(now);
            return true;
        }
    }

    private static void Trim(Queue<DateTimeOffset> hits, DateTimeOffset before)
    {
        while (hits.Count > 0 && hits.Peek() <= before)
        {
            hits.Dequeue();
        }
    }

    private void Prune(DateTimeOffset now)
    {
        foreach (var key in _clients.Where(kv => kv.Value.Count == 0 || kv.Value.Last() <= now - _clientWindow).Select(kv => kv.Key).ToList())
        {
            _clients.Remove(key);
        }

        if (_clients.Count >= _maxClients)
        {
            // Plin de adrese active (atac distribuit): se reia numaratoarea; limita globala ramane.
            _clients.Clear();
        }
    }
}
