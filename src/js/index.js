import { createMachine } from "./emulator"
import { createScreen } from "./screen"

const BOOT_FRAMES = 78

const machine = await createMachine("cpc464"),
  draw = createScreen(document.querySelector("canvas"))

machine.runFrames(BOOT_FRAMES)
draw(machine)
