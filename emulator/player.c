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

uint8_t *player_rom(void) { return rom; }
uint8_t *player_snapshot(void) { return snapshot; }

/* Hardware colour codes, one byte a sample, the whole raster. */
uint8_t *player_framebuffer(void) { return framebuffer; }

/* The operating system fills the lower half of the image, BASIC the upper
 * as ROM 0. */
void player_boot(uint32_t ram_size) {
  cpc_init(&cpc, ram, ram_size, rom);
  cpc_set_upper_rom(&cpc, 0, rom + 0x4000);
  cpc_connect_monitor(&cpc, framebuffer);
}

bool player_load_snapshot(uint32_t length) {
  const char *problem = NULL;
  return snapshot_load(&cpc, snapshot, length, &problem);
}

void player_run_frames(uint32_t frames) {
  uint32_t ticks = frames * PLAYER_TICKS_PER_FRAME;
  for (uint32_t tick = 0; tick < ticks; tick++) {
    cpc_tick(&cpc);
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

  for (uint32_t tick = 1; tick <= limit; tick++) {
    cpc_tick(&cpc);
    if (cpc.monitor.frame_retraced && !retraced) {
      return tick;
    }
    retraced = cpc.monitor.frame_retraced;
  }

  return limit;
}

void player_press(uint8_t key) { keyboard_press(&cpc.keyboard, key); }
void player_release(uint8_t key) { keyboard_release(&cpc.keyboard, key); }
void player_release_all(void) { keyboard_release_all(&cpc.keyboard); }

uint8_t player_peek(uint16_t address) { return cpc_peek(&cpc, address); }
void player_poke(uint16_t address, uint8_t value) { cpc_poke(&cpc, address, value); }

uint32_t player_rgb(uint8_t colour_code) { return gate_array_rgb(colour_code); }
