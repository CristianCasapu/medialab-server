/*
 * MediaLab TV - lansator pentru televizoarele fara aplicatie Emby / Jellyfin (browserul televizorului).
 *
 * Pagina e servita de plugin pe aceeasi origine cu interfata web a serverului, deci poate scrie direct
 * in localStorage-ul ei. Fluxul:
 *   1. daca interfata web are deja un token valid pentru server -> o deschide;
 *   2. altfel, daca avem contul salvat -> AuthenticateByName, scrie tokenul in formatul interfetei web
 *      (Emby: servercredentials3, Jellyfin: jellyfin_credentials) si o deschide;
 *   3. altfel -> formular de conectare, navigabil din telecomanda, cu „Conectare cu telefonul” si
 *      „Cont nou (de pe telefon)” cand serverul le are.
 *
 * Numele, sigla, culorile si limba vin din setarile plugin-ului (atributele data-* de pe <html>, theme.css).
 * ES5 si XMLHttpRequest: browserele televizoarelor mai vechi nu au fetch/ES6. Acelasi fisier si pe Jellyfin.
 */
(function () {
  'use strict';

  var VERSION = '1.2.0';
  var root = document.documentElement;
  var PLATFORM = root.getAttribute('data-platform') === 'jellyfin' ? 'jellyfin' : 'emby';
  var JELLYFIN = PLATFORM === 'jellyfin';
  var ORIGIN = location.origin || (location.protocol + '//' + location.host);
  var API = ORIGIN + apiPath();
  var WEB = JELLYFIN ? API + '/web/' : API.replace(/\/emby$/i, '') + '/web/index.html';
  // Dupa conectare: interfata MediaLab TV (stil Netflix, browse.html langa aceasta pagina) sau interfata web a serverului.
  var AFTER_UI = root.getAttribute('data-after') !== 'web';
  // ?login=1 (din interfata: „Alt cont” / dupa deconectare): direct formularul, fara conectarea automata.
  var FORCE_LOGIN = /[?&]login=1/.test(location.search || '');
  var CLIENT = root.getAttribute('data-client') || 'MediaLab TV';
  var ACCOUNT_KEY = 'medialabTvAccount';
  // Implicit televizorul pastreaza doar tokenul serverului (nu expira decat daca e revocat) si numele de utilizator;
  // parola doar daca adminul a ales „Tine minte parola pe televizoare” (data-remember=1).
  // Doar pe televizoare (dupa User-Agent): pe un calculator sau telefon parola nu se salveaza niciodata (SECURITY-AUDIT TV-3).
  var REMEMBER = root.getAttribute('data-remember') === '1' && isTvBrowser();
  // Cloudflare Turnstile (setarea adminului): cheia publica a site-ului; gol = conectarea obisnuita (/Users/AuthenticateByName).
  var TS_KEY = root.getAttribute('data-turnstile') || '';
  var CREDENTIALS_KEY = JELLYFIN ? 'jellyfin_credentials' : 'servercredentials3';
  var DEVICE_KEY = '_deviceId2';
  var SPLASH_MS = 1500;

  var KEY_UP = 38, KEY_DOWN = 40, KEY_ENTER = 13;

  var STRINGS = {
    ro: {
      connecting: 'Se conectează…', opening: 'Se deschide…', switchHint: 'Apăsați orice buton pentru alt cont',
      user: 'Utilizator', password: 'Parolă', signIn: 'Conectare', phoneSignIn: 'Conectare cu telefonul', newAccount: 'Cont nou (de pe telefon)',
      savedHint: 'Rămâi conectat pe acest televizor (parola nu se salvează).', savedHintPw: 'Contul (cu parola) se salvează pe acest televizor și conectarea se face automat data viitoare.',
      back: 'Înapoi', retry: 'Reîncearcă', offline: 'Serverul nu răspunde. Verificați conexiunea la internet.',
      wrong: 'Utilizator sau parolă greșită.', failed: 'Conectarea nu a reușit (cod {0}).', enterUser: 'Introduceți utilizatorul.',
      waiting: 'Se așteaptă…', regUnavailable: 'Înregistrarea nu este disponibilă acum.', phoneUnavailable: 'Conectarea cu telefonul nu este disponibilă acum.',
      newTitle: 'Cont nou', newText: 'Scanează codul cu telefonul sau tableta și completează acolo contul (și plata, dacă e cazul).',
      newTextCode: 'Scanează codul cu telefonul sau tableta și completează acolo contul. Codul de mai jos apare deja în formular (dacă nu, scrie-l). Televizorul se conectează singur când contul este activ.',
      code: 'Cod: {0}', regWaiting: 'Se așteaptă completarea pe telefon…', regCreated: 'Contul a fost creat. Se așteaptă plata sau aprobarea…',
      regActive: 'Contul este activ. Introduceți parola aleasă pe telefon.',
      payTitle: 'Abonament', payText: 'Abonamentul nu este activ. Scanează codul cu telefonul sau tableta și alege planul acolo.',
      payWaiting: 'Se așteaptă plata…', paid: 'Plata a fost confirmată.', disabled: 'Contul este dezactivat. Contactați administratorul serverului.', retryLogin: 'Conectarea nu a reușit, încercați din nou.',
      phoneTitle: 'Conectare cu telefonul', phoneText: 'Scanează codul cu telefonul și aprobă conectarea (cu contul tău).',
      phoneTextNoQr: 'Pe telefon, în aplicația Jellyfin: Setări → Quick Connect, apoi scrie codul de mai jos.',
      phoneWaiting: 'Se așteaptă aprobarea de pe telefon…', expired: 'Codul a expirat. Se cere altul…',
      botCheck: 'Verificarea anti-robot nu a reușit. Încercați din nou.', botWait: 'Confirmați că nu sunteți robot (mai jos), apoi apăsați Conectare.',
      tooMany: 'Prea multe încercări. Așteptați câteva minute.',
      footer: JELLYFIN ? 'Aplicație neoficială, compatibilă cu serverele Jellyfin' : 'Aplicație neoficială, compatibilă cu serverele Emby'
    },
    en: {
      connecting: 'Connecting…', opening: 'Opening…', switchHint: 'Press any button for another account',
      user: 'Username', password: 'Password', signIn: 'Sign in', phoneSignIn: 'Sign in with your phone', newAccount: 'New account (from your phone)',
      savedHint: 'You stay signed in on this TV (the password is not stored).', savedHintPw: 'The account (with the password) is saved on this TV and you are signed in automatically next time.',
      back: 'Back', retry: 'Retry', offline: 'The server is not responding. Check the internet connection.',
      wrong: 'Wrong username or password.', failed: 'Sign-in failed (code {0}).', enterUser: 'Enter the username.',
      waiting: 'Waiting…', regUnavailable: 'Sign-up is not available right now.', phoneUnavailable: 'Phone sign-in is not available right now.',
      newTitle: 'New account', newText: 'Scan the code with your phone or tablet and create the account there (and pay, if needed).',
      newTextCode: 'Scan the code with your phone or tablet and create the account there. The code below is already filled in on the form (if not, type it). The TV signs in by itself once the account is active.',
      code: 'Code: {0}', regWaiting: 'Waiting for the form on the phone…', regCreated: 'The account was created. Waiting for payment or approval…',
      regActive: 'The account is active. Enter the password you chose on the phone.',
      payTitle: 'Subscription', payText: 'The subscription is not active. Scan the code with your phone or tablet and choose a plan there.',
      payWaiting: 'Waiting for payment…', paid: 'Payment confirmed.', disabled: 'The account is disabled. Contact the server administrator.', retryLogin: 'Sign-in failed, please try again.',
      phoneTitle: 'Sign in with your phone', phoneText: 'Scan the code with your phone and approve the sign-in (with your account).',
      phoneTextNoQr: 'On your phone, in the Jellyfin app: Settings → Quick Connect, then enter the code below.',
      phoneWaiting: 'Waiting for approval on the phone…', expired: 'The code expired. Requesting a new one…',
      botCheck: 'The anti-bot check failed. Please try again.', botWait: 'Confirm that you are not a robot (below), then press Sign in.',
      tooMany: 'Too many attempts. Please wait a few minutes.',
      footer: JELLYFIN ? 'Unofficial app, compatible with Jellyfin servers' : 'Unofficial app, compatible with Emby servers'
    }
  };
  var LANG = pickLanguage();

  var serverInfo = null;
  var splashTimer = null;
  var interrupted = false;
  var features = { phone: false, phoneQr: false, register: false };

  function $(id) { return document.getElementById(id); }

  function t(key, arg) {
    var s = STRINGS[LANG][key] || STRINGS.en[key] || key;
    return arg === undefined ? s : s.replace('{0}', arg);
  }

  // Emby: /<prefix>/emby/MediaLabTv/index.html -> /<prefix>/emby. Jellyfin: calea de baza a serverului (data-api).
  function apiPath() {
    if (JELLYFIN) return (root.getAttribute('data-api') || '').replace(/\/+$/, '');
    var path = location.pathname || '';
    var at = path.indexOf('/MediaLabTv/');
    return at > 0 ? path.substring(0, at) : '/emby';
  }

  // Aceeasi detectie ca modul TV din browse.js (doar User-Agent-ul, fara ?tv=1).
  function isTvBrowser() {
    var ua = navigator.userAgent || '';
    var touch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
    if (/Tizen|Web0S|webOS|NetCast|NETTV|Saphi|Philips|HbbTV|SMART-TV|SmartTV|CrKey|AppleTV|Roku|AFT[A-Z]|VIDAA|Hisense/i.test(ua)) return true;
    if (/Android/i.test(ua) && /\bTV\b|BRAVIA|MiTV|MIBOX|Chromecast|GoogleTV|Google TV|SHIELD/i.test(ua)) return true;
    return /Android/i.test(ua) && !touch && Math.max(screen.width, screen.height) >= 1280;
  }

  function pickLanguage() {
    var set = root.getAttribute('data-lang');
    if (set === 'ro' || set === 'en') return set;
    var nav = ((navigator.languages && navigator.languages[0]) || navigator.language || navigator.userLanguage || 'en').toLowerCase();
    return nav.indexOf('ro') === 0 ? 'ro' : 'en';
  }

  function translate() {
    root.setAttribute('lang', LANG);
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute('data-i18n'));
    if (root.getAttribute('data-footer') !== '1') $('footer').textContent = t('footer');
    var hint = document.querySelector('[data-i18n="savedHint"]');
    if (hint && REMEMBER) hint.textContent = t('savedHintPw');
  }

  function show(id) {
    var screens = ['splash', 'login', 'offline', 'qr'];
    for (var i = 0; i < screens.length; i++) {
      var el = $(screens[i]);
      var extra = screens[i] === 'qr' && el.className.indexOf('noimg') >= 0 ? ' noimg' : '';
      el.className = (screens[i] === id ? 'screen' : 'screen hidden') + extra;
    }
    // Formularul nu incape sub antetul mare pe un ecran de 720p.
    document.body.className = id === 'login' ? 'compact' : id === 'qr' ? 'qrmode' : '';
    if (id !== 'qr') stopQr();
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

  // Acelasi DeviceId ca interfata web, ca tokenul sa apartina dispozitivului pe care il va folosi.
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

  function request(method, path, body, token, done) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, API + path, true);
    xhr.timeout = 15000;
    var auth = 'Client="' + quote(CLIENT) + '", Device="Smart TV", DeviceId="' + deviceId() + '", Version="' + VERSION + '"';
    if (JELLYFIN) {
      xhr.setRequestHeader('Authorization', 'MediaBrowser ' + auth + (token ? ', Token="' + token + '"' : ''));
    } else {
      xhr.setRequestHeader('X-Emby-Authorization', 'Emby UserId="", ' + auth);
      if (token) xhr.setRequestHeader('X-Emby-Token', token);
    }
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) { }
      done(xhr.status, data);
    };
    xhr.ontimeout = function () { };
    xhr.send(body ? JSON.stringify(body) : null);
  }

  function openWeb() {
    $('status').textContent = t('opening');
    location.replace(AFTER_UI ? 'browse.html' : WEB);
  }

  function findServer(credentials) {
    var servers = (credentials && credentials.Servers) || [];
    for (var i = 0; i < servers.length; i++) {
      if (servers[i].Id === serverInfo.Id) return servers[i];
    }
    return null;
  }

  function storedToken() {
    var server = findServer(readJson(CREDENTIALS_KEY));
    if (!server || !server.UserId) return null;
    var users = server.Users || [];
    for (var i = 0; i < users.length; i++) {
      if (users[i].UserId === server.UserId && users[i].AccessToken) {
        return { userId: server.UserId, token: users[i].AccessToken };
      }
    }
    return server.AccessToken ? { userId: server.UserId, token: server.AccessToken } : null;
  }

  // Scrie rezultatul conectarii exact cum il scrie interfata web dupa un login normal.
  function saveCredentials(auth) {
    var credentials = readJson(CREDENTIALS_KEY) || {};
    if (!credentials.Servers) credentials.Servers = [];
    var server = findServer(credentials);
    if (!server) {
      server = JELLYFIN ? { Id: serverInfo.Id } : { Id: serverInfo.Id, Type: 'Server' };
      credentials.Servers.push(server);
    }
    server.Name = serverInfo.ServerName;
    server.ManualAddress = JELLYFIN ? API : ORIGIN;
    if (!JELLYFIN) server.ManualAddressOnly = true;
    server.LastConnectionMode = 2;
    server.DateLastAccessed = new Date().getTime();
    server.UserId = auth.User.Id;
    server.AccessToken = auth.AccessToken;
    if (!JELLYFIN) {
      var users = server.Users || [];
      var found = false;
      for (var i = 0; i < users.length; i++) {
        if (users[i].UserId === auth.User.Id) {
          users[i].AccessToken = auth.AccessToken;
          found = true;
        }
      }
      if (!found) users.push({ UserId: auth.User.Id, AccessToken: auth.AccessToken });
      server.Users = users;
    }
    writeJson(CREDENTIALS_KEY, credentials);
  }

  // Doar numele (pentru formular) si, numai cu setarea adminului, parola.
  function saveAccount(username, password) {
    writeJson(ACCOUNT_KEY, REMEMBER && password ? { username: username, password: password } : { username: username });
  }

  function showButtons() {
    $('phone').className = features.phone ? 'nav secondary' : 'nav secondary hidden';
    $('register').className = features.register ? 'nav secondary' : 'nav secondary hidden';
  }

  function showLogin(message, username) {
    var account = readJson(ACCOUNT_KEY);
    $('user').value = username || (account ? account.username : '');
    $('pass').value = '';
    $('error').textContent = message || '';
    $('error').className = message ? 'error' : 'error hidden';
    showButtons();
    show('login');
    ($('user').value ? $('pass') : $('user')).focus();
  }

  function showOffline(text) {
    $('offlineText').textContent = text;
    show('offline');
    $('retry').focus();
  }

  // --- Cloudflare Turnstile (optional): widget „interaction-only”, vizibil doar cand Cloudflare cere o interactiune ---

  var ts = { id: null, token: null, waiting: [], loading: false, ready: false, busy: false, pending: null };

  function tsLoad() {
    if (ts.loading) return;
    ts.loading = true;
    window.mlTurnstileReady = tsRender;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=mlTurnstileReady';
    s.async = true;
    s.onerror = function () { ts.loading = false; tsFlush(null); };
    document.getElementsByTagName('head')[0].appendChild(s);
  }

  function tsRender() {
    if (ts.ready || !window.turnstile) return;
    ts.ready = true;
    ts.busy = true;
    ts.id = window.turnstile.render($('tsBox'), {
      sitekey: TS_KEY,
      action: 'tv-login',
      appearance: 'interaction-only',
      language: LANG,
      callback: function (token) { ts.busy = false; ts.token = token; tsInteractive(false); tsFlush(token); },
      'expired-callback': function () { ts.token = null; },
      'error-callback': function () { ts.busy = false; ts.token = null; tsFlush(null); return true; },
      'before-interactive-callback': function () { tsInteractive(true); },
      'after-interactive-callback': function () { tsInteractive(false); }
    });
  }

  function tsFlush(token) {
    var waiting = ts.waiting;
    ts.waiting = [];
    if (token) ts.token = null;
    for (var i = 0; i < waiting.length; i++) waiting[i](token);
  }

  // Un token Turnstile se foloseste o singura data: dupa fiecare incercare se cere altul.
  function tsToken(done) {
    if (ts.token) {
      var token = ts.token;
      ts.token = null;
      done(token);
      return;
    }
    // O singura cerere in asteptare: o noua apasare pe „Conectare” o inlocuieste pe cea veche.
    ts.waiting = [done];
    if (!ts.ready) { tsLoad(); return; }
    if (ts.busy) return;
    tsReset();
  }

  function tsReset() {
    ts.busy = true;
    try { window.turnstile.reset(ts.id); } catch (e) { ts.busy = false; tsFlush(null); }
  }

  // Dupa o incercare se pregateste deja tokenul urmator (invizibil, de obicei fara interactiune).
  function tsAfterUse() {
    if (ts.ready && !ts.token && !ts.busy) tsReset();
  }

  // Cand Cloudflare cere o interactiune: caseta apare in formular, intre parola si „Conectare”, si primeste focusul
  // telecomenzii (sagetile o ating ca pe orice camp; OK intra in ea).
  function tsInteractive(on) {
    var box = $('tsBox');
    box.className = on ? 'ts nav' : 'ts hidden';
    if (on) {
      box.setAttribute('tabindex', '0');
      if ($('login').className.indexOf('hidden') >= 0) {
        var p = ts.pending;
        showLogin(t('botWait'), p ? p.username : '');
        if (p) $('pass').value = p.password || '';
      } else {
        $('error').textContent = t('botWait');
        $('error').className = 'error';
      }
      box.focus();
    } else {
      box.setAttribute('tabindex', '-1');
      if (document.activeElement === box) $('submit').focus();
    }
  }

  // Cadrul Cloudflare e de obicei intr-un shadow root inchis: atunci focusul intra in el prin navigarea nativa a
  // browserului (Tab / OK pe televizor, cursorul Magic Remote); daca e accesibil, il focusam direct.
  function focusTurnstile() {
    var frame = $('tsBox').getElementsByTagName('iframe')[0];
    if (frame) { try { frame.focus(); return true; } catch (e) { } }
    return false;
  }

  function authenticate(username, password, done) {
    if (!TS_KEY) {
      request('POST', '/Users/AuthenticateByName', { Username: username, Pw: password }, null, done);
      return;
    }
    ts.pending = { username: username, password: password };
    tsToken(function (token) {
      if (!token) { done(-1, null); return; }
      ts.pending = null;
      request('POST', '/MediaLabTv/Login', { Username: username, Pw: password, Turnstile: token }, null, function (status, data) {
        tsAfterUse();
        done(status, data);
      });
    });
  }

  function login(username, password) {
    var onFail = function (message) { showLogin(message, username); };
    $('status').textContent = t('connecting');
    show('splash');
    authenticate(username, password, function (status, data) {
      if (status === -1 || (status === 400 && data && data.Error === 'turnstile')) {
        onFail(t('botCheck'));
      } else if (status === 429) {
        onFail(t('tooMany'));
      } else if (status === 200 && data && data.AccessToken) {
        saveAccount(username, password);
        saveCredentials(data);
        openWeb();
      } else if (status === 403 && !JELLYFIN) {
        // Parola e corecta, dar contul e dezactivat: abonament expirat (Cashier) sau cerere neaprobata.
        startPayment(username, password);
      } else if (status === 401 || status === 403) {
        onFail(t('wrong'));
      } else if (status === 0) {
        showOffline(t('offline'));
      } else {
        onFail(t('failed', status));
      }
    });
  }

  // --- Cod QR: cont nou, plata sau conectarea cu telefonul; televizorul se conecteaza singur la final ---

  var qrTimer = null;

  function stopQr() {
    if (qrTimer) { clearTimeout(qrTimer); qrTimer = null; }
  }

  function showQr(title, text, image, code) {
    $('qrTitle').textContent = title;
    $('qrText').textContent = text;
    if (image) $('qrImage').src = image; else $('qrImage').removeAttribute('src');
    $('qr').className = 'screen' + (image ? '' : ' noimg');
    $('qrCode').textContent = code || '';
    $('qrState').textContent = t('waiting');
    show('qr');
    $('qrBack').focus();
  }

  // Ce ofera serverul: Inregistrare (cont nou), Quick Connect (conectare cu telefonul).
  function checkFeatures() {
    if (root.getAttribute('data-register') === '1') {
      request('GET', '/Registration/Status', null, null, function (status, data) {
        features.register = status === 200 && !!data && !!data.Enabled;
        if (JELLYFIN && features.register) checkJellyfinQuickConnect(function () { });
        showButtons();
      });
    }
    if (root.getAttribute('data-phone') !== '1') return;
    if (JELLYFIN) {
      checkJellyfinQuickConnect(function (enabled) { features.phone = enabled; showButtons(); });
    } else {
      request('GET', '/QuickConnect/Status', null, null, function (status, data) {
        features.phone = status === 200 && !!data && !!data.Enabled;
        showButtons();
      });
    }
  }

  // Jellyfin: Quick Connect nativ (codul de 6 cifre) si, daca e instalat, pagina telefonului din „Quick Connect by MediaLab”.
  var jfQuickConnect = null;
  function checkJellyfinQuickConnect(done) {
    request('GET', '/QuickConnect/Enabled', null, null, function (status, data) {
      jfQuickConnect = status === 200 && data === true;
      if (!jfQuickConnect) { features.register = false; showButtons(); done(false); return; }
      request('GET', '/Connect/Status', null, null, function (s2, d2) {
        features.phoneQr = s2 === 200 && !!d2 && !!d2.Enabled;
        done(true);
      });
    });
  }

  // --- Emby ---------------------------------------------------------------------------------

  function startRegistration() {
    if (JELLYFIN) { startJellyfinCode('register'); return; }
    // DeviceId-ul televizorului: sesiunea creata de Inregistrare la final apartine acestui dispozitiv.
    request('POST', '/Registration/Handoff/Start', { Lang: LANG, DeviceId: deviceId(), DeviceName: 'Smart TV' }, null, function (status, data) {
      if (status !== 200 || !data || !data.Id) {
        showLogin(t('regUnavailable'));
        return;
      }
      showQr(t('newTitle'), t('newText'), API + '/Registration/' + data.Qr, t('code', data.Id));
      pollRegistration(data.Id, data.PollKey);
    });
  }

  function pollRegistration(id, key) {
    qrTimer = setTimeout(function () {
      request('POST', '/Registration/Handoff/Poll', { Id: id, PollKey: key }, null, function (status, data) {
        if (!qrTimer) return;
        var state = status === 200 && data ? data.Status : 'retry';
        if (state === 'active' && data.AccessToken && data.UserId) {
          // Registration 1.10.8+: sesiunea noua, creata de server (parola nu mai ajunge la televizor).
          stopQr();
          saveAccount(data.Username, null);
          saveCredentials({ AccessToken: data.AccessToken, User: { Id: data.UserId } });
          openWeb();
        } else if (state === 'active' && data.Password) {
          // Registration mai vechi: parola, o singura data.
          stopQr();
          login(data.Username, data.Password);
        } else if (state === 'active' || state === 'done') {
          stopQr();
          showLogin(t('regActive'), data.Username);
        } else if (state === 'expired') {
          startRegistration();
        } else {
          $('qrState').textContent = state === 'created' ? t('regCreated') : t('regWaiting');
          pollRegistration(id, key);
        }
      });
    }, 3000);
  }

  function startPayment(username, password) {
    request('POST', '/Cashier/TvLink', { Username: username, Password: password, Lang: LANG }, null, function (status, data) {
      if (status !== 200 || !data || !data.Token) {
        showLogin(data && data.Error === 'active' ? t('retryLogin') : t('disabled'), username);
        return;
      }
      showQr(t('payTitle'), t('payText'), API + '/Cashier/' + data.Qr, '');
      pollPayment(data.Token, username, password);
    });
  }

  function pollPayment(token, username, password) {
    qrTimer = setTimeout(function () {
      request('GET', '/Cashier/Info?t=' + encodeURIComponent(token), null, null, function (status, data) {
        if (!qrTimer) return;
        if (status === 200 && data && data.Account && data.Account.Access !== 'suspended') {
          stopQr();
          $('qrState').textContent = t('paid');
          login(username, password);
          return;
        }
        $('qrState').textContent = t('payWaiting');
        pollPayment(token, username, password);
      });
    }, 3000);
  }

  // Emby: ecranul plugin-ului Quick Connect (dupa aprobare deschide adresa setata acolo, ex. aceasta aplicatie).
  function startPhone() {
    if (JELLYFIN) { startJellyfinCode('phone'); return; }
    location.href = API + '/QuickConnect/Screen';
  }

  // --- Jellyfin: Quick Connect nativ ----------------------------------------------------------

  function formatCode(code) {
    code = String(code || '');
    return code.length === 6 ? code.slice(0, 3) + ' ' + code.slice(3) : code;
  }

  function startJellyfinCode(mode) {
    request('POST', '/QuickConnect/Initiate', null, null, function (status, data) {
      if (status !== 200 || !data || !data.Secret) {
        showLogin(mode === 'register' ? t('regUnavailable') : t('phoneUnavailable'));
        return;
      }
      if (mode === 'register') {
        showQr(t('newTitle'), t('newTextCode'), API + '/Registration/Qr?code=' + encodeURIComponent(data.Code), t('code', formatCode(data.Code)));
      } else if (features.phoneQr) {
        showQr(t('phoneTitle'), t('phoneText'), API + '/Connect/Qr?code=' + encodeURIComponent(data.Code), t('code', formatCode(data.Code)));
      } else {
        showQr(t('phoneTitle'), t('phoneTextNoQr'), null, formatCode(data.Code));
      }
      $('qrState').textContent = mode === 'register' ? t('regWaiting') : t('phoneWaiting');
      pollJellyfinCode(data.Secret, mode, new Date().getTime());
    });
  }

  function pollJellyfinCode(secret, mode, started) {
    qrTimer = setTimeout(function () {
      request('GET', '/QuickConnect/Connect?secret=' + encodeURIComponent(secret), null, null, function (status, data) {
        if (!qrTimer) return;
        if (status === 200 && data && data.Authenticated) {
          stopQr();
          request('POST', '/Users/AuthenticateWithQuickConnect', { Secret: secret }, null, function (s2, auth) {
            if (s2 === 200 && auth && auth.AccessToken) {
              saveCredentials(auth);
              openWeb();
            } else {
              showLogin(t('failed', s2));
            }
          });
          return;
        }
        // Codul Jellyfin expira (implicit 10 minute): se cere altul, fara sa iesim din ecran.
        if (status === 404 || (status !== 200 && status !== 0) || new Date().getTime() - started > 9 * 60 * 1000) {
          $('qrState').textContent = t('expired');
          stopQr();
          startJellyfinCode(mode);
          return;
        }
        pollJellyfinCode(secret, mode, started);
      });
    }, 3000);
  }

  // --- Pornire ----------------------------------------------------------------------------------

  function autoConnect() {
    $('hint').className = 'hint hidden';
    if (interrupted) return;
    var existing = storedToken();
    var account = readJson(ACCOUNT_KEY);
    var password = account && account.password ? account.password : null;
    var name = account ? account.username : '';
    if (existing) {
      request('GET', '/Users/' + existing.userId, null, existing.token, function (status) {
        if (status === 200) {
          // Actualizare de la 1.1: tokenul ajunge, parola salvata se sterge (daca adminul nu a cerut altfel).
          if (password && !REMEMBER) saveAccount(name, null);
          openWeb();
        } else if (status === 0) showOffline(t('offline'));
        else if (password) login(name, password);
        else showLogin('', name);
      });
    } else if (password) {
      // Actualizare de la 1.1 (sau parola tinuta minte): o conectare, apoi doar tokenul.
      login(name, password);
    } else {
      showLogin('', name);
    }
  }

  function start() {
    show('splash');
    $('status').textContent = t('connecting');
    request('GET', '/System/Info/Public', null, null, function (status, data) {
      if (status !== 200 || !data || !data.Id) {
        showOffline(t('offline'));
        return;
      }
      serverInfo = data;
      checkFeatures();
      var saved = readJson(ACCOUNT_KEY);
      if (FORCE_LOGIN || (!(saved && saved.password) && !storedToken())) {
        showLogin('', saved ? saved.username : '');
        return;
      }
      // Scurta fereastra in care orice buton duce la ecranul de cont (schimbare de cont).
      $('hint').className = 'hint';
      splashTimer = setTimeout(autoConnect, SPLASH_MS);
    });
  }

  // Navigare cu sagetile intre campuri si butoane.
  function moveFocus(step) {
    var screen = document.querySelector('.screen:not(.hidden)');
    if (!screen) return;
    var all = screen.querySelectorAll('.nav');
    var items = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].className.indexOf('hidden') < 0) items.push(all[i]);
    }
    var index = -1;
    for (var j = 0; j < items.length; j++) {
      if (items[j] === document.activeElement) index = j;
    }
    var next = items[Math.max(0, Math.min(items.length - 1, index + step))];
    if (next) next.focus();
  }

  function requestFullscreen() {
    var el = document.documentElement;
    var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (fn && !(document.fullscreenElement || document.webkitFullscreenElement)) {
      try {
        var result = fn.call(el);
        if (result && result.then) result.then(null, function () { });
      } catch (e) { }
    }
  }

  document.addEventListener('keydown', function (e) {
    var key = e.keyCode;
    if (splashTimer && $('hint').className === 'hint') {
      clearTimeout(splashTimer);
      splashTimer = null;
      interrupted = true;
      $('hint').className = 'hint hidden';
      showLogin();
      e.preventDefault();
      return;
    }
    if ((key === 8 || key === 27 || key === 461 || key === 10009) && $('qr').className.indexOf('hidden') < 0) {
      stopQr(); showLogin(); e.preventDefault(); return;
    }
    if (key === KEY_UP) { moveFocus(-1); e.preventDefault(); }
    else if (key === KEY_DOWN) { moveFocus(1); e.preventDefault(); }
    else if (key === KEY_ENTER && document.activeElement === $('user')) { $('pass').focus(); e.preventDefault(); }
  }, false);

  document.addEventListener('click', requestFullscreen, false);

  $('login').onsubmit = function (e) {
    e.preventDefault();
    requestFullscreen();
    var username = $('user').value.replace(/^\s+|\s+$/g, '');
    if (!username) {
      $('error').textContent = t('enterUser');
      $('error').className = 'error';
      $('user').focus();
      return false;
    }
    login(username, $('pass').value);
    return false;
  };

  $('retry').onclick = function () { interrupted = false; start(); };
  $('tsBox').onfocus = focusTurnstile;
  $('tsBox').onkeydown = function (e) { if (e.keyCode === KEY_ENTER && focusTurnstile()) e.preventDefault(); };
  $('register').onclick = function () { startRegistration(); };
  $('phone').onclick = function () { startPhone(); };
  $('qrBack').onclick = function () { stopQr(); showLogin(); };

  translate();
  if (TS_KEY) tsLoad();
  start();
})();
