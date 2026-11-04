const MAX_TEXT_CHARS = 2000;

/**
 * Collects page-level context the element extractor doesn't cover.
 * Read-only: nothing is clicked, typed, or submitted.
 */
export async function extractPageContext(page) {
  return page.evaluate((maxText) => {
    const clean = (t) => (t || "").replace(/\s+/g, " ").trim();
    const count = (selector) => document.querySelectorAll(selector).length;

    const metaDescription = document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content");

    const images = Array.from(document.images);

    return {
      lang: document.documentElement.getAttribute("lang") || null,
      meta_description: metaDescription
        ? clean(metaDescription).slice(0, 300)
        : null,
      // innerText respects CSS, so visually hidden text is mostly excluded.
      text_excerpt: clean(document.body?.innerText).slice(0, maxText),
      landmarks: {
        header: count('header, [role="banner"]'),
        nav: count('nav, [role="navigation"]'),
        main: count('main, [role="main"]'),
        aside: count('aside, [role="complementary"]'),
        footer: count('footer, [role="contentinfo"]'),
      },
      counts: {
        images: images.length,
        images_missing_alt: images.filter((img) => !img.hasAttribute("alt"))
          .length,
        iframes: count("iframe"),
        tables: count("table"),
        lists: count("ul, ol"),
        videos: count("video"),
      },
      has_password_field: count('input[type="password"]') > 0,
    };
  }, MAX_TEXT_CHARS);
}
