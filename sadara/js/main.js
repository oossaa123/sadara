/* Shared public-site behavior. API requests use the site's origin by default. */
const API_BASE = (() => {
    const configured = window.SADARA_API_BASE || document.querySelector('meta[name="api-base"]')?.content;
    if (configured) return String(configured).replace(/\/$/, '');
    return window.location.protocol === 'file:' ? 'http://127.0.0.1:5001' : '';
})();

(() => {
    'use strict';

    const storage = {
        get(key) { try { return localStorage.getItem(key); } catch { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private browsing may disable storage. */ } }
    };
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollBehavior = reducedMotion ? 'auto' : 'smooth';

    function safeUrl(value, fallback = '') {
        if (typeof value !== 'string' || !value.trim()) return fallback;
        try {
            const url = new URL(value, window.location.href);
            return ['http:', 'https:', 'file:'].includes(url.protocol) ? url.href : fallback;
        } catch { return fallback; }
    }

    function mediaUrl(value) {
        const path = typeof value === 'string' ? value : '';
        return safeUrl(path.startsWith('/media/') ? API_BASE + path : path, 'assets/images/hero.png');
    }

    async function apiRequest(path, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(API_BASE + path, {
                ...options,
                headers: { Accept: 'application/json', ...options.headers },
                signal: controller.signal,
                cache: 'no-store'
            });
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error('تعذر الاتصال بخدمة الموقع. يرجى المحاولة مجدداً.');
            }
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'تعذر إتمام الطلب. يرجى مراجعة البيانات والمحاولة مجدداً.');
            return data;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('استغرق الاتصال وقتاً طويلاً. تحقق من اتصالك وحاول مجدداً.');
            if (error instanceof TypeError) throw new Error('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.');
            throw error;
        } finally { clearTimeout(timeout); }
    }

    function initNavigation() {
        const themeButton = document.getElementById('theme-toggle');
        if (themeButton) {
            const updateLabel = () => {
                const dark = document.documentElement.dataset.theme === 'dark';
                themeButton.setAttribute('aria-label', dark ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن');
                themeButton.setAttribute('aria-pressed', String(dark));
                const icon = themeButton.querySelector('i');
                if (icon && !themeButton.classList.contains('theme-toggle-label')) icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
            };
            updateLabel();
            themeButton.addEventListener('click', () => {
                const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                document.documentElement.dataset.theme = theme;
                storage.set('theme', theme);
                updateLabel();
            });
        }

        const menuButton = document.getElementById('menu-toggle');
        const menu = document.getElementById('nav-menu');
        if (menuButton && menu) {
            const toggleMenu = open => {
                menu.classList.toggle('active', open);
                menuButton.setAttribute('aria-expanded', String(open));
                menuButton.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
                const icon = menuButton.querySelector('i');
                if (icon) icon.className = open ? 'fas fa-times' : 'fas fa-bars';
            };
            menuButton.setAttribute('aria-controls', menu.id);
            toggleMenu(false);
            menuButton.addEventListener('click', () => toggleMenu(!menu.classList.contains('active')));
            menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => toggleMenu(false)));
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && menu.classList.contains('active')) {
                    toggleMenu(false);
                    menuButton.focus();
                }
            });
            document.addEventListener('click', event => {
                if (!menu.contains(event.target) && !menuButton.contains(event.target)) toggleMenu(false);
            });
        }

        const header = document.getElementById('header');
        const toTop = document.getElementById('float-totop');
        const updateScroll = () => {
            const scrolled = window.scrollY > 50;
            header?.classList.toggle('scrolled', scrolled);
            toTop?.classList.toggle('show', scrolled);
        };
        window.addEventListener('scroll', updateScroll, { passive: true });
        updateScroll();
        toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: scrollBehavior }));

        // Ordinary page navigation preserves each page's metadata, styles and browser history.
        const prefetched = new Set();
        const prefetch = event => {
            const link = event.target.closest?.('a[href]');
            if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
            const url = new URL(link.href, location.href);
            if (url.origin !== location.origin || !url.pathname.endsWith('.html') || url.pathname.includes('/dashbord/')) return;
            if (prefetched.has(url.pathname)) return;
            prefetched.add(url.pathname);
            const hint = document.createElement('link');
            hint.rel = 'prefetch';
            hint.href = url.pathname;
            document.head.appendChild(hint);
        };
        document.addEventListener('pointerover', prefetch, { passive: true });
        document.addEventListener('focusin', prefetch);
    }

    function initTabsAndFaq() {
        const tabs = [...document.querySelectorAll('.tab-btn')];
        tabs.forEach((tab, index) => {
            const panel = document.getElementById(tab.dataset.tab);
            if (!panel) return;
            tab.id ||= `department-tab-${index}`;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', panel.id);
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', tab.id);
            const select = () => tabs.forEach(button => {
                const active = button === tab;
                button.classList.toggle('active', active);
                button.setAttribute('aria-selected', String(active));
                button.tabIndex = active ? 0 : -1;
                document.getElementById(button.dataset.tab)?.classList.toggle('active', active);
            });
            tab.setAttribute('aria-selected', String(tab.classList.contains('active')));
            tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
            tab.addEventListener('click', select);
            tab.addEventListener('keydown', event => {
                let next;
                if (event.key === 'ArrowLeft') next = (index + 1) % tabs.length;
                if (event.key === 'ArrowRight') next = (index - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = tabs.length - 1;
                if (next !== undefined) { event.preventDefault(); tabs[next].click(); tabs[next].focus(); }
            });
        });
        document.querySelector('.dept-tabs')?.setAttribute('role', 'tablist');

        const items = [...document.querySelectorAll('.faq-item')];
        items.forEach((item, index) => {
            const header = item.querySelector('.faq-header');
            const content = item.querySelector('.faq-content');
            if (!header || !content) return;
            header.setAttribute('role', 'button');
            header.tabIndex = 0;
            content.id ||= `faq-answer-${index}`;
            header.setAttribute('aria-controls', content.id);
            header.setAttribute('aria-expanded', String(item.classList.contains('active')));
            const toggle = () => {
                const open = !item.classList.contains('active');
                items.forEach(other => {
                    other.classList.remove('active');
                    other.querySelector('.faq-header')?.setAttribute('aria-expanded', 'false');
                    const answer = other.querySelector('.faq-content');
                    if (answer) answer.style.maxHeight = '';
                });
                if (open) {
                    item.classList.add('active');
                    header.setAttribute('aria-expanded', 'true');
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
            };
            header.addEventListener('click', toggle);
            header.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
            });
        });
    }

    let revealObserver;
    function revealContent() {
        const elements = document.querySelectorAll('.animate-on-scroll:not(.animated)');
        if (reducedMotion || !('IntersectionObserver' in window)) {
            elements.forEach(element => element.classList.add('animated'));
            return;
        }
        revealObserver ||= new IntersectionObserver(entries => entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('animated'); revealObserver.unobserve(entry.target); }
        }), { threshold: 0.08 });
        elements.forEach(element => revealObserver.observe(element));
    }

    let countdownTimer;
    function setCountdown(value) {
        const units = ['days', 'hours', 'minutes', 'seconds'].map(id => document.getElementById(id));
        if (units.some(unit => !unit)) return;
        clearInterval(countdownTimer);
        const deadline = Date.parse(value || '');
        const container = units[0].closest('.countdown-box');
        // An administrator supplies the deadline; never invent a deadline on each visit.
        if (!Number.isFinite(deadline) || deadline <= Date.now()) {
            if (container) container.hidden = true;
            return;
        }
        if (container) container.hidden = false;
        const update = () => {
            const remaining = Math.max(0, deadline - Date.now());
            const values = [Math.floor(remaining / 86400000), Math.floor(remaining / 3600000) % 24, Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60];
            units.forEach((unit, index) => { unit.textContent = String(values[index]).padStart(2, '0'); });
            if (!remaining) clearInterval(countdownTimer);
        };
        update();
        if (deadline > Date.now()) countdownTimer = setInterval(update, 1000);
    }

    function applySettings(settings) {
        window.latestSettings = settings;
        const fields = {
            top_phone: ['top-phone', 'footer-phone', 'contact-info-phone', 'contact-info-whatsapp'], top_email: ['top-email', 'footer-email', 'contact-info-email'], top_address: ['top-address', 'footer-address', 'contact-info-address'],
            hero_desc: ['hero-desc'], about_us_p1: ['about-us-p1'], about_us_p2: ['about-us-p2'], about_vision: ['about-vision'],
            about_mission: ['about-mission'], about_goals: ['about-goals'], dean_name: ['dean-name'], dean_title: ['dean-title'],
            dean_message_quote: ['dean-message-quote'], dean_message_p2: ['dean-message-p2']
        };
        Object.entries(fields).forEach(([key, ids]) => {
            if (settings[key] === undefined || settings[key] === null) return;
            ids.forEach(id => { const element = document.getElementById(id); if (element) element.textContent = String(settings[key]); });
        });
        const phone = String(settings.top_phone || '').replace(/\D/g, '');
        if (phone) {
            ['footer-whatsapp', 'contact-info-whatsapp'].forEach(id => {
                const whatsapp = document.getElementById(id);
                if (whatsapp) whatsapp.href = 'https://wa.me/' + phone;
            });
            ['top-phone', 'footer-phone', 'contact-info-phone'].forEach(id => {
                const link = document.getElementById(id)?.closest('a');
                if (link) link.href = 'tel:+' + phone;
            });
        }
        if (settings.top_email) {
            ['top-email', 'footer-email', 'contact-info-email'].forEach(id => {
                const link = document.getElementById(id)?.closest('a');
                if (link) link.href = 'mailto:' + settings.top_email;
            });
        }
        Object.entries({ social_facebook: 'top-fb', social_twitter: 'top-tw', social_linkedin: 'top-li', social_youtube: 'top-yt' }).forEach(([key, id]) => {
            const element = document.getElementById(id);
            if (element && settings[key]) element.href = safeUrl(settings[key], '#');
        });
        const tag = document.getElementById('hero-tag');
        if (tag && settings.hero_tag) tag.textContent = settings.hero_tag;
        const title = document.getElementById('hero-title');
        if (title && settings.hero_title) {
            const subtitle = document.createElement('span');
            subtitle.id = 'hero-subtitle';
            subtitle.textContent = settings.hero_subtitle || 'صدارة التعليم لمستقبل واعد';
            title.replaceChildren(document.createTextNode(String(settings.hero_title)), document.createElement('br'), subtitle);
        } else if (settings.hero_subtitle && document.getElementById('hero-subtitle')) {
            document.getElementById('hero-subtitle').textContent = settings.hero_subtitle;
        }
        Object.entries({ about_image: 'about-image', dean_avatar: 'dean-avatar' }).forEach(([key, id]) => {
            const element = document.getElementById(id);
            if (element && settings[key]) element.src = mediaUrl(settings[key]);
        });
        ['students', 'depts', 'employment', 'labs'].forEach(key => {
            const element = document.getElementById('stat-' + key);
            const value = settings['stat_' + key];
            if (element && value !== undefined && value !== null && Number.isFinite(Number(value))) {
                element.dataset.target = value;
                element.textContent = value + (element.dataset.suffix || '');
            }
        });
        setCountdown(settings.countdown_end);
    }

    function iconHtml(value, size = 24) {
        if (typeof value === 'string' && /^(https?:|\/|assets\/)/.test(value)) {
            return `<img src="${escapeHtml(mediaUrl(value))}" alt="" width="${size}" height="${size}" style="object-fit:contain">`;
        }
        const name = typeof value === 'string' && /^fa-[a-z0-9-]+$/.test(value) ? value : 'fa-graduation-cap';
        return `<i class="fas ${name}" aria-hidden="true"></i>`;
    }

    function bindImageFallbacks(container) {
        container.querySelectorAll('img').forEach(image => {
            image.addEventListener('error', () => { image.src = new URL('assets/images/hero.png', location.href).href; }, { once: true });
        });
    }

    function renderDepartments(departments) {
        const medical = document.getElementById('medical-tab');
        const tech = document.getElementById('tech-tab');
        const detailedMedical = document.getElementById('medical-depts-container');
        const detailedTech = document.getElementById('tech-depts-container');
        const containers = [medical, tech, detailedMedical, detailedTech].filter(Boolean);
        containers.forEach(container => container.replaceChildren());
        const phone = String(window.latestSettings?.top_phone || '967777777777').replace(/\D/g, '');
        departments.forEach(department => {
            const category = department.category === 'medical' ? 'medical' : 'tech';
            const name = escapeHtml(department.name);
            if (medical && tech) {
                const card = document.createElement('div');
                card.className = `glass dept-card dept-card-${category} animate-on-scroll`;
                const code = encodeURIComponent(String(department.code || ''));
                const inquiry = encodeURIComponent(`مرحباً كلية الصدارة، أود الاستفسار عن تخصص ${department.name}.`);
                card.innerHTML = `<div class="dept-card-img-wrapper"><span class="img-floating-badge"><i class="far fa-clock" aria-hidden="true"></i> ${escapeHtml(department.duration)}</span><img src="${escapeHtml(mediaUrl(department.image_url))}" alt="${name}" class="dept-card-img" loading="lazy" decoding="async"><div class="dept-card-icon-badge">${iconHtml(department.icon)}</div></div><div class="dept-card-body"><h3>${name}</h3><p>${escapeHtml(department.description)}</p><div class="dept-card-actions"><a href="departments.html#${code}" class="btn btn-outline btn-sm">تفاصيل البرنامج</a><a href="https://wa.me/${phone}?text=${inquiry}" target="_blank" rel="noopener noreferrer" class="btn whatsapp-inquire-btn btn-sm"><i class="fab fa-whatsapp" aria-hidden="true"></i> واتساب</a></div></div>`;
                (category === 'medical' ? medical : tech).appendChild(card);
            }
            if (detailedMedical && detailedTech) {
                const card = document.createElement('div');
                card.className = `glass glass-padding dept-detail-card dept-detail-${category}`;
                card.id = String(department.code || '');
                const courses = Array.isArray(department.courses) ? department.courses : [];
                const rows = courses.map((course, index) => `<tr><td>${escapeHtml(course.code)}</td><td>${escapeHtml(course.name)}</td><td>${escapeHtml(course.type)}</td>${index === 0 ? `<td rowspan="${courses.length}">${escapeHtml(department.careers)}</td>` : ''}</tr>`).join('');
                card.innerHTML = `<div class="dept-detail-heading"><h3>${iconHtml(department.icon, 32)} ${name}</h3><span class="badge badge-gold">المدة: ${escapeHtml(department.duration)}</span></div><p class="dept-detail-description">${escapeHtml(department.description)}</p><div class="table-responsive"><table class="custom-table"><thead><tr><th scope="col">رمز المساق</th><th scope="col">اسم المساق الدراسي</th><th scope="col">نوع التدريب</th><th scope="col">مجالات العمل المستقبلية</th></tr></thead><tbody>${rows || `<tr><td colspan="4">${escapeHtml(department.careers) || 'لم تُضف خطة المساقات بعد.'}</td></tr>`}</tbody></table></div>`;
                (category === 'medical' ? detailedMedical : detailedTech).appendChild(card);
            }
        });
        containers.forEach(container => {
            if (!container.children.length) container.innerHTML = '<p class="data-feedback">لا توجد تخصصات مضافة في هذا القسم حالياً.</p>';
            bindImageFallbacks(container);
        });
        const select = document.getElementById('student-dept');
        if (select) {
            const selected = select.value;
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.disabled = true;
            placeholder.textContent = departments.length ? 'اختر التخصص...' : 'لا توجد تخصصات متاحة حالياً';
            select.replaceChildren(placeholder);
            departments.forEach(department => {
                const option = document.createElement('option');
                option.value = department.name;
                option.textContent = department.name;
                select.appendChild(option);
            });
            select.value = [...select.options].some(option => option.value === selected) ? selected : '';
            select.disabled = departments.length === 0;
        }
        revealContent();
        if (location.hash) {
            let id;
            try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = location.hash.slice(1); }
            document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
        }
    }

    function renderLabs(labs) {
        const grid = document.querySelector('.labs-grid');
        if (!grid) return;
        grid.replaceChildren();
        labs.forEach(lab => {
            const card = document.createElement('div');
            card.className = 'glass lab-card animate-on-scroll';
            const medical = lab.category === 'medical';
            const specs = (Array.isArray(lab.specs) ? lab.specs : []).map(spec => `<span class="lab-spec-badge"><i class="fas fa-check-circle" aria-hidden="true"></i> ${escapeHtml(spec)}</span>`).join('');
            card.innerHTML = `<div class="lab-card-img-wrapper"><span class="img-floating-badge">${medical ? 'معمل طبي' : 'معمل تقني'}</span><img src="${escapeHtml(mediaUrl(lab.image_url))}" alt="${escapeHtml(lab.name)}" class="lab-card-img" loading="lazy" decoding="async"></div><div class="lab-card-body"><h3>${escapeHtml(lab.name)}</h3><p>${escapeHtml(lab.description)}</p><div class="lab-specs">${specs}</div></div>`;
            grid.appendChild(card);
        });
        if (!labs.length) grid.innerHTML = '<p class="data-feedback">لا توجد معامل مضافة حالياً.</p>';
        bindImageFallbacks(grid);
        revealContent();
    }

    function renderFees(fees) {
        const body = document.getElementById('fees-table-body');
        if (!body) return;
        body.replaceChildren();
        fees.forEach(fee => {
            const row = document.createElement('tr');
            ['department_name', 'official_fee', 'discounted_fee', 'installment', 'payment_options'].forEach(key => {
                const cell = document.createElement('td');
                cell.textContent = fee[key] ?? '';
                row.appendChild(cell);
            });
            body.appendChild(row);
        });
        if (!fees.length) body.innerHTML = '<tr><td colspan="5" class="data-feedback">لا توجد رسوم دراسية مضافة حالياً.</td></tr>';
    }

    function showDataError(containers, retry, hasCachedData) {
        containers.forEach(container => {
            if (!container || container.querySelector('.data-error')) return;
            const message = document.createElement(container.tagName === 'TBODY' ? 'tr' : 'div');
            message.className = 'data-feedback data-error';
            message.setAttribute('role', 'status');
            let parent = message;
            if (message.tagName === 'TR') {
                parent = document.createElement('td'); parent.colSpan = 5; message.appendChild(parent);
            }
            const text = document.createElement('p');
            text.textContent = hasCachedData ? 'نعرض آخر بيانات محفوظة؛ تعذر تحديثها الآن.' : 'تعذر تحميل البيانات حالياً. يرجى المحاولة مجدداً.';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-outline btn-sm data-retry';
            button.textContent = 'إعادة المحاولة';
            button.addEventListener('click', retry);
            parent.append(text, button);
            if (!hasCachedData) container.replaceChildren(message); else container.appendChild(message);
        });
    }

    async function loadResource({ path, cacheKey, render, containers = [], object = false }) {
        const valid = data => object ? data && typeof data === 'object' && !Array.isArray(data) :
            Array.isArray(data) && data.every(item => item && typeof item === 'object' && !Array.isArray(item));
        let cache;
        try { cache = JSON.parse(storage.get(cacheKey)); } catch { /* Ignore a corrupt cache. */ }
        const hasCache = valid(cache);
        if (hasCache) render(cache);
        const retry = () => loadResource({ path, cacheKey, render, containers, object });
        containers.forEach(container => {
            container?.querySelectorAll('.data-error').forEach(error => error.remove());
            container?.setAttribute('aria-busy', 'true');
        });
        try {
            const data = await apiRequest(path);
            if (!valid(data)) throw new Error('Invalid API response');
            storage.set(cacheKey, JSON.stringify(data));
            if (!hasCache || JSON.stringify(data) !== JSON.stringify(cache)) render(data);
        } catch {
            if (!object) showDataError(containers, retry, hasCache);
        } finally {
            containers.forEach(container => container?.setAttribute('aria-busy', 'false'));
        }
    }

    function initForm(id, path, getData, successMessage) {
        const form = document.getElementById(id);
        if (!form) return;
        const button = form.querySelector('button[type="submit"]');
        if (!button) return;
        const feedback = document.createElement('div');
        feedback.className = 'form-feedback';
        feedback.hidden = true;
        feedback.tabIndex = -1;
        form.appendChild(feedback);
        form.querySelectorAll('input, select, textarea').forEach(input => {
            if (input.id) input.name ||= input.id;
            if (input.type === 'tel') { input.inputMode = 'tel'; input.maxLength = 50; }
            if (input.type === 'text') input.maxLength = input.id === 'contact-subject' ? 500 : 255;
            if (input.type === 'email') input.maxLength = 254;
        });
        const name = form.querySelector('input[id$="name"]');
        if (name) name.autocomplete = 'name';
        const phone = form.querySelector('input[type="tel"]');
        if (phone) phone.autocomplete = 'tel';
        const email = form.querySelector('input[type="email"]');
        if (email) email.autocomplete = 'email';
        const department = form.querySelector('#student-dept');
        department?.querySelectorAll('option').forEach(option => { if (option.value) option.value = option.textContent.trim(); });
        let submitting = false;
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (submitting || !form.reportValidity()) return;
            const data = getData();
            if (Object.values(data).some(value => typeof value === 'string' && !value.trim())) {
                feedback.dataset.state = 'error';
                feedback.setAttribute('role', 'alert');
                feedback.textContent = 'يرجى تعبئة جميع الحقول المطلوبة بشكل صحيح.';
                feedback.hidden = false;
                feedback.focus();
                return;
            }
            submitting = true;
            const original = button.innerHTML;
            button.disabled = true;
            button.textContent = 'جاري الإرسال…';
            form.setAttribute('aria-busy', 'true');
            feedback.hidden = true;
            try {
                await apiRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                form.reset();
                feedback.dataset.state = 'success';
                feedback.setAttribute('role', 'status');
                feedback.textContent = successMessage;
            } catch (error) {
                feedback.dataset.state = 'error';
                feedback.setAttribute('role', 'alert');
                feedback.textContent = error.message;
            } finally {
                submitting = false;
                button.disabled = false;
                button.innerHTML = original;
                form.removeAttribute('aria-busy');
                feedback.hidden = false;
                feedback.focus();
            }
        });
    }

    function initCarousel() {
        const track = document.querySelector('.carousel-track');
        const dotsContainer = document.querySelector('.carousel-dots');
        if (!track || !dotsContainer || !track.children.length) return;
        const slides = [...track.children];
        let index = 0;
        const dots = slides.map((slide, position) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'carousel-dot';
            dot.setAttribute('aria-label', `عرض شهادة الطالب ${position + 1}`);
            dot.addEventListener('click', () => update(position));
            dotsContainer.appendChild(dot);
            return dot;
        });
        const update = position => {
            index = position;
            track.style.transform = `translateX(${index * 100}%)`;
            dots.forEach((dot, position) => {
                dot.classList.toggle('active', position === index);
                dot.setAttribute('aria-pressed', String(position === index));
                slides[position].setAttribute('aria-hidden', String(position !== index));
            });
        };
        document.querySelector('.carousel-btn-next')?.addEventListener('click', () => update((index + 1) % slides.length));
        document.querySelector('.carousel-btn-prev')?.addEventListener('click', () => update((index - 1 + slides.length) % slides.length));
        update(0);
        // Manual controls keep the reading position stable for keyboard and screen-reader users.
    }

    function init() {
        initNavigation();
        initTabsAndFaq();
        initCarousel();
        revealContent();
        setCountdown();
        document.querySelectorAll('.stat-number[data-target]').forEach(element => {
            element.textContent = element.dataset.target + (element.dataset.suffix || '');
        });
        const value = id => document.getElementById(id)?.value.trim() || '';
        initForm('quick-admission-form', '/api/applicants', () => ({ name: value('student-name'), phone: value('student-phone'), gpa: Number(value('student-gpa')), stream: value('student-stream'), department: value('student-dept') }), 'تم إرسال طلب التسجيل بنجاح. سيتواصل معك فريق القبول لاستكمال الإجراءات.');
        initForm('contact-form', '/api/contact', () => ({ name: value('contact-name'), email: value('contact-email'), phone: value('contact-phone'), subject: value('contact-subject'), message: value('contact-message') }), 'تم إرسال رسالتك بنجاح. شكراً لتواصلك معنا، سنرد عليك في أقرب وقت ممكن.');
        loadResource({ path: '/api/settings', cacheKey: 'sadara_settings', render: applySettings, object: true });
        const departmentContainers = ['medical-tab', 'tech-tab', 'medical-depts-container', 'tech-depts-container'].map(id => document.getElementById(id)).filter(Boolean);
        if (departmentContainers.length || document.getElementById('student-dept')) {
            loadResource({ path: '/api/departments', cacheKey: 'sadara_depts', render: renderDepartments, containers: departmentContainers });
        }
        const labsGrid = document.querySelector('.labs-grid');
        if (labsGrid) loadResource({ path: '/api/labs', cacheKey: 'sadara_labs', render: renderLabs, containers: [labsGrid] });
        const feesBody = document.getElementById('fees-table-body');
        if (feesBody) loadResource({ path: '/api/fees', cacheKey: 'sadara_fees', render: renderFees, containers: [feesBody] });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();

// ==========================================
// FontAwesome SVG Replacer & Mutation Observer
// ==========================================
(function() {
    const svgIcons = {
  "fa-facebook-f": "<svg viewBox=\"0 0 320 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z\" /></svg>",
  "fa-instagram": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z\" /></svg>",
  "fa-linkedin-in": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z\" /></svg>",
  "fa-twitter": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z\" /></svg>",
  "fa-whatsapp": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z\" /></svg>",
  "fa-youtube": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z\" /></svg>",
  "fa-address-book": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M96 0C60.7 0 32 28.7 32 64V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H96zM208 288h64c44.2 0 80 35.8 80 80c0 8.8-7.2 16-16 16H144c-8.8 0-16-7.2-16-16c0-44.2 35.8-80 80-80zm-32-96a64 64 0 1 1 128 0 64 64 0 1 1 -128 0zM512 80c0-8.8-7.2-16-16-16s-16 7.2-16 16v64c0 8.8 7.2 16 16 16s16-7.2 16-16V80zM496 192c-8.8 0-16 7.2-16 16v64c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm16 144c0-8.8-7.2-16-16-16s-16 7.2-16 16v64c0 8.8 7.2 16 16 16s16-7.2 16-16V336z\" /></svg>",
  "fa-arrow-left": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z\" /></svg>",
  "fa-award": "<svg viewBox=\"0 0 384 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M173.8 5.5c11-7.3 25.4-7.3 36.4 0L228 17.2c6 3.9 13 5.8 20.1 5.4l21.3-1.3c13.2-.8 25.6 6.4 31.5 18.2l9.6 19.1c3.2 6.4 8.4 11.5 14.7 14.7L344.5 83c11.8 5.9 19 18.3 18.2 31.5l-1.3 21.3c-.4 7.1 1.5 14.2 5.4 20.1l11.8 17.8c7.3 11 7.3 25.4 0 36.4L366.8 228c-3.9 6-5.8 13-5.4 20.1l1.3 21.3c.8 13.2-6.4 25.6-18.2 31.5l-19.1 9.6c-6.4 3.2-11.5 8.4-14.7 14.7L301 344.5c-5.9 11.8-18.3 19-31.5 18.2l-21.3-1.3c-7.1-.4-14.2 1.5-20.1 5.4l-17.8 11.8c-11 7.3-25.4 7.3-36.4 0L156 366.8c-6-3.9-13-5.8-20.1-5.4l-21.3 1.3c-13.2 .8-25.6-6.4-31.5-18.2l-9.6-19.1c-3.2-6.4-8.4-11.5-14.7-14.7L39.5 301c-11.8-5.9-19-18.3-18.2-31.5l1.3-21.3c.4-7.1-1.5-14.2-5.4-20.1L5.5 210.2c-7.3-11-7.3-25.4 0-36.4L17.2 156c3.9-6 5.8-13 5.4-20.1l-1.3-21.3c-.8-13.2 6.4-25.6 18.2-31.5l19.1-9.6C65 70.2 70.2 65 73.4 58.6L83 39.5c5.9-11.8 18.3-19 31.5-18.2l21.3 1.3c7.1 .4 14.2-1.5 20.1-5.4L173.8 5.5zM272 192a80 80 0 1 0 -160 0 80 80 0 1 0 160 0zM1.3 441.8L44.4 339.3c.2 .1 .3 .2 .4 .4l9.6 19.1c11.7 23.2 36 37.3 62 35.8l21.3-1.3c.2 0 .5 0 .7 .2l17.8 11.8c5.1 3.3 10.5 5.9 16.1 7.7l-37.6 89.3c-2.3 5.5-7.4 9.2-13.3 9.7s-11.6-2.2-14.8-7.2L74.4 455.5l-56.1 8.3c-5.7 .8-11.4-1.5-15-6s-4.3-10.7-2.1-16zm248 60.4L211.7 413c5.6-1.8 11-4.3 16.1-7.7l17.8-11.8c.2-.1 .4-.2 .7-.2l21.3 1.3c26 1.5 50.3-12.6 62-35.8l9.6-19.1c.1-.2 .2-.3 .4-.4l43.2 102.5c2.2 5.3 1.4 11.4-2.1 16s-9.3 6.9-15 6l-56.1-8.3-32.2 49.2c-3.2 5-8.9 7.7-14.8 7.2s-11-4.3-13.3-9.7z\" /></svg>",
  "fa-bars": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z\" /></svg>",
  "fa-book": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z\" /></svg>",
  "fa-book-open": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M249.6 471.5c10.8 3.8 22.4-4.1 22.4-15.5V78.6c0-4.2-1.6-8.4-5-11C247.4 52 202.4 32 144 32C93.5 32 46.3 45.3 18.1 56.1C6.8 60.5 0 71.7 0 83.8V454.1c0 11.9 12.8 20.2 24.1 16.5C55.6 460.1 105.5 448 144 448c33.9 0 79 14 105.6 23.5zm76.8 0C353 462 398.1 448 432 448c38.5 0 88.4 12.1 119.9 22.6c11.3 3.8 24.1-4.6 24.1-16.5V83.8c0-12.1-6.8-23.3-18.1-27.6C529.7 45.3 482.5 32 432 32c-58.4 0-103.4 20-123 35.6c-3.3 2.6-5 6.8-5 11V456c0 11.4 11.7 19.3 22.4 15.5z\" /></svg>",
  "fa-bullseye": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M448 256A192 192 0 1 0 64 256a192 192 0 1 0 384 0zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm256 80a80 80 0 1 0 0-160 80 80 0 1 0 0 160zm0-224a144 144 0 1 1 0 288 144 144 0 1 1 0-288zM224 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z\" /></svg>",
  "fa-calendar-alt": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M128 0c17.7 0 32 14.3 32 32V64H288V32c0-17.7 14.3-32 32-32s32 14.3 32 32V64h48c26.5 0 48 21.5 48 48v48H0V112C0 85.5 21.5 64 48 64H96V32c0-17.7 14.3-32 32-32zM0 192H448V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V192zm64 80v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16zm128 0v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H208c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H336zM64 400v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H208zm112 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H336c-8.8 0-16 7.2-16 16z\" /></svg>",
  "fa-certificate": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M211 7.3C205 1 196-1.4 187.6 .8s-14.9 8.9-17.1 17.3L154.7 80.6l-62-17.5c-8.4-2.4-17.4 0-23.5 6.1s-8.5 15.1-6.1 23.5l17.5 62L18.1 170.6c-8.4 2.1-15 8.7-17.3 17.1S1 205 7.3 211l46.2 45L7.3 301C1 307-1.4 316 .8 324.4s8.9 14.9 17.3 17.1l62.5 15.8-17.5 62c-2.4 8.4 0 17.4 6.1 23.5s15.1 8.5 23.5 6.1l62-17.5 15.8 62.5c2.1 8.4 8.7 15 17.1 17.3s17.3-.2 23.4-6.4l45-46.2 45 46.2c6.1 6.2 15 8.7 23.4 6.4s14.9-8.9 17.1-17.3l15.8-62.5 62 17.5c8.4 2.4 17.4 0 23.5-6.1s8.5-15.1 6.1-23.5l-17.5-62 62.5-15.8c8.4-2.1 15-8.7 17.3-17.1s-.2-17.3-6.4-23.4l-46.2-45 46.2-45c6.2-6.1 8.7-15 6.4-23.4s-8.9-14.9-17.3-17.1l-62.5-15.8 17.5-62c2.4-8.4 0-17.4-6.1-23.5s-15.1-8.5-23.5-6.1l-62 17.5L341.4 18.1c-2.1-8.4-8.7-15-17.1-17.3S307 1 301 7.3L256 53.5 211 7.3z\" /></svg>",
  "fa-chalkboard-teacher": "<svg viewBox=\"0 0 640 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M160 64c0-35.3 28.7-64 64-64H576c35.3 0 64 28.7 64 64V352c0 35.3-28.7 64-64 64H336.8c-11.8-25.5-29.9-47.5-52.4-64H384V320c0-17.7 14.3-32 32-32h64c17.7 0 32 14.3 32 32v32h64V64L224 64v49.1C205.2 102.2 183.3 96 160 96V64zm0 64a96 96 0 1 1 0 192 96 96 0 1 1 0-192zM133.3 352h53.3C260.3 352 320 411.7 320 485.3c0 14.7-11.9 26.7-26.7 26.7H26.7C11.9 512 0 500.1 0 485.3C0 411.7 59.7 352 133.3 352z\" /></svg>",
  "fa-chart-bar": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M32 32c17.7 0 32 14.3 32 32V400c0 8.8 7.2 16 16 16H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H80c-44.2 0-80-35.8-80-80V64C0 46.3 14.3 32 32 32zm96 96c0-17.7 14.3-32 32-32l192 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-192 0c-17.7 0-32-14.3-32-32zm32 64H288c17.7 0 32 14.3 32 32s-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 96H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32z\" /></svg>",
  "fa-chart-pie": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M304 240V16.6c0-9 7-16.6 16-16.6C443.7 0 544 100.3 544 224c0 9-7.6 16-16.6 16H304zM32 272C32 150.7 122.1 50.3 239 34.3c9.2-1.3 17 6.1 17 15.4V288L412.5 444.5c6.7 6.7 6.2 17.7-1.5 23.1C371.8 495.6 323.8 512 272 512C139.5 512 32 404.6 32 272zm526.4 16c9.3 0 16.6 7.8 15.4 17c-7.7 55.9-34.6 105.6-73.9 142.3c-6 5.6-15.4 5.2-21.2-.7L320 288H558.4z\" /></svg>",
  "fa-check": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z\" /></svg>",
  "fa-check-circle": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z\" /></svg>",
  "fa-chevron-down": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z\" /></svg>",
  "fa-chevron-left": "<svg viewBox=\"0 0 320 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z\" /></svg>",
  "fa-chevron-right": "<svg viewBox=\"0 0 320 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z\" /></svg>",
  "fa-chevron-up": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z\" /></svg>",
  "fa-circle-info": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z\" /></svg>",
  "fa-clock": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z\" /></svg>",
  "fa-cog": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z\" /></svg>",
  "fa-edit": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z\" /></svg>",
  "fa-envelope": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z\" /></svg>",
  "fa-envelope-open": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M64 208.1L256 65.9 448 208.1v47.4L289.5 373c-9.7 7.2-21.4 11-33.5 11s-23.8-3.9-33.5-11L64 255.5V208.1zM256 0c-12.1 0-23.8 3.9-33.5 11L25.9 156.7C9.6 168.8 0 187.8 0 208.1V448c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V208.1c0-20.3-9.6-39.4-25.9-51.4L289.5 11C279.8 3.9 268.1 0 256 0z\" /></svg>",
  "fa-envelope-open-text": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M215.4 96H144 107.8 96v8.8V144v40.4 89L.2 202.5c1.6-18.1 10.9-34.9 25.7-45.8L48 140.3V96c0-26.5 21.5-48 48-48h76.6l49.9-36.9C232.2 3.9 243.9 0 256 0s23.8 3.9 33.5 11L339.4 48H416c26.5 0 48 21.5 48 48v44.3l22.1 16.4c14.8 10.9 24.1 27.7 25.7 45.8L416 273.4v-89V144 104.8 96H404.2 368 296.6 215.4zM0 448V242.1L217.6 403.3c11.1 8.2 24.6 12.7 38.4 12.7s27.3-4.4 38.4-12.7L512 242.1V448v0c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64v0zM176 160H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H176c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H176c-8.8 0-16-7.2-16-16s7.2-16 16-16z\" /></svg>",
  "fa-eye": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z\" /></svg>",
  "fa-file-medical-alt": "<svg viewBox=\"0 0 384 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM160 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v48h48c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H224v48c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V352H112c-8.8 0-16-7.2-16-16V304c0-8.8 7.2-16 16-16h48V240z\" /></svg>",
  "fa-flag": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M64 32C64 14.3 49.7 0 32 0S0 14.3 0 32V64 368 480c0 17.7 14.3 32 32 32s32-14.3 32-32V352l64.3-16.1c41.1-10.3 84.6-5.5 122.5 13.4c44.2 22.1 95.5 24.8 141.7 7.4l34.7-13c12.5-4.7 20.8-16.6 20.8-30V66.1c0-23-24.2-38-44.8-27.7l-9.6 4.8c-46.3 23.2-100.8 23.2-147.1 0c-35.1-17.6-75.4-22-113.5-12.5L64 48V32z\" /></svg>",
  "fa-flask": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M288 0H160 128C110.3 0 96 14.3 96 32s14.3 32 32 32V196.8c0 11.8-3.3 23.5-9.5 33.5L10.3 406.2C3.6 417.2 0 429.7 0 442.6C0 480.9 31.1 512 69.4 512H378.6c38.3 0 69.4-31.1 69.4-69.4c0-12.8-3.6-25.4-10.3-36.4L329.5 230.4c-6.2-10.1-9.5-21.7-9.5-33.5V64c17.7 0 32-14.3 32-32s-14.3-32-32-32H288zM192 196.8V64h64V196.8c0 23.7 6.6 46.9 19 67.1L309.5 320h-171L173 263.9c12.4-20.2 19-43.4 19-67.1z\" /></svg>",
  "fa-globe": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z\" /></svg>",
  "fa-graduation-cap": "<svg viewBox=\"0 0 640 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M320 32c-8.1 0-16.1 1.4-23.7 4.1L15.8 137.4C6.3 140.9 0 149.9 0 160s6.3 19.1 15.8 22.6l57.9 20.9C57.3 229.3 48 259.8 48 291.9v28.1c0 28.4-10.8 57.7-22.3 80.8c-6.5 13-13.9 25.8-22.5 37.6C0 442.7-.9 448.3 .9 453.4s6 8.9 11.2 10.2l64 16c4.2 1.1 8.7 .3 12.4-2s6.3-6.1 7.1-10.4c8.6-42.8 4.3-81.2-2.1-108.7C90.3 344.3 86 329.8 80 316.5V291.9c0-30.2 10.2-58.7 27.9-81.5c12.9-15.5 29.6-28 49.2-35.7l157-61.7c8.2-3.2 17.5 .8 20.7 9s-.8 17.5-9 20.7l-157 61.7c-12.4 4.9-23.3 12.4-32.2 21.6l159.6 57.6c7.6 2.7 15.6 4.1 23.7 4.1s16.1-1.4 23.7-4.1L624.2 182.6c9.5-3.4 15.8-12.5 15.8-22.6s-6.3-19.1-15.8-22.6L343.7 36.1C336.1 33.4 328.1 32 320 32zM128 408c0 35.3 86 72 192 72s192-36.7 192-72L496.7 262.6 354.5 314c-11.1 4-22.8 6-34.5 6s-23.5-2-34.5-6L143.3 262.6 128 408z\" /></svg>",
  "fa-hand-holding-usd": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M312 24V34.5c6.4 1.2 12.6 2.7 18.2 4.2c12.8 3.4 20.4 16.6 17 29.4s-16.6 20.4-29.4 17c-10.9-2.9-21.1-4.9-30.2-5c-7.3-.1-14.7 1.7-19.4 4.4c-2.1 1.3-3.1 2.4-3.5 3c-.3 .5-.7 1.2-.7 2.8c0 .3 0 .5 0 .6c.2 .2 .9 1.2 3.3 2.6c5.8 3.5 14.4 6.2 27.4 10.1l.9 .3 0 0c11.1 3.3 25.9 7.8 37.9 15.3c13.7 8.6 26.1 22.9 26.4 44.9c.3 22.5-11.4 38.9-26.7 48.5c-6.7 4.1-13.9 7-21.3 8.8V232c0 13.3-10.7 24-24 24s-24-10.7-24-24V220.6c-9.5-2.3-18.2-5.3-25.6-7.8c-2.1-.7-4.1-1.4-6-2c-12.6-4.2-19.4-17.8-15.2-30.4s17.8-19.4 30.4-15.2c2.6 .9 5 1.7 7.3 2.5c13.6 4.6 23.4 7.9 33.9 8.3c8 .3 15.1-1.6 19.2-4.1c1.9-1.2 2.8-2.2 3.2-2.9c.4-.6 .9-1.8 .8-4.1l0-.2c0-1 0-2.1-4-4.6c-5.7-3.6-14.3-6.4-27.1-10.3l-1.9-.6c-10.8-3.2-25-7.5-36.4-14.4c-13.5-8.1-26.5-22-26.6-44.1c-.1-22.9 12.9-38.6 27.7-47.4c6.4-3.8 13.3-6.4 20.2-8.2V24c0-13.3 10.7-24 24-24s24 10.7 24 24zM568.2 336.3c13.1 17.8 9.3 42.8-8.5 55.9L433.1 485.5c-23.4 17.2-51.6 26.5-80.7 26.5H192 32c-17.7 0-32-14.3-32-32V416c0-17.7 14.3-32 32-32H68.8l44.9-36c22.7-18.2 50.9-28 80-28H272h16 64c17.7 0 32 14.3 32 32s-14.3 32-32 32H288 272c-8.8 0-16 7.2-16 16s7.2 16 16 16H392.6l119.7-88.2c17.8-13.1 42.8-9.3 55.9 8.5zM193.6 384l0 0-.9 0c.3 0 .6 0 .9 0z\" /></svg>",
  "fa-handshake": "<svg viewBox=\"0 0 640 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M323.4 85.2l-96.8 78.4c-16.1 13-19.2 36.4-7 53.1c12.9 17.8 38 21.3 55.3 7.8l99.3-77.2c7-5.4 17-4.2 22.5 2.8s4.2 17-2.8 22.5l-20.9 16.2L512 316.8V128h-.7l-3.9-2.5L434.8 79c-15.3-9.8-33.2-15-51.4-15c-21.8 0-43 7.5-60 21.2zm22.8 124.4l-51.7 40.2C263 274.4 217.3 268 193.7 235.6c-22.2-30.5-16.6-73.1 12.7-96.8l83.2-67.3c-11.6-4.9-24.1-7.4-36.8-7.4C234 64 215.7 69.6 200 80l-72 48V352h28.2l91.4 83.4c19.6 17.9 49.9 16.5 67.8-3.1c5.5-6.1 9.2-13.2 11.1-20.6l17 15.6c19.5 17.9 49.9 16.6 67.8-2.9c4.5-4.9 7.8-10.6 9.9-16.5c19.4 13 45.8 10.3 62.1-7.5c17.9-19.5 16.6-49.9-2.9-67.8l-134.2-123zM16 128c-8.8 0-16 7.2-16 16V352c0 17.7 14.3 32 32 32H64c17.7 0 32-14.3 32-32V128H16zM48 320a16 16 0 1 1 0 32 16 16 0 1 1 0-32zM544 128V352c0 17.7 14.3 32 32 32h32c17.7 0 32-14.3 32-32V144c0-8.8-7.2-16-16-16H544zm32 208a16 16 0 1 1 32 0 16 16 0 1 1 -32 0z\" /></svg>",
  "fa-home": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c0 2.7-.2 5.4-.5 8.1V472c0 22.1-17.9 40-40 40H456c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1H416 392c-22.1 0-40-17.9-40-40V448 384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v64 24c0 22.1-17.9 40-40 40H160 128.1c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2H104c-22.1 0-40-17.9-40-40V360c0-.9 0-1.9 .1-2.8V287.6H32c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z\" /></svg>",
  "fa-hospital": "<svg viewBox=\"0 0 640 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M192 48c0-26.5 21.5-48 48-48H400c26.5 0 48 21.5 48 48V512H368V432c0-26.5-21.5-48-48-48s-48 21.5-48 48v80H192V48zM48 96H160V512H48c-26.5 0-48-21.5-48-48V320H80c8.8 0 16-7.2 16-16s-7.2-16-16-16H0V224H80c8.8 0 16-7.2 16-16s-7.2-16-16-16H0V144c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48v48H560c-8.8 0-16 7.2-16 16s7.2 16 16 16h80v64H560c-8.8 0-16 7.2-16 16s7.2 16 16 16h80V464c0 26.5-21.5 48-48 48H480V96H592zM312 64c-8.8 0-16 7.2-16 16v24H272c-8.8 0-16 7.2-16 16v16c0 8.8 7.2 16 16 16h24v24c0 8.8 7.2 16 16 16h16c8.8 0 16-7.2 16-16V152h24c8.8 0 16-7.2 16-16V120c0-8.8-7.2-16-16-16H344V80c0-8.8-7.2-16-16-16H312z\" /></svg>",
  "fa-hospital-user": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M48 0C21.5 0 0 21.5 0 48V256H144c8.8 0 16 7.2 16 16s-7.2 16-16 16H0v64H144c8.8 0 16 7.2 16 16s-7.2 16-16 16H0v80c0 26.5 21.5 48 48 48H265.9c-6.3-10.2-9.9-22.2-9.9-35.1c0-46.9 25.8-87.8 64-109.2V271.8 48c0-26.5-21.5-48-48-48H48zM152 64h16c8.8 0 16 7.2 16 16v24h24c8.8 0 16 7.2 16 16v16c0 8.8-7.2 16-16 16H184v24c0 8.8-7.2 16-16 16H152c-8.8 0-16-7.2-16-16V152H112c-8.8 0-16-7.2-16-16V120c0-8.8 7.2-16 16-16h24V80c0-8.8 7.2-16 16-16zM512 272a80 80 0 1 0 -160 0 80 80 0 1 0 160 0zM288 477.1c0 19.3 15.6 34.9 34.9 34.9H541.1c19.3 0 34.9-15.6 34.9-34.9c0-51.4-41.7-93.1-93.1-93.1H381.1c-51.4 0-93.1 41.7-93.1 93.1z\" /></svg>",
  "fa-hourglass-half": "<svg viewBox=\"0 0 384 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M32 0C14.3 0 0 14.3 0 32S14.3 64 32 64V75c0 42.4 16.9 83.1 46.9 113.1L146.7 256 78.9 323.9C48.9 353.9 32 394.6 32 437v11c-17.7 0-32 14.3-32 32s14.3 32 32 32H64 320h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V437c0-42.4-16.9-83.1-46.9-113.1L237.3 256l67.9-67.9c30-30 46.9-70.7 46.9-113.1V64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320 64 32zM96 75V64H288V75c0 19-5.6 37.4-16 53H112c-10.3-15.6-16-34-16-53zm16 309c3.5-5.3 7.6-10.3 12.1-14.9L192 301.3l67.9 67.9c4.6 4.6 8.6 9.6 12.1 14.9H112z\" /></svg>",
  "fa-house-medical": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M543.8 287.6c17 0 32-14 32-32.1c1-9-3-17-11-24L309.5 7c-6-5-14-7-21-7s-15 1-22 8L10 231.5c-7 7-10 15-10 24c0 18 14 32.1 32 32.1h32V448c0 35.3 28.7 64 64 64H448.5c35.5 0 64.2-28.8 64-64.3l-.7-160.2h32zM256 208c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v48h48c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H320v48c0 8.8-7.2 16-16 16H272c-8.8 0-16-7.2-16-16V320H208c-8.8 0-16-7.2-16-16V272c0-8.8 7.2-16 16-16h48V208z\" /></svg>",
  "fa-inbox": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M121 32C91.6 32 66 52 58.9 80.5L1.9 308.4C.6 313.5 0 318.7 0 323.9V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V323.9c0-5.2-.6-10.4-1.9-15.5l-57-227.9C446 52 420.4 32 391 32H121zm0 64H391l48 192H387.8c-12.1 0-23.2 6.8-28.6 17.7l-14.3 28.6c-5.4 10.8-16.5 17.7-28.6 17.7H195.8c-12.1 0-23.2-6.8-28.6-17.7l-14.3-28.6c-5.4-10.8-16.5-17.7-28.6-17.7H73L121 96z\" /></svg>",
  "fa-info-circle": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z\" /></svg>",
  "fa-laptop-code": "<svg viewBox=\"0 0 640 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M64 96c0-35.3 28.7-64 64-64H512c35.3 0 64 28.7 64 64V352H512V96H128V352H64V96zM0 403.2C0 392.6 8.6 384 19.2 384H620.8c10.6 0 19.2 8.6 19.2 19.2c0 42.4-34.4 76.8-76.8 76.8H76.8C34.4 480 0 445.6 0 403.2zM281 209l-31 31 31 31c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-48-48c-9.4-9.4-9.4-24.6 0-33.9l48-48c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9zM393 175l48 48c9.4 9.4 9.4 24.6 0 33.9l-48 48c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l31-31-31-31c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0z\" /></svg>",
  "fa-layer-group": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M264.5 5.2c14.9-6.9 32.1-6.9 47 0l218.6 101c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 149.8C37.4 145.8 32 137.3 32 128s5.4-17.9 13.9-21.8L264.5 5.2zM476.9 209.6l53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 277.8C37.4 273.8 32 265.3 32 256s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0l152-70.2zm-152 198.2l152-70.2 53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 405.8C37.4 401.8 32 393.3 32 384s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0z\" /></svg>",
  "fa-lock": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z\" /></svg>",
  "fa-map-marked-alt": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M408 120c0 54.6-73.1 151.9-105.2 192c-7.7 9.6-22 9.6-29.6 0C241.1 271.9 168 174.6 168 120C168 53.7 221.7 0 288 0s120 53.7 120 120zm8 80.4c3.5-6.9 6.7-13.8 9.6-20.6c.5-1.2 1-2.5 1.5-3.7l116-46.4C558.9 123.4 576 135 576 152V422.8c0 9.8-6 18.6-15.1 22.3L416 503V200.4zM137.6 138.3c2.4 14.1 7.2 28.3 12.8 41.5c2.9 6.8 6.1 13.7 9.6 20.6V451.8L32.9 502.7C17.1 509 0 497.4 0 480.4V209.6c0-9.8 6-18.6 15.1-22.3l122.6-49zM327.8 332c13.9-17.4 35.7-45.7 56.2-77V504.3L192 449.4V255c20.5 31.3 42.3 59.6 56.2 77c20.5 25.6 59.1 25.6 79.6 0zM288 152a40 40 0 1 0 0-80 40 40 0 1 0 0 80z\" /></svg>",
  "fa-map-marker-alt": "<svg viewBox=\"0 0 384 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z\" /></svg>",
  "fa-microscope": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M160 32c0-17.7 14.3-32 32-32h32c17.7 0 32 14.3 32 32c17.7 0 32 14.3 32 32V288c0 17.7-14.3 32-32 32c0 17.7-14.3 32-32 32H192c-17.7 0-32-14.3-32-32c-17.7 0-32-14.3-32-32V64c0-17.7 14.3-32 32-32zM32 448H320c70.7 0 128-57.3 128-128s-57.3-128-128-128V128c106 0 192 86 192 192c0 49.2-18.5 94-48.9 128H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H320 32c-17.7 0-32-14.3-32-32s14.3-32 32-32zm80-64H304c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z\" /></svg>",
  "fa-moon": "<svg viewBox=\"0 0 384 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z\" /></svg>",
  "fa-paper-plane": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z\" /></svg>",
  "fa-phone": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z\" /></svg>",
  "fa-phone-alt": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z\" /></svg>",
  "fa-plus": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z\" /></svg>",
  "fa-plus-circle": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM232 344V280H168c-13.3 0-24-10.7-24-24s10.7-24 24-24h64V168c0-13.3 10.7-24 24-24s24 10.7 24 24v64h64c13.3 0 24 10.7 24 24s-10.7 24-24 24H280v64c0 13.3-10.7 24-24 24s-24-10.7-24-24z\" /></svg>",
  "fa-save": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32H64zm0 96c0-17.7 14.3-32 32-32H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z\" /></svg>",
  "fa-scroll": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M0 80v48c0 17.7 14.3 32 32 32H48 96V80c0-26.5-21.5-48-48-48S0 53.5 0 80zM112 32c10 13.4 16 30 16 48V384c0 35.3 28.7 64 64 64s64-28.7 64-64v-5.3c0-32.4 26.3-58.7 58.7-58.7H480V128c0-53-43-96-96-96H112zM464 480c61.9 0 112-50.1 112-112c0-8.8-7.2-16-16-16H314.7c-14.7 0-26.7 11.9-26.7 26.7V384c0 53-43 96-96 96H368h96z\" /></svg>",
  "fa-sign-in-alt": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M217.9 105.9L340.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L217.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1L32 320c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM352 416l64 0c17.7 0 32-14.3 32-32l0-256c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l64 0c53 0 96 43 96 96l0 256c0 53-43 96-96 96l-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32z\" /></svg>",
  "fa-spinner": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M304 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zm0 416a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM48 304a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm464-48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM142.9 437A48 48 0 1 0 75 369.1 48 48 0 1 0 142.9 437zm0-294.2A48 48 0 1 0 75 75a48 48 0 1 0 67.9 67.9zM369.1 437A48 48 0 1 0 437 369.1 48 48 0 1 0 369.1 437z\" /></svg>",
  "fa-stethoscope": "<svg viewBox=\"0 0 576 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M142.4 21.9c5.6 16.8-3.5 34.9-20.2 40.5L96 71.1V192c0 53 43 96 96 96s96-43 96-96V71.1l-26.1-8.7c-16.8-5.6-25.8-23.7-20.2-40.5s23.7-25.8 40.5-20.2l26.1 8.7C334.4 19.1 352 43.5 352 71.1V192c0 77.2-54.6 141.6-127.3 156.7C231 404.6 278.4 448 336 448c61.9 0 112-50.1 112-112V265.3c-28.3-12.3-48-40.5-48-73.3c0-44.2 35.8-80 80-80s80 35.8 80 80c0 32.8-19.7 61-48 73.3V336c0 97.2-78.8 176-176 176c-92.9 0-168.9-71.9-175.5-163.1C87.2 334.2 32 269.6 32 192V71.1c0-27.5 17.6-52 43.8-60.7l26.1-8.7c16.8-5.6 34.9 3.5 40.5 20.2zM480 224a32 32 0 1 0 0-64 32 32 0 1 0 0 64z\" /></svg>",
  "fa-sun": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M361.5 1.2c5 2.1 8.6 6.6 9.6 11.9L391 121l107.9 19.8c5.3 1 9.8 4.6 11.9 9.6s1.5 10.7-1.6 15.2L446.9 256l62.3 90.3c3.1 4.5 3.7 10.2 1.6 15.2s-6.6 8.6-11.9 9.6L391 391 371.1 498.9c-1 5.3-4.6 9.8-9.6 11.9s-10.7 1.5-15.2-1.6L256 446.9l-90.3 62.3c-4.5 3.1-10.2 3.7-15.2 1.6s-8.6-6.6-9.6-11.9L121 391 13.1 371.1c-5.3-1-9.8-4.6-11.9-9.6s-1.5-10.7 1.6-15.2L65.1 256 2.8 165.7c-3.1-4.5-3.7-10.2-1.6-15.2s6.6-8.6 11.9-9.6L121 121 140.9 13.1c1-5.3 4.6-9.8 9.6-11.9s10.7-1.5 15.2 1.6L256 65.1 346.3 2.8c4.5-3.1 10.2-3.7 15.2-1.6zM160 256a96 96 0 1 1 192 0 96 96 0 1 1 -192 0zm224 0a128 128 0 1 0 -256 0 128 128 0 1 0 256 0z\" /></svg>",
  "fa-times": "<svg viewBox=\"0 0 384 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z\" /></svg>",
  "fa-times-circle": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z\" /></svg>",
  "fa-tools": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M78.6 5C69.1-2.4 55.6-1.5 47 7L7 47c-8.5 8.5-9.4 22-2.1 31.6l80 104c4.5 5.9 11.6 9.4 19 9.4h54.1l109 109c-14.7 29-10 65.4 14.3 89.6l112 112c12.5 12.5 32.8 12.5 45.3 0l64-64c12.5-12.5 12.5-32.8 0-45.3l-112-112c-24.2-24.2-60.6-29-89.6-14.3l-109-109V104c0-7.5-3.5-14.5-9.4-19L78.6 5zM19.9 396.1C7.2 408.8 0 426.1 0 444.1C0 481.6 30.4 512 67.9 512c18 0 35.3-7.2 48-19.9L233.7 374.3c-7.8-20.9-9-43.6-3.6-65.1l-61.7-61.7L19.9 396.1zM512 144c0-10.5-1.1-20.7-3.2-30.5c-2.4-11.2-16.1-14.1-24.2-6l-63.9 63.9c-3 3-7.1 4.7-11.3 4.7H352c-8.8 0-16-7.2-16-16V102.6c0-4.2 1.7-8.3 4.7-11.3l63.9-63.9c8.1-8.1 5.2-21.8-6-24.2C388.7 1.1 378.5 0 368 0C288.5 0 224 64.5 224 144l0 .8 85.3 85.3c36-9.1 75.8 .5 104 28.7L429 274.5c49-23 83-72.8 83-130.5zM56 432a24 24 0 1 1 48 0 24 24 0 1 1 -48 0z\" /></svg>",
  "fa-trash-alt": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M135.2 17.7C140.6 6.8 151.7 0 163.8 0H284.2c12.1 0 23.2 6.8 28.6 17.7L320 32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32h96l7.2-14.3zM32 128H416V448c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V128zm96 64c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16z\" /></svg>",
  "fa-user-check": "<svg viewBox=\"0 0 640 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM0 482.3C0 383.8 79.8 304 178.3 304h91.4C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7H29.7C13.3 512 0 498.7 0 482.3zM625 177L497 305c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L591 143c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z\" /></svg>",
  "fa-user-doctor": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-96 55.2C54 332.9 0 401.3 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7c0-81-54-149.4-128-171.1V362c27.6 7.1 48 32.2 48 62v40c0 8.8-7.2 16-16 16H336c-8.8 0-16-7.2-16-16s7.2-16 16-16V424c0-17.7-14.3-32-32-32s-32 14.3-32 32v24c8.8 0 16 7.2 16 16s-7.2 16-16 16H256c-8.8 0-16-7.2-16-16V424c0-29.8 20.4-54.9 48-62V304.9c-6-.6-12.1-.9-18.3-.9H178.3c-6.2 0-12.3 .3-18.3 .9v65.4c23.1 6.9 40 28.3 40 53.7c0 30.9-25.1 56-56 56s-56-25.1-56-56c0-25.4 16.9-46.8 40-53.7V311.2zM144 448a24 24 0 1 0 0-48 24 24 0 1 0 0 48z\" /></svg>",
  "fa-user-graduate": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M219.3 .5c3.1-.6 6.3-.6 9.4 0l200 40C439.9 42.7 448 52.6 448 64s-8.1 21.3-19.3 23.5L352 102.9V160c0 70.7-57.3 128-128 128s-128-57.3-128-128V102.9L48 93.3v65.1l15.7 78.4c.9 4.7-.3 9.6-3.3 13.3s-7.6 5.9-12.4 5.9H16c-4.8 0-9.3-2.1-12.4-5.9s-4.3-8.6-3.3-13.3L16 158.4V86.6C6.5 83.3 0 74.3 0 64C0 52.6 8.1 42.7 19.3 40.5l200-40zM111.9 327.7c10.5-3.4 21.8 .4 29.4 8.5l71 75.5c6.3 6.7 17 6.7 23.3 0l71-75.5c7.6-8.1 18.9-11.9 29.4-8.5C401 348.6 448 409.4 448 481.3c0 17-13.8 30.7-30.7 30.7H30.7C13.8 512 0 498.2 0 481.3c0-71.9 47-132.7 111.9-153.6z\" /></svg>",
  "fa-user-plus": "<svg viewBox=\"0 0 640 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM0 482.3C0 383.8 79.8 304 178.3 304h91.4C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7H29.7C13.3 512 0 498.7 0 482.3zM504 312V248H440c-13.3 0-24-10.7-24-24s10.7-24 24-24h64V136c0-13.3 10.7-24 24-24s24 10.7 24 24v64h64c13.3 0 24 10.7 24 24s-10.7 24-24 24H552v64c0 13.3-10.7 24-24 24s-24-10.7-24-24z\" /></svg>",
  "fa-user-tie": "<svg viewBox=\"0 0 448 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M224 256A128 128 0 1 1 224 0a128 128 0 1 1 0 256zM209.1 359.2l-18.6-31c-6.4-10.7 1.3-24.2 13.7-24.2H224h19.7c12.4 0 20.1 13.6 13.7 24.2l-18.6 31 33.4 123.9 36-146.9c2-8.1 9.8-13.4 17.9-11.3c70.1 17.6 121.9 81 121.9 156.4c0 17-13.8 30.7-30.7 30.7H285.5c-2.1 0-4-.4-5.8-1.1l.3 1.1H168l.3-1.1c-1.8 .7-3.8 1.1-5.8 1.1H30.7C13.8 512 0 498.2 0 481.3c0-75.5 51.9-138.9 121.9-156.4c8.1-2 15.9 3.3 17.9 11.3l36 146.9 33.4-123.9z\" /></svg>",
  "fa-user-times": "<svg viewBox=\"0 0 640 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM0 482.3C0 383.8 79.8 304 178.3 304h91.4C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7H29.7C13.3 512 0 498.7 0 482.3zM471 143c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z\" /></svg>",
  "fa-users": "<svg viewBox=\"0 0 640 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M144 0a80 80 0 1 1 0 160A80 80 0 1 1 144 0zM512 0a80 80 0 1 1 0 160A80 80 0 1 1 512 0zM0 298.7C0 239.8 47.8 192 106.7 192h42.7c15.9 0 31 3.5 44.6 9.7c-1.3 7.2-1.9 14.7-1.9 22.3c0 38.2 16.8 72.5 43.3 96c-.2 0-.4 0-.7 0H21.3C9.6 320 0 310.4 0 298.7zM405.3 320c-.2 0-.4 0-.7 0c26.6-23.5 43.3-57.8 43.3-96c0-7.6-.7-15-1.9-22.3c13.6-6.3 28.7-9.7 44.6-9.7h42.7C592.2 192 640 239.8 640 298.7c0 11.8-9.6 21.3-21.3 21.3H405.3zM224 224a96 96 0 1 1 192 0 96 96 0 1 1 -192 0zM128 485.3C128 411.7 187.7 352 261.3 352H378.7C452.3 352 512 411.7 512 485.3c0 14.7-11.9 26.7-26.7 26.7H154.7c-14.7 0-26.7-11.9-26.7-26.7z\" /></svg>",
  "fa-wallet": "<svg viewBox=\"0 0 512 512\" class=\"svg-icon\" fill=\"currentColor\" aria-hidden=\"true\"><path xmlns:ns0=\"http://www.w3.org/2000/svg\" d=\"M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V192c0-35.3-28.7-64-64-64H80c-8.8 0-16-7.2-16-16s7.2-16 16-16H448c17.7 0 32-14.3 32-32s-14.3-32-32-32H64zM416 272a32 32 0 1 1 0 64 32 32 0 1 1 0-64z\" /></svg>"
};

    function updateIconSvg(iElem) {
        // Find which fa- class it has
        let iconName = null;
        for (const cls of iElem.classList) {
            if (cls.startsWith('fa-') && cls !== 'fa-solid' && cls !== 'fa-regular' && cls !== 'fa-brands' && cls !== 'fa-spin' && cls !== 'fa-spin-reverse' && !cls.match(/^fa-\d+x$/)) {
                iconName = cls;
                break;
            }
        }
        if (iconName) {
            // Handle some mapping updates just in case
            const renameMap = {
                "fa-phone-alt": "fa-phone",
                "fa-map-marker-alt": "fa-location-dot",
                "fa-map-marked-alt": "fa-map-location-dot",
                "fa-hand-holding-usd": "fa-hand-holding-dollar",
                "fa-sign-in-alt": "fa-right-to-bracket",
                "fa-trash-alt": "fa-trash-can",
                "fa-user-times": "fa-user-xmark",
                "fa-prescription-bottle-alt": "fa-prescription-bottle-medical",
                "fa-file-medical-alt": "fa-file-medical",
                "fa-times": "fa-xmark",
                "fa-times-circle": "fa-circle-xmark",
                "fa-check-circle": "fa-circle-check",
                "fa-info-circle": "fa-circle-info",
                "fa-calendar-alt": "fa-calendar-days",
                "fa-edit": "fa-pen-to-square",
                "fa-save": "fa-floppy-disk",
                "fa-plus-circle": "fa-circle-plus",
                "fa-chalkboard-teacher": "fa-chalkboard-user",
                "fa-chart-bar": "fa-chart-simple",
                "fa-tools": "fa-screwdriver-wrench",
                "fa-cog": "fa-gear",
                "fa-home": "fa-house"
            };
            if (!svgIcons[iconName] && renameMap[iconName]) {
                iconName = renameMap[iconName];
            }
            
            if (svgIcons[iconName]) {
                if (iElem.getAttribute('data-svg-loaded') !== iconName) {
                    iElem.innerHTML = svgIcons[iconName];
                    iElem.setAttribute('data-svg-loaded', iconName);
                }
            }
        }
    }

    // Observe DOM for changes (dynamic elements addition & class toggling)
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches('i')) {
                            updateIconSvg(node);
                        }
                        node.querySelectorAll('i').forEach(updateIconSvg);
                    }
                });
            } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (mutation.target.matches('i')) {
                    updateIconSvg(mutation.target);
                }
            }
        }
    });

    // Start observer
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        // Initialize existing elements
        document.querySelectorAll('i').forEach(updateIconSvg);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
            document.querySelectorAll('i').forEach(updateIconSvg);
        });
    }
})();
