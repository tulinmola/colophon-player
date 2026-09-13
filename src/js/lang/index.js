function hex(value, { digits = 2, prefix = "" } = {}) {
  return `${prefix}${value.toString(16).toUpperCase().padStart(digits, "0")}`
}

const html = String.raw

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function bit(on) {
  return on ? "1" : "."
}

function write(node, text) {
  if (node.textContent != text) {
    node.textContent = text
  }
}

function resetValue(control) {
  control.setCustomValidity("")
  control.value = control.defaultValue
}

function writeValue(control, value) {
  if (control.type == "checkbox") {
    control.defaultChecked = value
    control.checked = value
    return
  }

  const focused = document.activeElement == control

  // A clean field's value follows its default, and a form's reset leaves it clean;
  // assigning the value unchanged makes it dirty, so the default cannot move it.
  if (focused) {
    const typed = control.value

    control.value = typed
  }

  control.defaultValue = value

  if (!focused) {
    resetValue(control)
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

function download(blob, name) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a")

  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export { bit, download, escapeHtml, fitText, hex, html, resetValue, write, writeFitted, writeValue }
