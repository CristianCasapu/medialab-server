/*
 * MediaLab TV - interfata stil Netflix (acasa, pagina titlului, cautare, profiluri, player), pentru Emby si Jellyfin.
 *
 * Pagina e servita de plugin pe aceeasi origine cu serverul. Tokenul e cel scris de lansator (index.html / tv.js) in
 * formatul interfetei web a serverului (Emby: servercredentials3, Jellyfin: jellyfin_credentials); fara token valid ne
 * intoarcem la lansator. Toate datele vin din API-ul serverului cu tokenul utilizatorului si doar din listele lui
 * (biblioteci, reluare, favorite...), deci serverul aplica drepturile, eticheta si varsta. Un titlu deschis dupa id
 * (adresa #/title/<id>) se cere tot printr-o lista filtrata (Items?Ids=), nu direct: Emby nu verifica accesul la
 * citirea directa dupa id (TASKS G22).
 *
 * Redarea: PlaybackInfo cu un profil de browser (MP4 H.264 direct, altfel HLS H.264/AAC), hls.js (Emby: cel din
 * interfata web, modul AMD; Jellyfin: hls.js 1.5.20 inclus in plugin), pistele audio, subtitrarile VTT externe (cele
 * imagine se ard in flux), raportarea Sessions/Playing (reluarea apare in „Continua vizionarea”), episodul urmator si
 * butoanele „Sari peste” (Emby: markerii nativi + Smart Skip; Jellyfin: Media Segments).
 *
 * ES5 si XMLHttpRequest, fara pas de build: browserele televizoarelor (Philips Saphi ~ Chrome 79, Tizen, webOS).
 * Telecomanda (sageti, OK, Inapoi, butoanele media), mouse si touch.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var JELLYFIN = root.getAttribute('data-platform') === 'jellyfin';
  var ORIGIN = location.origin || (location.protocol + '//' + location.host);
  var API = ORIGIN + apiPath();
  var WEB = JELLYFIN ? API + '/web/' : API.replace(/\/emby$/i, '') + '/web/index.html';
  var CLIENT = root.getAttribute('data-client') || 'MediaLab TV';
  var VERSION = root.getAttribute('data-version') || '1.2.0';
  var LIVE_ENABLED = root.getAttribute('data-livetv') === '1';
  var CREDENTIALS_KEY = JELLYFIN ? 'jellyfin_credentials' : 'servercredentials3';
  var DEVICE_KEY = '_deviceId2';
  var ACCOUNT_KEY = 'medialabTvAccount';
  var PROFILES_KEY = 'medialabTvProfiles';
  var TICKS = 10000000;
  var UA = navigator.userAgent || '';
  var TOUCH = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  var PLATFORM_TV = detectTv();
  var TV = false;         // modul TV (10 picioare) activ
  var mouseUsed = false;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var LIST_FIELDS = 'Overview,Genres,PrimaryImageAspectRatio,ChildCount';
  var DETAIL_FIELDS = 'Overview,Genres,People,Studios,Taglines,RemoteTrailers,ChildCount,PrimaryImageAspectRatio,DateCreated';
  var IMG = '&EnableImageTypes=Primary,Backdrop,Thumb,Logo&ImageTypeLimit=1&EnableUserData=true';

  var STRINGS = {
    ro: {
      fullScreen: 'Ecran complet', exitFullScreen: 'Ieși din ecranul complet', fullHint: 'Apasă OK (sau F) pentru ecran complet',
      home: 'Acasă', movies: 'Filme', series: 'Seriale', liveTv: 'TV în direct', myList: 'Lista mea', search: 'Căutare', back: 'Înapoi',
      play: 'Redă', resume: 'Continuă', moreInfo: 'Mai multe informații', startOver: 'De la început', trailer: 'Trailer',
      addList: 'Lista mea', inList: 'În lista mea', markWatched: 'Marchează văzut', watched: 'Văzut',
      episodes: 'Episoade', season: 'Sezonul {0}', specials: 'Speciale', cast: 'Distribuția', similar: 'Titluri similare', inCollection: 'În această colecție',
      continueWatching: 'Continuă vizionarea', nextUp: 'Episodul următor', latestMovies: 'Filme adăugate recent', latestSeries: 'Seriale adăugate recent',
      collections: 'Colecții', favorites: 'Lista mea', genres: 'Genuri', more: 'Vezi tot',
      onNow: 'Acum la TV', tonightFilms: 'Filme în seara asta', sport: 'Sport', kids: 'Pentru copii', upNext: 'Urmează', allChannels: 'Toate canalele',
      whosWatching: 'Cine se uită?', otherAccount: 'Alt cont', signOut: 'Deconectare', openWeb: JELLYFIN ? 'Deschide Jellyfin Web' : 'Deschide Emby Web',
      password: 'Parola pentru {0}', signIn: 'Conectare', cancel: 'Renunță', wrongPassword: 'Parolă greșită.', pin: 'PIN-ul profilului {0}', wrongPin: 'PIN greșit.',
      searchHint: 'Titluri, genuri…', noResults: 'Nimic găsit pentru „{0}”.', typeToSearch: 'Scrie numele unui film sau serial.', emptyList: 'Nimic aici încă.',
      unplayable: 'Titlul nu se poate reda acum.', network: 'Serverul nu răspunde. Încercați din nou.', retry: 'Reîncearcă',
      audio: 'Audio', subtitles: 'Subtitrări', off: 'Fără', channels: 'Canale', chapters: 'Capitole', chapter: 'Capitolul {0}', volume: 'Volum', muted: 'Fără sunet', lockOsd: 'Blochează OSD', unlockOsd: 'Deblochează OSD', osdLocked: 'OSD blocat — tasta albastră îl deblochează', netCheck: 'Verifică rețeaua', netMeasuring: 'Se măsoară…', netRepeat: 'Repetă măsurarea', netFailed: 'Măsurarea a eșuat. Verifică conexiunea la server.', netSlow: 'Rețea lentă — redare posibilă doar la calitate scăzută', netMedium: 'Rețea medie', netGood: 'Rețea bună', netExcellent: 'Rețea excelentă — calitate maximă', netInitialQ: 'Calitate inițială AUTO: {0}', nextEpisode: 'Episodul următor', nextIn: 'Episodul următor în {0}',
      skipIntro: 'Sari peste intro', skipRecap: 'Sari peste rezumat', skipCredits: 'Sari peste generic', playPause: 'Redă / pauză', rewind: 'Înapoi 10 secunde', forward: 'Înainte 30 de secunde',
      live: 'LIVE', min: '{0} min', hm: '{0} h {1} min', seasons1: '1 sezon', seasonsN: '{0} sezoane', endsAt: 'Se termină la {0}', startsAt: 'Începe la {0}',
      director: 'Regia', genresLabel: 'Genuri', studios: 'Studiouri', sortName: 'A–Z', sortAdded: 'Adăugate recent', sortYear: 'An', sortRating: 'Notă',
      channelsN: '{0} canale', now: 'acum', nextHour: 'în următoarea oră', next4h: 'în următoarele 4 ore', space: 'Spațiu', del: 'Șterge', clear: 'Golește',
      exitQ: 'Ieșiți din aplicație?', exit: 'Ieșire', tvModeOn: 'Mod TV: pornit', tvModeOff: 'Mod TV: oprit',
      added: 'Adăugat în lista ta.', removed: 'Scos din lista ta.', markedWatched: 'Marcat ca văzut.', markedUnwatched: 'Marcat ca nevăzut.', episodeN: 'Episodul {0}',
      rosubDownload: 'Descarcă de pe rosub', rosubTitle: 'Subtitrări rosub', rosubHint: 'Se caută subtitrări românești pentru titlul curent. Ajustează textul și apasă Caută.',
      rosubSearching: 'Se caută pe rosub…', rosubEmpty: 'Nicio subtitrare găsită pe rosub.', rosubFailed: 'Căutarea pe rosub a eșuat. Încearcă din nou.', rosubDownloading: 'Se descarcă subtitrarea…',
      rosubUnavailable: 'rosub indisponibil — lipsește cheia API sau subs.ro nu răspunde.', rosubLoaded: 'Subtitrarea a fost încărcată.', rosubExt: 'rosub: {0}'
    },
    en: {
      fullScreen: 'Full screen', exitFullScreen: 'Exit full screen', fullHint: 'Press OK (or F) for full screen',
      home: 'Home', movies: 'Movies', series: 'TV Shows', liveTv: 'Live TV', myList: 'My List', search: 'Search', back: 'Back',
      play: 'Play', resume: 'Resume', moreInfo: 'More Info', startOver: 'Start Over', trailer: 'Trailer',
      addList: 'My List', inList: 'In My List', markWatched: 'Mark watched', watched: 'Watched',
      episodes: 'Episodes', season: 'Season {0}', specials: 'Specials', cast: 'Cast', similar: 'More Like This', inCollection: 'In This Collection',
      continueWatching: 'Continue Watching', nextUp: 'Next Up', latestMovies: 'New Movies', latestSeries: 'New TV Shows',
      collections: 'Collections', favorites: 'My List', genres: 'Genres', more: 'See all',
      onNow: 'On Now', tonightFilms: 'Movies Tonight', sport: 'Sports', kids: 'Kids', upNext: 'Coming Up', allChannels: 'All Channels',
      whosWatching: 'Who\'s watching?', otherAccount: 'Other account', signOut: 'Sign out', openWeb: JELLYFIN ? 'Open Jellyfin Web' : 'Open Emby Web',
      password: 'Password for {0}', signIn: 'Sign in', cancel: 'Cancel', wrongPassword: 'Wrong password.', pin: 'Profile PIN for {0}', wrongPin: 'Wrong PIN.',
      searchHint: 'Titles, genres…', noResults: 'No results for "{0}".', typeToSearch: 'Type the name of a movie or show.', emptyList: 'Nothing here yet.',
      unplayable: 'This title cannot be played right now.', network: 'The server is not responding. Please try again.', retry: 'Retry',
      audio: 'Audio', subtitles: 'Subtitles', off: 'Off', channels: 'Channels', chapters: 'Chapters', chapter: 'Chapter {0}', volume: 'Volume', muted: 'Muted', lockOsd: 'Lock OSD', unlockOsd: 'Unlock OSD', osdLocked: 'OSD locked — press the blue key to unlock', netCheck: 'Check network', netMeasuring: 'Measuring…', netRepeat: 'Measure again', netFailed: 'Measurement failed. Check the connection to the server.', netSlow: 'Slow network — playback possible only at low quality', netMedium: 'Average network', netGood: 'Good network', netExcellent: 'Excellent network — maximum quality', netInitialQ: 'Initial AUTO quality: {0}', nextEpisode: 'Next Episode', nextIn: 'Next episode in {0}',
      skipIntro: 'Skip Intro', skipRecap: 'Skip Recap', skipCredits: 'Skip Credits', playPause: 'Play / pause', rewind: 'Back 10 seconds', forward: 'Forward 30 seconds',
      live: 'LIVE', min: '{0}m', hm: '{0}h {1}m', seasons1: '1 Season', seasonsN: '{0} Seasons', endsAt: 'Ends at {0}', startsAt: 'Starts at {0}',
      director: 'Director', genresLabel: 'Genres', studios: 'Studios', sortName: 'A–Z', sortAdded: 'Recently added', sortYear: 'Year', sortRating: 'Rating',
      channelsN: '{0} channels', now: 'now', nextHour: 'in the next hour', next4h: 'in the next 4 hours', space: 'Space', del: 'Delete', clear: 'Clear',
      exitQ: 'Exit the app?', exit: 'Exit', tvModeOn: 'TV mode: on', tvModeOff: 'TV mode: off',
      added: 'Added to My List.', removed: 'Removed from My List.', markedWatched: 'Marked as watched.', markedUnwatched: 'Marked as unwatched.', episodeN: 'Episode {0}',
      rosubDownload: 'Download from rosub', rosubTitle: 'rosub subtitles', rosubHint: 'Searching rosub for Romanian subtitles of the current title. Adjust the text and press Search.',
      rosubSearching: 'Searching rosub…', rosubEmpty: 'No subtitles found on rosub.', rosubFailed: 'The rosub search failed. Try again.', rosubDownloading: 'Downloading the subtitle…',
      rosubUnavailable: 'rosub unavailable — the API key is missing or subs.ro is not responding.', rosubLoaded: 'The subtitle was loaded.', rosubExt: 'rosub: {0}'
    }
  };
  var LANG = pickLanguage();

  // --- Televizor: detectarea (browser + caracteristici), modul TV, marimea radacinii --------------------------------

  // Platforma televizorului dupa browser; null = nu pare televizor.
  function detectTv() {
    if (/Tizen/i.test(UA)) return 'tizen';
    if (/Web0S|webOS|NetCast/i.test(UA)) return 'webos';
    if (/NETTV|Saphi|Philips|HbbTV/i.test(UA)) return 'philips';
    if (/Android/i.test(UA) && /\bTV\b|AFT[A-Z]|BRAVIA|MiTV|MIBOX|Chromecast|GoogleTV|Google TV|SHIELD/i.test(UA)) return 'androidtv';
    if (/Android/i.test(UA) && !TOUCH && Math.max(screen.width, screen.height) >= 1280) return 'androidtv';
    if (/SMART-TV|SmartTV|CrKey|AppleTV|Roku|AFT[A-Z]|VIDAA|Hisense/i.test(UA)) return 'tv';
    return null;
  }

  // Fara touch, fara mouse fin, ecran mare: probabil televizor - modul TV porneste la prima sageata apasata inainte de mouse.
  function maybeTv() {
    var fine = false;
    try { fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches; } catch (e) { }
    return !TOUCH && !fine && window.innerWidth >= 1280 && window.innerHeight >= 700;
  }

  function modeOverride() {
    var m = /[?&]tv=([01])/.exec(location.search || '');
    if (m) return m[1] === '1' ? 'tv' : 'desktop';
    try { return localStorage.getItem('medialabTvMode'); } catch (e) { return null; }
  }

  function setTvMode(on) {
    TV = !!on;
    toggleClass(root, 'ml-tv', TV);
    scaleRoot();
    // Inapoi la derularea obisnuita: randurile mutate prin transform revin la pozitia lor.
    var inners = document.querySelectorAll('.ml-track-in');
    for (var i = 0; i < inners.length; i++) { inners[i].style.transform = ''; inners[i].parentNode.mlX = 0; }
  }

  // 20 px la 1280x720, 30 px la 1920x1080, 60 px la 3840x2160 (toate dimensiunile din browse.css sunt in rem).
  function scaleRoot() {
    if (!TV) { root.style.fontSize = ''; return; }
    var k = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    root.style.fontSize = Math.max(14, Math.round(20 * k * 10) / 10) + 'px';
  }

  function rem() { return parseFloat(window.getComputedStyle(root).fontSize) || 18; }

  // Starea sesiunii
  var S = { serverId: null, userId: null, token: null, user: null, hasLive: false, views: [], stack: [], replacing: false, homeBuilt: false, homeDirty: false, homeFocus: null, homeScroll: 0, rosub: null };

  // ------------------------------------------------------------------------------------------------
  // Utilitare
  // ------------------------------------------------------------------------------------------------

  function $(id) { return document.getElementById(id); }

  function t(key, a, b) {
    var s = STRINGS[LANG][key] || STRINGS.en[key] || key;
    if (a !== undefined) s = s.replace('{0}', a);
    if (b !== undefined) s = s.replace('{1}', b);
    return s;
  }

  function apiPath() {
    if (JELLYFIN) return (root.getAttribute('data-api') || '').replace(/\/+$/, '');
    var path = location.pathname || '';
    var at = path.indexOf('/MediaLabTv/');
    return at > 0 ? path.substring(0, at) : '/emby';
  }

  function pickLanguage() {
    var set = root.getAttribute('data-lang');
    if (set === 'ro' || set === 'en') return set;
    var nav = ((navigator.languages && navigator.languages[0]) || navigator.language || navigator.userLanguage || 'en').toLowerCase();
    return nav.indexOf('ro') === 0 ? 'ro' : 'en';
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function hasClass(e, c) { return !!e && !!e.className && typeof e.className === 'string' && (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function addClass(e, c) { if (e && !hasClass(e, c)) e.className = (e.className ? e.className + ' ' : '') + c; }
  function removeClass(e, c) { if (e && hasClass(e, c)) e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, ''); }
  function toggleClass(e, c, on) { if (on) addClass(e, c); else removeClass(e, c); }

  function closest(e, test) {
    while (e && e !== document) {
      if (e.nodeType === 1 && test(e)) return e;
      e = e.parentNode;
    }
    return null;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function clock(date) { return pad2(date.getHours()) + ':' + pad2(date.getMinutes()); }

  function duration(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    var h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return (h ? h + ':' + pad2(m) : m) + ':' + pad2(s);
  }

  function runtime(ticks) {
    if (!ticks) return '';
    var min = Math.round(ticks / TICKS / 60);
    return min >= 60 ? t('hm', Math.floor(min / 60), min % 60) : t('min', min);
  }

  function parseDate(s) {
    if (!s) return null;
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  function deviceId() {
    var id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) { }
    if (!id) {
      id = uuid();
      try { localStorage.setItem(DEVICE_KEY, id); } catch (e) { }
    }
    return id;
  }

  function quote(v) { return String(v).replace(/["\\\r\n]/g, ''); }

  function enc(v) { return encodeURIComponent(v); }

  function toast(text) {
    var box = $('mlToast');
    box.textContent = text;
    removeClass(box, 'hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { addClass(box, 'hidden'); }, 2600);
  }

  function hashColor(text) {
    var colors = ['#2b6cb0', '#c05621', '#2f855a', '#b83280', '#6b46c1', '#c53030', '#2c7a7b', '#975a16'];
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return colors[Math.abs(h) % colors.length];
  }

  // ------------------------------------------------------------------------------------------------
  // API: coada (cel mult 4 cereri deodata), cache scurt pentru liste, 401 -> lansatorul
  // ------------------------------------------------------------------------------------------------

  var queue = [];
  var active = 0;
  var cache = {};

  function authHeaders(xhr, token) {
    var auth = 'Client="' + quote(CLIENT) + '", Device="' + (PLATFORM_TV || TV ? 'Smart TV' : 'Web') + '", DeviceId="' + deviceId() + '", Version="' + VERSION + '"';
    if (JELLYFIN) {
      xhr.setRequestHeader('Authorization', 'MediaBrowser ' + auth + (token ? ', Token="' + token + '"' : ''));
    } else {
      xhr.setRequestHeader('X-Emby-Authorization', 'Emby UserId="' + (S.userId || '') + '", ' + auth);
      if (token) xhr.setRequestHeader('X-Emby-Token', token);
    }
  }

  function send(method, path, body, token, done) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, API + path, true);
    xhr.timeout = 20000;
    authHeaders(xhr, token);
    xhr.setRequestHeader('Accept', 'application/json');
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (e) { }
      done(xhr.status, data);
    };
    xhr.ontimeout = function () { };
    xhr.send(body ? JSON.stringify(body) : null);
  }

  function pump() {
    while (active < 4 && queue.length) {
      (function (job) {
        active++;
        send(job.method, job.path, job.body, job.token === undefined ? S.token : job.token, function (status, data) {
          active--;
          if (status === 401 && job.token === undefined && S.token) {
            toLauncher(false);
            return;
          }
          try { job.done(status, data); } finally { pump(); }
        });
      })(queue.shift());
    }
  }

  // api(method, path, body, done[, token]) - token null = fara token (cereri publice)
  function api(method, path, body, done, token) {
    queue.push({ method: method, path: path, body: body, done: done || function () { }, token: token });
    pump();
  }

  // GET cu cache (implicit 60 s): randurile se redeseneaza des la navigare
  function get(path, done, ttl) {
    var hit = cache[path];
    var now = new Date().getTime();
    if (hit && now - hit.time < (ttl || 60000)) {
      setTimeout(function () { done(200, hit.data); }, 0);
      return;
    }
    api('GET', path, null, function (status, data) {
      if (status === 200) cache[path] = { time: new Date().getTime(), data: data };
      done(status, data);
    });
  }

  function invalidate(pattern) {
    for (var key in cache) {
      if (cache.hasOwnProperty(key) && pattern.test(key)) delete cache[key];
    }
  }

  function items(data) { return (data && (data.Items || (data.length !== undefined ? data : null))) || []; }

  function U() { return '/Users/' + S.userId; }

  // Un titlu dupa id, doar pe calea pe care serverul verifica accesul utilizatorului:
  //  - Emby: citirea directa (/Users/{id}/Items/{id}) NU verifica bibliotecile (TASKS G22), lista filtrata Items?Ids= da;
  //  - Jellyfin 12.2: invers - lista Items?Ids= intoarce si titluri din afara bibliotecilor, citirea directa da 404.
  function loadItem(id, fields, done) {
    if (JELLYFIN) {
      get('/Items/' + enc(id) + '?userId=' + S.userId + '&Fields=' + fields, function (status, data) {
        done(status === 200 && data && data.Id ? data : null, status === 404 ? 200 : status);
      }, 15000);
      return;
    }
    get(U() + '/Items?Ids=' + enc(id) + '&Fields=' + fields + IMG, function (status, data) {
      var list = items(data);
      done(status === 200 && list.length ? list[0] : null, status);
    }, 15000);
  }

  // ------------------------------------------------------------------------------------------------
  // Imagini: adrese dimensionate, incarcare lenesa (IntersectionObserver), cel mult 6 deodata
  // ------------------------------------------------------------------------------------------------

  function imageUrl(id, type, width, tag, index) {
    return API + '/Items/' + id + '/Images/' + type + (index !== undefined && index !== null ? '/' + index : '') + '?maxWidth=' + Math.round(width * DPR) + '&quality=' + (width > 900 ? 70 : 80) + (tag ? '&tag=' + enc(tag) : '');
  }

  function tagOf(item, type) { return item.ImageTags && item.ImageTags[type]; }

  // Imaginea 16:9 a unui card: Thumb, Backdrop, a episodului, apoi ale serialului / parintelui, la urma posterul.
  function landscapeImage(item, width) {
    if (item.Type === 'Episode' && tagOf(item, 'Primary')) return { url: imageUrl(item.Id, 'Primary', width, tagOf(item, 'Primary')) };
    if (tagOf(item, 'Thumb')) return { url: imageUrl(item.Id, 'Thumb', width, tagOf(item, 'Thumb')) };
    if (item.BackdropImageTags && item.BackdropImageTags.length) return { url: imageUrl(item.Id, 'Backdrop', width, item.BackdropImageTags[0]) };
    if (item.ParentThumbItemId && item.ParentThumbImageTag) return { url: imageUrl(item.ParentThumbItemId, 'Thumb', width, item.ParentThumbImageTag) };
    if (item.SeriesId && item.SeriesThumbImageTag) return { url: imageUrl(item.SeriesId, 'Thumb', width, item.SeriesThumbImageTag) };
    if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) return { url: imageUrl(item.ParentBackdropItemId, 'Backdrop', width, item.ParentBackdropImageTags[0]) };
    if (tagOf(item, 'Primary')) return { url: imageUrl(item.Id, 'Primary', width, tagOf(item, 'Primary')), contain: item.Type === 'TvChannel' };
    if (item.SeriesId && item.SeriesPrimaryImageTag) return { url: imageUrl(item.SeriesId, 'Primary', width, item.SeriesPrimaryImageTag) };
    return null;
  }

  function posterImage(item, width) {
    if (tagOf(item, 'Primary')) return imageUrl(item.Id, 'Primary', width, tagOf(item, 'Primary'));
    if (item.SeriesId && item.SeriesPrimaryImageTag) return imageUrl(item.SeriesId, 'Primary', width, item.SeriesPrimaryImageTag);
    return null;
  }

  function backdropImage(item, width) {
    if (item.BackdropImageTags && item.BackdropImageTags.length) return imageUrl(item.Id, 'Backdrop', width, item.BackdropImageTags[0]);
    if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) return imageUrl(item.ParentBackdropItemId, 'Backdrop', width, item.ParentBackdropImageTags[0]);
    if (tagOf(item, 'Thumb')) return imageUrl(item.Id, 'Thumb', width, tagOf(item, 'Thumb'));
    if (tagOf(item, 'Primary')) return imageUrl(item.Id, 'Primary', width, tagOf(item, 'Primary'));
    return null;
  }

  // Fundalurile preincarcate la focusul cardului (rollover): pagina titlului apare instant.
  // Doar imagini din etichetele deja primite — fara cereri API suplimentare.
  var backdropCache = {};
  function preloadBackdrop(item) {
    var url = backdropImage(item, 1280);
    if (!url || backdropCache[url]) return;
    backdropCache[url] = true;
    var img = new Image();
    img.src = url;
  }

  var imgQueue = [];
  var imgActive = 0;
  var observer = window.IntersectionObserver ? new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        observer.unobserve(entries[i].target);
        queueImage(entries[i].target);
      }
    }
  }, { rootMargin: '200px 400px' }) : null;

  function lazyBg(node, url) {
    if (!url) return;
    node.setAttribute('data-bg', url);
    if (observer) observer.observe(node); else queueImage(node);
  }

  function queueImage(node) {
    if (!node.getAttribute('data-bg')) return;
    imgQueue.push(node);
    pumpImages();
  }

  function pumpImages() {
    while (imgActive < 6 && imgQueue.length) {
      (function (node) {
        var url = node.getAttribute('data-bg');
        if (!url) return;
        node.removeAttribute('data-bg');
        imgActive++;
        var img = new Image();
        img.onload = img.onerror = function (ev) {
          imgActive--;
          if (ev && ev.type === 'load') node.style.backgroundImage = 'url("' + url + '")';
          pumpImages();
        };
        img.src = url;
      })(imgQueue.shift());
    }
  }

  // La focus se incarca si urmatoarele carduri din rand (cele inca ascunse in dreapta).
  function preloadAround(card) {
    var n = card;
    for (var i = 0; i < 5 && n; i++) {
      n = n.nextSibling;
      if (!n || !n.querySelector) break;
      var bg = n.querySelector('[data-bg]');
      if (bg) {
        if (observer) observer.unobserve(bg);
        queueImage(bg);
      }
    }
  }

  // ------------------------------------------------------------------------------------------------
  // Contul: tokenul din formatul interfetei web, profilurile salvate pe dispozitiv
  // ------------------------------------------------------------------------------------------------

  function findServer(credentials) {
    var servers = (credentials && credentials.Servers) || [];
    for (var i = 0; i < servers.length; i++) {
      if (servers[i].Id === S.serverId) return servers[i];
    }
    return null;
  }

  function storedToken() {
    var server = findServer(readJson(CREDENTIALS_KEY));
    if (!server || !server.UserId) return null;
    var users = server.Users || [];
    for (var i = 0; i < users.length; i++) {
      if (users[i].UserId === server.UserId && users[i].AccessToken) return { userId: server.UserId, token: users[i].AccessToken };
    }
    return server.AccessToken ? { userId: server.UserId, token: server.AccessToken } : null;
  }

  // Ca dupa o conectare normala in interfata web: Emby Web / Jellyfin Web deschise de aici folosesc acelasi cont.
  function saveCredentials(userId, token, serverName) {
    var credentials = readJson(CREDENTIALS_KEY) || {};
    if (!credentials.Servers) credentials.Servers = [];
    var server = findServer(credentials);
    if (!server) {
      server = JELLYFIN ? { Id: S.serverId } : { Id: S.serverId, Type: 'Server' };
      credentials.Servers.push(server);
    }
    if (serverName) server.Name = serverName;
    server.ManualAddress = JELLYFIN ? API : ORIGIN;
    if (!JELLYFIN) server.ManualAddressOnly = true;
    server.LastConnectionMode = 2;
    server.DateLastAccessed = new Date().getTime();
    server.UserId = userId;
    server.AccessToken = token;
    if (!JELLYFIN) {
      var users = server.Users || [];
      var found = false;
      for (var i = 0; i < users.length; i++) {
        if (users[i].UserId === userId) { users[i].AccessToken = token; found = true; }
      }
      if (!found) users.push({ UserId: userId, AccessToken: token });
      server.Users = users;
    }
    writeJson(CREDENTIALS_KEY, credentials);
  }

  function forgetCredentials(userId) {
    var credentials = readJson(CREDENTIALS_KEY);
    var server = findServer(credentials);
    if (!server) return;
    if (server.UserId === userId) { server.UserId = null; server.AccessToken = null; }
    var users = server.Users || [];
    var kept = [];
    for (var i = 0; i < users.length; i++) if (users[i].UserId !== userId) kept.push(users[i]);
    if (!JELLYFIN) server.Users = kept;
    writeJson(CREDENTIALS_KEY, credentials);
  }

  function profiles() {
    var all = readJson(PROFILES_KEY) || {};
    return all[S.serverId] || [];
  }

  function saveProfiles(list) {
    var all = readJson(PROFILES_KEY) || {};
    all[S.serverId] = list;
    writeJson(PROFILES_KEY, all);
  }

  // Profilurile salvate pe dispozitiv: doar id, nume, imagine si daca au parola - niciun token (SECURITY-AUDIT TV-1).
  // Trecerea la alt profil cere parola lui (sau PIN-ul de profil Emby, la un cont fara parola).
  function profileEntry(p) {
    return { id: p.id, name: p.name, tag: p.tag || null, hasPassword: p.hasPassword !== false };
  }

  function rememberProfile(user) {
    var list = profiles();
    var kept = [profileEntry({ id: user.Id, name: user.Name, tag: user.PrimaryImageTag, hasPassword: user.HasPassword })];
    for (var i = 0; i < list.length && kept.length < 8; i++) if (list[i].id !== user.Id) kept.push(profileEntry(list[i]));
    saveProfiles(kept);
  }

  // Versiunile pana la 1.2.1 tineau tokenul fiecarui profil folosit pe dispozitiv: se revoca pe server si se sterg.
  function migrateProfiles() {
    var list = profiles();
    var dirty = false;
    for (var i = 0; i < list.length; i++) {
      if (!list[i].token) continue;
      dirty = true;
      if (list[i].token !== S.token) {
        send('POST', '/Sessions/Logout', null, list[i].token, function () { });
        if (list[i].id !== S.userId) forgetCredentials(list[i].id);
      }
    }
    if (dirty) {
      var kept = [];
      for (var j = 0; j < list.length; j++) kept.push(profileEntry(list[j]));
      saveProfiles(kept);
    }
  }

  function toLauncher(login) {
    location.replace('index.html' + (login ? '?login=1' : ''));
  }

  function avatar(node, id, name, tag) {
    node.textContent = '';
    node.style.backgroundImage = '';
    node.style.backgroundColor = hashColor(name || '?');
    if (tag) node.style.backgroundImage = 'url("' + API + '/Users/' + id + '/Images/Primary?maxWidth=' + Math.round(140 * DPR) + '&tag=' + enc(tag) + '")';
    else node.textContent = (name || '?').charAt(0).toUpperCase();
  }

  // ------------------------------------------------------------------------------------------------
  // Navigarea cu telecomanda: focus spatial, memoria fiecarui rand, derulare lina
  // ------------------------------------------------------------------------------------------------

  function visible(node) {
    if (!node.getClientRects().length) return false;
    var r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function scope() {
    if (!hasClass($('mlNetBox'), 'hidden')) return $('mlNetBox');
    if (!hasClass($('mlDialog'), 'hidden')) return $('mlDialog');
    if (!hasClass($('mlPlayer'), 'hidden')) {
      if (!hasClass($('mlChanBox'), 'hidden')) return $('mlChanBox');
      if (!hasClass($('mlChapBox'), 'hidden')) return $('mlChapBox');
      if (!hasClass($('mlRosub'), 'hidden')) return $('mlRosub');
      if (!hasClass($('mlTracks'), 'hidden')) return $('mlTracks');
      return $('mlPlayer');
    }
    return document;
  }

  function focusables() {
    var all = scope().querySelectorAll('.f');
    var list = [];
    for (var i = 0; i < all.length; i++) if (visible(all[i])) list.push(all[i]);
    return list;
  }

  function isFixed(node) { return !!closest(node, function (e) { return e.id === 'mlHeader' || e.id === 'mlPlayer' || e.id === 'mlDialog'; }); }

  function trackOf(node) { return closest(node, function (e) { return hasClass(e, 'ml-track'); }); }

  function focusEl(node) {
    if (!node) return;
    try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
  }

  function siblingIn(track, node, step) {
    var kids = track.querySelectorAll('.f');
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] === node) return kids[i + step] || null;
    }
    return null;
  }

  function move(dir) {
    var cur = document.activeElement;
    var list = focusables();
    if (!cur || list.indexOf(cur) < 0) { focusDefault(); return; }
    var track = trackOf(cur);
    if (track && (dir === 'left' || dir === 'right')) {
      var next = siblingIn(track, cur, dir === 'right' ? 1 : -1);
      if (next) focusEl(next);
      return;
    }
    var y = window.pageYOffset || 0;
    var r = cur.getBoundingClientRect();
    var cTop = r.top + (isFixed(cur) ? 0 : y), cBottom = r.bottom + (isFixed(cur) ? 0 : y), cx = (r.left + r.right) / 2;
    var cands = [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c === cur) continue;
      var cr = c.getBoundingClientRect();
      var off = isFixed(c) ? 0 : y;
      var top = cr.top + off, bottom = cr.bottom + off;
      if (dir === 'down' || dir === 'up') {
        var dy = dir === 'down' ? top - cTop : cTop - top;
        if (dy < 10) continue;
        cands.push({ e: c, dy: dy, dx: Math.abs((cr.left + cr.right) / 2 - cx), onScreen: cr.left >= -2 && cr.right <= window.innerWidth + 2 });
      } else {
        if (top >= cBottom - 4 || bottom <= cTop + 4) continue;
        var dx = dir === 'right' ? cr.left - r.left : r.left - cr.left;
        if (dx < 10) continue;
        cands.push({ e: c, dy: 0, dx: dx, onScreen: true });
      }
    }
    if (!cands.length) return;
    var best = null;
    if (dir === 'left' || dir === 'right') {
      for (var j = 0; j < cands.length; j++) if (!best || cands[j].dx < best.dx) best = cands[j];
      focusEl(best.e);
      return;
    }
    var minDy = Infinity;
    for (var k = 0; k < cands.length; k++) if (cands[k].dy < minDy) minDy = cands[k].dy;
    var line = [];
    for (var m = 0; m < cands.length; m++) if (cands[m].dy - minDy < 40) line.push(cands[m]);
    // Un rand orizontal: elementul pe care am fost ultima data in el, daca se vede; altfel cel mai apropiat vizibil.
    var lineTrack = trackOf(line[0].e);
    if (lineTrack && lineTrack.mlLast && lineTrack.mlLast.parentNode && visible(lineTrack.mlLast)) {
      var lr = lineTrack.mlLast.getBoundingClientRect();
      if (lr.left >= -2 && lr.right <= window.innerWidth + 2) { focusEl(lineTrack.mlLast); return; }
    }
    for (var n = 0; n < line.length; n++) {
      var cand = line[n];
      if (!best || (cand.onScreen && !best.onScreen) || (cand.onScreen === best.onScreen && cand.dx < best.dx)) best = cand;
    }
    focusEl(best.e);
  }

  function focusDefault() {
    var screen = currentScreen();
    var first = screen ? screen.querySelector('.ml-default') : null;
    if (first && visible(first)) { focusEl(first); return; }
    var list = focusables();
    for (var i = 0; i < list.length; i++) {
      if (!isFixed(list[i]) || scope() !== document) { focusEl(list[i]); return; }
    }
    if (list.length) focusEl(list[0]);
  }

  // Ancorarea focusului la deschiderea unui chenar/dialog: primul .f vizibil, altfel un element de rezerva, altfel implicitul ecranului.
  function anchorFocus(container, fallback) {
    var list = container ? container.querySelectorAll('.f') : [];
    for (var i = 0; i < list.length; i++) {
      if (visible(list[i])) { focusEl(list[i]); return; }
    }
    if (fallback && fallback.parentNode && visible(fallback)) { focusEl(fallback); return; }
    focusDefault();
  }

  // Daca DOM-ul s-a schimbat si focusul a ramas pe un element invizibil/sters, reancoram in scope-ul curent.
  function refocusIfLost() {
    var a = document.activeElement;
    if (isTyping()) return;
    if (a && a !== document.body && a.parentNode && visible(a)) return;
    if (P) return; // in player e legitim sa nu fie focus (OSD ascuns)
    focusDefault();
  }

  var animations = {};
  function animateScroll(key, getter, setter, target, ms) {
    var from = getter();
    if (Math.abs(target - from) < 2) { setter(target); return; }
    var start = null;
    var id = (animations[key] || 0) + 1;
    animations[key] = id;
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(new Date().getTime()); }, 16); };
    function step(ts) {
      if (animations[key] !== id) return;
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / ms);
      var e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      setter(from + (target - from) * e);
      if (p < 1) raf(step);
    }
    raf(step);
  }

  function reveal(node) {
    if (isFixed(node)) return;
    var track = trackOf(node);
    if (track) {
      track.mlLast = node;
      growNear(track, node);
      var pad = parseFloat(window.getComputedStyle(track).paddingLeft) || 0;
      if (S.pointer) {
        // Cursorul (Magic Remote) a mutat focusul: randul nu sare sub cursor.
      } else if (TV) {
        // Modul TV: randul se muta prin transform (GPU), pozitia calculata din asezare, nu din animatia in curs.
        var x = track.mlX || 0;
        var width = track.clientWidth - 2 * pad;
        var left = node.offsetLeft, right = left + node.offsetWidth;
        if (left - x < 0) x = left;
        else if (right - x > width) x = right - width;
        x = Math.max(0, x);
        if (x !== track.mlX) {
          track.mlX = x;
          var inner = track.firstChild;
          inner.style.webkitTransform = 'translate3d(' + (-x) + 'px,0,0)';
          inner.style.transform = 'translate3d(' + (-x) + 'px,0,0)';
        }
      } else {
        var tr = track.getBoundingClientRect(), er = node.getBoundingClientRect();
        var target = track.scrollLeft;
        if (er.left < tr.left + pad) target -= (tr.left + pad - er.left);
        else if (er.right > tr.right - pad) target += (er.right - (tr.right - pad));
        if (target !== track.scrollLeft) animateScroll(track, function () { return track.scrollLeft; }, function (v) { track.scrollLeft = v; }, Math.max(0, target), 220);
      }
      preloadAround(node);
    }
    if (S.pointer) return;
    var block = closest(node, function (e) { return hasClass(e, 'ml-row') || hasClass(e, 'ml-hero-info') || hasClass(e, 'ml-ep'); }) || node;
    var y = window.pageYOffset || 0;
    if (closest(node, function (e) { return hasClass(e, 'ml-hero-info'); }) && !closest(node, function (e) { return hasClass(e, 'ml-detail'); })) {
      animateScroll('page', function () { return window.pageYOffset || 0; }, function (v) { window.scrollTo(0, v); }, 0, 260);
      return;
    }
    var br = block.getBoundingClientRect();
    var header = $('mlHeader').offsetHeight || 68;
    if (br.top < header + 6 || br.bottom > window.innerHeight - 6) {
      var want = br.top < header + 6 || br.height > window.innerHeight - header ? y + br.top - header - 16 : y + br.bottom - window.innerHeight + 24;
      if (hasClass(block, 'ml-row') && !TOUCH) want = y + br.top - Math.round(Math.max(header + rem(), window.innerHeight * 0.16));
      animateScroll('page', function () { return window.pageYOffset || 0; }, function (v) { window.scrollTo(0, v); }, Math.max(0, want), 260);
    }
  }

  document.addEventListener('focus', function (ev) {
    var node = ev.target;
    if (node && node.nodeType === 1 && hasClass(node, 'f')) {
      reveal(node);
      if (currentScreen() === $('mlHome') && !isFixed(node)) S.homeFocus = node;
      if (node.mlOnFocus) node.mlOnFocus();
    }
  }, true);

  function isBack(e) {
    var k = e.keyCode;
    return k === 27 || k === 461 || k === 10009 || k === 166 || e.key === 'GoBack' || e.key === 'BrowserBack' || (k === 8 && !isTyping());
  }

  function isTyping() {
    var a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
  }

  // Tastele telecomenzii: sagetile, OK, Inapoi (8/27/461 webOS/10009 Tizen/166/GoBack), butoanele media,
  // cele colorate (403-406), canal +/- (427/428, PageUp/PageDown) si cifrele (canalul direct).
  var KEY = { RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406, CH_UP: 427, CH_DOWN: 428, PG_UP: 33, PG_DOWN: 34 };

  document.addEventListener('mousedown', function () { S.userMoved = true; }, true);
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    S.userMoved = true;
    var dir = k === 37 ? 'left' : k === 38 ? 'up' : k === 39 ? 'right' : k === 40 ? 'down' : null;
    // Fara touch / mouse fin pe ecran mare, sagetile apasate inaintea mouse-ului pornesc modul TV.
    if (dir && !TV && !mouseUsed && modeOverride() === null && maybeTv()) setTvMode(true);
    if (isBack(e)) {
      e.preventDefault();
      if (!hasClass($('mlDialog'), 'hidden')) { closeDialog(); return; }
      goBack();
      return;
    }
    if (!hasClass($('mlDialog'), 'hidden') || !hasClass($('mlNetBox'), 'hidden')) {
      if (dir) { e.preventDefault(); move(dir); }
      return;
    }
    refocusIfLost();
    if (P && playerKey(e)) { e.preventDefault(); return; }
    if (!isTyping()) {
      if (k === 70 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleFull(); return; }
      var digit = k >= 48 && k <= 57 ? k - 48 : k >= 96 && k <= 105 ? k - 96 : -1;
      if (digit >= 0 && S.hasLive && currentScreen() === $('mlList') && listState === null) { e.preventDefault(); typeDigit(digit); return; }
      if (k === KEY.RED || e.key === 'ColorF0Red') { e.preventDefault(); go('#/home'); return; }
      if (k === KEY.GREEN || e.key === 'ColorF1Green') { e.preventDefault(); go('#/search'); return; }
      if (k === KEY.YELLOW || e.key === 'ColorF2Yellow') { e.preventDefault(); go('#/list/favorites'); return; }
      if (k === KEY.BLUE || e.key === 'ColorF3Blue') { e.preventDefault(); go(S.hasLive ? '#/list/livetv' : '#/profiles'); return; }
      if (k === KEY.CH_UP || k === KEY.PG_UP) { e.preventDefault(); move('up'); return; }
      if (k === KEY.CH_DOWN || k === KEY.PG_DOWN) { e.preventDefault(); move('down'); return; }
    }
    if (dir) {
      if (isTyping() && (dir === 'left' || dir === 'right')) return;
      e.preventDefault();
      move(dir);
    }
  }, true);

  // Mouse / cursorul Magic Remote (webOS): focusul urmeaza cursorul, iar sagetile continua de acolo.
  document.addEventListener('mousemove', function () { mouseUsed = true; }, false);
  document.addEventListener('mouseover', function (e) {
    if (!TV) return;
    var node = closest(e.target, function (x) { return hasClass(x, 'f'); });
    if (!node || node === document.activeElement || !visible(node)) return;
    S.pointer = true;
    focusEl(node);
    S.pointer = false;
  }, false);
  document.addEventListener('cursorStateChange', function (e) {
    // webOS: cursorul a disparut (s-a apasat o sageata) - focusul ramane unde era; altfel nu facem nimic.
    if (e && e.detail && e.detail.visibility === false && !document.activeElement) focusDefault();
  }, false);

  // Tizen (aplicatie instalata): tastele media / colorate / cifrele trebuie cerute explicit.
  function registerTizenKeys() {
    try {
      var input = window.tizen && window.tizen.tvinputdevice;
      if (!input) return;
      var keys = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'MediaTrackNext', 'MediaTrackPrevious',
        'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'ChannelUp', 'ChannelDown', 'VolumeUp', 'VolumeDown', 'VolumeMute', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      for (var i = 0; i < keys.length; i++) { try { input.registerKey(keys[i]); } catch (e) { } }
    } catch (e) { }
  }

  // --- Dialogul de iesire (Inapoi la nivelul de sus nu inchide aplicatia fara confirmare) ---------------------

  function openDialog(text, yes, no, onYes) {
    $('mlDialogText').textContent = text;
    $('mlDialogYes').textContent = yes;
    $('mlDialogNo').textContent = no;
    $('mlDialogYes').onclick = function () { closeDialog(); onYes(); };
    $('mlDialogNo').onclick = closeDialog;
    $('mlDialog').mlReturn = document.activeElement;
    removeClass($('mlDialog'), 'hidden');
    focusEl($('mlDialogNo'));
  }

  function closeDialog() {
    addClass($('mlDialog'), 'hidden');
    var back = $('mlDialog').mlReturn;
    if (back && back.parentNode && visible(back)) focusEl(back); else focusDefault();
  }

  // --- „Verifică rețeaua” (D35): masurare prin mltvSpeed (plugin sau intern), verdict pe treptele AUTO ----

  var netInfo = { path: null, running: false, mbps: null };

  function mbpsText(bps) {
    return (bps / 1000000).toFixed(1).replace('.', ',') + ' Mbps';
  }

  function netVerdict(bps) {
    if (bps < LADDER[1]) return t('netSlow');
    if (bps < LADDER[3]) return t('netMedium');
    if (bps < LADDER[5]) return t('netGood');
    return t('netExcellent');
  }

  function openNet() {
    var box = $('mlNetBox');
    box.mlReturn = document.activeElement;
    removeClass(box, 'hidden');
    runNetMeasure();
    anchorFocus(box, $('mlNetClose'));
  }

  function closeNet() {
    var box = $('mlNetBox');
    if (hasClass(box, 'hidden')) return;
    addClass(box, 'hidden');
    var back = box.mlReturn;
    if (back && back.parentNode && visible(back)) focusEl(back); else focusDefault();
  }

  function runNetMeasure() {
    netInfo.running = true;
    netInfo.mbps = null;
    netInfo.path = null;
    $('mlNetStatus').textContent = t('netMeasuring');
    removeClass($('mlNetSpin'), 'hidden');
    addClass($('mlNetResult'), 'hidden');
    addClass($('mlNetRepeat'), 'hidden');
    mltvSpeed.measure(null, function (bps) {
      netInfo.running = false;
      netInfo.mbps = bps ? Math.round(bps / 100000) / 10 : null;
      netInfo.path = mltvSpeed.lastPath || null;
      renderNetResult(bps);
    });
  }

  function renderNetResult(bps) {
    addClass($('mlNetSpin'), 'hidden');
    if (!bps) {
      $('mlNetStatus').textContent = t('netFailed');
      removeClass($('mlNetRepeat'), 'hidden');
      anchorFocus($('mlNetBox'), $('mlNetRepeat'));
      return;
    }
    $('mlNetStatus').textContent = '';
    $('mlNetSpeed').textContent = mbpsText(bps);
    $('mlNetVerdict').textContent = netVerdict(bps);
    $('mlNetQuality').textContent = t('netInitialQ', mbpsText(LADDER[initialQualityStep(bps)]));
    removeClass($('mlNetResult'), 'hidden');
    removeClass($('mlNetRepeat'), 'hidden');
    anchorFocus($('mlNetBox'), $('mlNetRepeat'));
  }

  function wireNet() {
    $('mlNetClose').onclick = closeNet;
    $('mlNetRepeat').onclick = runNetMeasure;
  }

  function exitApp() {
    try { if (window.tizen && window.tizen.application) { window.tizen.application.getCurrentApplication().exit(); return; } } catch (e) { }
    try { if (window.webOS && window.webOS.platformBack) { window.webOS.platformBack(); return; } } catch (e) { }
    try { window.close(); } catch (e) { }
    // Browserul televizorului: pagina de dinaintea aplicatiei.
    setTimeout(function () { history.go(-Math.max(1, S.stack.length)); }, 100);
  }

  // --- Cifrele: canalul cu numarul tastat (TV in direct) -----------------------------------------------------

  function typeDigit(d) {
    S.digits = ((S.digits || '') + d).slice(-4);
    var box = $('mlDigits');
    box.textContent = S.digits;
    removeClass(box, 'hidden');
    clearTimeout(S.digitTimer);
    S.digitTimer = setTimeout(function () {
      var wanted = S.digits;
      S.digits = '';
      addClass(box, 'hidden');
      liveChannels(function (list) {
        for (var i = 0; i < list.length; i++) {
          var n = String(list[i].ChannelNumber || list[i].Number || '');
          if (n === wanted || n.replace(/^0+/, '') === wanted.replace(/^0+/, '')) { rememberChannels(list); go('#/play/' + list[i].Id, !!P); return; }
        }
        toast(wanted + ' ?');
      });
    }, 1500);
  }

  function rememberChannels(list) {
    S.liveIds = {};
    S.liveOrder = [];
    for (var i = 0; i < list.length; i++) { S.liveIds[list[i].Id] = list[i]; S.liveOrder.push(list[i].Id); }
  }

  // Canal +/- in player: canalul vecin din lista utilizatorului.
  function zap(step) {
    if (!P || !P.live) return;
    var id = P.id;
    liveChannels(function (list) {
      rememberChannels(list);
      var i = S.liveOrder.indexOf(id);
      if (i < 0 || !list.length) return;
      var next = list[(i + step + list.length) % list.length];
      go('#/play/' + next.Id, true);
    });
  }

  // ------------------------------------------------------------------------------------------------
  // Ecrane si rute (#/home, #/title/<id>, #/list/<fel>[/<id>], #/search, #/profiles, #/play/<id>[/<ticks>])
  // ------------------------------------------------------------------------------------------------

  var SCREENS = ['mlHome', 'mlTitle', 'mlList', 'mlSearch', 'mlProfiles'];

  function currentScreen() {
    for (var i = 0; i < SCREENS.length; i++) if (!hasClass($(SCREENS[i]), 'hidden')) return $(SCREENS[i]);
    return null;
  }

  function showScreen(id, nav) {
    var leaving = currentScreen();
    if (leaving && leaving.id === 'mlHome' && id !== 'mlHome') S.homeScroll = window.pageYOffset || 0;
    for (var i = 0; i < SCREENS.length; i++) toggleClass($(SCREENS[i]), 'hidden', SCREENS[i] !== id);
    toggleClass(document.body, 'ml-noheader', id === 'mlProfiles');
    var links = $('mlNav').querySelectorAll('a');
    for (var j = 0; j < links.length; j++) toggleClass(links[j], 'on', links[j].getAttribute('data-nav') === nav);
    headerShade();
  }

  function headerShade() {
    var screen = currentScreen();
    var solid = (window.pageYOffset || 0) > 40 || (screen && (screen.id === 'mlList' || screen.id === 'mlSearch'));
    toggleClass($('mlHeader'), 'solid', !!solid);
  }

  window.addEventListener('scroll', function () {
    headerShade();
    if (listState && currentScreen() === $('mlList')) maybeLoadMore();
  }, false);

  function route() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/');
    var name = parts[0] || 'home';
    var key = name + '/' + (parts[1] || '') + '/' + (parts[2] || '');
    if (S.replacing) { S.stack[S.stack.length - 1] = key; S.replacing = false; }
    else if (S.stack.length > 1 && S.stack[S.stack.length - 2] === key) S.stack.pop();
    else if (S.stack[S.stack.length - 1] !== key) S.stack.push(key);
    if (name !== 'play' && P) closePlayer(false);
    switch (name) {
      case 'title': showTitle(parts[1]); break;
      case 'list': showList(parts[1] || 'movies', parts[2] ? decodeURIComponent(parts[2]) : null); break;
      case 'search': showSearch(); break;
      case 'profiles': showProfiles(); break;
      case 'play': openPlayer(parts[1], parts[2] !== undefined && parts[2] !== '' ? parseInt(parts[2], 10) : null); break;
      default: showHome(); break;
    }
  }

  function go(hash, replace) {
    if (replace) { S.replacing = true; location.replace(hash); }
    else location.hash = hash;
  }

  function goBack() {
    if (!hasClass($('mlNetBox'), 'hidden')) { closeNet(); return; }
    if (P && !hasClass($('mlChanBox'), 'hidden')) { closeChannels(); return; }
    if (P && !hasClass($('mlChapBox'), 'hidden')) { closeChapters(); return; }
    if (P && !hasClass($('mlTracks'), 'hidden')) { closeTracks(); return; }
    if (P && !hasClass($('mlRosub'), 'hidden')) { closeRosub(); return; }
    if (S.stack.length > 1) { history.back(); return; }
    var screen = currentScreen();
    if (P || !screen || screen.id !== 'mlHome') { go('#/home', true); return; }
    // Acasa: intai inapoi la banner, apoi intrebarea de iesire (nu iesim din aplicatie din greseala).
    var first = $('mlHome').querySelector('.ml-default');
    if (first && document.activeElement !== first && (window.pageYOffset || 0) > 0) { focusEl(first); return; }
    if (first && document.activeElement !== first && !isFixed(document.activeElement || document.body)) { focusEl(first); return; }
    openDialog(t('exitQ'), t('exit'), t('cancel'), exitApp);
  }

  // ------------------------------------------------------------------------------------------------
  // Carduri si randuri
  // ------------------------------------------------------------------------------------------------

  function hrefFor(item) {
    switch (item.Type) {
      case 'Episode': return '#/play/' + item.Id;
      case 'TvChannel': return '#/play/' + item.Id;
      case 'Program': return '#/play/' + item.ChannelId;
      case 'Genre': return '#/list/genre/' + item.Id;
      case 'Person': return '#/list/person/' + item.Id;
      case 'CollectionFolder': case 'UserView': case 'Folder': return '#/list/library/' + item.Id;
      default: return '#/title/' + item.Id;
    }
  }

  function seasonEpisode(item) {
    if (item.Type !== 'Episode') return '';
    var s = item.ParentIndexNumber, e = item.IndexNumber;
    if (s === undefined || s === null || e === undefined || e === null) return '';
    return 'S' + s + ':E' + e;
  }

  function cardText(item) {
    if (item.Type === 'Episode') {
      var se = seasonEpisode(item);
      return { title: item.SeriesName || item.Name, sub: (se ? se + ' · ' : '') + item.Name };
    }
    if (item.Type === 'TvChannel') {
      var p = item.CurrentProgram;
      return { title: p ? p.Name : item.Name, sub: item.Name + (p && p.EndDate ? ' · ' + t('endsAt', clock(parseDate(p.EndDate))) : '') };
    }
    if (item.Type === 'Program') {
      var start = parseDate(item.StartDate);
      var channel = item.ChannelName || (S.liveIds && S.liveIds[item.ChannelId] ? S.liveIds[item.ChannelId].Name : '');
      return { title: item.Name, sub: channel + (channel && start ? ' · ' : '') + (start ? clock(start) : '') };
    }
    var sub = [];
    if (item.ProductionYear) sub.push(item.ProductionYear);
    if (item.Type === 'Movie' && item.RunTimeTicks) sub.push(runtime(item.RunTimeTicks));
    if (item.Type === 'Series' && item.ChildCount) sub.push(item.ChildCount === 1 ? t('seasons1') : t('seasonsN', item.ChildCount));
    if (item.Type === 'BoxSet' && item.ChildCount) sub.push(item.ChildCount + ' ' + (LANG === 'ro' ? 'titluri' : 'titles'));
    return { title: item.Name, sub: sub.join(' · ') };
  }

  function progressOf(item) {
    if (item.Type === 'TvChannel' && item.CurrentProgram) {
      var s = parseDate(item.CurrentProgram.StartDate), e = parseDate(item.CurrentProgram.EndDate);
      if (s && e && e > s) return Math.max(0, Math.min(100, (new Date() - s) / (e - s) * 100));
      return 0;
    }
    var ud = item.UserData;
    if (ud && ud.PlaybackPositionTicks && item.RunTimeTicks) return Math.max(2, Math.min(100, ud.PlaybackPositionTicks / item.RunTimeTicks * 100));
    if (ud && ud.PlayedPercentage) return ud.PlayedPercentage;
    return 0;
  }

  function card(item, opts) {
    opts = opts || {};
    var a = el('a', 'ml-card f' + (opts.poster ? ' poster' : ''));
    a.href = opts.href || hrefFor(item);
    a.setAttribute('data-id', item.Id);
    var box = el('div', 'ml-img');
    var image = null;
    if (opts.poster) {
      var p = posterImage(item, 220);
      if (p) image = { url: p };
    } else if (item.Type === 'TvChannel' && item.CurrentProgram && (tagOf(item.CurrentProgram, 'Primary') || tagOf(item.CurrentProgram, 'Thumb'))) {
      var prog = item.CurrentProgram;
      image = { url: imageUrl(prog.Id, tagOf(prog, 'Thumb') ? 'Thumb' : 'Primary', 320, tagOf(prog, 'Thumb') || tagOf(prog, 'Primary')) };
    } else if (item.Type === 'Program' && !tagOf(item, 'Primary') && !tagOf(item, 'Thumb') && item.ChannelId && item.ChannelPrimaryImageTag) {
      image = { url: imageUrl(item.ChannelId, 'Primary', 240, item.ChannelPrimaryImageTag), contain: true };
    } else {
      image = landscapeImage(item, 320);
    }
    if (image) lazyBg(box, image.url);
    else {
      // Fara imagine: un fundal colorat dupa titlu (randurile nu raman gri).
      addClass(a, 'noimg');
      box.style.backgroundImage = 'linear-gradient(135deg, ' + hashColor(item.SeriesName || item.Name || '?') + ' 0%, #1c1c1c 85%)';
    }
    if (image && image.contain) addClass(a, 'contain');
    var text = cardText(item);
    var cap = el('div', 'ml-cap');
    cap.appendChild(el('span', null, text.title));
    if (text.sub) cap.appendChild(el('small', null, text.sub));
    box.appendChild(cap);
    if (item.Type === 'TvChannel' || (item.Type === 'Program' && isAiring(item))) box.appendChild(el('span', 'ml-badge live', t('live')));
    var pct = opts.noProgress ? 0 : progressOf(item);
    if (pct > 0 && pct < 100) {
      addClass(a, 'has-progress');
      var bar = el('div', 'ml-progress');
      var fill = el('span');
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      box.appendChild(bar);
    }
    a.appendChild(box);
    a.setAttribute('aria-label', text.title + (text.sub ? ', ' + text.sub : ''));
    // Rollover (focus telecomanda / hover mouse): se preincarca lenes fundalul titlului.
    a.mlOnFocus = function () { preloadBackdrop(item); };
    return a;
  }

  function moreCard(href) {
    var a = el('a', 'ml-card f genre');
    a.href = href;
    var box = el('div', 'ml-img');
    var cap = el('div', 'ml-cap');
    cap.appendChild(el('span', null, t('more') + ' ›'));
    box.appendChild(cap);
    a.appendChild(box);
    return a;
  }

  function genreCard(genre) {
    var a = el('a', 'ml-card f genre');
    a.href = '#/list/genre/' + genre.Id;
    var box = el('div', 'ml-img');
    box.style.backgroundImage = 'linear-gradient(135deg, ' + hashColor(genre.Name) + ', #141414)';
    var cap = el('div', 'ml-cap');
    cap.appendChild(el('span', null, genre.Name));
    box.appendChild(cap);
    a.appendChild(box);
    return a;
  }

  function personCard(person) {
    var a = el('a', 'ml-person f');
    a.href = '#/list/person/' + person.Id;
    var face = el('div', 'ml-face');
    if (person.PrimaryImageTag) lazyBg(face, imageUrl(person.Id, 'Primary', 160, person.PrimaryImageTag));
    else face.textContent = (person.Name || '?').charAt(0);
    a.appendChild(face);
    a.appendChild(el('b', null, person.Name));
    if (person.Role) a.appendChild(el('small', null, person.Role));
    return a;
  }

  function isAiring(p) {
    var s = parseDate(p.StartDate), e = parseDate(p.EndDate), now = new Date();
    return !!(s && e && s <= now && e > now);
  }

  // Un rand: se incarca abia cand ajunge aproape de ecran; dispare daca e gol.
  var rowObserver = window.IntersectionObserver ? new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        rowObserver.unobserve(entries[i].target);
        loadRow(entries[i].target);
      }
    }
  }, { rootMargin: '0px 0px 900px 0px' }) : null;

  function row(container, def) {
    var box = el('div', 'ml-row loading');
    if (def.key) box.setAttribute('data-row', def.key);
    var head = el('div', 'ml-row-head');
    head.appendChild(el('h2', 'ml-row-title', def.title));
    if (def.sub) head.appendChild(el('span', 'ml-row-sub', def.sub));
    box.appendChild(head);
    var track = el('div', 'ml-track');
    var inner = el('div', 'ml-track-in');
    for (var i = 0; i < 6; i++) inner.appendChild(el('div', 'ml-skel'));
    track.appendChild(inner);
    box.appendChild(track);
    track.addEventListener('scroll', function () { if (track.scrollLeft + track.clientWidth > track.scrollWidth - 600) growRow(track); }, false);
    box.mlDef = def;
    container.appendChild(box);
    if (rowObserver && !def.eager) rowObserver.observe(box); else loadRow(box);
    return box;
  }

  function loadRow(box) {
    var def = box.mlDef;
    def.load(function (list) {
      fillRow(box, list);
    });
  }

  function fillRow(box, list) {
    var def = box.mlDef;
    var track = box.querySelector('.ml-track');
    if (!list || !list.length) {
      // Randurile care se pot umple mai tarziu (reluare, episodul urmator, lista mea) raman, ascunse.
      if (def.keep) addClass(box, 'hidden');
      else if (box.parentNode) box.parentNode.removeChild(box);
      return;
    }
    removeClass(box, 'hidden');
    var inner = track.firstChild;
    var lastIndex = 0;
    if (track.mlLast && track.mlLast.parentNode === inner) {
      var kids = inner.childNodes;
      for (var k = 0; k < kids.length; k++) if (kids[k] === track.mlLast) lastIndex = k;
    }
    var hadFocus = track.contains(document.activeElement);
    inner.textContent = '';
    // Randurile lungi (ex. 300 de canale) se deseneaza pe bucati, pe masura ce focusul / derularea ajunge la capat.
    track.mlRest = list.slice(0);
    track.mlMake = function (x) { return def.card ? def.card(x) : card(x, def.cardOpts); };
    track.mlMore = def.more || null;
    growRow(track, Math.max(ROW_CHUNK, lastIndex + 6));
    removeClass(box, 'loading');
    track.mlLast = track.mlLast ? inner.childNodes[Math.min(lastIndex, inner.childNodes.length - 1)] || null : null;
    if (hadFocus && track.mlLast) focusEl(track.mlLast);
    if (def.onFill) def.onFill(list);
  }

  var ROW_CHUNK = 24;

  function growRow(track, count) {
    var rest = track.mlRest;
    if (!rest) return;
    var inner = track.firstChild;
    var n = Math.min(rest.length, count || ROW_CHUNK);
    for (var i = 0; i < n; i++) inner.appendChild(track.mlMake(rest.shift()));
    if (!rest.length) {
      track.mlRest = null;
      if (track.mlMore) inner.appendChild(moreCard(track.mlMore));
    }
  }

  function growNear(track, node) {
    if (!track.mlRest) return;
    var kids = track.firstChild.childNodes;
    for (var i = kids.length - 1; i >= 0 && i >= kids.length - 8; i--) if (kids[i] === node) { growRow(track); return; }
  }

  function refreshRow(container, key) {
    var box = container.querySelector('[data-row="' + key + '"]');
    if (box) loadRow(box);
  }

  function listLoader(path, filter) {
    return function (done) {
      get(path, function (status, data) {
        var list = status === 200 ? items(data) : [];
        done(filter ? filter(list) : list);
      });
    };
  }

  function query(params) {
    return U() + '/Items?Recursive=true&Fields=' + LIST_FIELDS + IMG + '&' + params;
  }

  // ------------------------------------------------------------------------------------------------
  // Acasa: banner care se roteste + randuri
  // ------------------------------------------------------------------------------------------------

  var hero = { items: [], index: 0, timer: null, layers: null, info: null };

  function showHome() {
    showScreen('mlHome', 'home');
    if (!S.homeBuilt) {
      buildHome();
    } else {
      if (S.homeDirty) {
        S.homeDirty = false;
        refreshRow($('mlHome'), 'resume');
        refreshRow($('mlHome'), 'nextup');
        refreshRow($('mlHome'), 'favorites');
      }
      window.scrollTo(0, S.homeScroll || 0);
      if (S.homeFocus && S.homeFocus.parentNode && visible(S.homeFocus)) focusEl(S.homeFocus);
      else focusDefault();
    }
    startHeroTimer();
  }

  function buildHome() {
    S.homeBuilt = true;
    var home = $('mlHome');
    home.textContent = '';
    var heroBox = el('div', 'ml-hero');
    var l1 = el('div', 'ml-hero-img'), l2 = el('div', 'ml-hero-img');
    heroBox.appendChild(l1);
    heroBox.appendChild(l2);
    heroBox.appendChild(el('div', 'ml-hero-shade'));
    var info = el('div', 'ml-hero-info');
    heroBox.appendChild(info);
    var dots = el('div', 'ml-hero-dots');
    heroBox.appendChild(dots);
    home.appendChild(heroBox);
    hero.layers = [l1, l2];
    hero.info = info;
    hero.dots = dots;
    hero.box = heroBox;
    var rows = el('div', 'ml-rows');
    home.appendChild(rows);

    // Primul ecran: un buton focusabil imediat (telecomanda), inlocuit cand vine bannerul.
    info.appendChild(el('h1', 'ml-hero-title', ''));

    get(query('IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending&Limit=10&ImageTypes=Backdrop'), function (status, data) {
      var list = [];
      var all = status === 200 ? items(data) : [];
      for (var i = 0; i < all.length; i++) if (all[i].BackdropImageTags && all[i].BackdropImageTags.length) list.push(all[i]);
      if (!list.length) {
        heroBox.parentNode.removeChild(heroBox);
        addClass(rows, 'flat');
        hero.items = [];
        setTimeout(focusDefault, 50);
        return;
      }
      hero.items = list.slice(0, 6);
      hero.index = 0;
      for (var d = 0; d < hero.items.length; d++) dots.appendChild(el('i'));
      showHero(0, true);
    });

    var D = '&SortOrder=Descending';
    row(rows, { key: 'resume', title: t('continueWatching'), eager: true, keep: true, load: listLoader(U() + '/Items/Resume?Limit=24&MediaTypes=Video&Recursive=true&Fields=' + LIST_FIELDS + IMG) });
    row(rows, { key: 'nextup', title: t('nextUp'), eager: true, keep: true, load: listLoader('/Shows/NextUp?UserId=' + S.userId + '&Limit=24&Fields=' + LIST_FIELDS + IMG) });
    if (S.hasLive) {
      row(rows, { key: 'live', title: t('onNow'), more: '#/list/livetv', load: function (done) { liveChannels(function (list) { done(list.slice(0, 30)); }); } });
    }
    row(rows, { key: 'movies', title: t('latestMovies'), more: '#/list/movies/added', load: listLoader(query('IncludeItemTypes=Movie&SortBy=DateCreated,SortName' + D + '&Limit=24')) });
    row(rows, { key: 'series', title: t('latestSeries'), more: '#/list/series/added', load: listLoader(query('IncludeItemTypes=Series&SortBy=DateLastContentAdded,DateCreated' + D + '&Limit=24')) });
    if (S.hasLive) {
      row(rows, { key: 'tonight', title: t('tonightFilms'), load: livePrograms('movies') });
    }
    row(rows, { key: 'favorites', title: t('myList'), more: '#/list/favorites', keep: true, load: listLoader(query('Filters=IsFavorite&IncludeItemTypes=Movie,Series,Episode,BoxSet&SortBy=DateCreated' + D + '&Limit=24')) });

    // Cate un rand pe biblioteca (filme, seriale, video), apoi colectiile si genurile.
    for (var v = 0; v < S.views.length; v++) {
      var view = S.views[v];
      var type = view.CollectionType || '';
      if (type && type !== 'movies' && type !== 'tvshows' && type !== 'homevideos' && type !== 'musicvideos' && type !== 'mixed') continue;
      row(rows, { key: 'lib-' + view.Id, title: view.Name, more: '#/list/library/' + view.Id, load: listLoader(query('ParentId=' + view.Id + '&IncludeItemTypes=Movie,Series,Video,MusicVideo&SortBy=Random&Limit=20')) });
    }
    if (S.hasLive) {
      row(rows, { key: 'sport', title: t('sport'), sub: t('next4h'), load: livePrograms('sport') });
      row(rows, { key: 'kids', title: t('kids'), sub: t('now'), load: livePrograms('kids') });
    }
    row(rows, { key: 'collections', title: t('collections'), load: listLoader(query('IncludeItemTypes=BoxSet&SortBy=SortName&Limit=30')) });
    var genresRow = row(rows, {
      key: 'genres', title: t('genres'), card: genreCard,
      load: listLoader('/Genres?UserId=' + S.userId + '&IncludeItemTypes=Movie,Series&Recursive=true&SortBy=SortName&Limit=60'),
      onFill: function (genres) {
        // Trei genuri alese la intamplare primesc cate un rand al lor.
        var pool = genres.slice(0);
        for (var g = 0; g < 3 && pool.length; g++) {
          var pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
          var holder = el('div');
          rows.insertBefore(holder, genresRow);
          row(holder, { key: 'genre-' + pick.Id, title: pick.Name, more: '#/list/genre/' + pick.Id, load: listLoader(query('GenreIds=' + pick.Id + '&IncludeItemTypes=Movie,Series&SortBy=Random&Limit=20')) });
        }
      }
    });
  }

  function showHero(index, first) {
    var item = hero.items[index];
    if (!item) return;
    hero.index = index;
    var layer = hero.layers[index % 2], other = hero.layers[(index + 1) % 2];
    var url = backdropImage(item, Math.min(1920, window.innerWidth));
    var img = new Image();
    img.onload = function () {
      layer.style.backgroundImage = 'url("' + url + '")';
      addClass(layer, 'on');
      removeClass(other, 'on');
    };
    img.src = url;
    var dots = hero.dots.childNodes;
    for (var i = 0; i < dots.length; i++) toggleClass(dots[i], 'on', i === index);

    var focusedButton = document.activeElement && hero.info.contains(document.activeElement) ? document.activeElement.getAttribute('data-btn') : null;
    var info = hero.info;
    info.textContent = '';
    if (tagOf(item, 'Logo')) {
      var logo = el('img', 'ml-hero-logo');
      logo.alt = item.Name;
      logo.src = imageUrl(item.Id, 'Logo', 500, tagOf(item, 'Logo'));
      info.appendChild(logo);
    } else {
      info.appendChild(el('h1', 'ml-hero-title', item.Name));
    }
    var meta = [];
    if (item.ProductionYear) meta.push(item.ProductionYear);
    if (item.OfficialRating) meta.push(item.OfficialRating);
    if (item.Type === 'Movie' && item.RunTimeTicks) meta.push(runtime(item.RunTimeTicks));
    if (item.Type === 'Series' && item.ChildCount) meta.push(item.ChildCount === 1 ? t('seasons1') : t('seasonsN', item.ChildCount));
    if (item.Genres && item.Genres.length) meta.push(item.Genres.slice(0, 3).join(', '));
    info.appendChild(el('div', 'ml-hero-meta', meta.join('  ·  ')));
    if (item.Overview) info.appendChild(el('p', 'ml-hero-text', item.Overview));
    var buttons = el('div', 'ml-buttons');
    var play = el('a', 'ml-btn primary f ml-default');
    play.href = item.Type === 'Series' ? '#/title/' + item.Id + '/play' : '#/play/' + item.Id;
    play.setAttribute('data-btn', 'play');
    play.appendChild(el('span', 'ml-i-play'));
    play.appendChild(document.createTextNode(item.UserData && item.UserData.PlaybackPositionTicks ? t('resume') : t('play')));
    var more = el('a', 'ml-btn f');
    more.href = '#/title/' + item.Id;
    more.setAttribute('data-btn', 'more');
    var i2 = el('i', 'ml-i-info', 'i');
    more.appendChild(i2);
    more.appendChild(document.createTextNode(t('moreInfo')));
    buttons.appendChild(play);
    buttons.appendChild(more);
    info.appendChild(buttons);
    if (first && currentScreen() === $('mlHome') && !S.userMoved && !P) setTimeout(function () { if (!P && currentScreen() === $('mlHome')) focusEl(play); }, 30);
    else if (focusedButton) focusEl(focusedButton === 'more' ? more : play);
  }

  function startHeroTimer() {
    clearInterval(hero.timer);
    hero.timer = setInterval(function () {
      if (P || currentScreen() !== $('mlHome') || hero.items.length < 2 || document.hidden) return;
      if ((window.pageYOffset || 0) > window.innerHeight * 0.5) return;
      showHero((hero.index + 1) % hero.items.length, false);
    }, 9000);
  }

  // ------------------------------------------------------------------------------------------------
  // TV in direct (ideile paginii TV din Headend: acum, filme in seara asta, sport, copii, urmeaza)
  // ------------------------------------------------------------------------------------------------

  function checkLive(done) {
    if (!LIVE_ENABLED || (S.user.Policy && S.user.Policy.EnableLiveTvAccess === false)) { done(false); return; }
    get('/LiveTv/Channels?UserId=' + S.userId + '&Limit=1&EnableImages=false', function (status, data) {
      done(status === 200 && !!data && (data.TotalRecordCount > 0 || items(data).length > 0));
    }, 300000);
  }

  function liveChannels(done) {
    get('/LiveTv/Channels?UserId=' + S.userId + '&Limit=300&EnableImages=true&ImageTypeLimit=1&EnableImageTypes=Primary,Thumb&AddCurrentProgram=true&EnableUserData=false&Fields=PrimaryImageAspectRatio', function (status, data) {
      var list = status === 200 ? items(data) : [];
      if (list.length) rememberChannels(list);
      done(list);
    }, 60000);
  }

  function uniqueByName(list) {
    var seen = {}, out = [];
    for (var i = 0; i < list.length; i++) {
      if (seen[list[i].Name]) continue;
      seen[list[i].Name] = true;
      out.push(list[i]);
    }
    return out;
  }

  function livePrograms(kind) {
    return function (done) {
      var now = new Date();
      var hour = 3600 * 1000;
      var p = '/LiveTv/Programs?UserId=' + S.userId + '&EnableImages=true&ImageTypeLimit=1&EnableImageTypes=Primary,Thumb&Fields=Overview,PrimaryImageAspectRatio&EnableUserData=false&SortBy=StartDate';
      if (kind === 'movies') {
        var evening = new Date(now.getTime());
        evening.setHours(19, 0, 0, 0);
        if (evening < now) evening = now;
        var night = new Date(now.getTime());
        night.setHours(23, 59, 0, 0);
        if (night <= evening) night = new Date(evening.getTime() + 5 * hour);
        p += '&IsMovie=true&MinEndDate=' + enc(evening.toISOString()) + '&MaxStartDate=' + enc(night.toISOString()) + '&Limit=60';
      } else if (kind === 'sport') {
        p += '&IsSports=true&MinEndDate=' + enc(now.toISOString()) + '&MaxStartDate=' + enc(new Date(now.getTime() + 4 * hour).toISOString()) + '&Limit=60';
      } else if (kind === 'kids') {
        p += '&IsKids=true&IsAiring=true&Limit=60';
      } else {
        p += '&HasAired=false&MinStartDate=' + enc(now.toISOString()) + '&MaxStartDate=' + enc(new Date(now.getTime() + hour).toISOString()) + '&Limit=80';
      }
      // Canalele intai (numele canalului pe cardul emisiunii).
      liveChannels(function () {
        get(p, function (status, data) { done(status === 200 ? uniqueByName(items(data)).slice(0, 30) : []); }, 120000);
      });
    };
  }

  // ------------------------------------------------------------------------------------------------
  // Pagina titlului
  // ------------------------------------------------------------------------------------------------

  function showTitle(id) {
    var parts = (location.hash || '').split('/');
    var autoplay = parts[3] === 'play';
    var page = $('mlTitle');
    showScreen('mlTitle', null);
    window.scrollTo(0, 0);
    page.textContent = '';
    page.mlId = id;
    loadItem(id, DETAIL_FIELDS, function (item, status) {
      if (page.mlId !== id) return;
      if (!item) { errorBox(page, status === 0 ? t('network') : t('emptyList'), function () { showTitle(id); }); return; }
      if (autoplay && item.Type === 'Series') { playSeries(item, true); return; }
      renderTitle(page, item);
    });
  }

  function errorBox(container, text, retry) {
    container.textContent = '';
    var box = el('div', 'ml-pad');
    box.appendChild(el('p', 'ml-empty', text));
    if (retry) {
      var b = el('button', 'ml-btn f ml-default', t('retry'));
      b.type = 'button';
      b.onclick = retry;
      box.appendChild(b);
    }
    container.appendChild(box);
    setTimeout(focusDefault, 30);
  }

  function renderTitle(page, item) {
    var detail = el('div', 'ml-detail');
    var heroBox = el('div', 'ml-hero');
    var layer = el('div', 'ml-hero-img on');
    var url = backdropImage(item, Math.min(1920, window.innerWidth));
    if (url) layer.style.backgroundImage = 'url("' + url + '")';
    heroBox.appendChild(layer);
    heroBox.appendChild(el('div', 'ml-hero-shade'));
    var info = el('div', 'ml-hero-info');
    if (tagOf(item, 'Logo')) {
      var logo = el('img', 'ml-hero-logo');
      logo.alt = item.Name;
      logo.src = imageUrl(item.Id, 'Logo', 500, tagOf(item, 'Logo'));
      info.appendChild(logo);
    } else {
      info.appendChild(el('h1', 'ml-hero-title', item.Name));
    }
    var meta = el('div', 'ml-meta-line');
    if (item.CommunityRating) meta.appendChild(el('span', 'ml-match', '★ ' + (Math.round(item.CommunityRating * 10) / 10)));
    if (item.ProductionYear) meta.appendChild(el('span', null, String(item.ProductionYear) + (item.Type === 'Series' && item.Status === 'Continuing' ? '–' : (item.EndDate && parseDate(item.EndDate) && parseDate(item.EndDate).getFullYear() !== item.ProductionYear ? '–' + parseDate(item.EndDate).getFullYear() : ''))));
    if (item.OfficialRating) meta.appendChild(el('span', 'ml-rating', item.OfficialRating));
    if (item.Type === 'Movie' && item.RunTimeTicks) meta.appendChild(el('span', null, runtime(item.RunTimeTicks)));
    if (item.Type === 'Series' && item.ChildCount) meta.appendChild(el('span', null, item.ChildCount === 1 ? t('seasons1') : t('seasonsN', item.ChildCount)));
    if (item.Type === 'Movie' && item.RunTimeTicks) {
      var left = item.RunTimeTicks - ((item.UserData && item.UserData.PlaybackPositionTicks) || 0);
      meta.appendChild(el('span', null, t('endsAt', clock(new Date(new Date().getTime() + left / 10000)))));
    }
    info.appendChild(meta);
    if (item.Taglines && item.Taglines.length) info.appendChild(el('p', 'ml-tagline', item.Taglines[0]));
    if (item.Overview) info.appendChild(el('p', 'ml-hero-text', item.Overview));

    var buttons = el('div', 'ml-buttons');
    var resumeTicks = item.UserData && item.UserData.PlaybackPositionTicks;
    var play = el('button', 'ml-btn primary f ml-default');
    play.type = 'button';
    play.appendChild(el('span', 'ml-i-play'));
    play.appendChild(document.createTextNode(resumeTicks ? t('resume') : t('play')));
    play.onclick = function () {
      if (item.Type === 'Series') playSeries(item, false);
      else if (item.Type === 'BoxSet') go('#/list/collection/' + item.Id);
      else go('#/play/' + item.Id);
    };
    buttons.appendChild(play);
    if (resumeTicks && item.Type !== 'Series') {
      var over = el('a', 'ml-btn f', t('startOver'));
      over.href = '#/play/' + item.Id + '/0';
      buttons.appendChild(over);
    }
    if (item.LocalTrailerCount) {
      var trailer = el('button', 'ml-btn f', t('trailer'));
      trailer.type = 'button';
      trailer.onclick = function () {
        get(U() + '/Items/' + item.Id + '/LocalTrailers', function (status, data) {
          var list = status === 200 ? items(data) : [];
          if (list.length) { S.trailer = list[0]; go('#/play/' + list[0].Id + '/0'); } else toast(t('unplayable'));
        });
      };
      buttons.appendChild(trailer);
    }
    if (item.Type !== 'BoxSet') {
      var fav = el('button', 'ml-btn f');
      fav.type = 'button';
      var setFav = function () {
        var on = !!(item.UserData && item.UserData.IsFavorite);
        fav.textContent = (on ? '✓ ' : '+ ') + (on ? t('inList') : t('addList'));
        toggleClass(fav, 'on', on);
      };
      setFav();
      fav.onclick = function () {
        var on = !(item.UserData && item.UserData.IsFavorite);
        api(on ? 'POST' : 'DELETE', U() + '/FavoriteItems/' + item.Id, null, function (status) {
          if (status !== 200 && status !== 204) { toast(t('network')); return; }
          item.UserData = item.UserData || {};
          item.UserData.IsFavorite = on;
          setFav();
          invalidate(/IsFavorite|Ids=|\?userId=/);
          S.homeDirty = true;
          toast(on ? t('added') : t('removed'));
        });
      };
      buttons.appendChild(fav);
      var seen = el('button', 'ml-btn f');
      seen.type = 'button';
      var setSeen = function () {
        var on = !!(item.UserData && item.UserData.Played);
        seen.textContent = on ? '✓ ' + t('watched') : t('markWatched');
        toggleClass(seen, 'on', on);
      };
      setSeen();
      seen.onclick = function () {
        var on = !(item.UserData && item.UserData.Played);
        api(on ? 'POST' : 'DELETE', U() + '/PlayedItems/' + item.Id, null, function (status) {
          if (status !== 200 && status !== 204) { toast(t('network')); return; }
          item.UserData = item.UserData || {};
          item.UserData.Played = on;
          setSeen();
          invalidate(/Resume|NextUp|Ids=|\?userId=|Episodes/);
          S.homeDirty = true;
          toast(on ? t('markedWatched') : t('markedUnwatched'));
        });
      };
      buttons.appendChild(seen);
    }
    info.appendChild(buttons);
    heroBox.appendChild(info);
    detail.appendChild(heroBox);

    var body = el('div', 'ml-detail-body');
    detail.appendChild(body);
    page.textContent = '';
    page.appendChild(detail);

    if (item.Type === 'Series') seasonsBlock(body, item);
    if (item.Type === 'BoxSet') {
      row(body, { key: 'boxset', title: t('inCollection'), eager: true, load: listLoader(U() + '/Items?ParentId=' + item.Id + '&Fields=' + LIST_FIELDS + IMG + '&SortBy=ProductionYear,SortName') });
    }
    var cast = [];
    var directors = [];
    var people = item.People || [];
    for (var i = 0; i < people.length; i++) {
      if ((people[i].Type === 'Actor' || people[i].Type === 'GuestStar') && cast.length < 24) cast.push(people[i]);
      if (people[i].Type === 'Director') directors.push(people[i].Name);
    }
    if (cast.length) row(body, { key: 'cast', title: t('cast'), card: personCard, load: function (done) { done(cast); } });
    if (item.Type !== 'BoxSet') {
      row(body, { key: 'similar', title: t('similar'), load: listLoader('/Items/' + item.Id + '/Similar?UserId=' + S.userId + '&Limit=16&Fields=' + LIST_FIELDS + IMG) });
    }
    var facts = el('div', 'ml-pad');
    facts.style.paddingTop = '0';
    var addFact = function (label, value) {
      if (!value) return;
      var p = el('p', 'ml-facts');
      p.appendChild(el('span', null, label + ': '));
      p.appendChild(el('b', null, value));
      facts.appendChild(p);
    };
    addFact(t('director'), directors.join(', '));
    addFact(t('genresLabel'), (item.Genres || []).join(', '));
    var studios = [];
    for (var s = 0; s < (item.Studios || []).length; s++) studios.push(item.Studios[s].Name);
    addFact(t('studios'), studios.join(', '));
    body.appendChild(facts);
    setTimeout(function () { if (page.mlId === item.Id) focusEl(play); }, 30);
  }

  function seasonsBlock(body, series) {
    var wrap = el('div');
    var head = el('div', 'ml-row-head');
    head.appendChild(el('h2', 'ml-row-title', t('episodes')));
    wrap.appendChild(head);
    var chips = el('div', 'ml-seasons ml-chips');
    var list = el('div', 'ml-episodes');
    wrap.appendChild(chips);
    wrap.appendChild(list);
    body.appendChild(wrap);
    get('/Shows/' + series.Id + '/Seasons?UserId=' + S.userId + '&EnableUserData=true&EnableImages=false', function (status, data) {
      var seasons = status === 200 ? items(data) : [];
      if (!seasons.length) { body.removeChild(wrap); return; }
      get('/Shows/NextUp?UserId=' + S.userId + '&SeriesId=' + series.Id + '&Limit=1&Fields=' + LIST_FIELDS, function (s2, next) {
        var upNext = s2 === 200 ? items(next)[0] : null;
        var current = seasons[0];
        for (var i = 0; i < seasons.length; i++) {
          if (upNext && seasons[i].Id === upNext.SeasonId) current = seasons[i];
        }
        var buttons = [];
        for (var j = 0; j < seasons.length; j++) {
          (function (season) {
            var b = el('button', 'ml-chip f', season.IndexNumber === 0 ? t('specials') : (season.IndexNumber ? t('season', season.IndexNumber) : season.Name));
            b.type = 'button';
            b.onclick = function () {
              for (var k = 0; k < buttons.length; k++) toggleClass(buttons[k], 'on', buttons[k] === b);
              episodesOf(list, series, season, null);
            };
            buttons.push(b);
            chips.appendChild(b);
            if (season === current) addClass(b, 'on');
          })(seasons[j]);
        }
        episodesOf(list, series, current, upNext ? upNext.Id : null);
      });
    });
  }

  function episodesOf(list, series, season, highlight) {
    list.textContent = '';
    list.mlSeason = season.Id;
    get('/Shows/' + series.Id + '/Episodes?UserId=' + S.userId + '&SeasonId=' + season.Id + '&Fields=Overview,PrimaryImageAspectRatio&EnableUserData=true&EnableImageTypes=Primary,Thumb&ImageTypeLimit=1', function (status, data) {
      if (list.mlSeason !== season.Id) return;
      var eps = status === 200 ? items(data) : [];
      if (!eps.length) { list.appendChild(el('p', 'ml-empty', t('emptyList'))); return; }
      for (var i = 0; i < eps.length; i++) {
        var ep = eps[i];
        var a = el('a', 'ml-ep f' + (ep.UserData && ep.UserData.Played ? ' played' : ''));
        a.href = '#/play/' + ep.Id;
        a.appendChild(el('div', 'ml-ep-num', ep.IndexNumber !== undefined && ep.IndexNumber !== null ? String(ep.IndexNumber) : ''));
        var img = el('div', 'ml-ep-img');
        var image = landscapeImage(ep, 260);
        if (image) lazyBg(img, image.url);
        var pct = progressOf(ep);
        if (pct > 0 && pct < 100) {
          var bar = el('div', 'ml-progress');
          var fill = el('span');
          fill.style.width = pct + '%';
          bar.appendChild(fill);
          img.appendChild(bar);
        }
        a.appendChild(img);
        var text = el('div', 'ml-ep-text');
        var name = el('div', 'ml-ep-name');
        name.appendChild(el('span', null, ep.Name));
        if (ep.RunTimeTicks) name.appendChild(el('small', null, runtime(ep.RunTimeTicks)));
        text.appendChild(name);
        if (ep.Overview) text.appendChild(el('div', 'ml-ep-over', ep.Overview));
        a.appendChild(text);
        a.mlOnFocus = function () { preloadBackdrop(ep); };
        list.appendChild(a);
        if (highlight && ep.Id === highlight) a.mlHighlight = true;
      }
    });
  }

  // Serial: episodul urmator (cu reluare), altfel primul episod.
  function playSeries(series, replace) {
    get('/Shows/NextUp?UserId=' + S.userId + '&SeriesId=' + series.Id + '&Limit=1&Fields=' + LIST_FIELDS, function (status, data) {
      var next = status === 200 ? items(data)[0] : null;
      if (next) { go('#/play/' + next.Id, replace); return; }
      get('/Shows/' + series.Id + '/Episodes?UserId=' + S.userId + '&Limit=1&Fields=' + LIST_FIELDS, function (s2, d2) {
        var first = s2 === 200 ? items(d2)[0] : null;
        if (first) go('#/play/' + first.Id, replace);
        else { toast(t('unplayable')); if (replace) go('#/title/' + series.Id, true); }
      });
    });
  }

  // ------------------------------------------------------------------------------------------------
  // Grile: Filme, Seriale, Lista mea, biblioteca, gen, persoana, colectie; pagina TV in direct
  // ------------------------------------------------------------------------------------------------

  var listState = null;

  function showList(kind, id) {
    var page = $('mlList');
    var nav = kind === 'movies' || kind === 'series' || kind === 'favorites' || kind === 'livetv' ? kind : null;
    showScreen('mlList', nav);
    window.scrollTo(0, 0);
    page.textContent = '';
    listState = null;
    if (kind === 'livetv') { liveTvPage(page); return; }
    var wrap = el('div', 'ml-pad');
    var title = el('h1', 'ml-page-title');
    wrap.appendChild(title);
    page.appendChild(wrap);
    var sort = id === 'added' ? 'added' : 'name';
    var state = { kind: kind, id: id, start: 0, done: false, busy: false, grid: null, wrap: wrap, sort: sort, total: 0 };
    listState = state;
    var types = 'Movie,Series';
    var base = '';
    switch (kind) {
      case 'movies': title.textContent = t('movies'); types = 'Movie'; break;
      case 'series': title.textContent = t('series'); types = 'Series'; break;
      case 'favorites': title.textContent = t('myList'); types = 'Movie,Series,Episode,BoxSet'; base = '&Filters=IsFavorite'; break;
      case 'library': types = 'Movie,Series,Video,MusicVideo,BoxSet'; base = '&ParentId=' + enc(id); nameOf(id, title); break;
      case 'collection': types = ''; base = '&ParentId=' + enc(id); nameOf(id, title); break;
      case 'genre': base = '&GenreIds=' + enc(id); nameOf(id, title, true); break;
      case 'person': base = '&PersonIds=' + enc(id); nameOf(id, title, true); break;
      default: title.textContent = t('movies'); types = 'Movie'; break;
    }
    state.base = base + (types ? '&IncludeItemTypes=' + types : '');
    if (kind === 'movies' || kind === 'series' || kind === 'library' || kind === 'genre') {
      var chips = el('div', 'ml-chips');
      var sorts = [['name', t('sortName')], ['added', t('sortAdded')], ['year', t('sortYear')], ['rating', t('sortRating')]];
      for (var i = 0; i < sorts.length; i++) {
        (function (key, label) {
          var b = el('button', 'ml-chip f' + (key === state.sort ? ' on ml-default' : ''), label);
          b.type = 'button';
          b.onclick = function () {
            var all = chips.querySelectorAll('.ml-chip');
            for (var k = 0; k < all.length; k++) toggleClass(all[k], 'on', all[k] === b);
            state.sort = key;
            state.start = 0;
            state.done = false;
            state.grid.textContent = '';
            loadMore(state);
          };
          chips.appendChild(b);
        })(sorts[i][0], sorts[i][1]);
      }
      wrap.appendChild(chips);
    }
    state.grid = el('div', 'ml-grid');
    wrap.appendChild(state.grid);
    loadMore(state, true);
  }

  // Numele unei biblioteci / colectii / genului / persoanei din titlul grilei (tot printr-o cerere a utilizatorului).
  function nameOf(id, node, byItems) {
    if (!byItems) {
      for (var i = 0; i < S.views.length; i++) if (S.views[i].Id === id) { node.textContent = S.views[i].Name; return; }
    }
    loadItem(id, 'Overview', function (item) { if (item) node.textContent = item.Name; });
  }

  function sortParam(sort) {
    switch (sort) {
      case 'added': return '&SortBy=DateCreated,SortName&SortOrder=Descending';
      case 'year': return '&SortBy=ProductionYear,PremiereDate,SortName&SortOrder=Descending';
      case 'rating': return '&SortBy=CommunityRating,SortName&SortOrder=Descending';
      default: return '&SortBy=SortName&SortOrder=Ascending';
    }
  }

  function loadMore(state, first) {
    if (state.busy || state.done) return;
    state.busy = true;
    var limit = 60;
    var sortKey = state.sort;
    var path = query('StartIndex=' + state.start + '&Limit=' + limit + state.base + (state.kind === 'collection' ? '&SortBy=ProductionYear,SortName' : sortParam(state.sort)) + '&EnableTotalRecordCount=true');
    get(path, function (status, data) {
      state.busy = false;
      if (listState !== state || sortKey !== state.sort) return;
      var list = status === 200 ? items(data) : [];
      if (status !== 200 && first) { errorBox(state.wrap, t('network'), function () { showList(state.kind, state.id); }); return; }
      for (var i = 0; i < list.length; i++) state.grid.appendChild(card(list[i], { poster: list[i].Type !== 'Episode' && list[i].Type !== 'Video' }));
      state.start += list.length;
      if (list.length < limit) state.done = true;
      if (first && !list.length) state.grid.appendChild(el('p', 'ml-empty', t('emptyList')));
      if (first) setTimeout(function () { if (listState === state) { var f = state.grid.querySelector('.f'); focusEl(state.wrap.querySelector('.ml-default') && !f ? state.wrap.querySelector('.ml-default') : f || state.wrap.querySelector('.f')); } }, 30);
    });
  }

  function maybeLoadMore() {
    var state = listState;
    if (!state || state.done || state.busy || !state.grid) return;
    var r = state.grid.getBoundingClientRect();
    if (r.bottom - window.innerHeight < 700) loadMore(state);
  }

  function liveTvPage(page) {
    var rows = el('div', 'ml-rows flat');
    page.appendChild(rows);
    var first = true;
    var focusFirst = function () { if (first) { first = false; setTimeout(focusDefault, 30); } };
    row(rows, {
      key: 'live-now', title: t('onNow'), eager: true,
      load: function (done) { liveChannels(function (list) { done(list); focusFirst(); }); },
      onFill: function (list) { var s = rows.querySelector('[data-row="live-now"] .ml-row-sub'); if (!s) { var h = rows.querySelector('[data-row="live-now"] .ml-row-head'); if (h) h.appendChild(el('span', 'ml-row-sub', t('channelsN', list.length))); } }
    });
    row(rows, { key: 'live-movies', title: t('tonightFilms'), load: livePrograms('movies') });
    row(rows, { key: 'live-sport', title: t('sport'), sub: t('next4h'), load: livePrograms('sport') });
    row(rows, { key: 'live-kids', title: t('kids'), sub: t('now'), load: livePrograms('kids') });
    row(rows, { key: 'live-next', title: t('upNext'), sub: t('nextHour'), load: livePrograms('next') });
  }

  // ------------------------------------------------------------------------------------------------
  // Cautare (tastatura pe ecran pentru telecomanda; pe telefon/calculator tastatura obisnuita)
  // ------------------------------------------------------------------------------------------------

  function showSearch() {
    var page = $('mlSearch');
    showScreen('mlSearch', 'search');
    window.scrollTo(0, 0);
    if (page.mlBuilt) {
      setTimeout(function () { focusEl(page.querySelector('.ml-default')); }, 30);
      return;
    }
    page.mlBuilt = true;
    var wrap = el('div', 'ml-pad');
    var box = el('div', 'ml-search-box');
    var input = el('input', 'f' + (TV ? '' : ' ml-default'));
    input.type = 'search';
    input.placeholder = t('searchHint');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('aria-label', t('search'));
    box.appendChild(input);
    wrap.appendChild(box);
    var cols = el('div', 'ml-search-cols');
    var keys = el('div', 'ml-keys');
    var letters = 'abcdefghijklmnopqrstuvwxyz1234567890';
    var typeKey = function (label, cls, fn) {
      var k = el('button', 'ml-key f' + (cls ? ' ' + cls : ''), label);
      k.type = 'button';
      k.onclick = fn;
      keys.appendChild(k);
      return k;
    };
    for (var i = 0; i < letters.length; i++) {
      (function (ch) {
        var k = typeKey(ch.toUpperCase(), i === 0 && TV ? 'ml-default' : '', function () { input.value += ch; changed(); });
        if (i === 0 && TV) addClass(k, 'ml-default');
      })(letters.charAt(i));
    }
    typeKey(t('space'), 'wide', function () { input.value += ' '; changed(); });
    typeKey(t('del'), 'wide', function () { input.value = input.value.slice(0, -1); changed(); });
    typeKey(t('clear'), 'wide', function () { input.value = ''; changed(); });
    cols.appendChild(keys);
    var results = el('div', 'ml-results');
    cols.appendChild(results);
    wrap.appendChild(cols);
    page.appendChild(wrap);
    results.appendChild(el('p', 'ml-empty', t('typeToSearch')));
    var timer = null;
    var seq = 0;
    function changed() {
      clearTimeout(timer);
      timer = setTimeout(runSearch, 350);
    }
    function runSearch() {
      var term = input.value.replace(/^\s+|\s+$/g, '');
      var mine = ++seq;
      if (term.length < 2) { results.textContent = ''; results.appendChild(el('p', 'ml-empty', t('typeToSearch'))); return; }
      get(query('SearchTerm=' + enc(term) + '&IncludeItemTypes=Movie,Series,BoxSet&Limit=48'), function (status, data) {
        if (mine !== seq) return;
        var list = status === 200 ? items(data) : [];
        results.textContent = '';
        if (!list.length) { results.appendChild(el('p', 'ml-empty', t('noResults', term))); return; }
        var grid = el('div', 'ml-grid');
        for (var j = 0; j < list.length; j++) grid.appendChild(card(list[j], { poster: true }));
        results.appendChild(grid);
      }, 30000);
    }
    input.addEventListener('input', changed, false);
    setTimeout(function () { focusEl(page.querySelector('.ml-default')); }, 30);
  }

  // ------------------------------------------------------------------------------------------------
  // Profiluri („Cine se uita?”), schimbarea contului, deconectarea
  // ------------------------------------------------------------------------------------------------

  function showProfiles() {
    var page = $('mlProfiles');
    showScreen('mlProfiles', 'profiles');
    window.scrollTo(0, 0);
    page.textContent = '';
    var wrap = el('div', 'ml-profiles');
    wrap.appendChild(el('h1', null, t('whosWatching')));
    var list = el('div', 'ml-profile-list');
    wrap.appendChild(list);
    var menu = el('div', 'ml-menu');
    var web = el('a', 'f', t('openWeb'));
    web.href = WEB;
    var out = el('a', 'f', t('signOut'));
    out.href = 'javascript:void(0)';
    out.onclick = function (e) { e.preventDefault(); signOut(); };
    var mode = el('a', 'f', TV ? t('tvModeOn') : t('tvModeOff'));
    mode.href = 'javascript:void(0)';
    mode.onclick = function (e) {
      e.preventDefault();
      setTvMode(!TV);
      try { localStorage.setItem('medialabTvMode', TV ? 'tv' : 'desktop'); } catch (x) { }
      mode.textContent = TV ? t('tvModeOn') : t('tvModeOff');
    };
    var net = el('a', 'f', t('netCheck'));
    net.href = 'javascript:void(0)';
    net.onclick = function (e) { e.preventDefault(); openNet(); };
    menu.appendChild(web);
    menu.appendChild(mode);
    menu.appendChild(net);
    menu.appendChild(out);
    wrap.appendChild(menu);
    page.appendChild(wrap);

    // Profilurile: cel curent, cele salvate pe acest dispozitiv, apoi utilizatorii publici ai serverului
    // (serverul nu-i listeaza pe cei ascunsi). Parola se cere doar daca nu avem deja un token valid.
    var seen = {};
    var entries = [];
    var add = function (id, name, tag, hasPassword) {
      if (!id || seen[id]) return;
      seen[id] = true;
      entries.push({ id: id, name: name, tag: tag, hasPassword: hasPassword });
    };
    add(S.userId, S.user.Name, S.user.PrimaryImageTag, S.user.HasPassword !== false);
    var saved = profiles();
    for (var i = 0; i < saved.length; i++) add(saved[i].id, saved[i].name, saved[i].tag, saved[i].hasPassword !== false);
    api('GET', '/Users/Public', null, function (status, data) {
      var pub = status === 200 && data && data.length !== undefined ? data : [];
      for (var j = 0; j < pub.length; j++) add(pub[j].Id, pub[j].Name, pub[j].PrimaryImageTag, pub[j].HasPassword !== false);
      for (var k = 0; k < entries.length; k++) list.appendChild(profileTile(entries[k]));
      var other = el('a', 'ml-profile ml-profile-add f');
      other.href = 'index.html?login=1';
      var plus = el('span', 'ml-avatar', '+');
      other.appendChild(plus);
      other.appendChild(el('span', null, t('otherAccount')));
      list.appendChild(other);
      var current = list.querySelector('.ml-default') || list.querySelector('.f');
      setTimeout(function () { focusEl(current); }, 30);
    }, null);
  }

  function profileTile(p) {
    var a = el('a', 'ml-profile f' + (p.id === S.userId ? ' ml-default' : ''));
    a.href = 'javascript:void(0)';
    var face = el('span', 'ml-avatar');
    avatar(face, p.id, p.name, p.tag);
    a.appendChild(face);
    a.appendChild(el('span', null, p.name));
    a.onclick = function (e) {
      e.preventDefault();
      choose(p);
    };
    return a;
  }

  // Alt profil = conectare noua cu parola lui (nu se tin tokenurile altor profiluri); fara parola: direct, dar cu PIN-ul
  // de profil Emby daca e setat.
  function choose(p) {
    if (p.id === S.userId) { go('#/home', true); return; }
    if (p.hasPassword === false) { signInAs(p, '', null); return; }
    passwordPrompt(p);
  }

  function passwordPrompt(p) {
    secretPrompt(p, t('password', p.name), 'password', function (value, error) { signInAs(p, value, error); }, function () { showProfiles(); });
  }

  function secretPrompt(p, title, kind, submit, cancelled) {
    var page = $('mlProfiles');
    page.textContent = '';
    var wrap = el('div', 'ml-profiles');
    var face = el('span', 'ml-avatar');
    face.style.margin = '0 auto 18px';
    avatar(face, p.id, p.name, p.tag);
    wrap.appendChild(face);
    var form = el('form', 'ml-pw');
    form.appendChild(el('h1', null, title));
    var input = el('input', 'f ml-default');
    input.type = 'password';
    input.setAttribute('autocomplete', kind === 'pin' ? 'off' : 'current-password');
    if (kind === 'pin') input.setAttribute('inputmode', 'numeric');
    form.appendChild(input);
    var error = el('p', 'ml-error');
    form.appendChild(error);
    var buttons = el('div', 'ml-buttons');
    var ok = el('button', 'ml-btn primary f', t('signIn'));
    ok.type = 'submit';
    var cancel = el('button', 'ml-btn f', t('cancel'));
    cancel.type = 'button';
    cancel.onclick = function () { cancelled(); };
    buttons.appendChild(ok);
    buttons.appendChild(cancel);
    form.appendChild(buttons);
    form.onsubmit = function (e) {
      e.preventDefault();
      submit(input.value, error, input);
      return false;
    };
    wrap.appendChild(form);
    page.appendChild(wrap);
    setTimeout(function () { focusEl(input); }, 30);
  }

  function signInAs(p, password, errorNode) {
    send('POST', '/Users/AuthenticateByName', { Username: p.name, Pw: password }, null, function (status, data) {
      if (status === 200 && data && data.AccessToken) {
        if (!password && profilePin(data.User)) { pinPrompt(p, data); return; }
        switchTo(data.User, data.AccessToken);
        return;
      }
      if (errorNode) errorNode.textContent = status === 0 ? t('network') : t('wrongPassword');
      else passwordPrompt(p);
    });
  }

  // Emby: PIN-ul de profil (Setari → Profil) al unui cont fara parola; Jellyfin nu are echivalent.
  function profilePin(user) {
    var pin = !JELLYFIN && user && user.Configuration ? user.Configuration.ProfilePin : null;
    return pin ? String(pin) : null;
  }

  function pinPrompt(p, auth) {
    var tries = 0;
    var revoke = function () { send('POST', '/Sessions/Logout', null, auth.AccessToken, function () { }); };
    secretPrompt(p, t('pin', p.name), 'pin', function (value, error, input) {
      if (value === profilePin(auth.User)) { switchTo(auth.User, auth.AccessToken); return; }
      if (++tries >= 5) { revoke(); showProfiles(); return; }
      error.textContent = t('wrongPin');
      input.value = '';
    }, function () { revoke(); showProfiles(); });
  }

  // Trecerea la alt profil revoca tokenul celui de dinainte: pe dispozitiv ramane un singur token, al profilului curent.
  function switchTo(user, token) {
    var previous = S.token;
    var previousId = S.userId;
    if (previous && previous !== token) {
      send('POST', '/Sessions/Logout', null, previous, function () { });
      if (previousId && previousId !== user.Id) forgetCredentials(previousId);
    }
    S.userId = user.Id;
    S.user = user;
    S.token = token;
    saveCredentials(user.Id, token, null);
    rememberProfile(user);
    cache = {};
    S.homeBuilt = false;
    S.homeFocus = null;
    S.homeScroll = 0;
    $('mlSearch').mlBuilt = false;
    $('mlSearch').textContent = '';
    avatar($('mlMeAvatar'), user.Id, user.Name, user.PrimaryImageTag);
    loadViews(function () {
      checkLive(function (has) {
        S.hasLive = has;
        toggleClass($('mlNavLive'), 'hidden', !has);
        S.stack = [];
        go('#/home', true);
        if ((location.hash || '') === '#/home') route();
      });
    });
  }

  // Deconectarea scoate dispozitivul de tot: tokenul curent si cele ale profilurilor salvate (revocate pe server),
  // contul salvat al lansatorului si profilurile; altfel lansatorul ar reconecta imediat.
  function signOut() {
    var tokens = [S.token];
    var saved = profiles();
    for (var i = 0; i < saved.length; i++) if (saved[i].token && tokens.indexOf(saved[i].token) < 0) tokens.push(saved[i].token);
    var left = tokens.length;
    var finish = function () {
      if (--left > 0) return;
      for (var j = 0; j < saved.length; j++) forgetCredentials(saved[j].id);
      forgetCredentials(S.userId);
      saveProfiles([]);
      try { localStorage.removeItem(ACCOUNT_KEY); } catch (e) { }
      S.token = null;
      toLauncher(true);
    };
    for (var k = 0; k < tokens.length; k++) send('POST', '/Sessions/Logout', null, tokens[k], finish);
  }

  // ------------------------------------------------------------------------------------------------
  // Player
  // ------------------------------------------------------------------------------------------------

  var P = null;
  var hls = null;
  var osdTimer = null;

  function deviceProfile(bitrate) {
    return {
      MaxStreamingBitrate: bitrate,
      MaxStaticBitrate: bitrate,
      MusicStreamingTranscodingBitrate: 192000,
      DirectPlayProfiles: [{ Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac,mp3' }],
      TranscodingProfiles: [{ Container: 'ts', Type: 'Video', AudioCodec: 'aac,mp3', VideoCodec: 'h264', Context: 'Streaming', Protocol: 'hls', MaxAudioChannels: '2', BreakOnNonKeyFrames: true, MinSegments: 1 }],
      ContainerProfiles: [],
      CodecProfiles: [],
      SubtitleProfiles: [
        { Format: 'vtt', Method: 'External' },
        { Format: 'pgssub', Method: 'Encode' },
        { Format: 'dvdsub', Method: 'Encode' },
        { Format: 'dvbsub', Method: 'Encode' },
        { Format: 'ass', Method: 'Encode' },
        { Format: 'ssa', Method: 'Encode' }
      ]
    };
  }

  // --- Calitate AUTO permanenta (D34): treapta initiala din masurare reala, apoi monitorizare continua ------------
  // doar pe fluxuri transcodate; DirectPlay/static ramane nemodificat. Măsurarea interna poate fi inlocuita ulterior
  // cu cea a pluginului comercial de SpeedTest (D35) suprascriind mltvSpeed.measure.

  var LADDER = [1500000, 3000000, 6000000, 12000000, 20000000, 40000000];

  // Cea mai mare treapta din scara care incape in bps (minim prima treapta).
  function ladderStep(bps) {
    var s = LADDER[0];
    for (var i = 0; i < LADDER.length; i++) if (LADDER[i] <= bps) s = LADDER[i];
    return s;
  }

  function ladderIndex(bitrate) {
    for (var i = 0; i < LADDER.length; i++) if (LADDER[i] === bitrate) return i;
    return 0;
  }

  // Estimare de rezerva inainte de orice masurare (D34: conservator, 6 Mbps implicit, nu 20).
  function estimateBitrate() {
    var c = navigator.connection;
    if (c && c.downlink) return Math.max(1500000, Math.min(40000000, Math.round(c.downlink * 1000000 * 0.8)));
    return 6000000;
  }

  // Debitmetru client <-> server: 3 descarcari cronometrate ale unei imagini de item (maxWidth=800, anti-cache),
  // mediana vitezelor. Ieftin, sub ~2 s, sigur la abandon. Intoarce bps sau null la esec.
  function speedFetchOnce(url, done) {
    var xhr = new XMLHttpRequest();
    var start = new Date().getTime();
    var finished = false;
    var fail = function () { if (!finished) { finished = true; done(null); } };
    try {
      xhr.open('GET', url, true);
      xhr.timeout = 4000;
      authHeaders(xhr, S.token);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || finished) return;
        finished = true;
        if (xhr.status !== 200 || !xhr.responseText) { done(null); return; }
        var secs = (new Date().getTime() - start) / 1000;
        if (secs <= 0) { done(null); return; }
        done(xhr.responseText.length * 8 / secs);
      };
      xhr.ontimeout = fail;
      xhr.onerror = fail;
      xhr.send(null);
    } catch (e) { fail(); }
  }

  function internalSpeedMeasure(item, done) {
    var urls = [];
    if (item) {
      if (tagOf(item, 'Primary')) urls.push(API + '/Items/' + item.Id + '/Images/Primary?maxWidth=800&quality=70&tag=' + enc(tagOf(item, 'Primary')));
      if (item.BackdropImageTags && item.BackdropImageTags.length) urls.push(API + '/Items/' + item.Id + '/Images/Backdrop?maxWidth=800&quality=70&tag=' + enc(item.BackdropImageTags[0]));
      if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) urls.push(API + '/Items/' + item.ParentBackdropItemId + '/Images/Backdrop?maxWidth=800&quality=70&tag=' + enc(item.ParentBackdropImageTags[0]));
    }
    // Fara imagini de item (sau item null, ca la „Verifică rețeaua”): o resursa statica a pluginului,
    // de dimensiune cunoscuta (~47 KB), servita pe ambele servere langa browse.html.
    if (!urls.length) urls.push('icon-512.png?_mltv=1');
    var speeds = [];
    var left = 3;
    var i = 0;
    var next = function () {
      if (!left) {
        if (!speeds.length) { done(null); return; }
        speeds.sort(function (a, b) { return a - b; });
        done(speeds[Math.floor(speeds.length / 2)]);
        return;
      }
      left--;
      var url = urls[i % urls.length] + '&_mlts=' + enc(uuid());
      i++;
      speedFetchOnce(url, function (bps) {
        if (bps) speeds.push(bps);
        next();
      });
    };
    next();
  }

  // Masurare prin pluginul comercial SpeedTest (D35): daca endpointul sau raspunde, il folosim;
  // altfel masurarea interna cu imaginile itemului. Pluginul ofera /MediaLabSpeedTest/download?mb=N.
  function pluginPing(done) {
    var xhr = new XMLHttpRequest();
    var finished = false;
    var fail = function () { if (!finished) { finished = true; done(false); } };
    try {
      xhr.open('HEAD', API + '/MediaLabSpeedTest/ping', true);
      xhr.timeout = 2500;
      authHeaders(xhr, S.token);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || finished) return;
        finished = true;
        done(xhr.status === 200);
      };
      xhr.ontimeout = fail;
      xhr.onerror = fail;
      xhr.send(null);
    } catch (e) { fail(); }
  }

  function pluginSpeedOnce(mb, done) {
    var xhr = new XMLHttpRequest();
    var start = new Date().getTime();
    var finished = false;
    var fail = function () { if (!finished) { finished = true; done(null); } };
    try {
      xhr.open('GET', API + '/MediaLabSpeedTest/download?mb=' + mb, true);
      xhr.responseType = 'arraybuffer';
      xhr.timeout = 15000;
      authHeaders(xhr, S.token);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || finished) return;
        finished = true;
        if (xhr.status !== 200 || !xhr.response) { done(null); return; }
        var secs = (new Date().getTime() - start) / 1000;
        if (secs <= 0) { done(null); return; }
        done(xhr.response.byteLength * 8 / secs);
      };
      xhr.ontimeout = fail;
      xhr.onerror = fail;
      xhr.send(null);
    } catch (e) { fail(); }
  }

  function pluginSpeedMeasure(item, done) {
    var speeds = [];
    pluginSpeedOnce(4, function (a) {
      if (a) speeds.push(a);
      pluginSpeedOnce(8, function (b) {
        if (b) speeds.push(b);
        if (!speeds.length) { done(null); return; }
        speeds.sort(function (x, y) { return x - y; });
        done(speeds[Math.floor(speeds.length / 2)]);
      });
    });
  }

  var mltvSpeed = {
    // Punct unic de inlocuire: pluginul SpeedTest (D35) se descopera singur prin ping.
    // lastPath tine minte calea ultimei masurari ('plugin' | 'internal' | null) — o citeste si e2e-ul.
    lastPath: null,
    measure: function (item, done) {
      pluginPing(function (on) {
        if (on) {
          mltvSpeed.lastPath = 'plugin';
          pluginSpeedMeasure(item, done);
        } else {
          mltvSpeed.lastPath = 'internal';
          internalSpeedMeasure(item, done);
        }
      });
    }
  };

  // Treapta initiala din viteza masurata: cea mai mare treapta <= masurata * 0.7.
  function initialQualityStep(bps) {
    if (!bps) return ladderIndex(ladderStep(estimateBitrate()));
    return ladderIndex(ladderStep(bps * 0.7));
  }

  function loadHls(done) {
    if (window.Hls) { done(); return; }
    if (loadHls.failed) { done(); return; }
    var script = document.createElement('script');
    if (JELLYFIN) {
      script.src = 'hls.js?v=' + VERSION;
    } else {
      // hls.js din interfata web Emby e un modul AMD (define(["exports"], ...)): fara RequireJS il expunem ca window.Hls.
      if (!window.define) {
        window.define = function (deps, factory) {
          if (deps && deps[0] === 'exports' && typeof factory === 'function' && !window.Hls) {
            var exports = {};
            factory(exports);
            window.Hls = exports['default'] || exports.Hls;
          }
        };
      }
      script.src = API.replace(/\/emby$/i, '') + '/web/modules/hlsjs/hls.js';
    }
    script.onload = function () { done(); };
    script.onerror = function () { loadHls.failed = true; done(); };
    document.body.appendChild(script);
  }

  function openPlayer(id, startTicks) {
    if (!id) { go('#/home', true); return; }
    if (P && P.id === id && P.requestedStart === startTicks) return;
    if (P) stopPlayback(true);
    var video = $('mlVideo');
    removeClass($('mlPlayer'), 'hidden');
    addClass(document.body, 'ml-playing');
    addClass($('mlPlayError'), 'hidden');
    addClass($('mlSkip'), 'hidden');
    closeTracks();
    addClass($('mlChanBox'), 'hidden');
    addClass($('mlChapBox'), 'hidden');
    addClass($('mlVol'), 'hidden');
    removeClass($('mlSpin'), 'hidden');
    $('mlOsdTitle').textContent = '';
    $('mlOsdSub').textContent = '';
    $('mlBarFill').style.width = '0';
    $('mlBarBuf').style.width = '0';
    showOsd();
    focusEl($('mlPlayPause'));
    if (TV || TOUCH) fullscreen();
    var state = { id: id, requestedStart: startTicks, item: null, started: false, live: false, segments: [], next: null, countdown: null, audio: null, subtitle: null, skipShown: null, bitrate: 0, quality: null };
    P = state;
    var withItem = function (item) {
      if (P !== state) return;
      if (!item) { playError(t('unplayable')); return; }
      state.item = item;
      state.live = item.Type === 'TvChannel';
      var text = cardText(item);
      $('mlOsdTitle').textContent = item.Type === 'TvChannel' ? item.Name : text.title;
      $('mlOsdSub').textContent = item.Type === 'Episode' ? text.sub : (item.Type === 'TvChannel' && item.CurrentProgram ? item.CurrentProgram.Name : '');
      var start = startTicks;
      if (start === null || start === undefined || isNaN(start)) start = (!state.live && item.UserData && item.UserData.PlaybackPositionTicks) || 0;
      state.duration = item.RunTimeTicks || 0;
      toggleClass($('mlRew'), 'hidden', state.live);
      toggleClass($('mlFwd'), 'hidden', state.live);
      toggleClass($('mlBar'), 'hidden', state.live);
      if (!state.live) {
        loadSegments(state);
        if (item.Type === 'Episode' && item.SeriesId) {
          get('/Shows/' + item.SeriesId + '/Episodes?UserId=' + S.userId + '&StartItemId=' + item.Id + '&Limit=2&Fields=Overview' + IMG, function (status, data) {
            var list = status === 200 ? items(data) : [];
            if (P === state && list.length > 1 && list[0].Id === item.Id) state.next = list[1];
            toggleClass($('mlNextBtn'), 'hidden', !state.next);
          }, 30000);
        }
      }
      toggleClass($('mlNextBtn'), 'hidden', true);
      loadHls(function () { if (P === state) playbackInfo(state, start, null, null); });
    };
    if (S.trailer && S.trailer.Id === id) { var tr = S.trailer; S.trailer = null; withItem(tr); return; }
    // Canalele se cauta in lista canalelor utilizatorului; restul printr-o lista filtrata dupa id (G22).
    if (S.liveIds && S.liveIds[id]) { withItem(S.liveIds[id]); return; }
    loadItem(id, 'Chapters,Overview,PrimaryImageAspectRatio', function (item) {
      if (item || !S.hasLive) { withItem(item); return; }
      liveChannels(function (list) {
        var found = null;
        for (var i = 0; i < list.length; i++) if (list[i].Id === id) found = list[i];
        withItem(found);
      });
    });
  }

  function playbackInfo(state, startTicks, audioIndex, subtitleIndex) {
    // AUTO (D34): bitrate-ul vine din starea de calitate a sesiunii; la prima cerere, din estimarea conservatoare.
    if (!state.bitrate) {
      var firstStep = initialQualityStep(null);
      state.quality = { step: firstStep, measured: 0, down: 0, up: 0, lastSwitch: 0, playAt: 0, fragBps: 0 };
      state.bitrate = LADDER[firstStep];
    }
    var bitrate = state.bitrate;
    var q = '/Items/' + state.item.Id + '/PlaybackInfo?UserId=' + S.userId + '&StartTimeTicks=' + Math.max(0, Math.round(startTicks || 0)) + '&IsPlayback=true&AutoOpenLiveStream=true&MaxStreamingBitrate=' + bitrate;
    if (audioIndex !== null && audioIndex !== undefined) q += '&AudioStreamIndex=' + audioIndex;
    if (subtitleIndex !== null && subtitleIndex !== undefined) q += '&SubtitleStreamIndex=' + subtitleIndex;
    api('POST', q, { DeviceProfile: deviceProfile(bitrate) }, function (status, data) {
      if (P !== state) return;
      var source = status === 200 && data && data.MediaSources ? data.MediaSources[0] : null;
      if (!source || data.ErrorCode) { playError(t('unplayable')); return; }
      state.playSessionId = data.PlaySessionId;
      state.source = source;
      state.audio = audioIndex !== null && audioIndex !== undefined ? audioIndex : source.DefaultAudioStreamIndex;
      state.subtitle = subtitleIndex !== null && subtitleIndex !== undefined ? subtitleIndex : (source.DefaultSubtitleStreamIndex === undefined ? -1 : source.DefaultSubtitleStreamIndex);
      if (!state.duration && source.RunTimeTicks) state.duration = source.RunTimeTicks;
      var url = null;
      var key = JELLYFIN ? 'ApiKey' : 'api_key';
      if (source.SupportsDirectPlay && !state.live && /^(mp4|m4v)$/i.test(source.Container || '')) {
        url = API + '/Videos/' + state.item.Id + '/stream.' + source.Container.toLowerCase() + '?Static=true&MediaSourceId=' + enc(source.Id) + '&PlaySessionId=' + enc(data.PlaySessionId) + '&DeviceId=' + enc(deviceId()) + '&' + key + '=' + enc(S.token);
        state.method = 'DirectPlay';
      } else if (source.TranscodingUrl) {
        url = absolute(source.TranscodingUrl);
        state.method = /[?&](VideoCodec=copy|static=true)/i.test(source.TranscodingUrl) ? 'DirectStream' : 'Transcode';
      }
      if (!url) { playError(t('unplayable')); return; }
      // Masurarea reala a vitezei porneste doar pe transcodare (DirectPlay/static: serverul copiaza fisierul).
      if (state.method === 'Transcode' && !state.quality.measured && !state.quality.measuring) {
        state.quality.measuring = true;
        mltvSpeed.measure(state.item, function (bps) {
          if (P !== state || !state.quality) return;
          state.quality.measured = bps || 0;
          if (!bps) return;
          var step = initialQualityStep(bps);
          // Corectia treptei initiale: in jos imediat (bandă supraevaluata), in sus doar inainte de pragul de 30 s.
          if (step !== state.quality.step && (!state.quality.playAt || new Date().getTime() - state.quality.playAt < 30000)) {
            qualitySwitch(state, step, true);
          }
        });
      }
      attach(state, url, startTicks || 0);
    });
  }

  // Schimbarea treptei AUTO: re-cere PlaybackInfo cu noul MaxStreamingBitrate si reatasare la pozitia curenta
  // (acelasi tipar ca restartAt, pentru schimbarea pistelor). Abandonul fluxului vechi trimite report('stop'),
  // care sterge si transcodarea veche (DELETE /Videos/ActiveEncodings).
  function qualitySwitch(state, step, startup) {
    if (!state.quality || step < 0 || step >= LADDER.length || step === state.quality.step) return;
    var video = $('mlVideo');
    var ahead = 0;
    try { if (video.buffered && video.buffered.length) ahead = video.buffered.end(video.buffered.length - 1) - (video.currentTime || 0); } catch (e) { }
    state.quality.step = step;
    state.quality.down = 0;
    state.quality.up = 0;
    state.quality.lastSwitch = new Date().getTime();
    state.bitrate = LADDER[step];
    // Inainte de prima redare, currentTime e inca 0 (cautarea la pozitia salvata nu s-a facut): reluam de la pozitia ceruta.
    var ticks = state.started ? position() : (state.attachTicks || 0);
    // Spinner doar daca bufferul e deja la limita (<4 s); altfel schimbul e aproape fara simptom.
    restartAt(state, ticks, state.audio, state.subtitle, !startup && ahead >= 4);
  }

  // Verificarea periodica a calitatii (apelata la ~2 segmente + un interval de siguranta de 15 s).
  function onQualityCheck(state) {
    if (P !== state || !state.quality || state.method !== 'Transcode' || !state.started || !hls) return;
    var video = $('mlVideo');
    if (video.paused) return;
    var now = new Date().getTime();
    if (!state.quality.playAt) return;
    if (now - state.quality.playAt < 30000) return; // niciodata in primele 30 s de redare
    if (now - state.quality.lastSwitch < 45000) return; // racire intre comutari
    var ahead = 0;
    try { if (video.buffered && video.buffered.length) ahead = video.buffered.end(video.buffered.length - 1) - (video.currentTime || 0); } catch (e) { }
    var est = 0;
    try { if (hls.bandwidthEstimate) est = hls.bandwidthEstimate; } catch (e) { }
    if (!est) est = state.quality.fragBps || 0;
    if (!est) return;
    var step = state.quality.step;
    var cur = LADDER[step];
    // Jos: buffer < 8 s SI estimare < 70% din treapta curenta, de 2 verificari la rand.
    if (ahead < 8 && est < cur * 0.7) {
      state.quality.down++;
      state.quality.up = 0;
      if (state.quality.down >= 2 && step > 0) qualitySwitch(state, step - 1, false);
    } else if (step < LADDER.length - 1) {
      // Sus: buffer > 20 s SI estimare > 85% din treapta urmatoare, de 3 verificari la rand; niciodata peste masurata*0.9.
      var next = LADDER[step + 1];
      if (ahead > 20 && est > next * 0.85 && (!state.quality.measured || next <= state.quality.measured * 0.9)) {
        state.quality.up++;
        state.quality.down = 0;
        if (state.quality.up >= 3) qualitySwitch(state, step + 1, false);
      } else {
        state.quality.up = 0;
        state.quality.down = 0;
      }
    } else {
      state.quality.up = 0;
      state.quality.down = 0;
    }
  }

  function onFragBuffered(state, data) {
    if (P !== state || !state.quality) return;
    state.quality.frags = (state.quality.frags || 0) + 1;
    try {
      var stats = data && data.frag && data.frag.stats;
      if (stats && stats.total) {
        var start = stats.loading && stats.loading.start ? stats.loading.start : stats.trequest;
        var end = stats.loading && stats.loading.end ? stats.loading.end : stats.tload;
        if (start && end && end > start) state.quality.fragBps = Math.round(stats.total * 8 / ((end - start) / 1000));
      }
    } catch (e) { }
    // ~2 segmente intre verificari.
    if (state.quality.frags % 2 === 0) onQualityCheck(state);
  }

  function startQualityMonitor(state) {
    stopQualityMonitor(state);
    if (state.method !== 'Transcode' || !state.quality) return;
    state.quality.frags = 0;
    state.qTimer = setInterval(function () {
      if (P !== state) { stopQualityMonitor(state); return; }
      if ($('mlVideo').paused) return; // fara verificari in pauza
      onQualityCheck(state);
    }, 15000);
  }

  function stopQualityMonitor(state) {
    if (state && state.qTimer) { clearInterval(state.qTimer); state.qTimer = null; }
  }

  function absolute(url) {
    if (/^https?:/i.test(url)) return url;
    if (url.charAt(0) !== '/') url = '/' + url;
    return API + url;
  }

  function attach(state, url, startTicks) {
    var video = $('mlVideo');
    stopQualityMonitor(state);
    destroyHls();
    var olds = video.querySelectorAll('track');
    for (var i = 0; i < olds.length; i++) video.removeChild(olds[i]);
    var streams = state.source.MediaStreams || [];
    for (var j = 0; j < streams.length; j++) {
      var s = streams[j];
      if (s.Type !== 'Subtitle' || s.DeliveryMethod !== 'External' || !s.DeliveryUrl) continue;
      var track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = s.DisplayTitle || s.Language || ('#' + s.Index);
      if (s.Language) track.srclang = s.Language;
      track.src = absolute(s.DeliveryUrl);
      track.setAttribute('data-index', s.Index);
      video.appendChild(track);
    }
    // Subtitrarea descarcata de pe rosub in aceasta sesiune de redare: se reataseaza dupa fiecare repornire.
    if (state.ext) appendExtTrack(state.ext);
    var startSeconds = startTicks / TICKS;
    state.attachTicks = startTicks;
    var isHls = state.method !== 'DirectPlay';
    if (isHls && window.Hls && window.Hls.isSupported && window.Hls.isSupported()) {
      // Fara controlerul de interstitiale: hls.js 1.6 (cel din Emby) apeleaza media.play().catch() fara handler din el,
      // deci o reatasare (calitate AUTO, piste) lasa un AbortError neprins. Serverele nu produc interstitiale.
      hls = new window.Hls({ startPosition: state.live ? -1 : startSeconds, maxBufferLength: 30, maxMaxBufferLength: 60, backBufferLength: 30, enableWorker: true, interstitialsController: null, enableInterstitialPlayback: false });
      var retried = false;
      hls.on(window.Hls.Events.ERROR, function (event, info) {
        if (!info || !info.fatal || P !== state) return;
        if (info.type === window.Hls.ErrorTypes.NETWORK_ERROR && !retried) { retried = true; hls.startLoad(); return; }
        if (info.type === window.Hls.ErrorTypes.MEDIA_ERROR && !retried) { retried = true; hls.recoverMediaError(); return; }
        playError(t('unplayable'));
      });
      hls.on(window.Hls.Events.FRAG_BUFFERED, function (event, data) { onFragBuffered(state, data); });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (!isHls || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      state.seekOnLoad = state.live ? 0 : startSeconds;
    } else {
      playError(t('unplayable'));
      return;
    }
    video.onloadedmetadata = function () {
      if (P !== state) return;
      if (state.seekOnLoad) { try { video.currentTime = state.seekOnLoad; } catch (e) { } state.seekOnLoad = 0; }
      selectSubtitle(state.subtitle);
    };
    video.onplaying = function () {
      if (P !== state) return;
      addClass($('mlSpin'), 'hidden');
      if (!state.started) {
        state.started = true;
        if (state.quality) state.quality.playAt = new Date().getTime();
        startQualityMonitor(state);
        report('start');
      }
      setPlayIcon();
      scheduleOsdHide();
    };
    video.onwaiting = function () { if (P === state) removeClass($('mlSpin'), 'hidden'); };
    video.onpause = function () { if (P === state) { setPlayIcon(); showOsd(); report('progress'); } };
    video.onplay = function () { setPlayIcon(); };
    video.ontimeupdate = function () { if (P === state) onTime(state); };
    video.onended = function () {
      if (P !== state) return;
      if (state.next) playNext();
      else { report('stop'); state.stopped = true; goBack(); }
    };
    video.onerror = function () { if (P === state && !hls) playError(t('unplayable')); };
    clearInterval(state.timer);
    state.timer = setInterval(function () { if (P === state && state.started) report('progress'); }, 10000);
    selectSubtitle(state.subtitle);
    var p = video.play();
    if (p && p.then) p.then(null, function () { removeClass($('mlSpin'), 'hidden'); addClass($('mlSpin'), 'hidden'); showOsd(); setPlayIcon(); });
    fillTracks(state);
    buildChapterTicks(state);
  }

  function destroyHls() {
    if (hls) { try { hls.destroy(); } catch (e) { } hls = null; }
  }

  function position() {
    var v = $('mlVideo');
    return Math.round((v.currentTime || 0) * TICKS);
  }

  function report(kind) {
    var state = P;
    if (!state || !state.source || (!state.started && kind !== 'start')) return;
    var v = $('mlVideo');
    var body = {
      ItemId: state.item.Id, MediaSourceId: state.source.Id, PlaySessionId: state.playSessionId, PositionTicks: position(),
      IsPaused: v.paused, IsMuted: false, CanSeek: !state.live, PlayMethod: state.method,
      AudioStreamIndex: state.audio, SubtitleStreamIndex: state.subtitle, LiveStreamId: state.source.LiveStreamId || undefined,
      RunTimeTicks: state.duration || undefined
    };
    var path = kind === 'start' ? '/Sessions/Playing' : kind === 'stop' ? '/Sessions/Playing/Stopped' : '/Sessions/Playing/Progress';
    send('POST', path, body, S.token, function () { });
    if (kind === 'stop') {
      S.homeDirty = true;
      invalidate(/Resume|NextUp|Ids=|\?userId=|Episodes|IsFavorite/);
      if (state.method !== 'DirectPlay') send('DELETE', '/Videos/ActiveEncodings?DeviceId=' + enc(deviceId()) + '&PlaySessionId=' + enc(state.playSessionId), null, S.token, function () { });
    }
  }

  function stopPlayback(silent) {
    var state = P;
    if (!state) return;
    removeExtSub(state);
    clearInterval(state.timer);
    clearInterval(state.countdownTimer);
    stopQualityMonitor(state);
    if (state.started && !state.stopped) { report('stop'); state.stopped = true; }
    P = null;
    destroyHls();
    var video = $('mlVideo');
    video.onloadedmetadata = video.onplaying = video.onwaiting = video.onpause = video.onplay = video.ontimeupdate = video.onended = video.onerror = null;
    try { video.pause(); } catch (e) { }
    video.removeAttribute('src');
    try { video.load(); } catch (e) { }
    var ticks = $('mlBar').querySelector('.ml-bar-ticks');
    if (ticks) $('mlBar').removeChild(ticks);
    if (!silent) { }
  }

  function closePlayer(navigate) {
    stopPlayback(false);
    clearTimeout(osdTimer);
    addClass($('mlPlayer'), 'hidden');
    addClass($('mlChanBox'), 'hidden');
    addClass($('mlChapBox'), 'hidden');
    addClass($('mlRosub'), 'hidden');
    addClass($('mlVol'), 'hidden');
    removeClass(document.body, 'ml-playing');
    closeTracks();
    if (navigate) goBack();
    else setTimeout(function () {
      var screen = currentScreen();
      if (screen === $('mlHome') && S.homeDirty) showHome();
    }, 0);
  }

  function playError(text) {
    addClass($('mlSpin'), 'hidden');
    $('mlPlayError').textContent = text;
    removeClass($('mlPlayError'), 'hidden');
    showOsd();
    focusEl($('mlBack'));
  }

  function setPlayIcon() {
    var paused = $('mlVideo').paused;
    $('mlPPIcon').className = paused ? 'ml-i-play only' : 'ml-i-pause';
  }

  function showOsd() {
    // Blocat (D36): OSD-ul nu apare din sageti/miscare pana la deblocare, dar apare in pauza (ca sa nu ramai captiv).
    if (S.osdLock && P && !$('mlVideo').paused) return;
    removeClass($('mlOsd'), 'off');
    addClass($('mlPlayer'), 'osd-on');
    scheduleOsdHide();
  }

  function scheduleOsdHide() {
    clearTimeout(osdTimer);
    osdTimer = setTimeout(function () {
      var v = $('mlVideo');
      if (!P || v.paused || !hasClass($('mlTracks'), 'hidden') || !hasClass($('mlRosub'), 'hidden') || !hasClass($('mlChanBox'), 'hidden') || !hasClass($('mlChapBox'), 'hidden') || !hasClass($('mlPlayError'), 'hidden')) return;
      addClass($('mlOsd'), 'off');
      removeClass($('mlPlayer'), 'osd-on');
      if (document.activeElement && $('mlOsd').contains(document.activeElement)) {
        if (!hasClass($('mlSkip'), 'hidden')) focusEl($('mlSkip'));
        else try { document.activeElement.blur(); } catch (e) { }
      }
    }, 4000);
  }

  function hideOsd() {
    addClass($('mlOsd'), 'off');
    removeClass($('mlPlayer'), 'osd-on');
  }

  function osdVisible() { return !hasClass($('mlOsd'), 'off'); }

  function togglePause() {
    var v = $('mlVideo');
    if (v.paused) { var p = v.play(); if (p && p.then) p.then(null, function () { }); } else v.pause();
    setPlayIcon();
    showOsd();
  }

  function seekBy(seconds) {
    if (!P || P.live) return;
    var v = $('mlVideo');
    var max = P.duration ? P.duration / TICKS : (v.duration || 0);
    var target = Math.max(0, Math.min(max ? max - 1 : Infinity, (v.currentTime || 0) + seconds));
    try { v.currentTime = target; } catch (e) { }
    onTime(P);
    showOsd();
    report('progress');
  }

  function seekTo(seconds) {
    if (!P || P.live) return;
    try { $('mlVideo').currentTime = Math.max(0, seconds); } catch (e) { }
    onTime(P);
    report('progress');
  }

  function onTime(state) {
    var v = $('mlVideo');
    if (state.seekTarget !== null && state.seekTarget !== undefined) return;
    var pos = v.currentTime || 0;
    var dur = state.duration ? state.duration / TICKS : (isFinite(v.duration) ? v.duration : 0);
    $('mlTimePos').textContent = duration(pos);
    $('mlTimeDur').textContent = state.live ? t('live') : duration(dur);
    if (dur > 0) $('mlBarFill').style.width = Math.min(100, pos / dur * 100) + '%';
    try {
      if (dur > 0 && v.buffered && v.buffered.length) $('mlBarBuf').style.width = Math.min(100, v.buffered.end(v.buffered.length - 1) / dur * 100) + '%';
    } catch (e) { }
    if (!state.live) skipButton(state, pos, dur);
  }

  // --- Sari peste intro / rezumat / generic, episodul urmator ---------------------------------------

  function loadSegments(state) {
    var item = state.item;
    var list = [];
    if (JELLYFIN) {
      get('/MediaSegments/' + item.Id, function (status, data) {
        var segs = status === 200 ? items(data) : [];
        for (var i = 0; i < segs.length; i++) {
          var type = String(segs[i].Type || '').toLowerCase();
          var kind = type === 'intro' ? 'intro' : type === 'recap' ? 'recap' : type === 'outro' ? 'credits' : null;
          if (kind) list.push({ kind: kind, start: segs[i].StartTicks / TICKS, end: segs[i].EndTicks / TICKS });
        }
        if (P === state) state.segments = list;
      }, 300000);
      return;
    }
    // Emby: markerii nativi (capitole IntroStart / IntroEnd / CreditsStart), apoi Smart Skip daca e instalat.
    var chapters = item.Chapters || [];
    var introStart = null, introEnd = null, creditsStart = null;
    for (var c = 0; c < chapters.length; c++) {
      var m = chapters[c].MarkerType;
      if (m === 'IntroStart') introStart = chapters[c].StartPositionTicks / TICKS;
      else if (m === 'IntroEnd') introEnd = chapters[c].StartPositionTicks / TICKS;
      else if (m === 'CreditsStart') creditsStart = chapters[c].StartPositionTicks / TICKS;
    }
    if (introStart !== null && introEnd !== null && introEnd > introStart) list.push({ kind: 'intro', start: introStart, end: introEnd });
    if (creditsStart !== null) list.push({ kind: 'credits', start: creditsStart, end: Infinity });
    state.segments = list;
    get('/SmartSkip/Segments/' + item.Id, function (status, data) {
      if (P !== state || status !== 200 || !data) return;
      if (data.RecapStart !== null && data.RecapStart !== undefined && data.RecapEnd) list.push({ kind: 'recap', start: data.RecapStart, end: data.RecapEnd });
      if (data.CreditsStart !== null && data.CreditsStart !== undefined && creditsStart === null) list.push({ kind: 'credits', start: data.CreditsStart, end: data.CreditsEnd || Infinity });
      state.segments = list;
    }, 300000);
  }

  function skipButton(state, pos, dur) {
    var btn = $('mlSkip');
    var seg = null;
    for (var i = 0; i < state.segments.length; i++) {
      var s = state.segments[i];
      if (pos >= s.start && pos < Math.min(s.end, dur || Infinity) - 1) seg = s;
    }
    var nextMode = false;
    if (state.next) {
      if (seg && seg.kind === 'credits' && (seg.end === Infinity || seg.end >= dur - 5)) nextMode = true;
      if (!seg && dur > 60 && pos >= dur - 25 && !hasCredits(state)) nextMode = true;
    }
    if (nextMode) {
      if (state.countdown === null) {
        state.countdown = 10;
        clearInterval(state.countdownTimer);
        state.countdownTimer = setInterval(function () {
          if (P !== state || $('mlVideo').paused) return;
          state.countdown--;
          if (state.countdown <= 0) { clearInterval(state.countdownTimer); playNext(); return; }
          btn.textContent = t('nextIn', state.countdown);
        }, 1000);
      }
      btn.textContent = t('nextIn', state.countdown);
      btn.mlAction = 'next';
    } else if (seg) {
      cancelCountdown(state);
      btn.textContent = seg.kind === 'intro' ? t('skipIntro') : seg.kind === 'recap' ? t('skipRecap') : t('skipCredits');
      btn.mlAction = seg;
    } else {
      cancelCountdown(state);
      if (!hasClass(btn, 'hidden')) {
        var hadFocus = document.activeElement === btn;
        addClass(btn, 'hidden');
        state.skipShown = null;
        if (hadFocus) { if (osdVisible()) focusEl($('mlPlayPause')); else try { btn.blur(); } catch (e) { } }
      }
      return;
    }
    var key = nextMode ? 'next' : seg.kind + seg.start;
    if (state.skipShown !== key) {
      state.skipShown = key;
      removeClass(btn, 'hidden');
      // Ca pe Netflix: butonul primeste focusul, deci OK sare direct.
      if (!osdVisible() || !document.activeElement || document.activeElement === document.body) focusEl(btn);
    }
  }

  function hasCredits(state) {
    for (var i = 0; i < state.segments.length; i++) if (state.segments[i].kind === 'credits') return true;
    return false;
  }

  function cancelCountdown(state) {
    if (state.countdown !== null) { clearInterval(state.countdownTimer); state.countdown = null; }
  }

  function skipNow() {
    var btn = $('mlSkip');
    if (!P) return;
    if (btn.mlAction === 'next') { playNext(); return; }
    var seg = btn.mlAction;
    if (!seg) return;
    var dur = P.duration ? P.duration / TICKS : 0;
    if (seg.end === Infinity || (dur && seg.end >= dur - 1)) {
      if (P.next) { playNext(); return; }
      seekTo(Math.max(0, dur - 1));
      return;
    }
    seekTo(seg.end);
    addClass(btn, 'hidden');
  }

  function playNext() {
    var state = P;
    if (!state || !state.next) return;
    var next = state.next;
    report('stop');
    state.stopped = true;
    go('#/play/' + next.Id + '/0', true);
  }

  // --- Piste audio si subtitrari -----------------------------------------------------------------

  // Butoanele rapide din OSD arata intotdeauna selectia curenta si se dezactiveaza vizibil cand nu e alegere
  // (≤1 pista audio / fara subtitrari); activarea deschide panoul de piste, deja focusat pe lista ceruta.
  function fillTracks(state) {
    var streams = state.source.MediaStreams || [];
    var audio = 0, subs = 0, audioLabel = '', subLabel = t('off');
    for (var i = 0; i < streams.length; i++) {
      var s = streams[i];
      if (s.Type === 'Audio') {
        audio++;
        if (s.Index === state.audio) audioLabel = s.DisplayTitle || s.Language || ('#' + s.Index);
      }
      if (s.Type === 'Subtitle') {
        subs++;
        if (s.Index === state.subtitle) subLabel = s.DisplayTitle || s.Language || ('#' + s.Index);
      }
    }
    var aBtn = $('mlAudioBtn'), sBtn = $('mlSubsBtn');
    aBtn.textContent = t('audio') + (audioLabel ? ': ' + audioLabel : '');
    // Subtitrarea descarcata de pe rosub nu e un flux al serverului: se arata ca eticheta curenta cand e activa.
    var shownSub = state.extOn && state.ext ? state.ext.label : (state.subtitle === -1 ? t('off') : subLabel);
    sBtn.textContent = t('subtitles') + (subs || state.ext ? ': ' + shownSub : '');
    toggleClass(aBtn, 'disabled', audio < 2);
    // Panoul de subtitrari ramane accesibil si fara fluxuri: de acolo se descarca de pe rosub.
    toggleClass(sBtn, 'disabled', subs === 0 && !state.ext && !(S.rosub && S.rosub.enabled));
    if (S.rosub === null) ensureRosub(function () { if (P) fillTracks(P); });
    toggleClass($('mlChanBtn'), 'hidden', !state.live);
    removeClass($('mlLockBtn'), 'hidden');
    updateChapBtn(state);
    updateMediaInfo(state);
    updateFullBtn();
  }

  // Capitolele titlului (din raspunsul itemului; ambele servere trimit Chapters pe ruta Items/{id}).
  function chaptersOf(state) {
    var raw = (state.item && state.item.Chapters) || [];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      // Sarim peste markerii de tip Intro/Credits — raman utile prin „Sari peste”.
      if (raw[i].MarkerType && raw[i].MarkerType !== 'None' && raw[i].MarkerType !== 'Chapter') continue;
      if (!(raw[i].StartPositionTicks > 0)) continue;
      var copy = {};
      for (var k in raw[i]) { if (Object.prototype.hasOwnProperty.call(raw[i], k)) copy[k] = raw[i][k]; }
      copy._mlIndex = i;
      out.push(copy);
    }
    return out;
  }

  function updateChapBtn(state) {
    var n = chaptersOf(state).length;
    toggleClass($('mlChapBtn'), 'hidden', n === 0 || state.live);
    toggleClass($('mlChapBtn'), 'disabled', n === 0);
  }

  // Marcaje de capitole pe bara de derulare: pozitionate absolut la start/durata.
  function buildChapterTicks(state) {
    var bar = $('mlBar');
    var old = bar.querySelector('.ml-bar-ticks');
    if (old) bar.removeChild(old);
    var list = chaptersOf(state);
    var dur = state.duration ? state.duration / TICKS : 0;
    if (!list.length || !dur) return;
    var ticks = el('span', 'ml-bar-ticks');
    for (var i = 0; i < list.length; i++) {
      var pct = list[i].StartPositionTicks / TICKS / dur * 100;
      if (pct <= 0 || pct >= 100) continue;
      var m = el('i');
      m.style.left = pct + '%';
      ticks.appendChild(m);
    }
    bar.appendChild(ticks);
  }

  // Insignele de sub titlu (ideoile „SecondaryMediaInfo” din Emby Web): video, audio, subtitrare activa.
  var CODEC_VIDEO = { h264: 'H.264', hevc: 'HEVC', h265: 'HEVC', vp9: 'VP9', av1: 'AV1', mpeg2video: 'MPEG-2', mpeg1video: 'MPEG-1', mpeg4: 'MPEG-4', vc1: 'VC-1', wmv3: 'WMV' };
  var CODEC_AUDIO = { aac: 'AAC', ac3: 'AC-3', eac3: 'E-AC-3', dca: 'DTS', dts: 'DTS', truehd: 'TrueHD', flac: 'FLAC', mp3: 'MP3', mp2: 'MP2', opus: 'Opus', pcm: 'PCM', pcm_s16le: 'PCM', pcm_s24le: 'PCM', vorbis: 'Vorbis', wmapro: 'WMA', wmav2: 'WMA' };

  function fmtChannels(n) {
    if (n === 8) return '7.1';
    if (n === 7) return '6.1';
    if (n === 6) return '5.1';
    if (n === 2) return '2.0';
    if (n === 1) return 'Mono';
    return n ? n + ' ch' : '';
  }

  function updateMediaInfo(state) {
    var box = $('mlOsdBadges');
    if (!state || !state.source) { addClass(box, 'hidden'); return; }
    var streams = state.source.MediaStreams || [];
    var badges = [];
    for (var i = 0; i < streams.length; i++) {
      var s = streams[i];
      if (s.Type === 'Video' && !badges.length) {
        var v = s.Height ? s.Height + 'p' : '';
        var vc = CODEC_VIDEO[(s.Codec || '').toLowerCase()] || (s.Codec ? s.Codec.toUpperCase() : '');
        if (v || vc) badges.push((v ? v + ' ' : '') + vc);
      }
    }
    for (var j = 0; j < streams.length; j++) {
      var a = streams[j];
      if (a.Type === 'Audio' && a.Index === state.audio) {
        var ac = CODEC_AUDIO[(a.Codec || '').toLowerCase()] || (a.Codec ? a.Codec.toUpperCase() : '');
        var ch = fmtChannels(a.Channels);
        if (ac || ch) badges.push(ac + (ac && ch ? ' ' : '') + ch);
        break;
      }
    }
    if (state.subtitle !== -1 && state.subtitle !== null && state.subtitle !== undefined) badges.push(t('subtitles'));
    box.textContent = '';
    for (var b = 0; b < badges.length; b++) {
      var badge = badges[b];
      if (!badge) continue;
      box.appendChild(el('span', null, badge));
    }
    toggleClass(box, 'hidden', box.childNodes.length === 0);
  }

  function openTracks(kind) {
    var state = P;
    if (!state || !state.source) return;
    var list = $('mlTracksList');
    list.textContent = '';
    $('mlTracksTitle').textContent = kind === 'audio' ? t('audio') : t('subtitles');
    var streams = state.source.MediaStreams || [];
    var current = kind === 'audio' ? state.audio : (kind === 'subtitle' && state.extOn && state.ext ? EXT_SUB : state.subtitle);
    var focus = null;
    var option = function (label, index) {
      var b = el('button', 'ml-track-opt f' + (index === current ? ' on' : ''), label);
      b.type = 'button';
      b.onclick = function () { closeTracks(); chooseTrack(kind, index); };
      list.appendChild(b);
      if (index === current || !focus) focus = index === current ? b : focus || b;
    };
    if (kind === 'subtitle') option(t('off'), -1);
    for (var i = 0; i < streams.length; i++) {
      var s = streams[i];
      if ((kind === 'audio' && s.Type === 'Audio') || (kind === 'subtitle' && s.Type === 'Subtitle')) option(s.DisplayTitle || s.Language || ('#' + s.Index), s.Index);
    }
    if (kind === 'subtitle') {
      if (state.ext) option(state.ext.label, EXT_SUB);
      var rb = el('button', 'ml-track-opt ml-track-rosub f', t('rosubDownload'));
      rb.type = 'button';
      rb.onclick = function () { closeTracks(); openRosub(); };
      list.appendChild(rb);
    }
    removeClass($('mlTracks'), 'hidden');
    clearTimeout(osdTimer);
    focusEl(focus || list.firstChild);
    try { (document.activeElement || list.firstChild).scrollIntoView({ block: 'nearest' }); } catch (e) { }
  }

  // Intoarcerea focusului dupa inchiderea unui panou din player: pe OSD daca e vizibil, alt focus sters.
  function restoreOsdFocus(fallback) {
    if (!P) return;
    if (osdVisible()) { anchorFocus($('mlOsd'), fallback || $('mlPlayPause')); return; }
    if (document.activeElement && $('mlPlayer').contains(document.activeElement)) {
      try { document.activeElement.blur(); } catch (e) { }
    }
  }

  function closeTracks() {
    if (hasClass($('mlTracks'), 'hidden')) return;
    addClass($('mlTracks'), 'hidden');
    showOsd();
    restoreOsdFocus($('mlPlayPause'));
  }

  // --- „Descarcă de pe rosub” (subtitrari romanesti via subs.ro, prin controller-ul pluginului) -------

  // data-index al pistei externe descarcate in sesiunea de redare curenta (nu e un flux al serverului).
  var EXT_SUB = 'ml-ext';

  // Starea rosub a serverului (o singura citire pe sesiune): enabled = comutatorul adminului.
  function ensureRosub(done) {
    if (S.rosub) return done(S.rosub);
    api('GET', '/MediaLabTv/Rosub/Status', null, function (status, data) {
      S.rosub = status === 200 && data ? { enabled: data.Enabled !== false, ready: !!data.Ready } : { enabled: false, ready: false };
      done(S.rosub);
    });
  }

  function appendExtTrack(ext) {
    var video = $('mlVideo');
    if (video.querySelector('track[data-index="' + EXT_SUB + '"]')) return;
    var track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = ext.label;
    if (ext.lang) track.srclang = ext.lang;
    track.src = ext.url;
    track.setAttribute('data-index', EXT_SUB);
    video.appendChild(track);
  }

  function removeExtSub(state) {
    if (!state || !state.ext) return;
    try { URL.revokeObjectURL(state.ext.url); } catch (e) { }
    state.ext = null;
    state.extOn = false;
    var track = $('mlVideo').querySelector('track[data-index="' + EXT_SUB + '"]');
    if (track && track.parentNode) track.parentNode.removeChild(track);
  }

  // Tastatura pe ecran (acelasi tipar ca la cautare), construita o singura data.
  function buildRosubBox() {
    var input = $('mlRosubInput'), keys = $('mlRosubKeys');
    input.className = 'f' + (TV ? '' : ' ml-default');
    if (keys.mlBuilt) return;
    keys.mlBuilt = true;
    input.setAttribute('aria-label', t('rosubTitle'));
    $('mlRosubGo').onclick = runRosubSearch;
    input.onkeydown = function (e) { if (e.keyCode === 13) { e.preventDefault(); runRosubSearch(); } };
    var letters = 'abcdefghijklmnopqrstuvwxyz1234567890';
    var typeKey = function (label, cls, fn) {
      var k = el('button', 'ml-key f' + (cls ? ' ' + cls : ''), label);
      k.type = 'button';
      k.onclick = fn;
      keys.appendChild(k);
      if (TV && !keys.mlDefault) { addClass(k, 'ml-default'); keys.mlDefault = true; }
      return k;
    };
    for (var i = 0; i < letters.length; i++) {
      (function (ch) { typeKey(ch.toUpperCase(), '', function () { input.value += ch; }); })(letters.charAt(i));
    }
    typeKey(t('space'), 'wide', function () { input.value += ' '; });
    typeKey(t('del'), 'wide', function () { input.value = input.value.slice(0, -1); });
    typeKey(t('clear'), 'wide', function () { input.value = ''; });
  }

  function openRosub() {
    var state = P;
    if (!state || state.live) return;
    ensureRosub(function (r) {
      if (P !== state) return;
      if (!r.enabled) { toast(t('rosubUnavailable')); return; }
      buildRosubBox();
      var box = $('mlRosub');
      $('mlRosubTitle').textContent = t('rosubTitle');
      var input = $('mlRosubInput');
      // Textul initial: titlul curent (cu anul); ramane atasat de acest titlu pana il schimba utilizatorul.
      if (input.mlFor !== state.id) {
        var name = state.item ? (state.item.Name || '') : '';
        var year = state.item && state.item.ProductionYear ? state.item.ProductionYear : 0;
        input.value = name + (year && name.indexOf('(' + year + ')') < 0 ? ' (' + year + ')' : '');
        input.mlFor = state.id;
      }
      $('mlRosubGo').textContent = t('search');
      var list = $('mlRosubList');
      list.textContent = '';
      list.appendChild(el('p', 'ml-empty', t('rosubHint')));
      box.mlReturn = document.activeElement;
      removeClass(box, 'hidden');
      clearTimeout(osdTimer);
      // Pe televizor focusul pleaca pe tastatura virtuala (ca la cautare); pe desktop, in caseta textului.
      var firstKey = $('mlRosubKeys').querySelector('.f');
      if (TV && firstKey) focusEl(firstKey);
      else anchorFocus(box, input);
      runRosubSearch();
    });
  }

  function closeRosub() {
    var box = $('mlRosub');
    if (hasClass(box, 'hidden')) return;
    addClass(box, 'hidden');
    if (!P) return;
    showOsd();
    restoreOsdFocus($('mlSubsBtn'));
  }

  // Cautarea propriu-zisa e dupa idul titlului (IMDb/TMDB) pe server; textul din caseta se trimite pentru
  // servere viitoare/ajustari, iar utilizatorul o vede si o poate corecta inainte de o noua incercare.
  function runRosubSearch() {
    var state = P;
    if (!state || hasClass($('mlRosub'), 'hidden')) return;
    var list = $('mlRosubList');
    list.textContent = '';
    list.appendChild(el('p', 'ml-empty', t('rosubSearching')));
    api('GET', '/MediaLabTv/Rosub/Search?itemId=' + enc(state.id) + '&q=' + enc($('mlRosubInput').value), null, function (status, data) {
      if (P !== state || hasClass($('mlRosub'), 'hidden')) return;
      list.textContent = '';
      if (status === 409) { list.appendChild(el('p', 'ml-empty', t('rosubUnavailable'))); return; }
      if (status !== 200 || !data || !data.Items || !data.Items.length) {
        list.appendChild(el('p', 'ml-empty', status === 502 ? t('rosubUnavailable') : t('rosubEmpty')));
        return;
      }
      for (var i = 0; i < data.Items.length; i++) (function (item) {
        var label = item.Title || t('rosubTitle');
        if (item.Year) label += ' (' + item.Year + ')';
        if (item.Translator) label += ' — ' + item.Translator;
        var b = el('button', 'ml-track-opt f', label);
        b.type = 'button';
        b.onclick = function () { downloadRosub(item); };
        list.appendChild(b);
      })(data.Items[i]);
      var first = list.querySelector('.f');
      if (first) focusEl(first);
    });
  }

  // Descarca .srt-ul prin controller-ul pluginului (cheia API ramane pe server) si il ataseaza ca <track>.
  function downloadRosub(item) {
    var state = P;
    if (!state) return;
    var list = $('mlRosubList');
    list.textContent = '';
    list.appendChild(el('p', 'ml-empty', t('rosubDownloading')));
    downloadText('/MediaLabTv/Rosub/Download?itemId=' + enc(state.id) + '&subtitleId=' + enc(item.Id), function (status, text) {
      if (P !== state) return;
      if (status !== 200 || !text) {
        list.textContent = '';
        list.appendChild(el('p', 'ml-empty', status === 409 || status === 502 ? t('rosubUnavailable') : t('rosubFailed')));
        return;
      }
      removeExtSub(state);
      var blob;
      try { blob = new Blob([text], { type: 'text/plain' }); } catch (e) { blob = new Blob([text]); }
      state.ext = { label: t('rosubExt', item.Title || t('rosubTitle')), url: URL.createObjectURL(blob), lang: item.Language || 'ro' };
      state.extOn = true;
      appendExtTrack(state.ext);
      selectSubtitle(state.subtitle);
      fillTracks(state);
      closeRosub();
      toast(t('rosubLoaded'));
      report('progress');
    });
  }

  // GET cu raspuns brut (nu JSON): continutul .srt, cu tokenul utilizatorului.
  function downloadText(path, done) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API + path, true);
    xhr.timeout = 30000;
    authHeaders(xhr, S.token);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      done(xhr.status, xhr.responseText);
    };
    xhr.send(null);
  }

  // --- Selectorul de canale (TV in direct) --------------------------------------------------------

  function openChannels() {
    var state = P;
    if (!state || !state.live) return;
    showOsd();
    var box = $('mlChanBox');
    var listEl = $('mlChanList');
    var render = function (list) {
      if (P !== state) return;
      listEl.textContent = '';
      for (var i = 0; i < list.length; i++) (function (ch) {
        var row = el('button', 'ml-chan-row f' + (ch.Id === state.id ? ' on' : ''));
        row.type = 'button';
        var logo = el('span', 'ml-chan-logo');
        if (tagOf(ch, 'Primary')) logo.style.backgroundImage = 'url("' + imageUrl(ch.Id, 'Primary', 120, tagOf(ch, 'Primary')) + '")';
        row.appendChild(logo);
        var info = el('span', 'ml-chan-info');
        var name = el('span', 'ml-chan-name');
        name.appendChild(el('span', 'ml-chan-num', String(ch.ChannelNumber || ch.Number || '')));
        name.appendChild(document.createTextNode(ch.Name || ''));
        if (ch.Id === state.id) name.appendChild(el('span', 'ml-chan-live', t('live')));
        info.appendChild(name);
        var prog = ch.CurrentProgram;
        if (prog) {
          var pTxt = el('span', 'ml-chan-prog', prog.Name || '');
          var start = parseDate(prog.StartDate), end = parseDate(prog.EndDate);
          if (start && end && end > start) {
            var bar = el('span', 'ml-progress');
            bar.appendChild(el('span'));
            bar.firstChild.style.width = Math.max(0, Math.min(100, (new Date().getTime() - start.getTime()) / (end.getTime() - start.getTime()) * 100)) + '%';
            pTxt.appendChild(bar);
          }
          info.appendChild(pTxt);
        }
        row.appendChild(info);
        row.onclick = function () {
          if (ch.Id === state.id) { closeChannels(); return; }
          closeChannels();
          // Aceeasi cale ca si CH± / cifrele: raportarea si sesiunea raman corecte.
          go('#/play/' + ch.Id, true);
        };
        listEl.appendChild(row);
      })(list[i]);
      if (!list.length) listEl.appendChild(el('p', 'ml-empty', t('emptyList')));
    };
    render(S.liveOrder && S.liveOrder.length ? channelsFromCache() : []);
    liveChannels(function (list) {
      // Date proaspete (sau primul raspuns): redesenam daca chenarul e inca deschis.
      if (P === state && !hasClass(box, 'hidden')) render(list);
    });
    box.mlReturn = document.activeElement;
    $('mlChanTitle').textContent = t('channels');
    removeClass(box, 'hidden');
    clearTimeout(osdTimer);
    anchorFocus(box, $('mlChanBtn'));
  }

  function channelsFromCache() {
    var out = [];
    for (var i = 0; i < S.liveOrder.length; i++) if (S.liveIds[S.liveOrder[i]]) out.push(S.liveIds[S.liveOrder[i]]);
    return out;
  }

  function closeChannels() {
    var box = $('mlChanBox');
    if (hasClass(box, 'hidden')) return;
    addClass(box, 'hidden');
    if (!P) return;
    var back = box.mlReturn;
    showOsd();
    if (!osdVisible()) { restoreOsdFocus(null); return; }
    if (back && back.parentNode && visible(back)) focusEl(back);
    else anchorFocus($('mlOsd'), $('mlPlayPause'));
  }

  // --- Lista de capitole (acelasi tipar ca selectorul de canale) -------------------------------------

  function openChapters() {
    var state = P;
    if (!state || state.live) return;
    var list = chaptersOf(state);
    if (!list.length) return;
    showOsd();
    var box = $('mlChapBox');
    var listEl = $('mlChapList');
    listEl.textContent = '';
    var dur = state.duration ? state.duration / TICKS : 0;
    var now = position() / TICKS;
    var focus = null;
    var n = 0;
    for (var i = 0; i < list.length; i++) (function (ch) {
      var secs = ch.StartPositionTicks / TICKS;
      if (dur && secs >= dur - 2) return;
      var card = el('button', 'ml-chap-card f' + (secs <= now ? ' on' : ''));
      card.type = 'button';
      card.setAttribute('role', 'option');
      var img = el('span', 'ml-chap-img');
      var idx = ch._mlIndex === undefined ? i : ch._mlIndex;
      img.style.backgroundImage = 'url("' + imageUrl(state.id, 'Chapter', 360, null, idx) + '")';
      card.appendChild(img);
      card.appendChild(el('span', 'ml-chap-name', ch.Name || t('chapter', n + 1)));
      card.appendChild(el('span', 'ml-chap-time', duration(secs)));
      card.onclick = function () { closeChapters(); seekTo(secs); showOsd(); };
      listEl.appendChild(card);
      if (!focus && secs > now) { focus = card; }
      n++;
    })(list[i]);
    $('mlChapTitle').textContent = t('chapters');
    box.mlReturn = document.activeElement;
    removeClass(box, 'hidden');
    clearTimeout(osdTimer);
    focusEl(focus || listEl.firstChild || $('mlChapBtn'));
    try { (document.activeElement || listEl.firstChild).scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { }
  }

  function closeChapters() {
    var box = $('mlChapBox');
    if (hasClass(box, 'hidden')) return;
    addClass(box, 'hidden');
    if (!P) return;
    var back = box.mlReturn;
    showOsd();
    if (!osdVisible()) { restoreOsdFocus(null); return; }
    if (back && back.parentNode && visible(back)) focusEl(back);
    else anchorFocus($('mlOsd'), $('mlPlayPause'));
  }

  // --- Volum (tastele de volum ale televizoarelor ajusteaza volumul elementului video; indicator OSD) ---

  function volumeSupported() {
    var v = $('mlVideo');
    return v && typeof v.volume === 'number';
  }

  function showVolume() {
    if (!volumeSupported()) return;
    var v = $('mlVideo');
    var box = $('mlVol');
    var pct = Math.round(v.volume * 100);
    $('mlVolLabel').textContent = t('volume');
    $('mlVolFill').style.width = pct + '%';
    $('mlVolPct').textContent = v.muted ? t('muted') : pct + '%';
    removeClass(box, 'hidden');
    clearTimeout(showVolume.timer);
    showVolume.timer = setTimeout(function () { addClass(box, 'hidden'); }, 1600);
  }

  function volumeStep(dir) {
    if (!P || !volumeSupported()) return;
    var v = $('mlVideo');
    v.muted = false;
    v.volume = Math.max(0, Math.min(1, Math.round((v.volume + dir * 0.05) * 100) / 100));
    setPlayIcon();
    showVolume();
  }

  function volumeMute() {
    if (!P || !volumeSupported()) return;
    var v = $('mlVideo');
    v.muted = !v.muted;
    showVolume();
  }

  // --- Blocarea OSD (per sesiune, fara PIN): sagetile nu mai deschid OSD-ul pana la deblocare ---------

  function setOsdLock(on) {
    S.osdLock = !!on;
    var icon = $('mlLockIcon');
    if (icon) toggleClass(icon, 'on', S.osdLock);
    var label = S.osdLock ? t('unlockOsd') : t('lockOsd');
    var sr = $('mlLockLabel');
    if (sr) sr.textContent = label;
    var btn = $('mlLockBtn');
    if (btn) { btn.setAttribute('aria-label', label); btn.setAttribute('title', label); }
  }

  function chooseTrack(kind, index) {
    var state = P;
    if (!state) return;
    var pos = position();
    if (kind === 'audio') {
      if (index === state.audio) return;
      restartAt(state, pos, index, state.subtitle);
      return;
    }
    if (index === EXT_SUB) {
      if (!state.ext) return;
      state.extOn = true;
      selectSubtitle(state.subtitle);
      fillTracks(state);
      report('progress');
      return;
    }
    state.extOn = false;
    var stream = null;
    var streams = state.source.MediaStreams || [];
    for (var i = 0; i < streams.length; i++) if (streams[i].Index === index) stream = streams[i];
    var wasBurned = currentIsBurned(state);
    if (index === -1 || (stream && stream.DeliveryMethod === 'External' && stream.DeliveryUrl)) {
      state.subtitle = index;
      if (wasBurned) { restartAt(state, pos, state.audio, index); return; }
      selectSubtitle(index);
      fillTracks(state);
      report('progress');
      return;
    }
    // Subtitrare imagine (PGS/DVD/ASS): se arde in flux, deci redarea reporneste de la aceeasi pozitie.
    restartAt(state, pos, state.audio, index);
  }

  function currentIsBurned(state) {
    var streams = state.source.MediaStreams || [];
    for (var i = 0; i < streams.length; i++) {
      if (streams[i].Index === state.subtitle && streams[i].Type === 'Subtitle' && streams[i].DeliveryMethod === 'Encode') return true;
    }
    return false;
  }

  function restartAt(state, ticks, audio, subtitle, quiet) {
    if (state.started && !state.stopped) report('stop');
    state.started = false;
    state.stopped = false;
    if (!quiet) removeClass($('mlSpin'), 'hidden');
    playbackInfo(state, ticks, audio, subtitle);
  }

  function selectSubtitle(index) {
    var tracks = $('mlVideo').querySelectorAll('track');
    // Cu subtitrarea rosub activa, doar pista ei (data-index=ml-ext) se arata; altfel mecanismul obisnuit.
    var ext = P && P.extOn && P.ext;
    for (var i = 0; i < tracks.length; i++) {
      var di = tracks[i].getAttribute('data-index');
      var on = ext ? di === EXT_SUB : (di !== EXT_SUB && parseInt(di, 10) === index);
      if (tracks[i].track) tracks[i].track.mode = on ? 'showing' : 'disabled';
    }
  }

  // --- Taste in player --------------------------------------------------------------------------

  function playerKey(e) {
    var k = e.keyCode;
    if (!P) return false;
    if (!hasClass($('mlChanBox'), 'hidden')) return false; // chenarul de canale: sagetile/OK prin motorul de focus
    if (!hasClass($('mlChapBox'), 'hidden')) return false; // la fel lista de capitole
    var video = $('mlVideo');
    // Volumul: televizoarele trimit coduri diferite (Android 24/25/164, webview 4471/4472, Tizen/webOS proprii).
    if (k === 4471 || k === 24 || e.key === 'VolumeUp' || e.key === 'XF86AudioRaiseVolume') { if (volumeSupported()) { volumeStep(1); return true; } return false; }
    if (k === 4472 || k === 25 || e.key === 'VolumeDown' || e.key === 'XF86AudioLowerVolume') { if (volumeSupported()) { volumeStep(-1); return true; } return false; }
    if (k === 57345 || k === 57346 || k === 164 || e.key === 'VolumeMute' || e.key === 'XF86AudioMute') { if (volumeSupported()) { volumeMute(); return true; } return false; }
    if (k === 415 || e.key === 'MediaPlay') { if (video.paused) togglePause(); return true; }
    if (k === 19 || e.key === 'MediaPause') { if (!video.paused) togglePause(); return true; }
    if (k === 179 || k === 10252 || e.key === 'MediaPlayPause') { togglePause(); return true; }
    if (k === 413 || e.key === 'MediaStop') { closePlayer(true); return true; }
    if (k === 417 || e.key === 'MediaFastForward') { seekBy(30); return true; }
    if (k === 412 || e.key === 'MediaRewind') { seekBy(-10); return true; }
    if (k === 176 || e.key === 'MediaTrackNext') { if (P.live) zap(1); else if (P.next) playNext(); return true; }
    if (k === 177 || e.key === 'MediaTrackPrevious') { if (P.live) zap(-1); else seekTo(0); return true; }
    if (k === KEY.CH_UP || k === KEY.PG_UP || e.key === 'ChannelUp') { if (P.live) zap(1); else if (P.next) playNext(); return true; }
    if (k === KEY.CH_DOWN || k === KEY.PG_DOWN || e.key === 'ChannelDown') { if (P.live) zap(-1); return true; }
    var digit = k >= 48 && k <= 57 ? k - 48 : k >= 96 && k <= 105 ? k - 96 : -1;
    if (digit >= 0 && P.live) { typeDigit(digit); return true; }
    // Colorate in player: rosu = subtitrari, verde = audio, galben = sari peste / episodul urmator, albastru = OSD.
    if (k === KEY.RED || e.key === 'ColorF0Red') { if (!hasClass($('mlSubsBtn'), 'disabled')) openTracks('subtitle'); return true; }
    if (k === KEY.GREEN || e.key === 'ColorF1Green') { if (!hasClass($('mlAudioBtn'), 'disabled')) openTracks('audio'); return true; }
    if (k === KEY.YELLOW || e.key === 'ColorF2Yellow') { if (!hasClass($('mlSkip'), 'hidden')) skipNow(); else if (P.next) playNext(); return true; }
    if (k === KEY.BLUE || e.key === 'ColorF3Blue') {
      // Albastru: deblocheaza OSD-ul; altfel il ascunde (ramane si butonul de blocare din OSD).
      if (S.osdLock) { setOsdLock(false); showOsd(); toast(t('unlockOsd')); }
      else if (osdVisible()) hideOsd();
      else showOsd();
      return true;
    }
    if (!hasClass($('mlTracks'), 'hidden')) {
      if (k === 37 || k === 39) return true;
      return false;
    }
    if (!hasClass($('mlRosub'), 'hidden')) {
      if (k === 37 || k === 39) return true;
      return false;
    }
    var active = document.activeElement;
    var skipFocused = active === $('mlSkip') && !hasClass($('mlSkip'), 'hidden');
    if (!osdVisible()) {
      if (skipFocused && k === 13) return false;
      if (k === 37) { seekStep(-1); return true; }
      if (k === 39) { seekStep(1); return true; }
      if (k === 13) { togglePause(); return true; }
      if (k === 38) {
        if (S.osdLock) return true;
        // Sus: panoul de subtitrari (sau audio); daca nu exista alegere, doar OSD-ul.
        if (!hasClass($('mlSubsBtn'), 'disabled')) openTracks('subtitle');
        else if (!hasClass($('mlAudioBtn'), 'disabled')) openTracks('audio');
        else { showOsd(); focusEl($('mlPlayPause')); }
        return true;
      }
      if (k === 40) { if (S.osdLock) return true; showOsd(); focusEl(visible($('mlBar')) ? $('mlBar') : $('mlPlayPause')); return true; }
      return false;
    }
    // Jos: primul apas arata OSD-ul (ramura de mai sus), al doilea deschide filmstrip-ul capitolelor.
    if (k === 40 && !P.live && hasClass($('mlChapBox'), 'hidden') && chaptersOf(P).length) {
      openChapters();
      return true;
    }
    scheduleOsdHide();
    // Derularea continua cat timp tasta e tinuta (OSD-ul a aparut chiar din derulare) sau focusul e pe bara.
    if ((k === 37 || k === 39) && (active === $('mlBar') || !active || active === document.body || (P.seekTarget !== null && P.seekTarget !== undefined))) { seekStep(k === 37 ? -1 : 1); return true; }
    return false;
  }

  // Derularea cu sagetile: 10 s, iar tinute apasat 30 s, apoi 60 s; pozitia se arata pe bara si se aplica
  // o singura data dupa ce tasta e lasata (fiecare salt cere serverului alt segment).
  function seekStep(dir) {
    if (!P || P.live) return;
    var v = $('mlVideo');
    var now = new Date().getTime();
    if (P.seekDir === dir && now - (P.seekLast || 0) < 450) P.seekReps = (P.seekReps || 0) + 1; else P.seekReps = 0;
    P.seekLast = now;
    P.seekDir = dir;
    var step = P.seekReps < 4 ? 10 : P.seekReps < 12 ? 30 : 60;
    var max = P.duration ? P.duration / TICKS : (v.duration || 0);
    var from = P.seekTarget === null || P.seekTarget === undefined ? (v.currentTime || 0) : P.seekTarget;
    P.seekTarget = Math.max(0, Math.min(max ? max - 1 : from + step, from + dir * step));
    if (!S.osdLock) {
      showOsd();
      if (document.activeElement !== $('mlBar') && visible($('mlBar')) && osdVisible()) focusEl($('mlBar'));
      var hint = $('mlSeekHint');
      hint.textContent = duration(P.seekTarget);
      if (max) { hint.style.left = (P.seekTarget / max * 100) + '%'; $('mlBarFill').style.width = (P.seekTarget / max * 100) + '%'; }
      removeClass(hint, 'hidden');
      $('mlTimePos').textContent = duration(P.seekTarget);
    }
    clearTimeout(P.seekCommit);
    var state = P;
    P.seekCommit = setTimeout(function () {
      if (P !== state || state.seekTarget === null) return;
      var target = state.seekTarget;
      state.seekTarget = null;
      addClass(hint, 'hidden');
      seekTo(target);
    }, 650);
  }

  function fullscreen() {
    var d = document.documentElement;
    var fn = d.requestFullscreen || d.webkitRequestFullscreen;
    if (fn && !isFull()) {
      try { var r = fn.call(d); if (r && r.then) r.then(null, function () { }); } catch (e) { }
    }
  }

  // Ecran complet: butonul din antet (doar daca browserul il permite), tasta F si, venind din Quick Connect (?fs=1) sau pe
  // televizor, primul OK / clic (browserele cer un gest al utilizatorului; ecranul complet nu supravietuieste navigarii).
  function fullApi() { var d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen); }
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function exitFull() {
    var fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn && isFull()) { try { var r = fn.call(document); if (r && r.then) r.then(null, function () { }); } catch (e) { } }
  }
  function toggleFull() { if (isFull()) exitFull(); else fullscreen(); }
  function updateFullBtn() {
    var btn = $('mlFullBtn');
    var osdBtn = $('mlOsdFull');
    var label = isFull() ? t('exitFullScreen') : t('fullScreen');
    if (btn) {
      if (!fullApi()) addClass(btn, 'hidden');
      else removeClass(btn, 'hidden');
      $('mlFullLabel').textContent = label;
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }
    if (osdBtn) {
      if (!fullApi()) addClass(osdBtn, 'hidden');
      else removeClass(osdBtn, 'hidden');
      var sr = $('mlOsdFullLabel');
      if (sr) sr.textContent = label;
      osdBtn.setAttribute('aria-label', label);
      osdBtn.setAttribute('title', label);
    }
    if (isFull()) addClass(document.documentElement, 'is-full'); else removeClass(document.documentElement, 'is-full');
  }
  function wireFull() {
    var btn = $('mlFullBtn');
    if (!btn) return;
    btn.onclick = function (e) { if (e && e.preventDefault) e.preventDefault(); toggleFull(); };
    document.addEventListener('fullscreenchange', updateFullBtn, false);
    document.addEventListener('webkitfullscreenchange', updateFullBtn, false);
    updateFullBtn();
    var wanted = /[?&]fs=1(&|$)/.test(location.search) || TV;
    if (!wanted || !fullApi() || isFull()) return;
    var once = function (e) {
      if (e.type === 'keydown' && e.keyCode !== 13) return;
      document.removeEventListener('click', once, true);
      document.removeEventListener('keydown', once, true);
      fullscreen();
    };
    document.addEventListener('click', once, true);
    document.addEventListener('keydown', once, true);
    toast(t('fullHint'));
  }

  function wirePlayer() {
    $('mlBack').onclick = function () { closePlayer(true); };
    $('mlPlayPause').onclick = togglePause;
    $('mlRew').onclick = function () { seekBy(-10); };
    $('mlFwd').onclick = function () { seekBy(30); };
    $('mlOsdFull').onclick = toggleFull;
    $('mlAudioBtn').onclick = function () { if (!hasClass($('mlAudioBtn'), 'disabled')) openTracks('audio'); };
    $('mlSubsBtn').onclick = function () { if (!hasClass($('mlSubsBtn'), 'disabled')) openTracks('subtitle'); };
    $('mlChanBtn').onclick = openChannels;
    $('mlChapBtn').onclick = function () { if (!hasClass($('mlChapBtn'), 'disabled')) openChapters(); };
    $('mlLockBtn').onclick = function () {
      setOsdLock(true);
      hideOsd();
      toast(t('osdLocked'));
      try { document.activeElement.blur(); } catch (e) { }
    };
    $('mlNextBtn').onclick = function () { playNext(); };
    $('mlSkip').onclick = skipNow;
    $('mlBar').onclick = function (e) {
      if (!P || !e.clientX) return;
      var r = $('mlBar').getBoundingClientRect();
      var dur = P.duration ? P.duration / TICKS : ($('mlVideo').duration || 0);
      if (dur > 0) seekTo((e.clientX - r.left) / r.width * dur);
    };
    var surface = function (e) {
      if (!P) return;
      if (e.target === $('mlVideo') || e.target === $('mlOsd') || hasClass(e.target, 'ml-osd-top') || hasClass(e.target, 'ml-osd-bottom')) {
        if (osdVisible() && !TOUCH) togglePause();
        else if (osdVisible()) hideOsd();
        else showOsd();
      }
    };
    $('mlPlayer').addEventListener('click', surface, false);
    $('mlPlayer').addEventListener('mousemove', function () { if (P) showOsd(); }, false);
    window.addEventListener('pagehide', function () {
      if (P && P.started && !P.stopped) {
        // Fara antete la sendBeacon: tokenul ca parametru (acceptat de ambele servere).
        var body = JSON.stringify({ ItemId: P.item.Id, MediaSourceId: P.source.Id, PlaySessionId: P.playSessionId, PositionTicks: position(), PlayMethod: P.method, LiveStreamId: P.source.LiveStreamId || undefined });
        var url = API + '/Sessions/Playing/Stopped?' + (JELLYFIN ? 'ApiKey' : 'api_key') + '=' + enc(S.token);
        try { if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'application/json' })); } catch (e) { }
        P.stopped = true;
      }
    }, false);
  }

  // ------------------------------------------------------------------------------------------------
  // Pornire
  // ------------------------------------------------------------------------------------------------

  function translateStatic() {
    root.setAttribute('lang', LANG);
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute('data-i18n'));
  }

  function loadViews(done) {
    get(U() + '/Views', function (status, data) {
      S.views = status === 200 ? items(data) : [];
      done();
    }, 300000);
  }

  function fatal(text) {
    removeClass(document.body, 'ml-loading');
    showScreen('mlHome', null);
    errorBox($('mlHome'), text, function () { location.reload(); });
  }

  function boot() {
    var override = modeOverride();
    setTvMode(override === 'tv' || (override !== 'desktop' && !!PLATFORM_TV));
    window.addEventListener('resize', scaleRoot, false);
    registerTizenKeys();
    translateStatic();
    wirePlayer();
    wireFull();
    wireNet();
    setOsdLock(false);
    send('GET', '/System/Info/Public', null, null, function (status, info) {
      if (status !== 200 || !info || !info.Id) { fatal(t('network')); return; }
      S.serverId = info.Id;
      var stored = storedToken();
      if (!stored) { toLauncher(false); return; }
      S.userId = stored.userId;
      S.token = stored.token;
      send('GET', '/Users/' + S.userId, null, S.token, function (s2, user) {
        if (s2 === 401 || s2 === 403 || s2 === 404) { toLauncher(false); return; }
        if (s2 !== 200 || !user) { fatal(t('network')); return; }
        S.user = user;
        migrateProfiles();
        rememberProfile(user);
        avatar($('mlMeAvatar'), user.Id, user.Name, user.PrimaryImageTag);
        loadViews(function () {
          checkLive(function (has) {
            S.hasLive = has;
            toggleClass($('mlNavLive'), 'hidden', !has);
            removeClass(document.body, 'ml-loading');
            window.onhashchange = route;
            route();
          });
        });
      });
    });
  }

  // Pentru testele automate (ui-harness): starea, fara date sensibile.
  window.mlTv = {
    state: function () {
      return { tv: TV, platform: PLATFORM_TV, rootPx: rem(), userId: S.userId, screen: (currentScreen() || {}).id || null, player: !!P, playing: !!(P && P.started), method: P ? P.method : null, live: S.hasLive, segments: P ? P.segments.length : 0, next: !!(P && P.next), quality: P && P.quality ? { bitrate: P.bitrate, step: P.quality.step, measured: P.quality.measured } : null, osd: { chapters: P ? chaptersOf(P).length : 0, volume: volumeSupported() ? Math.round($('mlVideo').volume * 100) : null, muted: volumeSupported() ? $('mlVideo').muted : null, lock: !!S.osdLock }, net: { supported: netInfo.path, running: netInfo.running, mbps: netInfo.mbps } };
    }
  };

  boot();
})();
