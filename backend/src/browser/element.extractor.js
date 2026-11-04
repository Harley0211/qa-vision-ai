const MAX_PER_CATEGORY = 200;

/**
 * Extracts structured information about interactive and structural elements.
 * Read-only: nothing is clicked, typed, or submitted.
 */
export async function extractElements(page) {
  return page.evaluate((limit) => {
    // Collapse whitespace and trim long text.
    const clean = (text, max = 200) =>
      (text || "").replace(/\s+/g, " ").trim().slice(0, max);

    // Returns null instead of empty strings so JSON stays tidy.
    const attr = (el, name) => {
      const value = el.getAttribute(name);
      return value === null || value === "" ? null : value;
    };

    // Basic visibility check: has size and isn't hidden by CSS.
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const all = (selector) =>
      Array.from(document.querySelectorAll(selector)).slice(0, limit);

    // ---- Headings ----
    const headings = all("h1, h2, h3").map((el) => ({
      level: el.tagName.toLowerCase(),
      text: clean(el.textContent),
    }));

    // ---- Buttons (<button>, input buttons, and role="button") ----
    const buttons = all(
      'button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]',
    ).map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: clean(el.tagName === "INPUT" ? el.value : el.textContent),
      type: attr(el, "type"),
      id: attr(el, "id"),
      name: attr(el, "name"),
      aria_label: attr(el, "aria-label"),
      disabled:
        el.disabled === true || el.getAttribute("aria-disabled") === "true",
      visible: isVisible(el),
    }));

    // ---- Links ----
    const links = all("a[href]")
      .filter((el) => /^https?:$/.test(el.protocol))
      .map((el) => ({
        text: clean(el.textContent),
        href: el.href,
        target: attr(el, "target"),
        rel: attr(el, "rel"),
        aria_label: attr(el, "aria-label"),
        visible: isVisible(el),
      }));

    // ---- Inputs (skip buttons, they are listed above) ----
    const inputs = all("input")
      .filter((el) => !["button", "submit", "reset", "image"].includes(el.type))
      .map((el) => ({
        type: el.type,
        name: attr(el, "name"),
        id: attr(el, "id"),
        placeholder: attr(el, "placeholder"),
        aria_label: attr(el, "aria-label"),
        required: el.required,
        disabled: el.disabled,
        readonly: el.readOnly,
        visible: isVisible(el),
      }));

    // ---- Textareas ----
    const textareas = all("textarea").map((el) => ({
      name: attr(el, "name"),
      id: attr(el, "id"),
      placeholder: attr(el, "placeholder"),
      aria_label: attr(el, "aria-label"),
      required: el.required,
      disabled: el.disabled,
      readonly: el.readOnly,
      visible: isVisible(el),
    }));

    // ---- Selects (dropdowns) ----
    const selects = all("select").map((el) => ({
      name: attr(el, "name"),
      id: attr(el, "id"),
      aria_label: attr(el, "aria-label"),
      required: el.required,
      disabled: el.disabled,
      multiple: el.multiple,
      options: Array.from(el.options)
        .slice(0, 50)
        .map((opt) => ({
          value: opt.value,
          text: clean(opt.textContent, 100),
        })),
      visible: isVisible(el),
    }));

    // ---- Forms ----
    const forms = all("form").map((el) => ({
      id: attr(el, "id"),
      name: attr(el, "name"),
      method: (el.getAttribute("method") || "get").toLowerCase(),
      action: el.action || null,
      field_count: el.querySelectorAll("input, textarea, select").length,
      visible: isVisible(el),
    }));

    return { headings, buttons, links, inputs, textareas, selects, forms };
  }, MAX_PER_CATEGORY);
}
