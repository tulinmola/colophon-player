const CHUNK_MILLISECONDS = 1000

const MEDIA_TYPES = [
  ["video/webm;codecs=vp9", "webm"],
  ["video/webm;codecs=vp8", "webm"],
  ["video/webm", "webm"],
  ["video/mp4", "mp4"]
]

function supportedMediaType() {
  for (const [type, extension] of MEDIA_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { type, extension }
    }
  }

  return null
}

function extensionFor(type) {
  return type.startsWith("video/mp4") ? "mp4" : "webm"
}

export class CanvasRecorder {
  #canvas
  #chunks = []
  #context
  #extension = null
  #recorder
  #stream

  static get supported() {
    return "MediaRecorder" in window && "captureStream" in HTMLCanvasElement.prototype
  }

  constructor(width, height) {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    context.imageSmoothingEnabled = false

    this.#canvas = canvas
    this.#context = context
  }

  capture(layers) {
    const canvas = this.#canvas,
      context = this.#context

    context.clearRect(0, 0, canvas.width, canvas.height)
    for (const layer of layers) {
      context.drawImage(layer, 0, 0, canvas.width, canvas.height)
    }
  }

  start() {
    const stream = this.#canvas.captureStream(),
      mediaType = supportedMediaType(),
      recorder = mediaType
        ? new MediaRecorder(stream, { mimeType: mediaType.type })
        : new MediaRecorder(stream),
      onDataAvailable = this.onDataAvailable.bind(this)

    this.#stream = stream
    this.#recorder = recorder
    this.#extension = mediaType?.extension ?? null

    recorder.addEventListener("dataavailable", onDataAvailable)
    recorder.start(CHUNK_MILLISECONDS)
  }

  async stop() {
    const recorder = this.#recorder,
      stopped = new Promise(function (resolve, reject) {
        recorder.addEventListener("stop", resolve, { once: true })
        recorder.addEventListener(
          "error",
          function (event) {
            reject(event.error)
          },
          { once: true }
        )
      })

    recorder.stop()

    try {
      await stopped
    } finally {
      this.#stopTracks()
    }

    const type = recorder.mimeType || this.#chunks[0]?.type || "",
      extension = this.#extension ?? extensionFor(type),
      blob = new Blob(this.#chunks, { type })

    return { blob, extension }
  }

  discard() {
    if (this.#recorder.state != "inactive") {
      this.#recorder.stop()
    }
    this.#stopTracks()
  }

  onDataAvailable(event) {
    if (event.data.size > 0) {
      this.#chunks.push(event.data)
    }
  }

  #stopTracks() {
    for (const track of this.#stream.getTracks()) {
      track.stop()
    }
  }
}
