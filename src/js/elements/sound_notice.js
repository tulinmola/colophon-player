import { Element } from "./element"

// Laid on the page by a machine whose sound waits for a press.
class SoundNoticeElement extends Element {
  static create() {
    const notice = document.createElement("colophon-sound-notice")

    document.body.append(notice)

    return notice
  }

  init() {
    this.popover = "manual"
    this.setAttribute("role", "status")
    this.textContent = "Press a key or click to hear the machine."
  }
}

SoundNoticeElement.define("colophon-sound-notice")

export { SoundNoticeElement as SoundNotice }
