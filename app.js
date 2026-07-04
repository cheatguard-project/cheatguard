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

    // --- Ambient drifting fog blobs (systemdlc-inspired) ---
    var canvas = document.getElementById('particlesCanvas');
    var ctx = canvas.getContext('2d');
    var blobs = [];
    var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            baseR: isLarge ? (260 + Math.random() * 260) : (110 + Math.random() * 150),
            vx: (Math.random() - 0.5) * 0.08,
            vy: (Math.random() - 0.5) * 0.06 - 0.01,
            h: p.h, s: p.s, l: p.l,
            baseOp: isLarge ? (0.018 + Math.random() * 0.025) : (0.024 + Math.random() * 0.028),
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

    var BLOB_COUNT = 10;
    for (var i = 0; i < BLOB_COUNT; i++) blobs.push(createBlob(i));

    function animateBlobs() {
        var W = window.innerWidth, H = window.innerHeight;
        ctx.clearRect(0, 0, W, H);
        // Additive blending for soft "light through fog" feel
        ctx.globalCompositeOperation = 'screen';
        for (var i = 0; i < blobs.length; i++) {
            var b = blobs[i];
            b.swirl += b.swirlSpeed;
            b.swirl2 += b.swirl2Speed;
            b.pulse += b.pulseSpeed;
            b.x += b.vx;
            b.y += b.vy;
            // wrap toroidally
            if (b.x < -b.baseR) b.x = W + b.baseR;
            else if (b.x > W + b.baseR) b.x = -b.baseR;
            if (b.y < -b.baseR) b.y = H + b.baseR;
            else if (b.y > H + b.baseR) b.y = -b.baseR;

            // Compound swirl offset (two frequencies → organic wandering)
            var ox = Math.cos(b.swirl) * b.swirlAmp + Math.cos(b.swirl2) * b.swirl2Amp;
            var oy = Math.sin(b.swirl * 1.3) * b.swirlAmp + Math.sin(b.swirl2 * 1.7) * b.swirl2Amp;
            var pulseFactor = 1 + Math.sin(b.pulse) * 0.10;
            var r = b.baseR * pulseFactor;
            var op = b.baseOp * (0.78 + Math.sin(b.pulse * 0.7) * 0.18);
            var cx = b.x + ox, cy = b.y + oy;

            // Save + apply a slight squish for non-circular smoke shape
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(b.swirl * 0.22);
            ctx.scale(1.35, b.squish);
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

        var flagMap = { 'ru': '🇷🇺', 'en': '🇬🇧', 'pl': '🇵🇱' };
        document.getElementById('langFlag').textContent = flagMap[lang];
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
        langSwitcher.classList.remove('open');
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
            setLanguage(opt.getAttribute('data-lang'));
        });
    });

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

    // --- Toast ---
    var toastTimeout;
    function showToast() {
        clearTimeout(toastTimeout);
        // Force reflow so the entrance + check + sparks animations replay on every call
        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');
        toastTimeout = setTimeout(function() { toast.classList.remove('show'); }, 2400);
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
    setLanguage('ru');
    setupTilt(); // bind static tilt tiles (partners, support)
    setupScrollReveal(); // observe static reveals (section heads, partner cards)
    setupStatCounters();
});
