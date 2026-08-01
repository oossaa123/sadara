const API_BASE = (() => {
    const p = window.location.port;
    const h = window.location.hostname || '127.0.0.1';
    // In production (no port) or when running locally on Flask (5000) or Django (5001), use relative paths
    if (!p || p === '5000' || p === '5001') return '';
    // Otherwise point to Django API server on the same hostname
    return `http://${h}:5001`;
})();

function initPage() {
    // ==========================================
    // 1. Theme Toggle (Dark / Light Mode)
    // ==========================================
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // ==========================================
    // 2. Mobile Menu Toggle
    // ==========================================
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.className = 'fas fa-times';
            } else {
                icon.className = 'fas fa-bars';
            }
        });
        
        // Close menu when clicking nav link
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                menuToggle.querySelector('i').className = 'fas fa-bars';
            });
        });
    }

    // ==========================================
    // 3. Header Scrolled Styling & Back To Top
    // ==========================================
    const floatToTop = document.getElementById('float-totop');
    
    if (floatToTop) {
        floatToTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ==========================================
    // 4. Dynamic Countdown Timer (Urgency Element)
    // ==========================================
    let countdownInterval;
    function initCountdown(targetTimestamp) {
        const daysEl = document.getElementById('days');
        if (!daysEl) return;
        
        let countdownDate = targetTimestamp;
        if (!countdownDate) {
            const storedDeadline = localStorage.getItem('admission_deadline');
            if (storedDeadline && new Date(storedDeadline) > new Date()) {
                countdownDate = new Date(storedDeadline).getTime();
            } else {
                const now = new Date();
                const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 23, 59, 59);
                countdownDate = futureDate.getTime();
                localStorage.setItem('admission_deadline', futureDate.toISOString());
            }
        }
        
        if (countdownInterval) clearInterval(countdownInterval);
        
        const updateCountdown = () => {
            const now = new Date().getTime();
            const distance = countdownDate - now;
            
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            document.getElementById('days').innerText = String(days).padStart(2, '0');
            document.getElementById('hours').innerText = String(hours).padStart(2, '0');
            document.getElementById('minutes').innerText = String(minutes).padStart(2, '0');
            document.getElementById('seconds').innerText = String(seconds).padStart(2, '0');
            
            if (distance < 0) {
                clearInterval(countdownInterval);
                document.getElementById('days').innerText = "00";
                document.getElementById('hours').innerText = "00";
                document.getElementById('minutes').innerText = "00";
                document.getElementById('seconds').innerText = "00";
            }
        };
        
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);
    }

    // ==========================================
    // 5. Counter Animations (Stats Section)
    // ==========================================
    function initCounterAnimation() {
        const stats = document.querySelectorAll('.stat-number');
        const speed = 200;
        
        if (stats.length > 0) {
            const animateStats = (entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const target = entry.target;
                        const targetNumber = parseInt(target.getAttribute('data-target'));
                        let currentNumber = 0;
                        const suffix = target.getAttribute('data-suffix') || '+';
                        
                        const increment = Math.ceil(targetNumber / speed);
                        
                        const updateCount = () => {
                            currentNumber += increment;
                            if (currentNumber < targetNumber) {
                                target.innerText = currentNumber + suffix;
                                setTimeout(updateCount, 15);
                            } else {
                                target.innerText = targetNumber + suffix;
                            }
                        };
                        
                        updateCount();
                        observer.unobserve(target);
                    }
                });
            };
            
            const statsObserver = new IntersectionObserver(animateStats, {
                threshold: 0.5
            });
            
            stats.forEach(stat => statsObserver.observe(stat));
        }
    }

    // ==========================================
    // Fetch settings from API and apply to page
    // ==========================================
    // Helper function to apply settings to the DOM
    function applySettings(settings) {
        window.latestSettings = settings;
        // Apply to top bar and footer
        if (settings.top_phone) {
            const tPhone = document.getElementById('top-phone');
            if (tPhone) tPhone.innerText = settings.top_phone;
            const fPhone = document.getElementById('footer-phone');
            if (fPhone) fPhone.innerText = settings.top_phone;
            const fWhatsapp = document.getElementById('footer-whatsapp');
            if (fWhatsapp) fWhatsapp.setAttribute('href', 'https://wa.me/' + settings.top_phone.replace(/[^0-9]/g, ''));
        }
        if (settings.top_email) {
            const tEmail = document.getElementById('top-email');
            if (tEmail) tEmail.innerText = settings.top_email;
            const fEmail = document.getElementById('footer-email');
            if (fEmail) fEmail.innerText = settings.top_email;
        }
        if (settings.top_address) {
            const tAddress = document.getElementById('top-address');
            if (tAddress) tAddress.innerText = settings.top_address;
            const fAddress = document.getElementById('footer-address');
            if (fAddress) fAddress.innerText = settings.top_address;
        }
        
        // Social links
        if (settings.social_facebook) {
            const fb = document.getElementById('top-fb');
            if (fb) fb.href = settings.social_facebook;
        }
        if (settings.social_twitter) {
            const tw = document.getElementById('top-tw');
            if (tw) tw.href = settings.social_twitter;
        }
        if (settings.social_linkedin) {
            const li = document.getElementById('top-li');
            if (li) li.href = settings.social_linkedin;
        }
        if (settings.social_youtube) {
            const yt = document.getElementById('top-yt');
            if (yt) yt.href = settings.social_youtube;
        }
        
        // Hero section
        if (settings.hero_tag) {
            const tagEl = document.getElementById('hero-tag');
            if (tagEl) tagEl.innerHTML = `<i class="fas fa-graduation-cap"></i> ${settings.hero_tag}`;
        }
        if (settings.hero_title) {
            const titleEl = document.getElementById('hero-title');
            if (titleEl) {
                const subtitle = settings.hero_subtitle || 'صدارة التعليم لمستقبل واعد';
                titleEl.innerHTML = `${settings.hero_title} <br><span id="hero-subtitle">${subtitle}</span>`;
            }
        }
        if (settings.hero_desc) {
            const descEl = document.getElementById('hero-desc');
            if (descEl) descEl.innerText = settings.hero_desc;
        }
        
        // Stats section
        if (settings.stat_students) {
            const el = document.getElementById('stat-students');
            if (el) {
                el.setAttribute('data-target', settings.stat_students);
                if (el.innerText !== "0") el.innerText = settings.stat_students + (el.getAttribute('data-suffix') || '+');
            }
        }
        if (settings.stat_depts) {
            const el = document.getElementById('stat-depts');
            if (el) {
                el.setAttribute('data-target', settings.stat_depts);
                if (el.innerText !== "0") el.innerText = settings.stat_depts + (el.getAttribute('data-suffix') || '');
            }
        }
        if (settings.stat_employment) {
            const el = document.getElementById('stat-employment');
            if (el) {
                el.setAttribute('data-target', settings.stat_employment);
                if (el.innerText !== "0") el.innerText = settings.stat_employment + (el.getAttribute('data-suffix') || '%');
            }
        }
        if (settings.stat_labs) {
            const el = document.getElementById('stat-labs');
            if (el) {
                el.setAttribute('data-target', settings.stat_labs);
                if (el.innerText !== "0") el.innerText = settings.stat_labs + (el.getAttribute('data-suffix') || '');
            }
        }
        
        
        // About Section settings (on about.html)
        if (settings.about_us_p1) {
            const el = document.getElementById('about-us-p1');
            if (el) el.innerText = settings.about_us_p1;
        }
        if (settings.about_us_p2) {
            const el = document.getElementById('about-us-p2');
            if (el) el.innerText = settings.about_us_p2;
        }
        if (settings.about_image) {
            const el = document.getElementById('about-image');
            if (el) el.src = settings.about_image.startsWith('http') ? settings.about_image : (API_BASE + settings.about_image);
        }
        if (settings.about_vision) {
            const el = document.getElementById('about-vision');
            if (el) el.innerText = settings.about_vision;
        }
        if (settings.about_mission) {
            const el = document.getElementById('about-mission');
            if (el) el.innerText = settings.about_mission;
        }
        if (settings.about_goals) {
            const el = document.getElementById('about-goals');
            if (el) el.innerText = settings.about_goals;
        }
        if (settings.dean_name) {
            const el = document.getElementById('dean-name');
            if (el) el.innerText = settings.dean_name;
        }
        if (settings.dean_title) {
            const el = document.getElementById('dean-title');
            if (el) el.innerText = settings.dean_title;
        }
        if (settings.dean_avatar) {
            const el = document.getElementById('dean-avatar');
            if (el) el.src = settings.dean_avatar.startsWith('http') ? settings.dean_avatar : (API_BASE + settings.dean_avatar);
        }
        if (settings.dean_message_quote) {
            const el = document.getElementById('dean-message-quote');
            if (el) el.innerText = settings.dean_message_quote.startsWith('"') ? settings.dean_message_quote : `"${settings.dean_message_quote}"`;
        }
        if (settings.dean_message_p2) {
            const el = document.getElementById('dean-message-p2');
            if (el) el.innerText = settings.dean_message_p2;
        }

        // Re-initialize dynamic animations that depend on these values
        if (settings.countdown_end) {
            initCountdown(new Date(settings.countdown_end).getTime());
        } else {
            initCountdown();
        }
        initCounterAnimation();
    }

    // Try loading settings from cache first for instant page rendering
    const cachedSettings = localStorage.getItem('sadara_settings');
    if (cachedSettings) {
        try {
            applySettings(JSON.parse(cachedSettings));
        } catch (e) {
            console.error('Error applying cached settings:', e);
        }
    } else {
        // Fallback defaults
        initCountdown();
        initCounterAnimation();
    }

    // Fetch settings from API in the background and update/cache
    fetch(API_BASE + '/api/settings')
        .then(res => res.json())
        .then(settings => {
            const cached = localStorage.getItem('sadara_settings');
            const newStr = JSON.stringify(settings);
            if (cached !== newStr) {
                localStorage.setItem('sadara_settings', newStr);
                applySettings(settings);
            }
        })
        .catch(err => {
            console.warn('Backend settings API not reachable. Using fallback/cached settings.', err);
        });

    // Load cached departments immediately, then refresh from API
    loadDepartments();

    // Load cached labs immediately, then refresh from API
    loadLabs();

    // Load cached tuition fees immediately, then refresh from API
    loadFees();

    // ==========================================
    // 6. Department Tab Switching
    // ==========================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const deptPanels = document.querySelectorAll('.dept-panel');
    
    if (tabBtns.length > 0) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                
                tabBtns.forEach(b => b.classList.remove('active'));
                deptPanels.forEach(p => p.classList.remove('active'));
                
                btn.classList.add('active');
                const panel = document.getElementById(target);
                if (panel) panel.classList.add('active');
            });
        });
    }

    // ==========================================
    // 7. Testimonials Carousel
    // ==========================================
    const track = document.querySelector('.carousel-track');
    const nextBtn = document.querySelector('.carousel-btn-next');
    const prevBtn = document.querySelector('.carousel-btn-prev');
    const dotsContainer = document.querySelector('.carousel-dots');
    
    if (track && dotsContainer) {
        const slides = Array.from(track.children);
        let currentIndex = 0;
        const totalSlides = slides.length;
        
        slides.forEach((_, idx) => {
            const dot = document.createElement('button');
            dot.className = `carousel-dot ${idx === 0 ? 'active' : ''}`;
            dot.setAttribute('aria-label', `Slide ${idx + 1}`);
            dotsContainer.appendChild(dot);
        });
        
        const dots = Array.from(dotsContainer.children);
        
        const updateCarousel = (index) => {
            track.style.transform = `translateX(${index * 100}%)`;
            dots.forEach(dot => dot.classList.remove('active'));
            dots[index].classList.add('active');
            currentIndex = index;
        };
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                let index = currentIndex + 1 >= totalSlides ? 0 : currentIndex + 1;
                updateCarousel(index);
            });
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                let index = currentIndex - 1 < 0 ? totalSlides - 1 : currentIndex - 1;
                updateCarousel(index);
            });
        }
        
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                updateCarousel(index);
            });
        });
        
        let autoPlayInterval = setInterval(() => {
            let index = currentIndex + 1 >= totalSlides ? 0 : currentIndex + 1;
            updateCarousel(index);
        }, 6000);
        
        const carouselContainer = document.querySelector('.carousel-container');
        if (carouselContainer) {
            carouselContainer.addEventListener('mouseenter', () => {
                clearInterval(autoPlayInterval);
            });
            carouselContainer.addEventListener('mouseleave', () => {
                autoPlayInterval = setInterval(() => {
                    let index = currentIndex + 1 >= totalSlides ? 0 : currentIndex + 1;
                    updateCarousel(index);
                }, 6000);
            });
        }
    }

    // ==========================================
    // 8. FAQ Accordions
    // ==========================================
    const faqItems = document.querySelectorAll('.faq-item');
    
    if (faqItems.length > 0) {
        faqItems.forEach(item => {
            const header = item.querySelector('.faq-header');
            const content = item.querySelector('.faq-content');
            
            header.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                faqItems.forEach(i => {
                    i.classList.remove('active');
                    const c = i.querySelector('.faq-content');
                    if (c) c.style.maxHeight = null;
                });
                
                if (!isActive) {
                    item.classList.add('active');
                    content.style.maxHeight = content.scrollHeight + "px";
                }
            });
        });
    }

    // ==========================================
    // 9. Quick Admission Form Submission
    // ==========================================
    const admissionForm = document.getElementById('quick-admission-form');
    const formAlert = document.getElementById('form-success-alert');
    
    if (admissionForm) {
        admissionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const studentName = document.getElementById('student-name').value.trim();
            const studentPhone = document.getElementById('student-phone').value.trim();
            const studentGpa = document.getElementById('student-gpa').value.trim();
            const studentDept = document.getElementById('student-dept').value;
            const studentStream = document.getElementById('student-stream').value;
            
            if (studentName === '' || studentPhone === '' || studentGpa === '' || studentDept === '' || studentStream === '') {
                alert('الرجاء تعبئة كافة الحقول بشكل صحيح.');
                return;
            }
            
            const submitBtn = admissionForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال طلبك...';
            
            fetch(API_BASE + '/api/applicants', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: studentName,
                    phone: studentPhone,
                    gpa: parseFloat(studentGpa),
                    stream: studentStream,
                    department: studentDept
                })
            })
            .then(res => {
                if (!res.ok) throw new Error('Submission failed');
                return res.json();
            })
            .then(data => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                admissionForm.reset();
                
                if (formAlert) {
                    formAlert.style.display = 'block';
                    formAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    setTimeout(() => {
                        formAlert.style.display = 'none';
                    }, 8000);
                }
            })
            .catch(err => {
                console.error(err);
                alert('حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى لاحقاً.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            });
        });
    }

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
            
            const data = {
                name: document.getElementById('contact-name').value.trim(),
                email: document.getElementById('contact-email').value.trim(),
                phone: document.getElementById('contact-phone').value.trim(),
                subject: document.getElementById('contact-subject').value.trim(),
                message: document.getElementById('contact-message').value.trim()
            };
            
            fetch(API_BASE + '/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(res => {
                if (!res.ok) throw new Error('Failed');
                return res.json();
            })
            .then(resData => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                contactForm.reset();
                // Show success message
                const successDiv = document.createElement('div');
                successDiv.className = 'glass glass-padding animate-on-scroll animated';
                successDiv.style.cssText = 'text-align: center; margin-top: 20px; border: 2px solid #2ecc71; background: rgba(46, 204, 113, 0.08);';
                successDiv.innerHTML = `
                    <i class="fas fa-check-circle" style="font-size: 3rem; color: #2ecc71; margin-bottom: 15px;"></i>
                    <h3 style="color: #2ecc71; margin-bottom: 10px;">تم إرسال رسالتك بنجاح!</h3>
                    <p style="color: var(--text-secondary);">شكراً لتواصلك معنا. سيقوم فريق شؤون الطلاب بالرد عليك في أقرب وقت ممكن.</p>
                `;
                contactForm.parentNode.appendChild(successDiv);
                contactForm.style.display = 'none';
                setTimeout(() => {
                    contactForm.style.display = 'block';
                    successDiv.remove();
                }, 8000);
            })
            .catch(err => {
                console.error(err);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                alert('حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة مرة أخرى.');
            });
        });
    }

    // ==========================================
    // 10. Scroll Animations (Scroll Reveal)
    // ==========================================
    window.initScrollRevealForNewElements = function() {
        const revealElements = document.querySelectorAll('.animate-on-scroll:not(.animated)');
        if (revealElements.length > 0) {
            const revealOnScroll = (entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animated');
                        observer.unobserve(entry.target);
                    }
                });
            };
            
            const revealObserver = new IntersectionObserver(revealOnScroll, {
                threshold: 0.1
            });
            
            revealElements.forEach(elem => revealObserver.observe(elem));
        }
    };
    
    initScrollRevealForNewElements();

    // ==========================================
    // 11. Dynamic Departments Loading with Cache
    // ==========================================
    function renderDepartments(depts) {
        // Helper to resolve media URLs to backend
        const resolveMediaUrl = (url) => {
            if (!url) return '';
            if (url.startsWith('http://') || url.startsWith('https://')) return url;
            if (url.startsWith('/media/')) return API_BASE + url;
            return url;
        };

        // Apply to index.html (Homepage)
        const medicalTab = document.getElementById('medical-tab');
        const techTab = document.getElementById('tech-tab');
        
        // Get phone number for WhatsApp inquiry links
        const rawPhone = (window.latestSettings && window.latestSettings.top_phone) || '967777777777';
        const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
        
        if (medicalTab && techTab) {
            medicalTab.innerHTML = '';
            techTab.innerHTML = '';
            
            depts.forEach(d => {
                const card = document.createElement('div');
                card.className = `glass dept-card dept-card-${d.category} animate-on-scroll`;
                
                const waText = encodeURIComponent(`مرحباً كلية الصدارة، أود الاستفسار عن تخصص ${d.name}.`);
                
                let iconHtml = '';
                const resolvedIcon = resolveMediaUrl(d.icon);
                if (d.icon && (d.icon.startsWith('/') || d.icon.startsWith('http'))) {
                    iconHtml = `<img src="${resolvedIcon}" style="width: 24px; height: 24px; object-fit: contain; vertical-align: middle;">`;
                } else {
                    iconHtml = `<i class="fa-solid ${d.icon || 'fa-graduation-cap'}"></i>`;
                }

                const resolvedImg = resolveMediaUrl(d.image_url);

                card.innerHTML = `
                    <div class="dept-card-img-wrapper">
                        <span class="img-floating-badge"><i class="far fa-clock"></i> ${d.duration}</span>
                        <img src="${resolvedImg}" alt="${d.name}" class="dept-card-img" onerror="this.src='https://placehold.co/400x250?text=${d.name}'">
                        <div class="dept-card-icon-badge">${iconHtml}</div>
                    </div>
                    <div class="dept-card-body">
                        <h3>${d.name}</h3>
                        <p>${d.description}</p>
                        <div class="dept-card-actions">
                            <a href="departments.html#${d.code}" class="btn btn-outline btn-sm">تفاصيل البرنامج</a>
                            <a href="https://wa.me/${cleanPhone}?text=${waText}" target="_blank" rel="noopener noreferrer" class="btn whatsapp-inquire-btn btn-sm"><i class="fab fa-whatsapp"></i> واتساب</a>
                        </div>
                    </div>
                `;
                
                if (d.category === 'medical') {
                    medicalTab.appendChild(card);
                } else {
                    techTab.appendChild(card);
                }
            });
            
            if (window.initScrollRevealForNewElements) {
                window.initScrollRevealForNewElements();
            }
        }
        
        // Apply to departments.html (Detailed view page)
        const medContainer = document.getElementById('medical-depts-container');
        const techContainer = document.getElementById('tech-depts-container');
        
        if (medContainer && techContainer) {
            medContainer.innerHTML = '';
            techContainer.innerHTML = '';
            
            depts.forEach(d => {
                const card = document.createElement('div');
                card.className = `glass glass-padding dept-detail-card dept-detail-${d.category}`;
                card.id = d.code;
                
                let detailIconHtml = '';
                const resolvedIcon = resolveMediaUrl(d.icon);
                if (d.icon && (d.icon.startsWith('/') || d.icon.startsWith('http'))) {
                    detailIconHtml = `<img src="${resolvedIcon}" style="width: 32px; height: 32px; object-fit: contain; vertical-align: middle; margin-left: 10px;">`;
                } else {
                    detailIconHtml = `<i class="fa-solid ${d.icon || 'fa-graduation-cap'}" style="margin-left: 10px;"></i>`;
                }

                // Careers
                const careersText = d.careers || '';
                
                // Courses table rows
                let coursesHtml = '';
                const courses = Array.isArray(d.courses) ? d.courses : [];
                courses.forEach((c, idx) => {
                    const rowspan = idx === 0 ? ` rowspan="${courses.length || 1}"` : '';
                    const careersCol = idx === 0 ? `<td${rowspan}>${careersText}</td>` : '';
                    
                    coursesHtml += `
                        <tr>
                            <td>${c.code || ''}</td>
                            <td>${c.name || ''}</td>
                            <td>${c.type || ''}</td>
                            ${careersCol}
                        </tr>
                    `;
                });
                
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 20px;">
                        <h3 style="color: var(--primary); font-size: 1.8rem;">${detailIconHtml} ${d.name}</h3>
                        <span class="badge badge-gold">المدة: ${d.duration}</span>
                    </div>
                    <p style="color: var(--text-secondary); margin-bottom: 25px;">${d.description}</p>
                    <div class="table-responsive">
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>رمز المساق</th>
                                    <th>اسم المساق الدراسي</th>
                                    <th>نوع التدريب</th>
                                    <th>مجالات العمل المستقبلية</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${coursesHtml || '<tr><td colspan="4" style="text-align: center;">لا توجد خطة مساقات حالية</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
                
                if (d.category === 'medical') {
                    medContainer.appendChild(card);
                } else {
                    techContainer.appendChild(card);
                }
            });
            
            // If there is a hash in the URL, scroll to it smoothly
            if (window.location.hash) {
                const targetEl = document.querySelector(window.location.hash);
                if (targetEl) {
                    setTimeout(() => {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 500);
                }
            }
        }

        // Apply to admission.html (dropdown of departments)
        const admissionSelect = document.getElementById('student-dept');
        if (admissionSelect) {
            const firstOption = admissionSelect.querySelector('option[value=""]');
            admissionSelect.innerHTML = '';
            if (firstOption) {
                admissionSelect.appendChild(firstOption);
            }
            depts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.name;
                opt.textContent = d.name;
                admissionSelect.appendChild(opt);
            });
        }
    }

    function loadDepartments() {
        // Load from cache first
        const cachedDepts = localStorage.getItem('sadara_depts');
        if (cachedDepts) {
            try {
                renderDepartments(JSON.parse(cachedDepts));
            } catch (e) {
                console.error('Error parsing cached departments:', e);
            }
        }

        fetch(API_BASE + '/api/departments')
            .then(res => res.json())
            .then(depts => {
                const cached = localStorage.getItem('sadara_depts');
                if (cached && JSON.stringify(depts) === JSON.stringify(JSON.parse(cached))) {
                    return; // Avoid unnecessary re-render to eliminate layout lag
                }
                localStorage.setItem('sadara_depts', JSON.stringify(depts));
                renderDepartments(depts);
            })
            .catch(err => {
                console.error('Failed to load departments from API:', err);
            });
    }

    function renderLabs(labs) {
        const labsGrid = document.querySelector('.labs-grid');
        if (!labsGrid) return;

        // Helper to resolve media URLs to backend
        const resolveMediaUrl = (url) => {
            if (!url) return '';
            if (url.startsWith('http://') || url.startsWith('https://')) return url;
            if (url.startsWith('/media/')) return API_BASE + url;
            return url;
        };

        labsGrid.innerHTML = '';

        if (labs.length === 0) {
            labsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px; font-size: 1.1rem; font-family: var(--font-primary);">لا توجد معامل مضافة حالياً.</div>';
            return;
        }

        labs.forEach(l => {
            const card = document.createElement('div');
            card.className = 'glass lab-card animate-on-scroll';

            const categoryLabel = l.category === 'medical' ? 'معمل طبي' : 'معمل تقني';
            const categoryIcon = l.category === 'medical' ? 'fa-prescription-bottle-alt' : 'fa-laptop-code';
            const resolvedImg = resolveMediaUrl(l.image_url);

            // Generate specs html
            let specsHtml = '';
            const specs = Array.isArray(l.specs) ? l.specs : [];
            specs.forEach(s => {
                let specIcon = 'fa-check-circle';
                const lowerS = s.toLowerCase();
                if (lowerS.includes('حاسوب') || lowerS.includes('برامج') || lowerS.includes('exocad') || lowerS.includes('cad') || lowerS.includes('سيرفر') || lowerS.includes('شبك')) specIcon = 'fa-desktop';
                else if (lowerS.includes('ماسح') || lowerS.includes('ثلاثي') || lowerS.includes('مكعب') || lowerS.includes('ابعاد')) specIcon = 'fa-cube';
                else if (lowerS.includes('مخرطة') || lowerS.includes('جهاز') || lowerS.includes('أداة') || lowerS.includes('أوتوكلاف')) specIcon = 'fa-cog';
                else if (lowerS.includes('سرير') || lowerS.includes('دمى') || lowerS.includes('طاولة') || lowerS.includes('رعاية') || lowerS.includes('مريض')) specIcon = 'fa-procedures';
                else if (lowerS.includes('تحليل') || lowerS.includes('مجهر') || lowerS.includes('مجاهر') || lowerS.includes('طيف') || lowerS.includes('دم')) specIcon = 'fa-microscope';
                
                specsHtml += `<span class="lab-spec-badge"><i class="fas ${specIcon}"></i> ${s}</span>`;
            });

            card.innerHTML = `
                <div class="lab-card-img-wrapper">
                    <span class="img-floating-badge"><i class="fas ${categoryIcon}"></i> ${categoryLabel}</span>
                    <img src="${resolvedImg}" alt="${l.name}" class="lab-card-img" onerror="this.src='https://placehold.co/400x250?text=${l.name}'">
                </div>
                <div class="lab-card-body">
                    <h3>${l.name}</h3>
                    <p>${l.description}</p>
                    <div class="lab-specs">
                        ${specsHtml}
                    </div>
                </div>
            `;

            labsGrid.appendChild(card);
        });

        if (window.initScrollRevealForNewElements) {
            window.initScrollRevealForNewElements();
        }
    }

    function loadLabs() {
        const cached = localStorage.getItem('sadara_labs');
        if (cached) {
            try {
                renderLabs(JSON.parse(cached));
            } catch (e) {
                console.error('Error parsing cached labs:', e);
            }
        }

        fetch(API_BASE + '/api/labs')
            .then(res => res.json())
            .then(labs => {
                const cachedStr = localStorage.getItem('sadara_labs');
                if (cachedStr && JSON.stringify(labs) === JSON.stringify(JSON.parse(cachedStr))) {
                    return; // Avoid layout reflow
                }
                localStorage.setItem('sadara_labs', JSON.stringify(labs));
                renderLabs(labs);
            })
            .catch(err => {
                console.error('Failed to load labs from API:', err);
            });
    }

    function renderFees(fees) {
        const tbody = document.getElementById('fees-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        if (fees.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">لا توجد رسوم دراسية مضافة حالياً.</td>
                </tr>
            `;
            return;
        }
        
        fees.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold; color: var(--primary);">${f.department_name}</td>
                <td>${f.official_fee}</td>
                <td style="font-weight: bold; color: #2ecc71;">${f.discounted_fee}</td>
                <td>${f.installment}</td>
                <td>${f.payment_options}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function loadFees() {
        const tbody = document.getElementById('fees-table-body');
        if (!tbody) return;
        
        const cached = localStorage.getItem('sadara_fees');
        if (cached) {
            try {
                renderFees(JSON.parse(cached));
            } catch (e) {
                console.error('Error parsing cached fees:', e);
            }
        }
        
        fetch(API_BASE + '/api/fees')
            .then(res => res.json())
            .then(fees => {
                const cachedStr = localStorage.getItem('sadara_fees');
                if (cachedStr && JSON.stringify(fees) === JSON.stringify(JSON.parse(cachedStr))) {
                    return;
                }
                localStorage.setItem('sadara_fees', JSON.stringify(fees));
                renderFees(fees);
            })
            .catch(err => {
                console.error('Failed to load fees from API:', err);
            });
    }
}

// ==========================================
// Instant Page Navigation: Hover Prefetch
// Preloads pages when user hovers over links
// ==========================================
(function() {
    const prefetched = new Set();
    
    function prefetchPage(url) {
        if (prefetched.has(url)) return;
        if (!url || url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('http')) return;
        
        prefetched.add(url);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        link.as = 'document';
        document.head.appendChild(link);
    }
    
    document.addEventListener('mouseover', function(e) {
        const link = e.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (href && href.endsWith('.html')) {
            prefetchPage(href);
        }
    }, { passive: true });
    
    // Also prefetch on touchstart for mobile
    document.addEventListener('touchstart', function(e) {
        const link = e.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (href && href.endsWith('.html')) {
            prefetchPage(href);
        }
    }, { passive: true });
})();

// ==========================================
// Global Scroll Listener
// ==========================================
window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    const floatToTop = document.getElementById('float-totop');
    if (header) {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
            if (floatToTop) floatToTop.classList.add('show');
        } else {
            header.classList.remove('scrolled');
            if (floatToTop) floatToTop.classList.remove('show');
        }
    }
});

// ==========================================
// SPA Router implementation
// ==========================================
let currentAbortController = null;

function showProgressBar() {
    let bar = document.getElementById('spa-progress-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'spa-progress-bar';
        bar.style.position = 'fixed';
        bar.style.top = '0';
        bar.style.left = '0';
        bar.style.height = '3px';
        bar.style.background = 'linear-gradient(to right, var(--primary), var(--secondary))';
        bar.style.zIndex = '99999';
        bar.style.transition = 'width 0.3s ease, opacity 0.3s ease';
        bar.style.width = '0%';
        bar.style.boxShadow = '0 0 10px var(--primary)';
        document.body.appendChild(bar);
    }
    bar.style.opacity = '1';
    bar.style.width = '10%';
    setTimeout(() => { if (bar.style.width === '10%') bar.style.width = '40%'; }, 100);
    setTimeout(() => { if (bar.style.width === '40%') bar.style.width = '75%'; }, 300);
}

function hideProgressBar() {
    const bar = document.getElementById('spa-progress-bar');
    if (bar) {
        bar.style.width = '100%';
        setTimeout(() => {
            bar.style.opacity = '0';
            setTimeout(() => {
                bar.style.width = '0%';
            }, 300);
        }, 150);
    }
}

function loadPage(url) {
    showProgressBar();
    if (currentAbortController) {
        currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    
    document.body.classList.add('page-transitioning');
    const cleanUrl = url.split('#')[0];
    
    fetch(cleanUrl, { signal: currentAbortController.signal })
        .then(res => {
            if (!res.ok) throw new Error('Page not found');
            return res.text();
        })
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Swap body content
            document.body.innerHTML = doc.body.innerHTML;
            document.title = doc.title;
            
            // Re-run page scripts and dynamic logic
            initPage();
            
            // Scroll handling
            if (url.includes('#')) {
                const hash = url.substring(url.indexOf('#'));
                setTimeout(() => {
                    const elem = document.querySelector(hash);
                    if (elem) {
                        elem.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 100);
            } else {
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
            
            document.body.classList.remove('page-transitioning');
            hideProgressBar();
        })
        .catch(err => {
            if (err.name === 'AbortError') return;
            console.error('SPA load page error:', err);
            hideProgressBar();
            document.body.classList.remove('page-transitioning');
            // Fallback to traditional navigation
            window.location.href = url;
        });
}

function navigateTo(url) {
    const currentLoc = window.location.pathname + window.location.search + window.location.hash;
    if (url === currentLoc) return;
    
    history.pushState(null, '', url);
    loadPage(url);
}

function initSPARouter() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href) return;
        
        // Ignore external urls
        if (href.startsWith('http://') || href.startsWith('https://')) return;
        if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
        if (href.startsWith('#') || link.getAttribute('target') === '_blank') return;
        
        // Ignore links pointing out of static site or to admin dashboard
        if (href.includes('../dashbord/') || href.includes('dashbord/')) return;
        
        if (href.endsWith('.html') || !href.includes('.')) {
            e.preventDefault();
            navigateTo(href);
        }
    });
    
    window.addEventListener('popstate', () => {
        loadPage(window.location.pathname + window.location.search + window.location.hash);
    });
}

// ==========================================
// Initialization on DOM ready
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initPage();
    initSPARouter();
});
