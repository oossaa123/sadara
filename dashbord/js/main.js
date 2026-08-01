document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. Theme Toggle (Dark / Light Mode)
    // ==========================================
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    if (themeToggleBtn) {
        // Check saved theme or default to system preference
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            let newTheme = 'light';
            
            if (currentTheme === 'light') {
                newTheme = 'dark';
            }
            
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
    const header = document.getElementById('header');
    const floatToTop = document.getElementById('float-totop');
    
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
                if (floatToTop) floatToTop.classList.add('show');
            } else {
                header.classList.remove('scrolled');
                if (floatToTop) floatToTop.classList.remove('show');
            }
        });
    }
    
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
    const daysEl = document.getElementById('days');
    if (daysEl) {
        let countdownDate;
        const storedDeadline = localStorage.getItem('admission_deadline');
        
        if (storedDeadline && new Date(storedDeadline) > new Date()) {
            countdownDate = new Date(storedDeadline).getTime();
        } else {
            const now = new Date();
            const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 23, 59, 59);
            countdownDate = futureDate.getTime();
            localStorage.setItem('admission_deadline', futureDate.toISOString());
        }
        
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
                const nowTime = new Date();
                const nextDeadline = new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate() + 8, 23, 59, 59);
                countdownDate = nextDeadline.getTime();
                localStorage.setItem('admission_deadline', nextDeadline.toISOString());
            }
        };
        
        updateCountdown();
        const countdownInterval = setInterval(updateCountdown, 1000);
    }

    // ==========================================
    // 5. Counter Animations (Stats Section)
    // ==========================================
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
            
            setTimeout(() => {
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
            }, 1500);
        });
    }

    // ==========================================
    // 10. Scroll Animations (Scroll Reveal)
    // ==========================================
    const revealElements = document.querySelectorAll('.animate-on-scroll');
    
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
});
