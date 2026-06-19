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
    return stripHTML(value)
      .replace(/^[-•\s]+/, "")
      .replace(/^Главная логика билета:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
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

  function scoreTitle(siteTitle, sourceTitle) {
    const site = new Set(tokens(siteTitle));
    const source = new Set(tokens(sourceTitle));
    if (!site.size || !source.size) return 0;
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
    return best && bestScore >= 0.38 ? { item: best, score: bestScore } : null;
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
    const items = paragraphItems(text);
    return {
      logic: [summary],
      causes: pickByNeedle(items, ["причин", "предпос", "почему", "исходн"], 0, 2),
      keyEvents: [
        `Даты: ${dates}`,
        `Опорные пункты: ${points}`,
        ...pickByNeedle(items, ["событ", "этап", "персон", "реформ", "войн"], 1, 2),
      ],
      links: pickByNeedle(items, ["поэтому", "в результате", "это прив", "механизм", "следств"], 2, 2),
      results: pickByNeedle(items, ["итог", "последств", "результат", "значение"], Math.max(items.length - 2, 0), 2),
      final: [conclusion],
    };
  }

  function mergeUnique(primary, fallback, limit) {
    const result = [];
    [...asList(primary), ...asList(fallback)].forEach((item) => {
      const key = item.toLowerCase();
      if (item && !result.some((existing) => existing.toLowerCase() === key)) {
        result.push(item);
      }
    });
    return result.slice(0, limit);
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

  function renderMainAnswer(text) {
    const source = String(text || "").trim();
    if (!source) return "";
    return `<section class="exam-main-answer" data-exam-section="answer">
      <h3>Ответ на экзамене</h3>
      <div class="exam-main-answer-body">${source}</div>
    </section>`;
  }

  function renderStructuredContent(summary, dates, points, text, conclusion, options) {
    const fallback = fallbackSections(summary, dates, points, text, conclusion);
    const source = options && options.docx;
    const sections = source
      ? {
          logic: mergeUnique(source.logic, fallback.logic, 2),
          causes: mergeUnique(source.causes, fallback.causes, 5),
          keyEvents: mergeUnique(source.keyEvents, fallback.keyEvents, 8),
          links: mergeUnique(source.links, fallback.links, 4),
          results: mergeUnique(source.results, fallback.results, 4),
          final: mergeUnique(source.final, fallback.final, 1),
        }
      : fallback;
    const extra = options && options.extra ? options.extra : "";
    const sourceNote = "";
    return `<div class="topic-enter article-content space-y-5 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
      ${sourceNote}
      ${renderSection("logic", sections.logic, "exam-callout")}
      ${renderSection("keyEvents", sections.keyEvents)}
      ${renderMainAnswer(text)}
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
