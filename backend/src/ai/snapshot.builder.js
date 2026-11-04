// Caps per category: keeps the prompt small and the free-tier quota safe.
const LIMITS = {
  headings: 30,
  buttons: 30,
  links: 40,
  inputs: 30,
  textareas: 10,
  selects: 10,
  forms: 10,
  textExcerpt: 1500,
};

/** Best-effort redaction of personal data in page text. Not a guarantee. */
function redact(text) {
  if (!text) return text;
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b\d{12,19}\b/g, "[number]");
}

/** Keeps only origin + path. Drops ?query and #fragment, where tokens often hide. */
function stripUrlNoise(href) {
  try {
    const u = new URL(href);
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}

/** Removes empty/false fields so the JSON stays small. */
function compact(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== null && v !== undefined && v !== false && v !== "",
    ),
  );
}

/**
 * Visible items first (stable sort keeps document order within each group),
 * then cap. `total` tells the model how many existed before capping.
 */
function limited(list, limit, mapFn) {
  const sorted = [...list].sort(
    (a, b) => Number(a.visible === false) - Number(b.visible === false),
  );
  return { total: list.length, items: sorted.slice(0, limit).map(mapFn) };
}

function dedupeLinks(links) {
  const seen = new Set();
  return links.filter((link) => {
    const key = `${stripUrlNoise(link.href)}|${link.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Builds the compact, sanitized snapshot we will send to the AI model.
 * Pure function: no browser, no network.
 */
export function buildSnapshot({ url, title, status_code, elements, context }) {
  const origin = new URL(url).origin;

  const snapshot = {
    page: compact({
      url: stripUrlNoise(url) ?? url,
      title: redact(title),
      status_code,
      language: context.lang,
      meta_description: redact(context.meta_description),
      has_password_field: context.has_password_field,
    }),
    structure: { landmarks: context.landmarks, counts: context.counts },
    text_excerpt: redact(context.text_excerpt).slice(0, LIMITS.textExcerpt),

    headings: limited(elements.headings, LIMITS.headings, (h) =>
      compact({ level: h.level, text: redact(h.text) }),
    ),

    buttons: limited(elements.buttons, LIMITS.buttons, (b) =>
      compact({
        text: redact(b.text),
        type: b.type,
        aria_label: redact(b.aria_label),
        disabled: b.disabled,
        hidden: b.visible === false,
      }),
    ),

    links: limited(dedupeLinks(elements.links), LIMITS.links, (l) =>
      compact({
        text: redact(l.text),
        href: stripUrlNoise(l.href),
        internal: stripUrlNoise(l.href)?.startsWith(origin),
        new_tab: l.target === "_blank",
        hidden: l.visible === false,
      }),
    ),

    // type="hidden" inputs (CSRF tokens etc.) are noise for the model, so skip them.
    inputs: limited(
      elements.inputs.filter((i) => i.type !== "hidden"),
      LIMITS.inputs,
      (i) =>
        compact({
          type: i.type,
          name: i.name,
          placeholder: redact(i.placeholder),
          aria_label: redact(i.aria_label),
          required: i.required,
          disabled: i.disabled,
          readonly: i.readonly,
          hidden: i.visible === false,
        }),
    ),

    textareas: limited(elements.textareas, LIMITS.textareas, (t) =>
      compact({
        name: t.name,
        placeholder: redact(t.placeholder),
        aria_label: redact(t.aria_label),
        required: t.required,
        disabled: t.disabled,
        hidden: t.visible === false,
      }),
    ),

    selects: limited(elements.selects, LIMITS.selects, (s) =>
      compact({
        name: s.name,
        aria_label: redact(s.aria_label),
        required: s.required,
        multiple: s.multiple,
        option_count: s.options.length,
        sample_options: s.options.slice(0, 8).map((o) => redact(o.text)),
        hidden: s.visible === false,
      }),
    ),

    forms: limited(elements.forms, LIMITS.forms, (f) =>
      compact({
        id: f.id,
        name: f.name,
        method: f.method,
        action: f.action ? stripUrlNoise(f.action) : null,
        field_count: f.field_count,
        hidden: f.visible === false,
      }),
    ),
  };

  const json = JSON.stringify(snapshot);

  return {
    snapshot,
    stats: {
      characters: json.length,
      approx_tokens: Math.round(json.length / 4), // rough rule of thumb
    },
  };
}
