(function () {
  const SECTION_TITLES = {
    logic: "Главная логика",
    causes: "Причины и предпосылки",
    keyEvents: "Ключевые события, даты и персоналии",
    links: "Причинно-следственные связи",
    results: "Итоги и последствия",
    final: "Финальная фраза для экзамена",
  };

  const STOP_WORDS = new Set([
    "билет",
    "гг",
    "год",
    "года",
    "век",
    "века",
    "россии",
    "россия",
    "ссср",
    "внешняя",
    "внутренняя",
    "политика",
    "причины",
    "итоги",
    "последствия",
  ]);

  const SERVICE_PHRASES = [
    /^принято[.!]?\s+этот блок билетов/i,
    /текст полностью отформатирован и готов для копирования/i,
  ];

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function stripHTML(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanText(value) {
    const text = stripHTML(value)
      .replace(/^[-•\s]+/, "")
      .replace(/^Главная логика билета:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    return SERVICE_PHRASES.some((pattern) => pattern.test(text)) ? "" : text;
  }

  function asList(value) {
    if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
    return String(value || "")
      .split(";")
      .map(cleanText)
      .filter(Boolean);
  }

  function tokens(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^а-яa-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((token) => token.replace(/^\d+$/, ""))
      .filter((token) => token.length > 3 && !STOP_WORDS.has(token));
  }

  function semanticKey(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/^[а-я\s-]+:\s*/i, "")
      .replace(/[«»"“”'().,;:!?—–-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function similarity(a, b) {
    const left = new Set(tokens(a));
    const right = new Set(tokens(b));
    if (!left.size || !right.size) return 0;
    let overlap = 0;
    left.forEach((token) => {
      if (right.has(token)) overlap += 1;
    });
    return overlap / Math.min(left.size, right.size);
  }

  function isMeaningDuplicate(a, b) {
    const left = semanticKey(a);
    const right = semanticKey(b);
    if (!left || !right) return false;
    if (left === right) return true;
    if (left.length > 48 && right.length > 48 && (left.includes(right) || right.includes(left))) {
      return true;
    }
    return similarity(left, right) >= 0.82;
  }

  function scoreTitle(siteTitle, sourceTitle) {
    const site = new Set(tokens(siteTitle));
    const source = new Set(tokens(sourceTitle));
    if (!site.size || !source.size) return 0;
    const siteYears = String(siteTitle || "").match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];
    const sourceYears = String(sourceTitle || "").match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];
    if (
      siteYears.length &&
      sourceYears.length &&
      !siteYears.some((year) => sourceYears.includes(year))
    ) {
      return 0;
    }
    let overlap = 0;
    source.forEach((token) => {
      if (site.has(token)) overlap += 1;
    });
    return overlap / Math.max(4, Math.min(site.size, source.size));
  }

  function bestDocxMatch(topic) {
    const data = window.DOCX_TICKET_DATA || [];
    let best = null;
    let bestScore = 0;
    data.forEach((item) => {
      const score = scoreTitle(topic.title, item.sourceTitle);
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    });
    return best && bestScore >= 0.5 ? { item: best, score: bestScore } : null;
  }

  function paragraphItems(htmlText) {
    const blocks = String(htmlText || "").match(/<(?:p|li)\b[\s\S]*?<\/(?:p|li)>/gi) || [];
    return blocks.map(cleanText).filter(Boolean);
  }

  function pickByNeedle(items, needles, fallbackStart, fallbackCount) {
    const found = items.filter((item) => {
      const lower = item.toLowerCase();
      return needles.some((needle) => lower.includes(needle));
    });
    if (found.length) return found.slice(0, 3);
    return items.slice(fallbackStart, fallbackStart + fallbackCount).filter(Boolean);
  }

  function fallbackSections(summary, dates, points, text, conclusion) {
    return {
      logic: [summary],
      causes: [],
      keyEvents: [
        `Даты: ${dates}`,
        `Опорные пункты: ${points}`,
      ],
      links: [],
      results: [],
      final: [conclusion],
    };
  }

  function mergeUnique(primary, fallback, limit) {
    const result = [];
    [...asList(primary), ...asList(fallback)].forEach((item) => {
      if (item && !result.some((existing) => isMeaningDuplicate(existing, item))) {
        result.push(item);
      }
    });
    return result.slice(0, limit);
  }

  function filterSyntheticFallback(items) {
    return asList(items).filter((item) => !/^(даты|опорные пункты):/i.test(item));
  }

  function dedupeList(items, limit) {
    return mergeUnique(items, [], limit || Number.POSITIVE_INFINITY);
  }

  function removeResultFinalOverlap(sections) {
    const finalItems = asList(sections.final);
    const originalResults = asList(sections.results);
    const filteredResults = originalResults.filter(
      (result) => !finalItems.some((final) => isMeaningDuplicate(result, final)),
    );
    sections.results = filteredResults.length || !originalResults.length
      ? filteredResults
      : originalResults.slice(0, 1);
    const priorItems = [
      ...asList(sections.logic),
      ...asList(sections.keyEvents),
      ...asList(sections.causes),
      ...asList(sections.links),
      ...asList(sections.results),
    ];
    sections.final = finalItems
      .filter((final) => !priorItems.some((item) => isMeaningDuplicate(item, final)))
      .slice(0, 1);
    return sections;
  }

  function renderSection(key, items, className) {
    const list = asList(items);
    if (!list.length) return "";
    const body =
      list.length === 1
        ? `<p>${escapeHTML(list[0])}</p>`
        : `<ul class="list-disc space-y-2 pl-5">${list.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`;
    return `<section class="exam-structured-section ${className || ""}" data-exam-section="${key}">
      <h4>${SECTION_TITLES[key]}</h4>
      ${body}
    </section>`;
  }

  function stripRepeatedConclusionBlocks(text) {
    return String(text || "").replace(
      /<(p|li)\b[^>]*>[\s\S]*?(?:<strong>\s*)?[•\s]*(?:итог|итоги|последствия)\b[\s\S]*?<\/\1>/gi,
      "",
    ).trim();
  }

  function sectionReferenceItems(sections) {
    return [
      ...asList(sections.logic),
      ...asList(sections.causes),
      ...asList(sections.keyEvents),
      ...asList(sections.links),
      ...asList(sections.results),
      ...asList(sections.final),
    ].filter(Boolean);
  }

  function stripDuplicateAnswerBlocks(text, referenceItems) {
    const source = stripRepeatedConclusionBlocks(text);
    const blocks = source.match(/<(?:p|li)\b[\s\S]*?<\/(?:p|li)>/gi);
    if (!blocks) return source;
    return blocks
      .filter((block) => {
        const clean = cleanText(block);
        return clean && !referenceItems.some((item) => isMeaningDuplicate(clean, item));
      })
      .join("");
  }

  function renderMainAnswer(text, sections) {
    const source = stripDuplicateAnswerBlocks(text, sectionReferenceItems(sections));
    if (!source) return "";
    return `<section class="exam-main-answer" data-exam-section="answer">
      <h3>Ответ на экзамене</h3>
      <div class="exam-main-answer-body">${source}</div>
    </section>`;
  }

  function renderStructuredContent(summary, dates, points, text, conclusion, options) {
    const fallback = fallbackSections(summary, dates, points, text, conclusion);
    const source = options && options.docx;
    const sections = removeResultFinalOverlap(source
      ? {
          logic: mergeUnique(source.logic, fallback.logic, 2),
          causes: dedupeList(source.causes, 5),
          keyEvents: dedupeList(source.keyEvents, 8),
          links: dedupeList(source.links, 4),
          results: dedupeList(source.results, 4),
          final: mergeUnique(source.final, fallback.final, 1),
        }
      : {
          logic: dedupeList(fallback.logic, 2),
          causes: dedupeList(fallback.causes, 5),
          keyEvents: dedupeList(fallback.keyEvents, 8),
          links: dedupeList(fallback.links, 4),
          results: dedupeList(fallback.results, 4),
          final: dedupeList(fallback.final, 1),
        });
    const extra = options && options.extra ? options.extra : "";
    const sourceNote = "";
    return `<div class="topic-enter article-content space-y-5 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
      ${sourceNote}
      ${renderSection("logic", sections.logic, "exam-callout")}
      ${renderSection("keyEvents", sections.keyEvents)}
      ${renderMainAnswer(text, sections)}
      ${renderSection("causes", sections.causes)}
      ${renderSection("links", sections.links)}
      ${renderSection("results", sections.results)}
      ${extra}
      ${renderSection("final", sections.final, "final-callout")}
    </div>`;
  }

  function enhanceTicketsFromDocx(bookData) {
    if (!Array.isArray(bookData)) return;
    bookData.forEach((topic) => {
      const match = bestDocxMatch(topic);
      if (!match) return;
      if (!topic._structuredArgs) {
        const dataMatch = String(topic.content || "").match(/<!--ticket-args:([\s\S]*?)-->/);
        if (dataMatch) {
          try {
            topic._structuredArgs = JSON.parse(decodeURIComponent(dataMatch[1]));
          } catch (error) {
            topic._structuredArgs = null;
          }
        }
      }
      topic.docxSource = {
        title: match.item.sourceTitle,
        number: match.item.sourceNumber,
        score: match.score,
      };
      if (topic._structuredArgs) {
        topic.content = renderStructuredContent(
          topic._structuredArgs.summary,
          topic._structuredArgs.dates,
          topic._structuredArgs.points,
          topic._structuredArgs.text,
          topic._structuredArgs.conclusion,
          { docx: match.item, extra: topic._structuredArgs.extra || "" },
        );
      }
    });
  }

  window.renderStructuredContent = renderStructuredContent;
  window.enhanceTicketsFromDocx = enhanceTicketsFromDocx;
})();
