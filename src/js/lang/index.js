function hex(value, digits) {
  const text = value.toString(16).toUpperCase()
  return `&${text.padStart(digits, "0")}`
}

const html = String.raw

function fields(root) {
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

export { fields, hex, html, write }
