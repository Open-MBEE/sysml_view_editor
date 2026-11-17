/** Rebuild engine HTML through an allowlist: no scripts, styles, media, forms or event handlers survive. */
const structural = new Set([
  'article',
  'header',
  'footer',
  'nav',
  'section',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'a',
  'em',
  'strong',
  'b',
  'i',
  'u',
  's',
  'small',
  'sup',
  'sub',
  'code',
  'kbd',
  'samp',
  'var',
  'pre',
  'br',
  'hr',
  'blockquote',
  'cite',
  'abbr',
  'time',
  'table',
  'caption',
  'colgroup',
  'col',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'figure',
  'figcaption',
]);
/** Removed with their content: executable, embedded or interactive content has no place in a read-only document. */
const removed = new Set([
  'script',
  'style',
  'link',
  'meta',
  'base',
  'title',
  'head',
  'iframe',
  'frame',
  'object',
  'embed',
  'applet',
  'svg',
  'math',
  'template',
  'noscript',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'img',
  'picture',
  'source',
  'video',
  'audio',
  'canvas',
  'map',
  'area',
  'slot',
  'dialog',
]);
const attributes = new Set([
  'id',
  'class',
  'title',
  'lang',
  'dir',
  'colspan',
  'rowspan',
  'scope',
  'start',
  'reversed',
  'datetime',
  'cite',
]);

function keepClass(value: string) {
  return value
    .split(/\s+/)
    .filter((token) => token.startsWith('sysml-'))
    .join(' ');
}

function keepHref(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return undefined;
}

function copyAttributes(from: Element, to: Element) {
  for (const { name, value } of Array.from(from.attributes)) {
    const lower = name.toLowerCase();
    if (lower === 'class') {
      const kept = keepClass(value);
      if (kept) to.setAttribute('class', kept);
    } else if (lower === 'href') {
      const kept = keepHref(value);
      if (kept) {
        to.setAttribute('href', kept);
        if (!kept.startsWith('#')) {
          to.setAttribute('rel', 'noopener noreferrer');
          to.setAttribute('target', '_blank');
        }
      }
    } else if (lower.startsWith('data-') || attributes.has(lower))
      to.setAttribute(lower, value);
  }
}

function rebuild(source: Node, into: Node, target: Document) {
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      into.appendChild(target.createTextNode(child.nodeValue ?? ''));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as Element,
      tag = element.localName.toLowerCase();
    if (removed.has(tag)) continue;
    // Diagram source fences are replaced by native renderers or the engine notice.
    if (
      tag === 'pre' &&
      ['mermaid', 'dot', 'plantuml', 'd2'].some((form) =>
        element.classList.contains(form),
      )
    )
      continue;
    if (!structural.has(tag)) {
      rebuild(element, into, target);
      continue;
    }
    const copy = target.createElement(tag);
    copyAttributes(element, copy);
    rebuild(element, copy, target);
    into.appendChild(copy);
  }
}

/** Parse untrusted document HTML in an inert document and rebuild only the allowed tree. */
export function sanitizeDocumentHtml(
  html: string,
  target: Document = document,
): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const fragment = target.createDocumentFragment();
  rebuild(parsed.body, fragment, target);
  return fragment;
}

/** Path of data-name attributes from the document root to the block holding `node`. */
export function contentPath(node: Element, root: Element): string | undefined {
  const names: string[] = [];
  let current: Element | null = node.closest('[data-content]');
  while (current && current !== root && root.contains(current)) {
    const name = current.getAttribute('data-name');
    if (name) names.unshift(name);
    current = current.parentElement?.closest('[data-content]') ?? null;
  }
  return names.length ? names.join('/') : undefined;
}
