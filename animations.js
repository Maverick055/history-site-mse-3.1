(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPowerUI = window.matchMedia("(max-width: 1023px), (pointer: coarse)");

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function canAnimate() {
    return !reduceMotion && window.gsap;
  }

  function motionDuration(value) {
    return lowPowerUI.matches ? Math.min(value, 0.16) : value;
  }

  function registerPlugins() {
    if (!window.gsap) return;
    const plugins = [
      window.ScrollTrigger,
      window.TextPlugin,
    ].filter(Boolean);
    if (plugins.length) window.gsap.registerPlugin(...plugins);
  }

  function animateHero() {
    if (!canAnimate()) return;
    const hero = document.querySelector("#view-home > .fade-up");
    if (!hero) return;
    const items = [
      hero.querySelector("span"),
      hero.querySelector("h1"),
      hero.querySelector("p"),
      ...hero.querySelectorAll("button"),
      ...hero.querySelectorAll("#stat-topics, #stat-terms, #stat-quiz"),
    ].filter(Boolean);
    gsap.from(items, {
      autoAlpha: 0,
      y: 24,
      duration: 0.58,
      stagger: 0.055,
      ease: "power3.out",
      overwrite: true,
    });
    if (window.TextPlugin) {
      const subhead = hero.querySelector("h1 + p");
      if (subhead) {
        const text = subhead.textContent.trim();
        subhead.textContent = "";
        gsap.to(subhead, { text, duration: 0.75, delay: 0.18, ease: "none" });
      }
    }
  }

  function animateHomeSections() {
    if (!canAnimate() || lowPowerUI.matches || !window.ScrollTrigger) return;
    gsap.utils.toArray("#view-home > section").forEach((section) => {
      gsap.from(section, {
        scrollTrigger: { trigger: section, start: "top 85%", once: true },
        autoAlpha: 0,
        y: 18,
        duration: 0.62,
        ease: "power2.out",
      });
    });
    const sectionCards = document.querySelectorAll("#view-home button[data-topic-id], #view-home button[onclick*='quiz']");
    if (sectionCards.length) {
      gsap.from(sectionCards, {
        scrollTrigger: { trigger: "#view-home", start: "top 75%", once: true },
        autoAlpha: 0,
        y: 14,
        duration: 0.5,
        stagger: 0.045,
        ease: "power2.out",
      });
    }
  }

  function animateArticleBlocks() {
    if (!canAnimate()) return;
    const article = document.getElementById("article-body");
    if (!article) return;
    const blocks = [...article.querySelectorAll(".exam-structured-section, .exam-main-answer, .exam-source-note, .article-info-card, .final-callout")].slice(0, 12);
    if (!blocks.length) return;
    gsap.fromTo(
      blocks,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: motionDuration(0.22), stagger: lowPowerUI.matches ? 0.012 : 0.022, ease: "power2.out", overwrite: true },
    );
  }

  function wrapTopicSelection() {
    if (!canAnimate() || typeof window.selectTopic !== "function" || window.selectTopic.__animated) return;
    const original = window.selectTopic;
    window.selectTopic = function (...args) {
      const article = document.getElementById("article-body");
      if (!article) return original.apply(this, args);
      gsap.to(article, {
        autoAlpha: 0,
        y: -8,
        duration: 0.16,
        ease: "power2.out",
        onComplete: () => {
          original.apply(this, args);
          gsap.fromTo(article, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: motionDuration(0.22), ease: "power2.out" });
          animateArticleBlocks();
        },
      });
    };
    window.selectTopic.__animated = true;
  }

  function wrapModeSwitching() {
    if (!canAnimate() || typeof window.switchMode !== "function" || window.switchMode.__animated) return;
    const original = window.switchMode;
    window.switchMode = function (...args) {
      const result = original.apply(this, args);
      const mode = args[0];
      const view = document.getElementById(`view-${mode}`);
      if (view) {
        gsap.killTweensOf(view);
        gsap.fromTo(view, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: motionDuration(0.16), ease: "power2.out", overwrite: true });
        animateViewContent(mode);
      }
      return result;
    };
    window.switchMode.__animated = true;
  }

  function animateViewContent(mode) {
    if (!canAnimate()) return;
    const selectors = {
      home: "#view-home > .fade-up, #view-home > section",
      read: "#article-body > div, #article-body .exam-structured-section, #article-body .exam-main-answer",
      cards: "#view-cards > div, #card-type-filters button, #card-summary",
      quiz: "#quiz-question-text, #quiz-answers-container .quiz-option-btn, #btn-next-question",
    };
    const items = [...document.querySelectorAll(selectors[mode] || "")]
      .filter((item) => !item.classList.contains("hidden"))
      .slice(0, mode === "cards" ? 18 : 12);
    if (!items.length) return;
    gsap.fromTo(
      items,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: motionDuration(0.18), stagger: lowPowerUI.matches ? 0.01 : 0.018, ease: "power2.out", overwrite: true },
    );
  }

  function wrapCards() {
    if (!canAnimate() || typeof window.renderCards !== "function" || window.renderCards.__animated) return;
    const original = window.renderCards;
    window.renderCards = function (...args) {
      const container = document.getElementById("cards-container");
      const result = original.apply(this, args);
      const cards = container ? [...container.querySelectorAll(".perspective-1000")].slice(0, 18) : [];
      if (!cards.length) return result;
      gsap.fromTo(cards, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: motionDuration(0.18), stagger: lowPowerUI.matches ? 0.01 : 0.018, ease: "power2.out", overwrite: true });
      return result;
    };
    window.renderCards.__animated = true;
  }

  function animateQuizContent() {
    if (!canAnimate()) return;
    const items = [
      document.getElementById("quiz-question-text"),
      ...document.querySelectorAll("#quiz-answers-container .quiz-option-btn"),
      document.getElementById("btn-next-question"),
    ].filter((item) => item && !item.classList.contains("hidden"));
    if (!items.length) return;
    gsap.fromTo(
      items,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: motionDuration(0.18), stagger: lowPowerUI.matches ? 0.012 : 0.018, ease: "power2.out", overwrite: true },
    );
  }

  function wrapQuiz() {
    if (!canAnimate() || typeof window.showQuestion !== "function" || window.showQuestion.__animated) return;
    const original = window.showQuestion;
    window.showQuestion = function (...args) {
      const result = original.apply(this, args);
      requestAnimationFrame(animateQuizContent);
      return result;
    };
    window.showQuestion.__animated = true;
  }

  function wrapSearchResults() {
    if (!canAnimate() || typeof window.renderSearchResults !== "function" || window.renderSearchResults.__animated) return;
    const original = window.renderSearchResults;
    window.renderSearchResults = function (...args) {
      const result = original.apply(this, args);
      const items = document.querySelectorAll("#search-results button, #desktop-search-results button, #mobile-search-results-panel button");
      if (items.length) {
        gsap.fromTo(items, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.2, stagger: 0.018, ease: "power2.out", overwrite: true });
      }
      return result;
    };
    window.renderSearchResults.__animated = true;
  }

  function enhanceSearchShell() {
    if (!canAnimate()) return;
    const shells = document.querySelectorAll(".site-search, .codex-mobile-search-row");
    if (shells.length) {
      gsap.fromTo(shells, { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.24, stagger: 0.035, ease: "power3.out", overwrite: true });
    }
    // NOTE: never apply a transform (scale) to .codex-search-wrap on focus.
    // A transform on the wrap makes it the containing block for the
    // position:fixed search dropdown, offsetting it off-screen. The dropdown
    // is portaled to <body> and must stay viewport-relative.
  }

  function enhanceProgress() {
    window.animateStudyProgress = function (progress) {
      const bar = document.getElementById("read-progress-bar");
      if (!bar) return;
      if (!canAnimate()) {
        bar.style.width = `${progress}%`;
        return;
      }
      gsap.to(bar, { width: `${progress}%`, duration: 0.32, ease: "power2.out", overwrite: true });
    };
  }

  function microInteractions() {
    if (!canAnimate() || !window.matchMedia("(pointer: fine)").matches) return;
    const selector = "button, .codex-ticket-card, .perspective-1000";
    document.addEventListener("mouseenter", (event) => {
      const target = event.target.closest && event.target.closest(selector);
      if (!target) return;
      gsap.to(target, { y: -2, duration: 0.18, ease: "power2.out", overwrite: true });
    }, true);
    document.addEventListener("mouseleave", (event) => {
      const target = event.target.closest && event.target.closest(selector);
      if (!target) return;
      gsap.to(target, { y: 0, duration: 0.18, ease: "power2.out", overwrite: true });
    }, true);
  }

  function init() {
    registerPlugins();
    enhanceProgress();
    if (!canAnimate()) return;
    animateHero();
    animateHomeSections();
    wrapTopicSelection();
    wrapModeSwitching();
    wrapCards();
    wrapQuiz();
    wrapSearchResults();
    enhanceSearchShell();
    microInteractions();
    requestAnimationFrame(animateArticleBlocks);
  }

  ready(init);
})();
