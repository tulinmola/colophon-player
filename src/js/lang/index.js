function hex(value, { digits = 2, prefix = "" } = {}) {
  return `${prefix}${value.toString(16).toUpperCase().padStart(digits, "0")}`
}

const html = String.raw

function inputNamePath(name) {
  return name.match(/[^[\]]+/gu)
}

function nodesByName(root) {
  const found = {}

  for (const node of root.querySelectorAll("[data-field]")) {
    found[node.dataset.field] = node
  }

  for (const input of root.querySelectorAll("input[name]")) {
    found[inputNamePath(input.name).at(-1)] = input
  }

  return found
}

function write(node, text) {
  if (node.textContent != text) {
    node.textContent = text
  }
}

export { hex, html, inputNamePath, nodesByName, write }
