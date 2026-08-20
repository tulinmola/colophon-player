/*
 * player.c — the machine's host in a page.
 *
 * The core allocates nothing and does no I/O, so a host owns the machine,
 * its memory and its screen and decides when it runs. This one holds all of
 * it in fixed storage: the module's memory is whatever it needs when it
 * loads and never grows. The page writes ROM and snapshot bytes straight
 * into the buffers exported below, which is the whole of the traffic in
 * that direction.
 */
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "cpc.h"
#include "gate_array.h"
#include "snapshot.h"

/* Sized for the largest machine: a 6128's 128K, and the 32K image holding
   the operating system and BASIC. */
#define PLAYER_RAM_SIZE 0x20000
#define PLAYER_ROM_SIZE 0x8000
#define PLAYER_SNAPSHOT_SIZE (SNAPSHOT_HEADER_SIZE + PLAYER_RAM_SIZE)

/* A frame is 312 lines of 64µs, and four T-states fill a microsecond of a
   4MHz clock. */
#define PLAYER_TICKS_PER_FRAME (CPC_FRAMEBUFFER_HEIGHT * 64 * 4)

static cpc_t cpc;
static uint8_t ram[PLAYER_RAM_SIZE];
static uint8_t framebuffer[CPC_FRAMEBUFFER_WIDTH * CPC_FRAMEBUFFER_HEIGHT];
static uint8_t rom[PLAYER_ROM_SIZE];
static uint8_t snapshot[PLAYER_SNAPSHOT_SIZE];

/* The frame each physical byte was last stored to, taken from the pins the
   tick already returns — the tap the emulator's observation.en.md costs at
   nothing measurable. Zero means never, so frames count from one. */
static uint32_t written[PLAYER_RAM_SIZE];
static uint32_t frame;

static void tick(void) {
  bool retraced = cpc.monitor.frame_retraced;
  uint64_t pins = cpc_tick(&cpc);

  if ((pins & (Z80_MREQ | Z80_WR)) == (Z80_MREQ | Z80_WR)) {
    uint16_t address = z80_address(pins);
    size_t physical = (size_t)(cpc.write_page[address >> 14] + (address & 0x3FFF) - cpc.ram);
    written[physical] = frame;
  }

  if (cpc.monitor.frame_retraced && !retraced) {
    frame++;
  }
}

/* cpc_finish_instruction would tick the core out of the tap's sight, so the
   host walks the same loop itself; the guard is the core's own. */
static void finish_instruction(void) {
  for (int guard = 0; guard < 256 && !z80_instruction_complete(&cpc.cpu); guard++) {
    tick();
  }
}

uint8_t *player_rom(void) { return rom; }
uint8_t *player_snapshot(void) { return snapshot; }

/* Addresses into it are physical, the video hardware's own view; peek and
   poke walk the CPU's banking instead. */
uint8_t *player_ram(void) { return ram; }

/* Hardware colour codes, one byte a sample, the whole raster. */
uint8_t *player_framebuffer(void) { return framebuffer; }

uint32_t *player_writes(void) { return written; }
uint32_t player_frame(void) { return frame; }

/* The operating system fills the lower half of the image, BASIC the upper
 * as ROM 0. */
void player_boot(uint32_t ram_size) {
  cpc_init(&cpc, ram, ram_size, rom);
  cpc_set_upper_rom(&cpc, 0, rom + 0x4000);
  cpc_connect_monitor(&cpc, framebuffer);
  memset(written, 0, sizeof written);
  frame = 1;
}

bool player_load_snapshot(uint32_t length) {
  const char *problem = NULL;
  if (!snapshot_load(&cpc, snapshot, length, &problem)) {
    return false;
  }

  memset(written, 0, sizeof written);
  frame = 1;
  return true;
}

void player_run_frames(uint32_t frames) {
  uint32_t ticks = frames * PLAYER_TICKS_PER_FRAME;
  for (uint32_t count = 0; count < ticks; count++) {
    tick();
  }
}

/* The monitor sends the beam to the top-left corner as the frame sync
 * reaches its length, so the moment it reports a retrace is the moment the
 * framebuffer holds a whole frame and nothing of the next.
 *
 * Software decides how long a frame is, and may decide never to finish one:
 * a rupture that leaves the vsync position past the vertical total stops the
 * frames for as long as it holds. The caller says how long it is prepared to
 * wait, so there is no frame to be waited for forever. */
uint32_t player_run_until_retrace(uint32_t limit) {
  bool retraced = cpc.monitor.frame_retraced;

  for (uint32_t count = 1; count <= limit; count++) {
    tick();
    if (cpc.monitor.frame_retraced && !retraced) {
      return count;
    }
    retraced = cpc.monitor.frame_retraced;
  }

  return limit;
}

void player_press(uint8_t key) { keyboard_press(&cpc.keyboard, key); }
void player_release(uint8_t key) { keyboard_release(&cpc.keyboard, key); }
void player_release_all(void) { keyboard_release_all(&cpc.keyboard); }

uint8_t player_peek(uint16_t address) { return cpc_peek(&cpc, address); }

/* A poke is a store like any other, only not on the bus, so it stamps by
   hand what the tap would have seen. */
void player_poke(uint16_t address, uint8_t value) {
  cpc_poke(&cpc, address, value);
  size_t physical = (size_t)(cpc.write_page[address >> 14] + (address & 0x3FFF) - cpc.ram);
  written[physical] = frame;
}

z80_t *player_z80(void) { return &cpc.cpu; }
crtc_t *player_crtc(void) { return &cpc.crtc; }

void player_finish_instruction(void) { finish_instruction(); }

/* Without the tick, a machine already between instructions would not move. */
void player_step_instruction(void) {
  tick();
  finish_instruction();
}

uint32_t player_rgb(uint8_t colour_code) { return gate_array_rgb(colour_code); }
