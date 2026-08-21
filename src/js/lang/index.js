function hex(value, { digits = 2, prefix = "" } = {}) {
  return `${prefix}${value.toString(16).toUpperCase().padStart(digits, "0")}`
}

const html = String.raw

function nodesByName(root) {
  const found = {}

  for (const node of root.querySelectorAll("[data-field]")) {
    found[node.dataset.field] = node
  }

  return found
}

function write(node, text) {
  if (node.textContent != text) {
    node.textContent = text
  }
}

function fit(text, room) {
  if (text.length <= room) {
    return text
  }

  const head = Math.ceil((room - 1) / 2),
    tail = room - 1 - head

  return `${text.slice(0, head)}\u2026${text.slice(text.length - tail)}`
}

function writeFitted(node, text, room) {
  const fitted = fit(text, room),
    whole = fitted == text ? "" : text

  write(node, fitted)

  if (node.title != whole) {
    node.title = whole
  }
}

export { hex, html, nodesByName, write, writeFitted }
