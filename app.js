document.addEventListener('DOMContentLoaded', function() {
    // --- State ---
    var currentLang = 'ru';
    var activeShell = 'powershell';
    var activeCategory = 'all';

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
    var toast = document.getElementById('toast');
    var statCmds = document.getElementById('statCmds');

    // --- Custom Cursor Glow ---
    document.addEventListener('mousemove', function(e) {
        cursorGlow.style.left = e.clientX + 'px';
        cursorGlow.style.top = e.clientY + 'px';
    });

    // --- Particles ---
    var canvas = document.getElementById('particlesCanvas');
    var ctx = canvas.getContext('2d');
    var particles = [];

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function createParticle() {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 1.5 + 0.5,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5,
            opacity: Math.random() * 0.5 + 0.1
        };
    }

    for (var i = 0; i < 50; i++) {
        particles.push(createParticle());
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            p.x += p.speedX;
            p.y += p.speedY;
            if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
                particles[i] = createParticle();
            }
            ctx.fillStyle = 'rgba(255, 255, 255, ' + p.opacity + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        requestAnimationFrame(animateParticles);
    }
    animateParticles();

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

    // --- Render Commands ---
    function renderCommands() {
        commandsList.innerHTML = '';

        var filtered = window.commandsData.filter(function(cmd) {
            var matchShell = cmd.shell === activeShell;
            var matchCategory = activeCategory === 'all' || cmd.category === activeCategory;
            return matchShell && matchCategory;
        });

        if (filtered.length === 0) {
            var emptyP = document.createElement('p');
            emptyP.style.cssText = 'color: var(--grey); text-align: center; padding: 40px;';
            emptyP.textContent = 'Нет команд.';
            commandsList.appendChild(emptyP);
            return;
        }

        filtered.forEach(function(cmd, idx) {
            var card = document.createElement('div');
            card.className = 'cmd-card';
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

            var titleSpan = document.createElement('span');
            titleSpan.className = 'cmd-title-text';
            titleSpan.textContent = title;

            var badgeSpan = document.createElement('span');
            badgeSpan.className = 'cmd-badge';
            badgeSpan.textContent = catName;

            headerLeft.appendChild(numSpan);
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
            bodyInner.appendChild(descDiv);
            bodyInner.appendChild(codeWrap);
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

    // --- Render Artifacts ---
    function renderArtifacts() {
        artifactsGrid.innerHTML = '';
        var lblTools = (window.i18n[currentLang] && window.i18n[currentLang]['art_tools_lbl']) || 'Инструменты';

        window.artifactsData.forEach(function(art, idx) {
            var card = document.createElement('div');
            card.className = 'art-card reveal';
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
    }

    // --- Render FAQ ---
    function renderFAQ() {
        faqList.innerHTML = '';

        window.faqData.forEach(function(item) {
            var el = document.createElement('div');
            el.className = 'faq-item reveal';

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
    }

    // --- Toast ---
    var toastTimeout;
    function showToast() {
        clearTimeout(toastTimeout);
        toast.classList.add('show');
        toastTimeout = setTimeout(function() { toast.classList.remove('show'); }, 2500);
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

    // --- Init ---
    statCmds.textContent = window.commandsData.length + '+';
    setLanguage('ru');
});
