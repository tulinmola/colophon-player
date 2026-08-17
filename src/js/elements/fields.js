import { html } from "../lang"

function renderAbbreviation(label, meaning) {
  return meaning ? html`<abbr title="${meaning}">${label}</abbr>` : label
}

function renderInput(label, meaning, names, digits = 2) {
  // aria-label is what keeps the sigil and any sibling control from being read
  // out as part of the name.
  const controls = names.map(function (name, index) {
    const next = names[index + 1],
      announced = names.length > 1 ? name.toUpperCase().replace("_", " shadow") : label

    return html`<input
      name="${name}"
      aria-label="${announced}"
      maxlength="${digits}"
      pattern="[0-9A-Fa-f]{1,${digits}}"
      ${next ? `data-next="${next}"` : ""}
    />`
  })

  return html`<label
    >${renderAbbreviation(label, meaning)}<span class="input-group"
      >${controls.join("&nbsp;")}</span
    ></label
  >`
}

function renderOutput(label, meaning, name) {
  return html`<label
    >${renderAbbreviation(label, meaning)}<output
      name="${name}"
      aria-label="${label}"
      aria-live="off"
    ></output
  ></label>`
}

// A control holding focus is left alone, so a value being typed survives the
// machine's own updates. defaultValue is where a reset returns the control, so
// it carries the machine's value too.
function show(control, value) {
  if (document.activeElement == control) {
    return
  }

  if (control.type == "checkbox") {
    control.checked = value
    control.defaultChecked = value
  } else {
    control.value = value
    control.defaultValue = value
  }
}

export { renderAbbreviation, renderInput, renderOutput, show }
