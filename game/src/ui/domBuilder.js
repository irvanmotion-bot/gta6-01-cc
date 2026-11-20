// Small helpers the HUD panels and menus use to build their own DOM, so index.html stays a canvas and a script tag.

/** Create an element with a class, optional text, appended to `parent` when one is given. */
export function createElement(tag, className, parent = null, text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  if (parent) parent.append(node);
  return node;
}

/** A labelled meter: caption on the left, value on the right, a filling bar under them. Returns its parts. */
export function createMeter(parent, className, caption) {
  const root = createElement('div', `meter ${className}`, parent);
  const head = createElement('div', 'meter-head', root);
  const label = createElement('span', 'meter-label', head, caption);
  const value = createElement('b', 'meter-value', head);
  const track = createElement('div', 'meter-track', root);
  const fill = createElement('i', 'meter-fill', track);
  return { root, label, value, fill };
}

/** Writes text, classes and widths only when they change, so most frames leave the DOM untouched. */
export class DomCache {
  constructor() {
    this.seen = new Map();
  }

  changed(node, key, value) {
    let entry = this.seen.get(node);
    if (!entry) { entry = {}; this.seen.set(node, entry); }
    if (entry[key] === value) return false;
    entry[key] = value;
    return true;
  }

  text(node, value) {
    if (this.changed(node, 'text', value)) node.textContent = value;
  }

  html(node, value) {
    if (this.changed(node, 'html', value)) node.innerHTML = value;
  }

  toggle(node, name, on) {
    if (this.changed(node, `class:${name}`, on)) node.classList.toggle(name, on);
  }

  width(node, share) {
    const value = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
    if (this.changed(node, 'width', value)) node.style.width = value;
  }

  color(node, value) {
    if (this.changed(node, 'color', value)) node.style.color = value;
  }
}

export function formatCash(amount) {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

export function formatClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
