document.addEventListener('DOMContentLoaded', function() {
    // --- State ---
    var currentLang = 'ru';
    var activeShell = 'powershell';
    var activeCategory = 'all';
    var searchQuery = '';

    // --- DOM Elements ---
    var cursorGlow = document.getElementById('cursorGlow');
    var navbar = document.getElementById('navbar');
    var langBtn = document.getElementById('langCurrent');
    var langSwitcher = document.getElementById('langSwitcher');
    var langOptions = document.querySelectorAll('.lang-opt');
    var burgerBtn = document.getElementById('burger');
    var navMenu = document.getElementById('navMenu');
    var commandsList = document.getElementById('commandsList');
    var artifactsGrid = document.getElementById('artifactsGrid');
    var faqList = document.getElementById('faqList');
    var shellTabs = document.querySelectorAll('.shell-tab');
    var catTabs = document.querySelectorAll('.cat-tab');
    var cmdSearchInput = document.getElementById('cmdSearch');
    var cmdSearchWrap = cmdSearchInput ? cmdSearchInput.closest('.cmd-search') : null;
    var cmdSearchClear = document.getElementById('cmdSearchClear');
    var toast = document.getElementById('toast');
    var statCmds = document.getElementById('statCmds');

    // --- Custom Cursor Glow ---
    document.addEventListener('mousemove', function(e) {
        cursorGlow.style.left = e.clientX + 'px';
        cursorGlow.style.top = e.clientY + 'px';
    });

    // --- Interactive smoke (Canvas 2D particle field) ---
    // Canvas 2D выбран вместо WebGL-шейдера сознательно: радиальные градиенты
    // с низкой прозрачностью и screen-blending дают убедительный объёмный дым
    // при ~15 формах на кадр (тривиальная нагрузка), без компиляции шейдеров,
    // WebGL-контекста и лишних килобайт. WebGL оправдан от сотен тысяч частиц.
    var canvas = document.getElementById('particlesCanvas');
    var ctx = canvas.getContext('2d');
    var blobs = [];
    var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    // Силовое поле курсора: позиция сглаживается (lerp), чтобы дым реагировал
    // с лёгкой инерцией, а не дёргался за мышью.
    var smokeMouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, vx: 0, vy: 0, px: -9999, py: -9999 };
    // Усилено (задача 6): реакция резче, но вихрь остаётся плавным —
    // резкость даёт быстрый lerp и большие силы, плавность — вязкость.
    var SMOKE_CURSOR_RADIUS = 360;   // радиус действия поля, px
    var SMOKE_REPEL = 0.095;         // сила расталкивания (0.055 → 0.095)
    var SMOKE_SWIRL = 0.08;          // сила закручивания (0.045 → 0.08)
    var SMOKE_DRAG_BOOST = 0.11;     // увлечение за мышью (0.06 → 0.11)

    if (!isCoarsePointer && !prefersReducedMotion) {
        document.addEventListener('mousemove', function(e) {
            smokeMouse.tx = e.clientX;
            smokeMouse.ty = e.clientY;
        }, { passive: true });
        document.addEventListener('mouseleave', function() {
            smokeMouse.tx = -9999;
            smokeMouse.ty = -9999;
        });
    }

    function resizeCanvas() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Calm smoke palette: low-saturation, low-opacity light fog.
    var smokePalette = [
        { h: 196, s: 22, l: 66 },
        { h: 214, s: 20, l: 62 },
        { h: 232, s: 16, l: 58 },
        { h: 176, s: 18, l: 62 },
        { h: 255, s: 14, l: 56 }
    ];

    function createBlob(seed) {
        var p = smokePalette[Math.floor(Math.random() * smokePalette.length)];
        var isLarge = Math.random() < 0.36;
        // depth: 0.35 (дальний слой) … 1 (ближний). Крупные формы — дальше:
        // движутся медленнее, прозрачнее, слабее реагируют на курсор — параллакс.
        var depth = isLarge ? (0.35 + Math.random() * 0.3) : (0.6 + Math.random() * 0.4);
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            baseR: isLarge ? (260 + Math.random() * 260) : (110 + Math.random() * 150),
            vx: (Math.random() - 0.5) * 0.08 * depth,
            vy: ((Math.random() - 0.5) * 0.06 - 0.01) * depth,
            /* скорость от силового поля курсора (затухающая) */
            fx: 0, fy: 0,
            depth: depth,
            h: p.h, s: p.s, l: p.l,
            baseOp: (isLarge ? (0.018 + Math.random() * 0.025) : (0.024 + Math.random() * 0.028)) * (0.6 + depth * 0.4),
            swirl: Math.random() * Math.PI * 2,
            swirlSpeed: 0.00025 + Math.random() * 0.00075,
            swirlAmp: 18 + Math.random() * 46,
            swirl2: Math.random() * Math.PI * 2,
            swirl2Speed: 0.00045 + Math.random() * 0.001,
            swirl2Amp: 6 + Math.random() * 18,
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: 0.00028 + Math.random() * 0.0009,
            squish: 0.55 + Math.random() * 0.38
        };
    }

    // Адаптивное число форм: меньше на мобильных, автоснижение при низком FPS.
    var BLOB_COUNT = isCoarsePointer ? 6 : 12;
    for (var i = 0; i < BLOB_COUNT; i++) blobs.push(createBlob(i));

    var fpsSamples = 0, fpsAccum = 0, lastFrameTs = 0, fpsChecked = false;

    // Сила взаимодействия курсора с дымом: внутри радиуса действует
    // репеллер (расталкивание) + перпендикулярный вихрь (закручивание),
    // сила затухает квадратично к краю поля. Быстрое движение мыши
    // дополнительно "увлекает" дым за собой (drag).
    function applyCursorForce(b) {
        var dx = b.x - smokeMouse.x;
        var dy = b.y - smokeMouse.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var radius = SMOKE_CURSOR_RADIUS * (0.6 + b.depth * 0.55);
        if (dist > radius || dist < 0.001) return;
        var t = 1 - dist / radius;
        var falloff = t * t; // квадратичное затухание — мягкий край поля
        var nx = dx / dist, ny = dy / dist;
        var strength = falloff * b.depth;
        // репеллер: от курсора наружу
        b.fx += nx * SMOKE_REPEL * strength;
        b.fy += ny * SMOKE_REPEL * strength;
        // вихрь: перпендикуляр к радиусу → дым закручивается вокруг курсора
        b.fx += -ny * SMOKE_SWIRL * strength;
        b.fy += nx * SMOKE_SWIRL * strength;
        // увлечение за скоростью мыши
        b.fx += smokeMouse.vx * SMOKE_DRAG_BOOST * strength;
        b.fy += smokeMouse.vy * SMOKE_DRAG_BOOST * strength;
    }

    function animateBlobs(ts) {
        var W = window.innerWidth, H = window.innerHeight;

        // Адаптация под FPS: первые ~90 кадров замеряем; если в среднем
        // ниже ~45 fps — убираем треть форм (сначала мелкие ближние).
        if (!fpsChecked && lastFrameTs && ts) {
            fpsAccum += ts - lastFrameTs;
            fpsSamples += 1;
            if (fpsSamples >= 90) {
                fpsChecked = true;
                var avgFrame = fpsAccum / fpsSamples;
                if (avgFrame > 22) blobs.length = Math.max(4, Math.floor(blobs.length * 0.66));
            }
        }
        lastFrameTs = ts || 0;

        // Инерционное сглаживание позиции курсора + оценка его скорости
        smokeMouse.px = smokeMouse.x; smokeMouse.py = smokeMouse.y;
        smokeMouse.x += (smokeMouse.tx - smokeMouse.x) * 0.2; // 0.12 → 0.2: реакция резче
        smokeMouse.y += (smokeMouse.ty - smokeMouse.y) * 0.2;
        smokeMouse.vx = smokeMouse.x - smokeMouse.px;
        smokeMouse.vy = smokeMouse.y - smokeMouse.py;

        ctx.clearRect(0, 0, W, H);
        // Additive blending for soft "light through fog" feel
        ctx.globalCompositeOperation = 'screen';
        for (var i = 0; i < blobs.length; i++) {
            var b = blobs[i];
            b.swirl += b.swirlSpeed;
            b.swirl2 += b.swirl2Speed;
            b.pulse += b.pulseSpeed;

            // силовое поле курсора → скорость с вязким затуханием
            if (smokeMouse.tx > -9000) applyCursorForce(b);
            b.fx *= 0.94; // вязкость: дым медленно "успокаивается"
            b.fy *= 0.94;

            b.x += b.vx + b.fx;
            b.y += b.vy + b.fy;
            // wrap toroidally
            if (b.x < -b.baseR) b.x = W + b.baseR;
            else if (b.x > W + b.baseR) b.x = -b.baseR;
            if (b.y < -b.baseR) b.y = H + b.baseR;
            else if (b.y > H + b.baseR) b.y = -b.baseR;

            // Compound swirl offset (two frequencies → organic wandering)
            var ox = Math.cos(b.swirl) * b.swirlAmp + Math.cos(b.swirl2) * b.swirl2Amp;
            var oy = Math.sin(b.swirl * 1.3) * b.swirlAmp + Math.sin(b.swirl2 * 1.7) * b.swirl2Amp;
            var pulseFactor = 1 + Math.sin(b.pulse) * 0.10;
            // Возмущение курсором слегка "раздувает" и подсвечивает дым
            var agitation = Math.min(Math.sqrt(b.fx * b.fx + b.fy * b.fy) * 0.55, 0.35);
            var r = b.baseR * (pulseFactor + agitation * 0.4);
            var op = b.baseOp * (0.78 + Math.sin(b.pulse * 0.7) * 0.18) * (1 + agitation * 1.6);
            var cx = b.x + ox, cy = b.y + oy;

            // Save + apply a slight squish for non-circular smoke shape;
            // при возмущении форма вытягивается вдоль направления силы
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(agitation > 0.02 ? Math.atan2(b.fy, b.fx) : b.swirl * 0.22);
            ctx.scale(1.35 + agitation * 0.5, b.squish);
            var grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            grd.addColorStop(0,    'hsla(' + b.h + ',' + b.s + '%,' + b.l + '%,' + op + ')');
            grd.addColorStop(0.42, 'hsla(' + b.h + ',' + b.s + '%,' + b.l + '%,' + (op * 0.42) + ')');
            grd.addColorStop(0.78, 'hsla(' + b.h + ',' + b.s + '%,' + b.l + '%,' + (op * 0.10) + ')');
            grd.addColorStop(1,    'hsla(' + b.h + ',' + b.s + '%,' + b.l + '%,0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
        if (!prefersReducedMotion) requestAnimationFrame(animateBlobs);
    }
    animateBlobs();

    // --- Navbar Scroll ---
    window.addEventListener('scroll', function() {
        if (window.scrollY > 20) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    });

    // --- Mobile Menu ---
    burgerBtn.addEventListener('click', function() {
        burgerBtn.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    document.querySelectorAll('.nav-link').forEach(function(link) {
        link.addEventListener('click', function() {
            burgerBtn.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // --- Localization ---
    function setLanguage(lang) {
        currentLang = lang;
        document.documentElement.lang = lang;

        // SVG-флаги вместо emoji (на Windows emoji-флаги рендерятся как "RU"/"PL").
        // Копируем разметку флага из соответствующего пункта dropdown.
        var srcOpt = document.querySelector('.lang-opt[data-lang="' + lang + '"] .lang-flag');
        var flagEl = document.getElementById('langFlag');
        if (srcOpt && flagEl) flagEl.innerHTML = srcOpt.innerHTML;
        document.getElementById('langCode').textContent = lang.toUpperCase();

        langOptions.forEach(function(opt) {
            if (opt.getAttribute('data-lang') === lang) opt.classList.add('active');
            else opt.classList.remove('active');
        });

        document.querySelectorAll('[data-i18n]').forEach(function(el) {
            var key = el.getAttribute('data-i18n');
            if (window.i18n[lang] && window.i18n[lang][key]) {
                el.textContent = window.i18n[lang][key];
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-placeholder');
            if (window.i18n[lang] && window.i18n[lang][key]) {
                el.setAttribute('placeholder', window.i18n[lang][key]);
            }
        });

        renderCommands();
        renderArtifacts();
        renderFAQ();
        splitHeroTitle();
        splitSectionTitles();
        langSwitcher.classList.remove('open');
    }

    // --- Section titles: word-by-word scroll reveal (задача 8) ---
    // Слова оборачиваются в .st-word с индексом --sw; сама анимация
    // стартует по классу .visible от IntersectionObserver (не scroll-listener).
    function splitSectionTitles() {
        if (prefersReducedMotion) return;
        document.querySelectorAll('.section-head.reveal .section-title').forEach(function(title) {
            var text = title.textContent.trim();
            if (!text) return;
            title.textContent = '';
            text.split(/\s+/).forEach(function(word, i) {
                if (i > 0) title.appendChild(document.createTextNode(' '));
                var span = document.createElement('span');
                span.className = 'st-word';
                span.textContent = word;
                span.style.setProperty('--sw', i);
                title.appendChild(span);
            });
        });
    }

    // --- Hero title: word-by-word masked reveal (re-runs on language change) ---
    function splitHeroTitle() {
        var title = document.querySelector('.hero-title');
        if (!title) return;
        if (prefersReducedMotion) return;

        var wordIndex = 0;
        title.querySelectorAll('.hero-title-line').forEach(function(line) {
            var text = line.textContent.trim();
            if (!text) return;
            line.textContent = '';
            text.split(/\s+/).forEach(function(word, i) {
                if (i > 0) line.appendChild(document.createTextNode(' '));
                var outer = document.createElement('span');
                outer.className = 'hero-word';
                var inner = document.createElement('span');
                inner.className = 'hero-word-inner';
                inner.textContent = word;
                inner.style.setProperty('--wd', (0.15 + wordIndex * 0.11) + 's');
                outer.appendChild(inner);
                line.appendChild(outer);
                wordIndex += 1;
            });
        });
        title.classList.add('split');
    }

    langBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        langSwitcher.classList.toggle('open');
    });

    document.addEventListener('click', function() {
        langSwitcher.classList.remove('open');
    });

    langOptions.forEach(function(opt) {
        opt.addEventListener('click', function(e) {
            e.stopPropagation();
            var lang = opt.getAttribute('data-lang');
            setLanguage(lang);
            // Ручной выбор — фиксируем, автоопределение больше не перезапишет
            try { localStorage.setItem('cg_lang', lang); } catch (err) { /* private mode */ }
        });
    });

    // --- Автоопределение языка (задача 7) ---
    // Поддерживаемые языки сайта: ru, en, pl.
    // Маппинг стран → языки:
    //   ru: RU, BY, KZ, KG, UZ, TJ, AM, AZ, GE, MD, UA
    //   pl: PL
    //   en: всё остальное (fallback)
    // Порядок: localStorage → navigator.language (мгновенно, без сети) →
    // IP-геолокация в фоне (не блокирует рендер: сайт уже показан,
    // язык подменяется только если отличается и юзер не выбрал вручную).
    var GEO_LANG_MAP = {
        RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru', UZ: 'ru', TJ: 'ru',
        AM: 'ru', AZ: 'ru', GE: 'ru', MD: 'ru', UA: 'ru',
        PL: 'pl'
    };
    var SUPPORTED_LANGS = ['ru', 'en', 'pl'];

    function detectInitialLang() {
        // 1) сохранённый выбор
        var stored = null;
        try { stored = localStorage.getItem('cg_lang'); } catch (err) { /* noop */ }
        if (stored && SUPPORTED_LANGS.indexOf(stored) !== -1) return { lang: stored, final: true };

        // 2) язык браузера — мгновенный fallback без сети
        var navLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
        var guess = SUPPORTED_LANGS.indexOf(navLang) !== -1 ? navLang : 'en';
        return { lang: guess, final: false };
    }

    function refineLangByGeo() {
        // Фоновая IP-геолокация; таймаут 4с, ошибки молча игнорируются
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        if (controller) setTimeout(function() { controller.abort(); }, 4000);
        fetch('https://ipapi.co/json/', controller ? { signal: controller.signal } : undefined)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var country = (data && data.country_code || '').toUpperCase();
                var lang = GEO_LANG_MAP[country] || 'en';
                var manual = null;
                try { manual = localStorage.getItem('cg_lang'); } catch (err) { /* noop */ }
                // Не перетираем ручной выбор; меняем только если язык другой
                if (!manual && lang !== currentLang) setLanguage(lang);
                // Запоминаем результат автоопределения, чтобы не запрашивать повторно
                if (!manual) { try { localStorage.setItem('cg_lang', lang); } catch (err) { /* noop */ } }
            })
            .catch(function() { /* сеть/лимит/adblock — остаёмся на fallback */ });
    }

    function getI18n(key, fallback) {
        return (window.i18n[currentLang] && window.i18n[currentLang][key]) || fallback;
    }

    // --- Animated stat counters: count up when the stats bar scrolls into view ---
    function setupStatCounters() {
        var statNums = document.querySelectorAll('.stat-num');
        if (!statNums.length) return;

        function animateCounter(el) {
            var raw = el.textContent.trim();
            var match = raw.match(/^(\d+)(.*)$/);
            if (!match) return;
            var target = parseInt(match[1], 10);
            var suffix = match[2] || '';
            if (prefersReducedMotion || target <= 1) return;

            var duration = 1400;
            var start = null;
            el.textContent = '0' + suffix;

            function step(ts) {
                if (!start) start = ts;
                var progress = Math.min((ts - start) / duration, 1);
                // ease-out-expo
                var eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                el.textContent = Math.round(eased * target) + suffix;
                if (progress < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }

        var counterObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.6 });

        statNums.forEach(function(el) { counterObserver.observe(el); });
    }

    function updateCategoryCounts() {
        catTabs.forEach(function(tab) {
            var cat = tab.getAttribute('data-cat');
            var count = window.commandsData.filter(function(cmd) {
                return cmd.shell === activeShell && (cat === 'all' || cmd.category === cat);
            }).length;
            var existing = tab.querySelector('.cat-count');
            if (existing) existing.remove();
            var countSpan = document.createElement('span');
            countSpan.className = 'cat-count';
            countSpan.textContent = count;
            tab.appendChild(countSpan);
        });
    }

    // --- Render Commands ---
    function renderCommands() {
        commandsList.innerHTML = '';

        var q = searchQuery.trim().toLowerCase();
        var filtered = window.commandsData.filter(function(cmd) {
            var matchShell = cmd.shell === activeShell;
            var matchCategory = activeCategory === 'all' || cmd.category === activeCategory;
            if (!matchShell || !matchCategory) return false;
            if (!q) return true;
            var title = (cmd.title[currentLang] || cmd.title['en'] || '').toLowerCase();
            var desc = (cmd.desc[currentLang] || cmd.desc['en'] || '').toLowerCase();
            var code = (cmd.code || '').toLowerCase();
            return title.indexOf(q) !== -1 || desc.indexOf(q) !== -1 || code.indexOf(q) !== -1;
        });

        updateCategoryCounts();

        if (filtered.length === 0) {
            var emptyWrap = document.createElement('div');
            emptyWrap.className = 'cmd-empty-state';
            
            var title = (window.i18n[currentLang] && window.i18n[currentLang]['cmd_empty_title']) || 'Ничего не найдено';
            var desc = (window.i18n[currentLang] && window.i18n[currentLang]['cmd_empty_desc']) || 'Попробуйте изменить параметры поиска или категорию.';

            emptyWrap.innerHTML = `
                <div class="cmd-empty-radar">
                    <div class="radar-circle"></div>
                    <div class="radar-circle"></div>
                    <div class="radar-circle"></div>
                    <div class="radar-sweep"></div>
                    <svg class="radar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <h3>${title}</h3>
                <p>${desc}</p>
            `;
            commandsList.appendChild(emptyWrap);
            return;
        }

        filtered.forEach(function(cmd, idx) {
            var card = document.createElement('div');
            card.className = 'cmd-card tilt';
            card.style.animationDelay = (idx * 0.05) + 's';

            var title = cmd.title[currentLang] || cmd.title['en'];
            var desc = cmd.desc[currentLang] || cmd.desc['en'];
            var catKey = 'cat_' + cmd.category;
            var catName = (window.i18n[currentLang] && window.i18n[currentLang][catKey]) || cmd.category;
            var numStr = (idx + 1).toString().padStart(2, '0');

            // Build header
            var header = document.createElement('div');
            header.className = 'cmd-header';

            var headerLeft = document.createElement('div');
            headerLeft.className = 'cmd-header-left';

            var numSpan = document.createElement('span');
            numSpan.className = 'cmd-num';
            numSpan.textContent = numStr;

            var iconSpan = document.createElement('span');
            iconSpan.className = 'cmd-shell-icon';
            if (cmd.shell === 'powershell') {
                iconSpan.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--powershell-color, #4ea8de)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>';
            } else {
                iconSpan.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cmd-color, #ffffff)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><polyline points="9 9 12 12 9 15"></polyline></svg>';
            }

            var titleSpan = document.createElement('span');
            titleSpan.className = 'cmd-title-text';
            titleSpan.textContent = title;

            var badgeSpan = document.createElement('span');
            badgeSpan.className = 'cmd-badge';
            badgeSpan.textContent = catName;

            headerLeft.appendChild(numSpan);
            headerLeft.appendChild(iconSpan);
            headerLeft.appendChild(titleSpan);
            headerLeft.appendChild(badgeSpan);

            var arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            arrowSvg.setAttribute('class', 'cmd-arrow');
            arrowSvg.setAttribute('width', '16');
            arrowSvg.setAttribute('height', '16');
            arrowSvg.setAttribute('viewBox', '0 0 24 24');
            arrowSvg.setAttribute('fill', 'none');
            arrowSvg.setAttribute('stroke', 'currentColor');
            arrowSvg.setAttribute('stroke-width', '2');
            var polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.setAttribute('points', '6 9 12 15 18 9');
            arrowSvg.appendChild(polyline);

            header.appendChild(headerLeft);
            header.appendChild(arrowSvg);

            // Build body
            var body = document.createElement('div');
            body.className = 'cmd-body';

            var bodyInner = document.createElement('div');
            bodyInner.className = 'cmd-body-inner';

            var descDiv = document.createElement('div');
            descDiv.className = 'cmd-desc';
            descDiv.textContent = desc;

            var codeWrap = document.createElement('div');
            codeWrap.className = 'cmd-code-wrap';
            codeWrap.title = (window.i18n[currentLang] && window.i18n[currentLang]['cmd_sub']) || 'Нажмите, чтобы скопировать';

            var codeDiv = document.createElement('div');
            codeDiv.className = 'cmd-code';
            codeDiv.textContent = cmd.code;

            codeWrap.appendChild(codeDiv);
            var metaRow = document.createElement('div');
            metaRow.className = 'cmd-meta-row';

            var copyMeta = document.createElement('span');
            copyMeta.className = 'cmd-copy-hint';
            copyMeta.textContent = getI18n('cmd_copy_hint', 'Нажмите код, чтобы скопировать');

            metaRow.appendChild(copyMeta);
            bodyInner.appendChild(descDiv);
            bodyInner.appendChild(codeWrap);
            bodyInner.appendChild(metaRow);
            body.appendChild(bodyInner);

            card.appendChild(header);
            card.appendChild(body);

            // Accordion toggle
            header.addEventListener('click', function() {
                var isOpen = card.classList.contains('open');
                document.querySelectorAll('.cmd-card').forEach(function(c) { c.classList.remove('open'); });
                if (!isOpen) card.classList.add('open');
            });

            // Copy action
            codeWrap.addEventListener('click', function(e) {
                e.stopPropagation();
                var textToCopy = cmd.code;
                navigator.clipboard.writeText(textToCopy).then(function() {
                    showToast();
                });
            });

            commandsList.appendChild(card);
        });
        setupTilt();
    }

    shellTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            shellTabs.forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            activeShell = tab.getAttribute('data-shell');
            renderCommands();
        });
    });

    catTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            catTabs.forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            activeCategory = tab.getAttribute('data-cat');
            renderCommands();
        });
    });

    if (cmdSearchInput) {
        cmdSearchInput.addEventListener('input', function() {
            searchQuery = cmdSearchInput.value;
            if (cmdSearchWrap) cmdSearchWrap.classList.toggle('has-value', searchQuery.length > 0);
            renderCommands();
        });
        cmdSearchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && cmdSearchInput.value) {
                cmdSearchInput.value = '';
                searchQuery = '';
                if (cmdSearchWrap) cmdSearchWrap.classList.remove('has-value');
                renderCommands();
            }
        });
    }
    if (cmdSearchClear) {
        cmdSearchClear.addEventListener('click', function() {
            if (!cmdSearchInput) return;
            cmdSearchInput.value = '';
            searchQuery = '';
            if (cmdSearchWrap) cmdSearchWrap.classList.remove('has-value');
            cmdSearchInput.focus();
            renderCommands();
        });
    }

    // --- Render Artifacts ---
    function renderArtifacts() {
        artifactsGrid.innerHTML = '';
        var lblTools = (window.i18n[currentLang] && window.i18n[currentLang]['art_tools_lbl']) || 'Инструменты';

        window.artifactsData.forEach(function(art, idx) {
            var card = document.createElement('div');
            card.className = 'art-card reveal tilt';
            card.style.setProperty('--i', idx);

            var title = art.title[currentLang] || art.title['en'];
            var desc = art.desc[currentLang] || art.desc['en'];
            var numStr = (idx + 1).toString().padStart(2, '0');

            var numSpan = document.createElement('span');
            numSpan.className = 'art-num';
            numSpan.textContent = 'ART-' + numStr;

            var titleH3 = document.createElement('h3');
            titleH3.className = 'art-title';
            titleH3.textContent = title;

            var pathDiv = document.createElement('div');
            pathDiv.className = 'art-path';
            pathDiv.textContent = art.path;

            var descP = document.createElement('p');
            descP.className = 'art-desc';
            descP.textContent = desc;

            var toolsLabel = document.createElement('div');
            toolsLabel.className = 'art-tools-label';
            toolsLabel.textContent = lblTools;

            var toolsList = document.createElement('div');
            toolsList.className = 'art-tools-list';

            art.tools.forEach(function(t) {
                var toolDiv = document.createElement('div');
                toolDiv.className = 'art-tool';
                toolDiv.textContent = t;
                toolsList.appendChild(toolDiv);
            });

            card.appendChild(numSpan);
            card.appendChild(titleH3);
            card.appendChild(pathDiv);
            card.appendChild(descP);
            card.appendChild(toolsLabel);
            card.appendChild(toolsList);

            artifactsGrid.appendChild(card);
        });
        setupScrollReveal();
        setupTilt();
    }

    // --- Render FAQ ---
    function renderFAQ() {
        faqList.innerHTML = '';

        window.faqData.forEach(function(item) {
            var el = document.createElement('div');
            el.className = 'faq-item reveal tilt';

            var q = item.q[currentLang] || item.q['en'];
            var a = item.a[currentLang] || item.a['en'];

            var btn = document.createElement('button');
            btn.className = 'faq-q';

            var qSpan = document.createElement('span');
            qSpan.textContent = q;

            var svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgEl.setAttribute('width', '18');
            svgEl.setAttribute('height', '18');
            svgEl.setAttribute('viewBox', '0 0 24 24');
            svgEl.setAttribute('fill', 'none');
            svgEl.setAttribute('stroke', 'currentColor');
            svgEl.setAttribute('stroke-width', '2');
            var pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            pl.setAttribute('points', '6 9 12 15 18 9');
            svgEl.appendChild(pl);

            btn.appendChild(qSpan);
            btn.appendChild(svgEl);

            var answerDiv = document.createElement('div');
            answerDiv.className = 'faq-a';

            var answerInner = document.createElement('div');
            answerInner.className = 'faq-a-inner';
            answerInner.textContent = a;

            answerDiv.appendChild(answerInner);

            el.appendChild(btn);
            el.appendChild(answerDiv);

            btn.addEventListener('click', function() {
                var isOpen = el.classList.contains('open');
                document.querySelectorAll('.faq-item').forEach(function(fi) { fi.classList.remove('open'); });
                if (!isOpen) el.classList.add('open');
            });

            faqList.appendChild(el);
        });
        setupScrollReveal();
        setupTilt();
    }

    // --- Toast: "диагональное желе" ---
    // Появление = keyframe toastJellyIn, скрытие = toastJellyOut (класс .hide).
    // При каждом вызове слегка варьируем амплитуду диагонали, чтобы повторные
    // уведомления не выглядели механически одинаковыми (stagger-эффект).
    var toastTimeout, toastHideTimeout;
    function showToast() {
        clearTimeout(toastTimeout);
        clearTimeout(toastHideTimeout);
        // Джиттер амплитуды: базовые 52/66px ± ~18% (синхронно с токенами)
        var jx = 52 + (Math.random() - 0.5) * 18;
        var jy = 66 + (Math.random() - 0.5) * 24;
        toast.style.setProperty('--jelly-dx', jx.toFixed(0) + 'px');
        toast.style.setProperty('--jelly-dy', jy.toFixed(0) + 'px');
        // Force reflow so the entrance + check + sparks animations replay on every call
        toast.classList.remove('show', 'hide');
        void toast.offsetWidth;
        toast.classList.add('show');
        toastTimeout = setTimeout(function() {
            toast.classList.remove('show');
            toast.classList.add('hide');
            toastHideTimeout = setTimeout(function() { toast.classList.remove('hide'); }, 500);
        }, 2400);
    }

    // --- Scroll progress bar ---
    function setupScrollProgress() {
        var bar = document.getElementById('scrollProgress');
        if (!bar || prefersReducedMotion) return;
        var ticking = false;
        function update() {
            ticking = false;
            var max = document.documentElement.scrollHeight - window.innerHeight;
            var p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
            bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
        }
        window.addEventListener('scroll', function() {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    // --- Magnetic CTA buttons: subtle pull toward the cursor ---
    function setupMagneticButtons() {
        if (prefersReducedMotion) return;
        document.querySelectorAll('.cta-btn').forEach(function(btn) {
            var strength = 0.22;
            btn.addEventListener('mouseenter', function() {
                btn.style.transition = '';
            });
            btn.addEventListener('mousemove', function(e) {
                var rect = btn.getBoundingClientRect();
                var dx = e.clientX - (rect.left + rect.width / 2);
                var dy = e.clientY - (rect.top + rect.height / 2);
                btn.style.transform = 'translate(' + (dx * strength).toFixed(1) + 'px, ' + (dy * strength).toFixed(1) + 'px)';
            });
            btn.addEventListener('mouseleave', function() {
                btn.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
                btn.style.transform = 'translate(0, 0)';
            });
        });
    }

    // --- Scrollspy: highlight the nav link of the section in view ---
    function setupScrollSpy() {
        var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link[href^="#"]'));
        if (!links.length) return;
        var map = {};
        var sections = [];
        links.forEach(function(link) {
            var id = link.getAttribute('href').slice(1);
            var section = document.getElementById(id);
            if (section) { map[id] = link; sections.push(section); }
        });
        if (!sections.length) return;

        var spy = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                var link = map[entry.target.id];
                if (!link) return;
                if (entry.isIntersecting) {
                    links.forEach(function(l) { l.classList.remove('active'); });
                    link.classList.add('active');
                }
            });
        }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

        sections.forEach(function(s) { spy.observe(s); });
    }

    // --- Scroll Reveal ---
    function setupScrollReveal() {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        document.querySelectorAll('.reveal').forEach(function(el) { observer.observe(el); });
    }

    // --- Tilt: "bend under cursor" 3D effect for all .tilt tiles ---
    function setupTilt() {
        if (prefersReducedMotion) return;
        var tiles = document.querySelectorAll('.tilt');
        tiles.forEach(function(el) {
            if (el._tiltBound) return;
            el._tiltBound = true;

            var rafId = 0;
            var pending = null;
            // Read tilt multiplier from CSS custom property (default 1)
            var multStr = getComputedStyle(el).getPropertyValue('--tilt-mult');
            var mult = parseFloat(multStr);
            if (!isFinite(mult) || mult <= 0) mult = 1;

            function apply() {
                rafId = 0;
                if (!pending) return;
                var rect = el.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                var mx = pending.x - rect.left;
                var my = pending.y - rect.top;
                var nx = mx / rect.width - 0.5;   // -0.5 .. 0.5
                var ny = my / rect.height - 0.5;
                if (nx < -0.5) nx = -0.5; else if (nx > 0.5) nx = 0.5;
                if (ny < -0.5) ny = -0.5; else if (ny > 0.5) ny = 0.5;
                var aspect = rect.width / rect.height;
                var maxAngle = (aspect > 3 ? 3.5 : (aspect > 2 ? 5.5 : 8)) * mult;
                // "Bend under cursor": cursor area dips back, opposite side lifts
                var rx = (-ny * maxAngle).toFixed(2);
                var ry = (nx * maxAngle).toFixed(2);
                el.style.setProperty('--rx', rx + 'deg');
                el.style.setProperty('--ry', ry + 'deg');
                el.style.setProperty('--mx', mx.toFixed(1) + 'px');
                el.style.setProperty('--my', my.toFixed(1) + 'px');
            }

            el.addEventListener('mouseenter', function(e) {
                el.classList.add('tilting');
                pending = { x: e.clientX, y: e.clientY };
                if (!rafId) rafId = requestAnimationFrame(apply);
            });

            el.addEventListener('mousemove', function(e) {
                pending = { x: e.clientX, y: e.clientY };
                if (!rafId) rafId = requestAnimationFrame(apply);
            });

            el.addEventListener('mouseleave', function() {
                el.classList.remove('tilting');
                el.style.setProperty('--rx', '0deg');
                el.style.setProperty('--ry', '0deg');
                pending = null;
            });
        });
    }

    // --- Support: mail copy ---
    document.querySelectorAll('.support-card[data-copy]').forEach(function(card) {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            var text = card.getAttribute('data-copy');
            if (!text) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(showToast, fallbackCopy);
            } else {
                fallbackCopy();
            }
            function fallbackCopy() {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); showToast(); } catch (_) {}
                document.body.removeChild(ta);
            }
        });
    });

    // --- Init ---
    statCmds.textContent = window.commandsData.length + '+';
    // Dynamic partner count
    var statPartners = document.getElementById('statPartners');
    if (statPartners) {
        var partnerCount = document.querySelectorAll('.partner-list > li').length;
        if (partnerCount > 0) statPartners.textContent = partnerCount;
    }
    // Язык: мгновенный рендер на localStorage/navigator.language,
    // затем неблокирующее уточнение по IP-геолокации
    var initialLang = detectInitialLang();
    setLanguage(initialLang.lang);
    if (!initialLang.final) refineLangByGeo();

    setupTilt(); // bind static tilt tiles (partners, support)
    setupScrollReveal(); // observe static reveals (section heads, partner cards)
    setupStatCounters();
    setupScrollProgress();
    setupMagneticButtons();
    setupScrollSpy();
});
