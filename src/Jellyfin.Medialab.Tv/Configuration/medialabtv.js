// medialab Server (builtin-tv): configurarea MediaLab TV e a serverului, nu a unui plugin.
function mltvGetConfig() { return ApiClient.getJSON(ApiClient.getUrl('MediaLabTv/Admin/Configuration')); }
function mltvSaveConfig(c) { return ApiClient.ajax({ type: 'POST', url: ApiClient.getUrl('MediaLabTv/Admin/Configuration'), data: JSON.stringify(c), contentType: 'application/json' }); }
// Pagina de configurare Jellyfin (modul ES): Jellyfin Web o porneste cu `new default(view, params)`.
const PID = '690b15d6-5a98-4abb-bf1a-bffaecfc48d5';
const STRINGS = {
    ro: {
        license: 'Licență', save: 'Salvează', saved: 'Salvat.', apply: 'Aplică', applied: 'Aplicat.',
        intro: 'Aplicația pentru televizoarele fără aplicație Jellyfin: se deschide în browserul televizorului, se conectează singură cu contul salvat sau cu telefonul (Quick Connect), apoi deschide interfața proprie în stil Netflix (sau Jellyfin Web). Cont nou de pe telefon cu Registration by MediaLab. Numele, sigla, culorile, limba și adresa sunt ale tale.',
        noLicense: 'Fără licență valabilă, televizoarele văd doar un ecran neutru „Serviciul nu este disponibil”.',
        addressTitle: 'Adresa pentru televizoare', addressText: 'Deschide una dintre adrese în browserul televizorului (o dată; apoi o poți salva ca pagină de start / favorit).',
        qcHint: 'Conectarea cu telefonul folosește Quick Connect din Jellyfin (Panou → General → Quick Connect pornit). Cu Quick Connect by MediaLab instalat, ecranul arată și un cod QR spre pagina de aprobare de pe telefon.',
        brandTitle: 'Branding', name: 'Numele aplicației (titlul de pe televizor)', short: 'Numele scurt', shortText: 'Apare în lista de dispozitive a serverului (client) și ca nume al aplicației salvate pe televizor.',
        tagline: 'Rândul de sub nume (ex. adresa site-ului; opțional)', footer: 'Rândul din subsol (ex. suport; opțional)', footerText: 'Gol = „Aplicație neoficială, compatibilă cu serverele Jellyfin” (în limba televizorului).',
        colors: 'Culori', accent: 'accent (butoane, focus)', background: 'fundal', language: 'Limba aplicației', langAuto: 'Automat (limba televizorului)',
        logo: 'Sigla (PNG sau SVG, cel mult 512 KB; pătrată arată cel mai bine)', logoReset: 'Sigla implicită', logoText: 'Se folosește și ca iconiță a paginii.', logoBad: 'Sigla trebuie să fie PNG sau SVG (fără scripturi), cel mult 512 KB.',
        phone: 'Butonul „Conectare cu telefonul” (când Quick Connect este pornit în Jellyfin)', register: 'Butonul „Cont nou (de pe telefon)” (când Registration by MediaLab este instalat și deschis, cu Quick Connect pornit)',
        preview: 'Previzualizare', signIn: 'Conectare', defaultFooter: 'Aplicație neoficială, compatibilă cu serverele Jellyfin',
        badColor: 'Culorile trebuie să fie de forma #rrggbb.', badName: 'Numele nu poate fi gol.',
        pathTitle: 'Calea de acces', pathText: 'O adresă scurtă sub interfața web Jellyfin, ex. /web/tv/, care arată aplicația. Plugin-ul o servește direct (nu scrie nimic în fișierele Jellyfin), deci rămâne și după actualizările Jellyfin. Gol = doar /MediaLabTv/.',
        path: 'Calea', badSlug: 'Calea poate avea doar litere mici, cifre, „-” și „_” (cel mult 40).',
        stateCurrent: 'Calea este activă: ', stateConflict: 'Calea există deja în interfața web Jellyfin și nu se acoperă; alege alta: ', stateOff: 'Fără cale proprie: televizoarele folosesc /MediaLabTv/.',
        after: 'După conectare se deschide', afterUi: 'Interfața MediaLab TV (stil Netflix)', afterWeb: 'Jellyfin Web',
        afterText: 'Interfața MediaLab TV: acasă cu banner și rânduri (continuă vizionarea, adăugate recent, genuri, colecții, TV în direct), pagina titlului, căutare, profiluri și player, gândite pentru telecomandă. Jellyfin Web rămâne la un clic, din meniul profilului.',
        liveRows: 'Rândurile de TV în direct în interfața MediaLab TV (când serverul are canale)',
        remember: 'Ține minte parola pe televizoare (implicit oprit)', rememberText: 'Confidențialitate: implicit, după conectare televizorul păstrează doar tokenul de acces al serverului (nu expiră decât dacă îl revoci din Dispozitive) și numele de utilizator; parola nu se salvează. Pornește doar pentru televizoarele al căror browser pierde tokenul: parola rămâne atunci în clar în memoria browserului televizorului.',
        rememberWarn: 'Atenție: cu această opțiune parola fiecărui cont conectat pe televizor se păstrează NECRIPTATĂ în memoria browserului televizorului (localStorage); oricine are acces la televizor sau un script pe aceeași adresă o poate citi. Se aplică doar în browserele de televizor (Tizen, webOS, Android TV, Philips etc.), niciodată pe calculatoare sau telefoane.',
        secTitle: 'Securitate la conectare',
        tsOn: 'Verificare anti-robot Cloudflare Turnstile pe pagina de conectare a televizorului (implicit oprit)',
        tsText: 'Pagina de conectare încarcă widgetul Turnstile (invizibil; o casetă apare doar când Cloudflare cere o confirmare, iar telecomanda ajunge la ea cu săgețile) și trimite parola prin /MediaLabTv/Login, care verifică tokenul la Cloudflare (cu IP-ul clientului) și limitează încercările pe IP. Important: /Users/AuthenticateByName al serverului rămâne accesibil, deci Turnstile este o frână anti-robot pentru această pagină, nu o barieră pentru tot serverul. Cheile se creează în Cloudflare → Turnstile (widget „Managed”, cu domeniul serverului).',
        tsReg: 'Folosește cheile din Înregistrare (plugin-ul Registration)', tsRegOk: 'Înregistrarea are chei Turnstile: se folosesc acestea.', tsRegNoKeys: 'Înregistrarea este instalată, dar nu are chei Turnstile setate.', tsRegMissing: 'Plugin-ul Înregistrare (cu chei partajate) nu este instalat sau este o versiune mai veche.',
        tsSite: 'Cheia site-ului (site key)', tsSecret: 'Cheia secretă (secret key; se păstrează criptată pe server)',
        tsActive: 'Turnstile este activ pe pagina de conectare.', tsActiveTest: 'Turnstile este activ cu cheile de TEST Cloudflare (doar pentru probe).', tsInactive: 'Turnstile este pornit, dar lipsesc cheile: pagina se conectează ca până acum.', tsOff: 'Turnstile este oprit.'
    },
    en: {
        license: 'License', save: 'Save', saved: 'Saved.', apply: 'Apply', applied: 'Applied.',
        intro: 'The app for TVs without a Jellyfin app: it opens in the TV browser, signs in by itself with the saved account or with the phone (Quick Connect), then opens its own Netflix-style interface (or Jellyfin Web). New account from the phone with Registration by MediaLab. The name, logo, colours, language and address are yours.',
        noLicense: 'Without a valid license, TVs only see a neutral "This service is unavailable" screen.',
        addressTitle: 'Address for TVs', addressText: 'Open one of these addresses in the TV browser (once; then save it as the start page / a favourite).',
        qcHint: 'Sign-in with the phone uses Jellyfin Quick Connect (Dashboard → General → Quick Connect on). With Quick Connect by MediaLab installed, the screen also shows a QR code to the approval page on the phone.',
        brandTitle: 'Branding', name: 'App name (title on the TV)', short: 'Short name', shortText: 'Shown in the server\'s device list (client) and as the name of the app saved on the TV.',
        tagline: 'Line under the name (e.g. your website; optional)', footer: 'Footer line (e.g. support; optional)', footerText: 'Empty = "Unofficial app, compatible with Jellyfin servers" (in the TV\'s language).',
        colors: 'Colours', accent: 'accent (buttons, focus)', background: 'background', language: 'App language', langAuto: 'Automatic (TV language)',
        logo: 'Logo (PNG or SVG, at most 512 KB; square looks best)', logoReset: 'Default logo', logoText: 'Also used as the page icon.', logoBad: 'The logo must be PNG or SVG (no scripts), at most 512 KB.',
        phone: '"Sign in with your phone" button (when Quick Connect is on in Jellyfin)', register: '"New account (from your phone)" button (when Registration by MediaLab is installed and open, with Quick Connect on)',
        preview: 'Preview', signIn: 'Sign in', defaultFooter: 'Unofficial app, compatible with Jellyfin servers',
        badColor: 'Colours must look like #rrggbb.', badName: 'The name cannot be empty.',
        pathTitle: 'Access path', pathText: 'A short address under the Jellyfin web interface, e.g. /web/tv/, showing the app. The plugin serves it directly (it writes nothing to the Jellyfin files), so it stays after Jellyfin updates. Empty = /MediaLabTv/ only.',
        path: 'Path', badSlug: 'The path may only contain lowercase letters, digits, "-" and "_" (at most 40).',
        stateCurrent: 'The path is active: ', stateConflict: 'The path already exists in the Jellyfin web interface and is not covered; choose another: ', stateOff: 'No own path: TVs use /MediaLabTv/.',
        after: 'After sign-in, open', afterUi: 'The MediaLab TV interface (Netflix-style)', afterWeb: 'Jellyfin Web',
        afterText: 'The MediaLab TV interface: home with a billboard and rows (continue watching, recently added, genres, collections, live TV), title pages, search, profiles and a player, built for the remote. Jellyfin Web stays one click away, in the profile menu.',
        liveRows: 'Live TV rows in the MediaLab TV interface (when the server has channels)',
        remember: 'Remember the password on TVs (off by default)', rememberText: 'Privacy: by default, after sign-in the TV keeps only the server access token (it does not expire unless you revoke it under Devices) and the username; the password is not stored. Turn this on only for TVs whose browser loses the token: the password is then kept in plain text in the TV browser storage.',
        rememberWarn: 'Warning: with this option the password of every account signed in on the TV is kept UNENCRYPTED in the TV browser storage (localStorage); anyone with access to the TV, or a script on the same address, can read it. It applies only in TV browsers (Tizen, webOS, Android TV, Philips etc.), never on computers or phones.',
        secTitle: 'Sign-in security',
        tsOn: 'Cloudflare Turnstile anti-bot check on the TV sign-in page (off by default)',
        tsText: 'The sign-in page loads the Turnstile widget (invisible; a box appears only when Cloudflare asks for a confirmation, and the remote reaches it with the arrow keys) and sends the password through /MediaLabTv/Login, which verifies the token with Cloudflare (with the client IP) and limits attempts per IP. Important: the server\'s own /Users/AuthenticateByName stays reachable, so Turnstile is anti-bot friction for this page, not a server-wide gate. Create the keys in Cloudflare → Turnstile (a "Managed" widget with the server\'s domain).',
        tsReg: 'Use the Registration keys (Registration plugin)', tsRegOk: 'Registration has Turnstile keys: they are used.', tsRegNoKeys: 'Registration is installed but has no Turnstile keys set.', tsRegMissing: 'The Registration plugin (with shared keys) is not installed or is an older version.',
        tsSite: 'Site key', tsSecret: 'Secret key (kept encrypted on the server)',
        tsActive: 'Turnstile is active on the sign-in page.', tsActiveTest: 'Turnstile is active with the Cloudflare TEST keys (for trials only).', tsInactive: 'Turnstile is on, but the keys are missing: the page signs in as before.', tsOff: 'Turnstile is off.'
    }
};
const LANG = (document.documentElement.lang || navigator.language || 'en').toLowerCase().indexOf('ro') === 0 ? 'ro' : 'en';
function t(k) { return STRINGS[LANG][k] || STRINGS.en[k] || k; }
const COLOR = /^#[0-9a-fA-F]{6}$/;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const loading = { show: function () { Dashboard.showLoadingMsg(); }, hide: function () { Dashboard.hideLoadingMsg(); } };

export default function (view) {
    const $ = function (id) { return view.querySelector('#' + id); };
    view.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    let config = null;

    function base() { return ApiClient.serverAddress().replace(/\/+$/, ''); }
    function logoUrl() { return ApiClient.getUrl('MediaLabTv/logo') + '?v=' + ((config && config.LogoVersion) || 0); }
    function luminance(hex) {
        const c = [1, 3, 5].map(function (i) { const v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }

    function preview() {
        const accent = COLOR.test($('tvAccent').value) ? $('tvAccent').value : '#52b54b';
        const bg = COLOR.test($('tvBg').value) ? $('tvBg').value : '#101418';
        const p = $('tvPreview');
        p.style.background = bg;
        p.style.color = luminance(bg) > 0.4 ? '#151515' : '#f2f2f2';
        $('pvBtn').style.background = accent;
        $('pvBtn').style.color = luminance(accent) > 0.4 ? '#111' : '#fff';
        $('pvName').textContent = $('tvName').value || 'MediaLab TV';
        $('pvTagline').textContent = $('tvTagline').value;
        $('pvTagline').style.color = accent;
        $('pvFoot').textContent = $('tvFooter').value || t('defaultFooter');
    }

    function pathStatus(s) {
        $('tvUrlMain').textContent = base() + '/MediaLabTv/';
        const active = s.Path && !s.Conflict;
        $('tvUrlShort').textContent = active ? location.origin + s.Path : '';
        $('tvUrlShortRow').classList.toggle('hide', !active);
        $('tvPathState').className = !s.Path ? 'tv-muted' : s.Conflict ? 'tv-warn' : 'tv-ok';
        $('tvPathState').textContent = !s.Path ? t('stateOff') : (s.Conflict ? t('stateConflict') : t('stateCurrent')) + s.Path;
        $('tvPathMessage').textContent = s.Valid ? '' : t('badSlug');
        $('tvNoLicense').classList.toggle('hide', !!s.Licensed);
    }

    function accessPath() { return ApiClient.getJSON(ApiClient.getUrl('MediaLabTv/Admin/AccessPath')).then(pathStatus); }

    // ---- campuri secrete (plugin-store/tools/secrets/secret-fields.js) ----
    // Parolele/cheile nu se mai trimit browserului: <input data-secret="Nume"> ramane gol, iar pagina arata doar daca
    // secretul e setat (config.SecretsSet). Tastezi o valoare noua = inlocuire; „Șterge” = config.SecretsClear.
    function mlSecretsLoad(view, config, ro) {
        var set = String(config.SecretsSet || '').split(',').filter(Boolean);
        view.querySelectorAll('[data-secret]').forEach(function (input) {
            var name = input.getAttribute('data-secret'), on = set.indexOf(name) >= 0;
            input.value = '';
            input.removeAttribute('data-clear');
            input.placeholder = on ? (ro ? 'setat ✓ — tastează pentru a înlocui' : 'set ✓ — type to replace') : (ro ? 'nesetat' : 'not set');
            var btn = input.parentNode.querySelector('.ml-secret-clear');
            if (!btn) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ml-secret-clear';
                btn.style.cssText = 'margin:.35em 0 0;padding:.25em .8em;border-radius:.3em;border:1px solid rgba(128,128,128,.5);background:transparent;color:inherit;cursor:pointer;font-size:.85em;';
                btn.addEventListener('click', function () {
                    input.value = '';
                    input.setAttribute('data-clear', '1');
                    input.placeholder = ro ? 'se șterge la salvare' : 'will be cleared on save';
                    btn.hidden = true;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                });
                input.insertAdjacentElement('afterend', btn);
            }
            btn.textContent = ro ? 'Șterge' : 'Clear';
            btn.hidden = !on;
        });
    }
    function mlSecretsSave(view, config) {
        var clear = [];
        view.querySelectorAll('[data-secret]').forEach(function (input) {
            var name = input.getAttribute('data-secret'), v = input.value.trim();
            config[name] = v;
            if (!v && input.getAttribute('data-clear') === '1') { clear.push(name); }
        });
        config.SecretsClear = clear.join(',');
        return config;
    }
    // ---- sfarsit campuri secrete ----
    function tsUi() {
        $('tvTsOwn').classList.toggle('hide', $('tvTsReg').checked);
    }

    function tsStatus() {
        return ApiClient.getJSON(ApiClient.getUrl('MediaLabTv/Admin/Turnstile')).then(function (s) {
            $('tvTsRegState').textContent = s.RegistrationHasKeys ? t('tsRegOk') : s.RegistrationAvailable ? t('tsRegNoKeys') : t('tsRegMissing');
            $('tvTsState').className = s.Active ? (s.TestKeys ? 'tv-warn' : 'tv-ok') : s.Enabled ? 'tv-warn' : 'tv-muted';
            $('tvTsState').textContent = s.Active ? (s.TestKeys ? t('tsActiveTest') : t('tsActive')) : s.Enabled ? t('tsInactive') : t('tsOff');
        });
    }

    function load() {
        loading.show();
        Promise.all([
            mltvGetConfig(),
            ApiClient.getJSON(ApiClient.getUrl('MediaLabTv/Admin/AccessPath'))
        ]).then(function (r) {
            config = r[0];
            $('tvName').value = config.AppName || '';
            $('tvShort').value = config.ShortName || '';
            $('tvTagline').value = config.Tagline || '';
            $('tvFooter').value = config.Footer || '';
            $('tvAccent').value = config.AccentColor || '#52b54b';
            $('tvBg').value = config.BackgroundColor || '#101418';
            $('tvAccentPick').value = COLOR.test($('tvAccent').value) ? $('tvAccent').value : '#52b54b';
            $('tvBgPick').value = COLOR.test($('tvBg').value) ? $('tvBg').value : '#101418';
            $('tvLang').value = config.Language || 'auto';
            $('tvPhone').checked = config.ShowPhoneSignIn !== false;
            $('tvRegister').checked = config.ShowRegistration !== false;
            $('tvAfter').value = config.AfterSignIn === 'web' ? 'web' : 'ui';
            $('tvLive').checked = config.ShowLiveTv !== false;
            $('tvRemember').checked = config.RememberPassword === true;
            $('tvRememberWarn').classList.toggle('hide', !$('tvRemember').checked);
            $('tvTsOn').checked = config.TurnstileEnabled === true;
            $('tvTsReg').checked = config.TurnstileUseRegistration === true;
            $('tvTsSite').value = config.TurnstileSiteKey || '';
            mlSecretsLoad(view, config, LANG === 'ro');
            tsUi();
            tsStatus();
            $('tvSlug').value = config.AccessSlug || '';
            $('pvLogo').src = logoUrl();
            preview();
            pathStatus(r[1]);
        }).finally(loading.hide);
    }

    function save(then) {
        loading.show();
        return mltvSaveConfig(config).then(then).finally(loading.hide);
    }

    function send(type, path, body) {
        return ApiClient.ajax({ type: type, url: ApiClient.getUrl(path), data: body ? JSON.stringify(body) : undefined, contentType: 'application/json', dataType: 'json' });
    }

    ['tvName', 'tvTagline', 'tvFooter'].forEach(function (id) { $(id).addEventListener('input', preview); });
    $('tvAccent').addEventListener('input', function () { if (COLOR.test($('tvAccent').value)) { $('tvAccentPick').value = $('tvAccent').value; } preview(); });
    $('tvBg').addEventListener('input', function () { if (COLOR.test($('tvBg').value)) { $('tvBgPick').value = $('tvBg').value; } preview(); });
    $('tvAccentPick').addEventListener('input', function () { $('tvAccent').value = $('tvAccentPick').value; preview(); });
    $('tvBgPick').addEventListener('input', function () { $('tvBg').value = $('tvBgPick').value; preview(); });

    $('tvLogoFile').addEventListener('change', function () {
        const file = $('tvLogoFile').files[0];
        $('tvLogoError').textContent = '';
        if (!file) { return; }
        if (file.size > 512 * 1024) { $('tvLogoError').textContent = t('logoBad'); return; }
        const reader = new FileReader();
        reader.onload = function () {
            loading.show();
            send('POST', 'MediaLabTv/Admin/Logo', { DataUrl: reader.result }).then(function (r) {
                if (!r.Ok) { $('tvLogoError').textContent = r.Error || t('logoBad'); return; }
                config.LogoVersion = r.Version;
                $('pvLogo').src = logoUrl();
            }).finally(function () { loading.hide(); $('tvLogoFile').value = ''; });
        };
        reader.readAsDataURL(file);
    });
    $('tvLogoReset').addEventListener('click', function () {
        loading.show();
        send('DELETE', 'MediaLabTv/Admin/Logo').then(function (r) { config.LogoVersion = r.Version; $('pvLogo').src = logoUrl(); }).finally(loading.hide);
    });

    $('tvRemember').addEventListener('change', function () { $('tvRememberWarn').classList.toggle('hide', !$('tvRemember').checked); });
    $('tvTsReg').addEventListener('change', tsUi);
    $('tvSaveSec').addEventListener('click', function () {
        if (!config) { return; }
        $('tvSavedSec').textContent = '';
        mltvGetConfig().then(function (fresh) {
            config = fresh;
            config.TurnstileEnabled = $('tvTsOn').checked;
            config.TurnstileUseRegistration = $('tvTsReg').checked;
            config.TurnstileSiteKey = $('tvTsSite').value.trim();
            mlSecretsSave(view, config);
            return save(function () {
                $('tvSavedSec').textContent = t('saved');
                return mltvGetConfig().then(function (c) { config = c; mlSecretsLoad(view, config, LANG === 'ro'); return tsStatus(); });
            });
        });
    });

    $('tvSaveBrand').addEventListener('click', function () {
        if (!config) { return; }
        const accent = $('tvAccent').value.trim(), bg = $('tvBg').value.trim();
        $('tvBrandError').textContent = !COLOR.test(accent) || !COLOR.test(bg) ? t('badColor') : !$('tvName').value.trim() ? t('badName') : '';
        $('tvSavedBrand').textContent = '';
        if ($('tvBrandError').textContent) { return; }
        // Reincarca setarile (sigla poate fi schimbata intre timp), apoi suprascrie doar campurile de branding.
        mltvGetConfig().then(function (fresh) {
            config = fresh;
            config.AppName = $('tvName').value.trim();
            config.ShortName = $('tvShort').value.trim();
            config.Tagline = $('tvTagline').value.trim();
            config.Footer = $('tvFooter').value.trim();
            config.AccentColor = accent.toLowerCase();
            config.BackgroundColor = bg.toLowerCase();
            config.Language = $('tvLang').value;
            config.ShowPhoneSignIn = $('tvPhone').checked;
            config.ShowRegistration = $('tvRegister').checked;
            config.AfterSignIn = $('tvAfter').value;
            config.ShowLiveTv = $('tvLive').checked;
            config.RememberPassword = $('tvRemember').checked;
            return save(function () { $('tvSavedBrand').textContent = t('saved'); });
        });
    });

    $('tvSavePath').addEventListener('click', function () {
        if (!config) { return; }
        const slug = $('tvSlug').value.trim().toLowerCase().replace(/^\/?(web\/)?/, '').replace(/\/+$/, '');
        $('tvSavedPath').textContent = '';
        if (slug && !SLUG.test(slug)) { $('tvPathMessage').textContent = t('badSlug'); return; }
        mltvGetConfig().then(function (fresh) {
            config = fresh;
            config.AccessSlug = slug;
            return save(function () {
                $('tvSlug').value = slug;
                return accessPath().then(function () { $('tvSavedPath').textContent = t('applied'); });
            });
        });
    });

    view.addEventListener('viewshow', load);
}
