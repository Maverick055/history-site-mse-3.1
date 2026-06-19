(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function hasGSAP() {
        return !reduceMotion && window.gsap;
    }

    function animateArticle() {
        if (!hasGSAP()) return;

        const article = document.getElementById('article-body');
        const title = document.getElementById('header-title');
        const category = document.getElementById('header-category');
        if (!article) return;

        gsap.killTweensOf([article, title, category]);
        gsap.fromTo(article, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: 'power2.out' });

        if (title) {
            gsap.fromTo(title, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.36, ease: 'power2.out' });
        }
        if (category) {
            gsap.fromTo(category, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' });
        }

        const blocks = article.querySelectorAll(
            '.exam-answer > p, .exam-answer > li, #article-body details, #article-body .rounded-xl, #article-body .rounded-2xl'
        );
        gsap.fromTo(blocks, { autoAlpha: 0, y: 12 }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.34,
            stagger: 0.035,
            ease: 'power2.out',
            overwrite: true
        });
    }

    function animateShell() {
        if (!hasGSAP()) return;

        if (window.ScrollTrigger) {
            gsap.registerPlugin(window.ScrollTrigger);
        }

        if (window.ScrollTrigger) {
            gsap.utils.toArray('article details, .perspective-1000, .quiz-option-btn').forEach((element) => {
                gsap.from(element, {
                    scrollTrigger: { trigger: element, start: 'top 90%', once: true },
                    autoAlpha: 0,
                    y: 16,
                    duration: 0.38,
                    ease: 'power2.out'
                });
            });
        }
    }

    function enhanceInteractions() {
        if (!hasGSAP()) return;

        document.addEventListener('click', (event) => {
            const summary = event.target.closest('summary');
            if (!summary) return;
            gsap.fromTo(summary.parentElement, { scale: 0.992 }, { scale: 1, duration: 0.22, ease: 'power2.out' });
        });
    }

    function wrapTopicSelection() {
        if (!hasGSAP() || typeof window.selectTopic !== 'function' || window.selectTopic.__gsapWrapped) return;

        const originalSelectTopic = window.selectTopic;
        window.selectTopic = function (...args) {
            const result = originalSelectTopic.apply(this, args);
            requestAnimationFrame(() => animateArticle());
            return result;
        };
        window.selectTopic.__gsapWrapped = true;
    }

    function initAnimations() {
        if (!hasGSAP()) return;
        animateArticle();
        enhanceInteractions();
        wrapTopicSelection();
    }

    if (document.readyState === 'complete') {
        initAnimations();
    } else {
        window.addEventListener('load', initAnimations, { once: true });
    }
})();
