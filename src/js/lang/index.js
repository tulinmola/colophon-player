function hex(value, { digits = 2, prefix = "" } = {}) {
  return `${prefix}${value.toString(16).toUpperCase().padStart(digits, "0")}`
}

const html = String.raw

function write(node, text) {
  if (node.textContent != text) {
    node.textContent = text
  }
}

function writeValue(control, value) {
  if (document.activeElement == control) {
    return
  }

  if (control.type == "checkbox") {
    control.defaultChecked = value
    control.checked = value
  } else {
    control.defaultValue = value
    control.value = value
  }
}

function fitText(text, room) {
  if (text.length <= room) {
    return text
  }

  const head = Math.ceil((room - 1) / 2),
    tail = room - 1 - head

  return `${text.slice(0, head)}\u2026${text.slice(text.length - tail)}`
}

function writeFitted(node, text, room) {
  const fitted = fitText(text, room),
    whole = fitted == text ? "" : text

  write(node, fitted)

  if (node.title != whole) {
    node.title = whole
  }
}

export { hex, html, write, writeFitted, writeValue }
