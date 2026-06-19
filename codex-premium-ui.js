(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const storageKey = `codex_periods_collapsed_${location.pathname}`;
    const collapsedPeriodKey = `codex_collapsed_periods_${location.pathname}`;
    const maxResults = 8;
    const searchInputSelector = '#global-search, #mobile-search, #mobile-top-search';
    let mobileSheetOpen = false;
    let ticketSearchIndex = null;
    let ticketSearchIndexSource = null;
    let ticketSearchIndexLength = 0;
    const ticketSearchEntryMap = new WeakMap();

    function canAnimate() {
        return !reduceMotion && window.gsap;
    }

    function getTickets() {
        try {
            return Array.isArray(BOOK_DATA) ? BOOK_DATA : [];
        } catch (error) {
            return [];
        }
    }

    function getVisibleTickets(fallback) {
        if (Array.isArray(fallback)) return fallback;
        if (typeof window.visibleTopics === 'function') return window.visibleTopics();
        return getTickets();
    }

    function getReadSections() {
        try {
            return Array.isArray(readSections) ? readSections : [];
        } catch (error) {
            return [];
        }
    }

    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function stripMarkup(value) {
        const element = document.createElement('div');
        element.innerHTML = String(value || '');
        return (element.textContent || element.innerText || '').replace(/\s+/g, ' ').trim();
    }

    function normalize(value) {
        return String(value || '').toLocaleLowerCase('ru-RU');
    }

    function getTerms(query) {
        return normalize(query)
            .split(/\s+/)
            .map(term => term.trim())
            .filter(term => term.length > 1);
    }

    function highlight(value, terms) {
        let output = escapeHTML(value);
        [...new Set(terms)].sort((a, b) => b.length - a.length).forEach((term) => {
            const expression = new RegExp(`(${escapeRegExp(escapeHTML(term))})`, 'gi');
            output = output.replace(expression, '<mark class="codex-highlight">$1</mark>');
        });
        return output;
    }

    function parseTicketTitle(title) {
        const match = String(title || '').match(/^Билет\s+(\d+)\.\s*(.+)$/i);
        return {
            number: match ? match[1] : String(title || '').split('.')[0].replace(/\D/g, '') || '•',
            title: match ? match[2] : String(title || '').replace(/^Билет\s+\d+\.\s*/i, '')
        };
    }

    function extractDates(item) {
        const text = stripMarkup(item.content);
        const matches = text.match(/\b\d{1,2}\s*(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|авг\.|сент\.|окт\.|нояб\.|дек\.)\s+\d{4}\s*г?\.?|\b\d{4}[-–]\d{4}(?:-х)?\s*(?:гг?\.?)?|\b\d{4}\s*(?:г\.|года|гг\.)?/gi) || [];
        return [...new Set(matches)].slice(0, 3).join(' · ') || 'ключевые даты внутри билета';
    }

    function makeSummary(item, terms) {
        const cached = ticketSearchEntryMap.get(item);
        const clean = (cached ? cached.summaryText : stripMarkup(item.content))
            .replace(/^Смысл ответа\s*/i, '')
            .replace(/Главная логика билета:\s*/i, '')
            .replace(/Главные даты:.*?Опорные пункты:/i, '')
            .trim();
        const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
        const base = sentences.slice(0, 2).join(' ').trim() || clean.slice(0, 260);
        const compact = base.length > 310 ? `${base.slice(0, 307).trim()}...` : base;
        return highlight(compact, terms);
    }

    function getTicketSearchIndex() {
        const tickets = getTickets();
        if (ticketSearchIndex && ticketSearchIndexSource === tickets && ticketSearchIndexLength === tickets.length) {
            return ticketSearchIndex;
        }

        ticketSearchIndexSource = tickets;
        ticketSearchIndexLength = tickets.length;
        ticketSearchIndex = tickets.map((item) => {
            const titleText = String(item.title || '');
            const categoryText = String(item.category || '');
            const contentText = stripMarkup(item.content);
            const entry = {
                item,
                title: normalize(titleText),
                category: normalize(categoryText),
                content: normalize(contentText),
                summaryText: contentText
            };
            entry.haystack = `${entry.title} ${entry.category} ${entry.content}`;
            ticketSearchEntryMap.set(item, entry);
            return entry;
        });
        return ticketSearchIndex;
    }

    function countOccurrences(value, term, limit) {
        if (!term) return 0;
        let count = 0;
        let position = value.indexOf(term);
        while (position !== -1 && count < limit) {
            count += 1;
            position = value.indexOf(term, position + term.length);
        }
        return count;
    }

    function ticketMeta(item) {
        const clean = stripMarkup(item.content);
        const dateText = extractDates(item);
        const termsCount = (clean.match(/[А-ЯA-ZЁ][а-яa-zё-]{3,}/g) || []).length;
        return { dateText, termsCount };
    }

    function renderTicketCard(item) {
        const parsed = parseTicketTitle(item.title);
        const meta = ticketMeta(item);
        const isRead = getReadSections().includes(item.id);
        return `
            <button type="button" data-topic-id="${escapeHTML(item.id)}" class="codex-ticket-card codex-tilt-card">
                <span class="codex-ticket-number">${escapeHTML(parsed.number)}</span>
                <span class="min-w-0">
                    <span class="codex-ticket-title">${escapeHTML(parsed.title)}</span>
                    <span class="codex-ticket-tag">${escapeHTML(item.category)}</span>
                    <span class="codex-ticket-meta">
                        <span>${escapeHTML(meta.dateText)}</span>
                        <span>${meta.termsCount} опорных слов</span>
                        ${isRead ? '<span>изучено</span>' : '<span>не отмечено</span>'}
                    </span>
                </span>
            </button>
        `;
    }

    function periodKey(name) {
        return normalize(name).replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || 'period';
    }

    function readCollapsedPeriods() {
        try {
            return new Set(JSON.parse(localStorage.getItem(collapsedPeriodKey) || '[]'));
        } catch (error) {
            return new Set();
        }
    }

    function writeCollapsedPeriods(values) {
        localStorage.setItem(collapsedPeriodKey, JSON.stringify([...values]));
    }

    function renderPeriodGroup(catName, items) {
        const key = periodKey(catName);
        const collapsed = readCollapsedPeriods().has(key);
        return `
            <div class="space-y-2 codex-period-group ${collapsed ? 'is-collapsed' : ''}" data-period-key="${escapeHTML(key)}">
                <button type="button" class="codex-period-heading" data-period-toggle="${escapeHTML(key)}" aria-expanded="${String(!collapsed)}">
                    <span class="line-clamp-2">${escapeHTML(catName)}</span>
                    <span class="codex-period-count">${items.length}</span>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
                <div class="codex-period-body">
                    <div class="codex-period-content space-y-2">
                        ${items.map(renderTicketCard).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Premium TOC renderer used by all split ticket pages.
    function renderPremiumTOC(list) {
        const container = document.getElementById('toc-container');
        if (!container) return;
        const data = getVisibleTickets(list);
        if (!data.length) {
            container.innerHTML = '<div class="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800">Ничего не найдено.</div>';
            return;
        }

        const categories = {};
        data.forEach((item) => {
            if (!categories[item.category]) categories[item.category] = [];
            categories[item.category].push(item);
        });

        container.innerHTML = Object.entries(categories).map(([catName, items]) => renderPeriodGroup(catName, items)).join('');
    }

    // The unified index stores tickets inside the period filter, not #toc-container.
    function renderPremiumPeriods() {
        const container = document.getElementById('period-filter');
        if (!container || typeof window.periodTopics !== 'function') return false;
        const categories = [...new Set(getTickets().map(item => item.category))];
        const items = [
            { id: 'all', label: 'Все периоды', count: window.periodTopics('all').length },
            ...categories
                .map(cat => ({ id: cat, label: cat, count: window.periodTopics(cat).length }))
                .filter(item => item.count > 0)
        ];

        if (!items.length || !items[0].count) {
            container.innerHTML = '<div class="rounded-xl bg-black/5 p-4 text-center text-xs text-black/50 dark:bg-white/10 dark:text-white/50">Поиск ничего не нашел.</div>';
            return true;
        }

        container.innerHTML = items.map(item => `
            <div class="period-group ${readCollapsedPeriods().has(periodKey(item.id)) ? 'is-collapsed' : ''} rounded-2xl border border-black/5 bg-white/70 p-2 dark:border-white/10 dark:bg-white/5">
                <button type="button" class="period-btn codex-period-heading" data-period-toggle="${escapeHTML(periodKey(item.id))}" aria-expanded="${String(!readCollapsedPeriods().has(periodKey(item.id)))}">
                    <span class="line-clamp-2">${escapeHTML(item.label)}</span>
                    <span class="codex-period-count">${item.count}</span>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
                <div class="codex-period-body mt-2">
                    <div class="codex-period-content space-y-2">
                        ${window.periodTopics(item.id).map(renderTicketCard).join('')}
                    </div>
                </div>
            </div>
        `).join('');
        return true;
    }

    function togglePeriod(button) {
        const group = button.closest('.codex-period-group, .period-group');
        const body = group ? group.querySelector('.codex-period-body') : null;
        const key = button.getAttribute('data-period-toggle');
        if (!body || !key) return;

        const collapsed = button.getAttribute('aria-expanded') === 'true';
        const stored = readCollapsedPeriods();
        if (collapsed) stored.add(key);
        else stored.delete(key);
        writeCollapsedPeriods(stored);
        button.setAttribute('aria-expanded', String(!collapsed));
        group.classList.toggle('is-collapsed', collapsed);
    }

    function rankTickets(query) {
        const terms = getTerms(query);
        if (!terms.length) return [];

        return getTicketSearchIndex()
            .map((entry) => {
                let score = 0;

                terms.forEach((term) => {
                    if (entry.title.includes(term)) score += 12;
                    if (entry.category.includes(term)) score += 5;
                    if (entry.content.includes(term)) score += 2;
                    score += countOccurrences(entry.haystack, term, 6);
                });

                return { item: entry.item, score };
            })
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(result => result.item);
    }

    // Lightweight client-side search panel with generated TL;DR previews.
    function ensureSearchPanel(input) {
        if (!input) return null;
        if (!input.getAttribute('aria-label')) {
            input.setAttribute('aria-label', input.getAttribute('placeholder') || 'Поиск');
        }
        if (!input.getAttribute('autocomplete')) {
            input.setAttribute('autocomplete', 'off');
        }
        const parent = input.parentElement;
        if (parent && !parent.classList.contains('codex-search-wrap')) {
            parent.classList.add('codex-search-wrap');
        }
        if (parent && !parent.querySelector('.codex-search-clear')) {
            const clear = document.createElement('button');
            clear.type = 'button';
            clear.className = 'codex-search-clear';
            clear.setAttribute('aria-label', 'Очистить поиск');
            clear.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 6.4 13.6 13.6M13.6 6.4 6.4 13.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
            input.insertAdjacentElement('afterend', clear);
        }
        if (parent) parent.classList.toggle('codex-search-has-value', Boolean(input.value.trim()));

        let panel = parent ? parent.querySelector('.codex-search-panel') : null;
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'codex-search-panel';
            panel.hidden = true;
            const clear = parent ? parent.querySelector('.codex-search-clear') : null;
            (clear || input).insertAdjacentElement('afterend', panel);
        }
        return panel;
    }

    function showPanel(panel) {
        if (!panel || !panel.hidden) return;
        panel.hidden = false;
        if (canAnimate()) {
            gsap.fromTo(panel, { autoAlpha: 0, y: -8, scale: 0.985 }, {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.24,
                ease: 'power2.out'
            });
        }
    }

    function hidePanels(exceptPanel) {
        document.querySelectorAll('.codex-search-panel').forEach((panel) => {
            if (panel === exceptPanel) return;
            if (panel.hidden) return;
            if (canAnimate()) {
                gsap.to(panel, {
                    autoAlpha: 0,
                    y: -8,
                    scale: 0.985,
                    duration: 0.18,
                    ease: 'power2.in',
                    onComplete: () => { panel.hidden = true; }
                });
            } else {
                panel.hidden = true;
            }
        });
    }

    function getTermsData() {
        try {
            return Array.isArray(TERMS) ? TERMS : [];
        } catch (error) {
            return [];
        }
    }

    function getQuestionsData() {
        try {
            return Array.isArray(QUIZ_QUESTIONS) ? QUIZ_QUESTIONS : [];
        } catch (error) {
            return [];
        }
    }

    function getDateMatches(query) {
        const terms = getTerms(query);
        const digitSearch = /\d/.test(query || '');
        if (!terms.length && !digitSearch) return [];
        const datePattern = /\b\d{1,2}\s+[а-яё]+\s+\d{3,4}\s*г\.|\b\d{3,4}(?:-\d{2,4})?\s*гг?\.?/gi;
        const matches = [];

        getTickets().forEach((item) => {
            const source = `${item.title} ${stripMarkup(item.content || '')}`;
            const dates = source.match(datePattern) || [];
            dates.slice(0, 6).forEach((date) => {
                if (!terms.length || terms.some(term => normalize(date).includes(term) || normalize(source).includes(term))) {
                    matches.push({ date, item });
                }
            });
        });

        const seen = new Set();
        return matches.filter((match) => {
            const key = `${match.date}-${match.item.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 6);
    }

    function rankTerms(query) {
        const terms = getTerms(query);
        if (!terms.length) return [];
        return getTermsData()
            .map((item, index) => {
                const haystack = normalize(`${item.term} ${item.definition}`);
                const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
                return { item, index, score };
            })
            .filter(result => result.score > 0)
            .slice(0, 6);
    }

    function rankQuestions(query) {
        const terms = getTerms(query);
        if (!terms.length) return [];
        return getQuestionsData()
            .map((item, index) => {
                const haystack = normalize(`${item.q} ${item.hint} ${(item.a || []).join(' ')}`);
                const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
                return { item, index, score };
            })
            .filter(result => result.score > 0)
            .slice(0, 5);
    }

    function ensureCommandPalette() {
        let palette = document.getElementById('codex-command-palette');
        if (palette) return palette;

        palette = document.createElement('div');
        palette.id = 'codex-command-palette';
        palette.className = 'codex-command-palette';
        palette.hidden = true;
        palette.innerHTML = `
            <div class="codex-command-backdrop" data-command-close></div>
            <section class="codex-command-shell" role="dialog" aria-modal="true" aria-label="Поиск по Историческому Навигатору">
                <header class="codex-command-header">
                    <span class="codex-command-kicker">Command palette</span>
                    <strong id="codex-command-query">Поиск по билетам, датам и терминам</strong>
                    <button type="button" class="codex-command-close" data-command-close aria-label="Закрыть поиск">
                        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 6.4 13.6 13.6M13.6 6.4 6.4 13.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </button>
                </header>
                <div id="codex-command-results" class="codex-command-results"></div>
                <footer class="codex-command-footer">
                    <span>↑↓ выбрать</span>
                    <span>Enter открыть</span>
                    <span>Esc закрыть</span>
                </footer>
            </section>
        `;
        document.body.appendChild(palette);
        return palette;
    }

    function setCommandActive(index) {
        const palette = ensureCommandPalette();
        const items = [...palette.querySelectorAll('.codex-command-item')];
        if (!items.length) return;
        const next = ((index % items.length) + items.length) % items.length;
        items.forEach((item, itemIndex) => {
            item.classList.toggle('is-active', itemIndex === next);
            item.setAttribute('aria-selected', String(itemIndex === next));
        });
        palette.dataset.activeIndex = String(next);
        items[next].scrollIntoView({ block: 'nearest' });
    }

    function commandItem(kind, attrs, marker, title, meta, summary) {
        return `
            <button type="button" class="codex-command-item" ${attrs} role="option" aria-selected="false">
                <span class="codex-command-marker codex-command-marker-${kind}">${marker}</span>
                <span class="codex-command-copy">
                    <span class="codex-command-title">${title}</span>
                    <span class="codex-command-meta">${meta}</span>
                    ${summary ? `<span class="codex-command-summary">${summary}</span>` : ''}
                </span>
            </button>
        `;
    }

    function commandGroup(title, count, body) {
        if (!body) return '';
        return `
            <section class="codex-command-group">
                <div class="codex-command-group-head">
                    <span>${title}</span>
                    <strong>${count}</strong>
                </div>
                <div class="codex-command-list" role="listbox">${body}</div>
            </section>
        `;
    }

    function renderCommandPalette(query, sourceInput) {
        const palette = ensureCommandPalette();
        const resultsNode = palette.querySelector('#codex-command-results');
        const queryNode = palette.querySelector('#codex-command-query');
        const trimmed = String(query || '').trim();
        const terms = getTerms(trimmed);
        const isSearchInput = sourceInput && sourceInput.matches?.(searchInputSelector);

        if (!trimmed && !isSearchInput) {
            hideCommandPalette();
            return;
        }

        palette.hidden = false;
        document.body.classList.add('codex-command-open');
        queryNode.textContent = trimmed ? `“${trimmed}”` : 'Начните вводить билет, дату, термин или фамилию';

        if (!trimmed) {
            resultsNode.innerHTML = `
                <div class="codex-command-empty">
                    <strong>Быстрый поиск по всему курсу</strong>
                    <span>Например: 1812, Сперанский, индустриализация, холодная война.</span>
                </div>
            `;
            palette.dataset.activeIndex = '0';
            return;
        }

        const ticketResults = rankTickets(trimmed).slice(0, 6);
        const termResults = rankTerms(trimmed).slice(0, 5);
        const dateResults = getDateMatches(trimmed).slice(0, 5);
        const questionResults = rankQuestions(trimmed).slice(0, 4);

        const ticketsHtml = ticketResults.map((item) => {
            const parsed = parseTicketTitle(item.title);
            return commandItem(
                'ticket',
                `data-topic-id="${escapeHTML(item.id)}"`,
                `B${escapeHTML(parsed.number)}`,
                highlight(parsed.title, terms),
                highlight(item.category, terms),
                makeSummary(item, terms)
            );
        }).join('');

        const termsHtml = termResults.map(({ item, index }) => commandItem(
            'term',
            `data-term-index="${index}"`,
            'Т',
            highlight(item.term, terms),
            'Термин',
            highlight(item.definition, terms)
        )).join('');

        const datesHtml = dateResults.map(({ date, item }) => {
            const parsed = parseTicketTitle(item.title);
            return commandItem(
                'date',
                `data-topic-id="${escapeHTML(item.id)}"`,
                'Д',
                highlight(date, terms),
                `Билет ${escapeHTML(parsed.number)}`,
                highlight(parsed.title, terms)
            );
        }).join('');

        const questionsHtml = questionResults.map(({ item, index }) => commandItem(
            'question',
            `data-question-index="${index}"`,
            '?',
            `Вопрос ${index + 1}`,
            'Тест',
            highlight(item.q, terms)
        )).join('');

        const total = ticketResults.length + termResults.length + dateResults.length + questionResults.length;
        resultsNode.innerHTML = total
            ? [
                commandGroup('Билеты', ticketResults.length, ticketsHtml),
                commandGroup('Даты', dateResults.length, datesHtml),
                commandGroup('Термины', termResults.length, termsHtml),
                commandGroup('Тесты', questionResults.length, questionsHtml)
            ].join('')
            : `
                <div class="codex-command-empty">
                    <strong>Ничего не найдено</strong>
                    <span>Попробуйте дату, фамилию, реформу, войну или термин из билета.</span>
                </div>
            `;
        setCommandActive(0);
    }

    function hideCommandPalette() {
        const palette = document.getElementById('codex-command-palette');
        if (!palette) return;
        palette.hidden = true;
        palette.dataset.activeIndex = '0';
        document.body.classList.remove('codex-command-open');
    }

    function renderSearchPanel(query, sourceInput) {
        const panel = ensureSearchPanel(sourceInput);
        if (!panel) return;
        hidePanels(panel);
        const terms = getTerms(query);
        if (!terms.length) {
            hidePanels();
            return;
        }

        const results = rankTickets(query);
        if (!results.length) {
            panel.innerHTML = `
                <div class="codex-search-panel-head">
                    <span>Поиск</span>
                    <strong>0 результатов</strong>
                </div>
                <div class="codex-search-empty">Ничего не найдено. Попробуйте дату, фамилию, реформу или термин из билета.</div>
            `;
            showPanel(panel);
            return;
        }

        const shouldAnimateResults = canAnimate() && panel.hidden;
        panel.innerHTML = `
            <div class="codex-search-panel-head">
                <span>Результаты поиска</span>
                <strong>${results.length} ${results.length === 1 ? 'билет' : 'билетов'}</strong>
            </div>
            <div class="codex-search-result-list">
                ${results.map((item) => {
            const parsed = parseTicketTitle(item.title);
            return `
                <button type="button" class="codex-search-result" data-ticket-id="${escapeHTML(item.id)}">
                    <span class="codex-result-content">
                        <span class="codex-result-meta">
                            <span class="codex-result-number">Билет ${escapeHTML(parsed.number)}</span>
                            <span class="codex-result-category">${highlight(item.category, terms)}</span>
                        </span>
                        <span class="codex-result-title">${highlight(parsed.title, terms)}</span>
                        <span class="codex-result-summary">${makeSummary(item, terms)}</span>
                    </span>
                    <span class="codex-result-action">Открыть</span>
                </button>
            `;
        }).join('')}
            </div>
        `;

        showPanel(panel);
        if (shouldAnimateResults) {
            gsap.fromTo(panel.querySelectorAll('.codex-search-result'), { autoAlpha: 0, y: 8 }, {
                autoAlpha: 1,
                y: 0,
                duration: 0.22,
                stagger: 0.035,
                ease: 'power2.out',
                overwrite: true
            });
        }
    }

    function filterTOC(query) {
        const terms = getTerms(query);
        if (!terms.length) {
            renderPremiumTOC(getTickets());
            return;
        }
        const filtered = getTickets().filter((item) => {
            const haystack = normalize(`${item.title} ${item.category} ${stripMarkup(item.content)}`);
            return terms.every(term => haystack.includes(term));
        });
        renderPremiumTOC(filtered);
    }

    function syncSearchInputs(value, activeInput) {
        document.querySelectorAll(searchInputSelector).forEach((input) => {
            if (input !== activeInput) input.value = value;
            const parent = input.parentElement;
            if (parent) parent.classList.toggle('codex-search-has-value', Boolean(value.trim()));
        });
    }

    function ensureMobileSearch() {
        if (document.getElementById('mobile-top-search')) return;
        const desktopSearch = document.getElementById('global-search');
        const header = document.querySelector('header');
        if (!desktopSearch || !header) return;

        const row = document.createElement('div');
        row.className = 'codex-mobile-search-row';
        row.innerHTML = '<input type="search" id="mobile-top-search" placeholder="Поиск по билетам, датам, терминам..." autocomplete="off" aria-label="Поиск по билетам, датам и терминам">';
        header.insertAdjacentElement('afterend', row);
    }

    function installSearch(originalHandleSearch) {
        window.__codexPremiumSearchActive = true;
        ensureMobileSearch();
        document.querySelectorAll(searchInputSelector).forEach((input) => {
            ensureSearchPanel(input);
        });
        let deferredSearchTimer = null;

        function commitSearchState(query, activeInput) {
            if (typeof originalHandleSearch === 'function' && typeof window.visibleTopics === 'function') {
                originalHandleSearch.call(window, query);
                if (typeof window.hideSearchDropdowns === 'function') window.hideSearchDropdowns();
                renderPremiumTOC(window.visibleTopics());
                renderPremiumPeriods();
            } else {
                filterTOC(query);
            }
        }

        function scheduleSearchCommit(query, activeInput, immediate) {
            window.clearTimeout(deferredSearchTimer);
            if (immediate) {
                commitSearchState(query, activeInput);
                return;
            }
            deferredSearchTimer = window.setTimeout(() => {
                commitSearchState(query, activeInput);
            }, 160);
        }

        document.addEventListener('input', (event) => {
            const input = event.target.closest(searchInputSelector);
            if (!input) return;
            if (input.getAttribute('oninput')) return;
            syncSearchInputs(input.value, input);
            renderSearchPanel(input.value, input);
            scheduleSearchCommit(input.value, input, false);
        }, true);

        document.addEventListener('focusin', (event) => {
            const input = event.target.closest(searchInputSelector);
            if (!input) return;
            renderSearchPanel(input.value, input);
        });

        document.addEventListener('click', (event) => {
            if (event.target.closest('[data-command-close]')) {
                event.preventDefault();
                hideCommandPalette();
                return;
            }
            const commandItemNode = event.target.closest('.codex-command-item');
            if (commandItemNode) {
                hideCommandPalette();
                closeMobileSheet();
                const topicId = commandItemNode.getAttribute('data-topic-id');
                const termIndex = commandItemNode.getAttribute('data-term-index');
                const questionIndex = commandItemNode.getAttribute('data-question-index');
                if (topicId && typeof window.selectTopic === 'function') {
                    window.selectTopic(topicId);
                    return;
                }
                if (termIndex !== null && typeof window.openTermResult === 'function') {
                    window.openTermResult(Number(termIndex));
                    return;
                }
                if (questionIndex !== null && typeof window.openQuestionResult === 'function') {
                    window.openQuestionResult(Number(questionIndex));
                    return;
                }
            }
            const clear = event.target.closest('.codex-search-clear');
            if (clear) {
                event.preventDefault();
                event.stopPropagation();
                const input = clear.parentElement?.querySelector(searchInputSelector);
                window.clearTimeout(deferredSearchTimer);
                syncSearchInputs('', input);
                commitSearchState('', input);
                hidePanels();
                hideCommandPalette();
                input?.focus();
                return;
            }
            const result = event.target.closest('.codex-search-result[data-ticket-id]');
            if (result && typeof window.selectTopic === 'function') {
                window.clearTimeout(deferredSearchTimer);
                window.selectTopic(result.getAttribute('data-ticket-id'));
                hidePanels();
                closeMobileSheet();
                return;
            }
            const periodButton = event.target.closest('[data-period-toggle]');
            if (periodButton) {
                event.preventDefault();
                event.stopImmediatePropagation();
                togglePeriod(periodButton);
                return;
            }
            const topic = event.target.closest('[data-topic-id]');
            if (topic && typeof window.selectTopic === 'function' && topic.classList.contains('codex-ticket-card')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                window.selectTopic(topic.getAttribute('data-topic-id'));
                closeMobileSheet();
                return;
            }
            if (!event.target.closest('.codex-search-wrap')) hidePanels();
        });

        document.addEventListener('keydown', (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                const input = document.getElementById('global-search') || document.getElementById('mobile-top-search');
                input?.focus();
                renderSearchPanel(input?.value || '', input);
                return;
            }
            const palette = document.getElementById('codex-command-palette');
            const paletteOpen = palette && !palette.hidden;
            if (paletteOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault();
                const current = Number(palette.dataset.activeIndex || 0);
                setCommandActive(current + (event.key === 'ArrowDown' ? 1 : -1));
                return;
            }
            if (paletteOpen && event.key === 'Enter') {
                const active = palette.querySelector('.codex-command-item.is-active');
                if (active) {
                    event.preventDefault();
                    active.click();
                    return;
                }
            }
            if (event.key === 'Escape') {
                hidePanels();
                hideCommandPalette();
                closeMobileSheet();
            }
        });

        window.handleSearch = function (query) {
            const activeInput = document.activeElement && document.activeElement.matches?.(searchInputSelector)
                ? document.activeElement
                : document.getElementById('global-search');
            syncSearchInputs(query, activeInput);
            renderSearchPanel(query, activeInput);
            scheduleSearchCommit(query, activeInput, false);
        };
    }

    // Desktop: collapse the periods list without layout jumps.
    function installPeriodToolbar() {
        const sidebar = document.getElementById('sidebar-toc');
        const container = document.getElementById('toc-container');
        if (!sidebar || !container || sidebar.dataset.codexPeriodReady === 'true') return;

        const title = sidebar.querySelector('p');
        const toolbar = document.createElement('div');
        toolbar.className = 'codex-period-toolbar';
        toolbar.innerHTML = `
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Все периоды</p>
            <button type="button" id="codex-period-toggle" class="codex-period-toggle" aria-expanded="true">
                <span>Свернуть</span>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
        `;

        if (title) title.replaceWith(toolbar);
        else sidebar.insertBefore(toolbar, container);

        const button = toolbar.querySelector('button');
        const label = toolbar.querySelector('span');

        function applyState(collapsed, animate) {
            if (window.matchMedia('(max-width: 1023px)').matches) return;
            button.setAttribute('aria-expanded', String(!collapsed));
            label.textContent = collapsed ? 'Развернуть' : 'Свернуть';
            sidebar.classList.toggle('codex-periods-collapsed', collapsed);
        }

        applyState(localStorage.getItem(storageKey) === 'true', false);
        button.addEventListener('click', () => {
            if (window.matchMedia('(max-width: 1023px)').matches) {
                closeMobileSheet();
                return;
            }
            const collapsed = button.getAttribute('aria-expanded') === 'true';
            localStorage.setItem(storageKey, String(collapsed));
            applyState(collapsed, true);
        });
        sidebar.dataset.codexPeriodReady = 'true';
    }

    // Mobile: convert the periods panel into a GSAP bottom sheet.
    function ensureMobileSheet() {
        const sidebar = document.getElementById('sidebar-toc');
        if (!sidebar || document.getElementById('codex-period-sheet-trigger')) return;
        document.body.classList.add('codex-has-bottom-sheet');

        const overlay = document.createElement('button');
        overlay.type = 'button';
        overlay.id = 'codex-period-sheet-overlay';
        overlay.className = 'codex-sheet-overlay';
        overlay.hidden = true;
        overlay.setAttribute('aria-label', 'Закрыть список периодов');
        overlay.addEventListener('click', closeMobileSheet);

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.id = 'codex-period-sheet-trigger';
        trigger.className = 'codex-mobile-period-trigger';
        trigger.innerHTML = `
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 6h16M4 12h16M4 18h10"></path>
            </svg>
            <span>Все периоды</span>
        `;
        trigger.addEventListener('click', openMobileSheet);

        document.body.appendChild(overlay);
        document.body.appendChild(trigger);

        syncResponsiveSheet();
    }

    // Keep mobile transforms from leaking into desktop layouts after resize.
    function syncResponsiveSheet() {
        const sidebar = document.getElementById('sidebar-toc');
        const overlay = document.getElementById('codex-period-sheet-overlay');
        if (!sidebar) return;

        if (!window.matchMedia('(max-width: 1023px)').matches) {
            mobileSheetOpen = false;
            document.body.classList.remove('codex-sheet-open');
            if (overlay) overlay.hidden = true;
            sidebar.style.transform = '';
            sidebar.style.opacity = '';
            sidebar.style.visibility = '';
        }
    }

    function openMobileSheet() {
        const sidebar = document.getElementById('sidebar-toc');
        const overlay = document.getElementById('codex-period-sheet-overlay');
        if (!sidebar || !overlay || !window.matchMedia('(max-width: 1023px)').matches) return;
        mobileSheetOpen = true;
        overlay.hidden = false;
        document.body.classList.add('codex-sheet-open');
    }

    function closeMobileSheet() {
        const sidebar = document.getElementById('sidebar-toc');
        const overlay = document.getElementById('codex-period-sheet-overlay');
        if (!sidebar || !overlay || !mobileSheetOpen) return;
        mobileSheetOpen = false;
        document.body.classList.remove('codex-sheet-open');
        window.setTimeout(() => {
            if (!mobileSheetOpen) overlay.hidden = true;
        }, reduceMotion ? 0 : 180);
    }

    function animateTOC() {
        return;
    }

    function installTilt() {
        return;
    }

    function animateArticleDetails() {
        if (!canAnimate()) return;
        const blocks = document.querySelectorAll('#article-body > div, #article-body h4, #article-body li, #article-body p, #article-body details, #article-body button');
        gsap.fromTo(blocks, { autoAlpha: 0, y: 12 }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.018,
            ease: 'power2.out',
            overwrite: true
        });
    }

    function animateChrome() {
        return;
    }

    function wrapExistingFunctions() {
        const originalRenderTOC = window.renderTOC;
        const originalHandleSearch = window.handleSearch;
        const originalSelectTopic = window.selectTopic;
        const originalRenderPeriods = window.renderPeriods;

        if (typeof originalRenderTOC === 'function') {
            window.renderTOC = function (...args) {
                renderPremiumTOC(args[0]);
                requestAnimationFrame(() => {
                    installPeriodToolbar();
                    ensureMobileSheet();
                    animateTOC();
                });
            };
        }

        if (typeof originalRenderPeriods === 'function') {
            window.renderPeriods = function (...args) {
                const rendered = renderPremiumPeriods();
                if (!rendered) originalRenderPeriods.apply(this, args);
                requestAnimationFrame(animateTOC);
            };
        }

        if (typeof originalSelectTopic === 'function') {
            window.selectTopic = function (...args) {
                const result = originalSelectTopic.apply(this, args);
                requestAnimationFrame(() => {
                    renderPremiumTOC(getVisibleTickets());
                    animateArticleDetails();
                    installTilt();
                });
                return result;
            };
        }

        installSearch(originalHandleSearch);
    }

    function init() {
        wrapExistingFunctions();
        document.querySelectorAll('button[title]:not([aria-label])').forEach((button) => {
            button.setAttribute('aria-label', button.getAttribute('title') || '');
        });
        document.querySelectorAll('input[type="search"], input[id*="search"]').forEach((input) => {
            if (!input.getAttribute('aria-label')) {
                input.setAttribute('aria-label', input.getAttribute('placeholder') || 'Поиск');
            }
            if (!input.getAttribute('autocomplete')) {
                input.setAttribute('autocomplete', 'off');
            }
        });
        installPeriodToolbar();
        ensureMobileSheet();
        syncResponsiveSheet();
        installTilt();
        animateChrome();
        window.addEventListener('resize', syncResponsiveSheet);
        requestAnimationFrame(() => {
            renderPremiumTOC(getVisibleTickets());
            renderPremiumPeriods();
            animateTOC();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
