/*
 * spectrum.c — a ZX Spectrum, wired into the player.
 *
 * The board, its own loop calling its own chips, and a word to the record
 * after each tick.
 */
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "deck.h"
#include "player.h"
#include "spectrum.h"
#include "spectrum_snapshot.h"
#include "ula.h"
#include "z80_bus.h"

typedef char spectrum_raster_fits
    [SPECTRUM_FRAMEBUFFER_WIDTH * SPECTRUM_FRAMEBUFFER_HEIGHT <= PLAYER_FRAMEBUFFER_SIZE ? 1 : -1];
typedef char spectrum_snapshot_fits[SPECTRUM_SNAPSHOT_SIZE <= PLAYER_SNAPSHOT_SIZE ? 1 : -1];

static struct {
  spectrum_t machine;
  player_deck_t deck;
} board;

typedef char spectrum_fits_the_host[sizeof board <= PLAYER_MACHINE_BYTES ? 1 : -1];

/* The map never moves, and a store below the RAM — into the ROM, or past what
   a 16K machine has — reached nothing to stamp. */
static uint32_t physical_of(uint16_t address) {
  uint32_t offset = (uint32_t)(address - SPECTRUM_RAM_BASE);

  return address >= SPECTRUM_RAM_BASE && offset < board.machine.ram_size ? offset : PLAYER_NOWHERE;
}

/* Eight lines to a character row. */
static player_moment_t moment_of(uint64_t pins, bool retraced) {
  player_moment_t moment = {0};

  moment.settled = spectrum_instruction_complete(&board.machine);
  moment.frame_ended = board.machine.monitor.frame_retraced && !retraced;
  moment.program_counter = board.machine.cpu.pc;
  moment.row = (uint16_t)(board.machine.ula.line / 8);
  moment.line = board.machine.ula.line;
  z80_bus_access(&moment, pins, physical_of);

  return moment;
}

/* The processor's own answer, not the machine's: a tick the ULA holds the
   clock for is one the processor did not run, and the instruction about to
   run begins at the tick it truly starts. */
static uint32_t run(uint32_t limit) {
  bool retraced = board.machine.monitor.frame_retraced;

  for (uint32_t count = 0; count < limit; count++) {
    const bool settled_now = spectrum_instruction_complete(&board.machine);
    const uint16_t line = board.machine.ula.line;

    player_before(settled_now, (uint16_t)(line / 8), line);

    if (z80_instruction_complete(&board.machine.cpu)) {
      player_fetching(board.machine.cpu.pc);
    }

    uint64_t pins = spectrum_tick(&board.machine);
    player_moment_t moment = moment_of(pins, retraced);
    retraced = board.machine.monitor.frame_retraced;

    if (!player_after(&moment)) {
      return count + 1;
    }
  }

  return limit;
}

static bool settled(void) { return spectrum_instruction_complete(&board.machine); }

static void poke(uint16_t address, uint8_t value);
static void press(uint8_t key);
static void release(uint8_t key);
static bool load_snapshot(uint32_t length);
static uint32_t rgb(uint8_t sample);

static uint8_t peek(uint16_t address) { return spectrum_peek(&board.machine, address); }

/* One image of 16K answering from 0x0000, and no interface to fit. */
void player_boot_spectrum(uint32_t ram_size) {
  spectrum_init(&board.machine, player_ram_bytes, ram_size, player_rom_bytes);
  spectrum_connect_monitor(&board.machine, player_framebuffer_bytes);
  player_deck_fit(&board.deck, SPECTRUM_TICKS_PER_MILLISECOND, TZX_SPECTRUM);
  spectrum_insert_tape(&board.machine, &board.deck.tape);

  const player_subject_t subject = {.run = run,
                                    .settled = settled,
                                    .restore = player_deck_restored,
                                    .peek = peek,
                                    .state = &board,
                                    .state_bytes = sizeof board,
                                    .memory_bytes = ram_size,
                                    .poke = poke,
                                    .press = press,
                                    .release = release,
                                    .load_snapshot = load_snapshot,
                                    .rgb = rgb,
                                    .physical_of = physical_of,
                                    .processor = &board.machine.cpu,
                                    .matrix = &board.machine.keyboard,
                                    .ticks_per_frame = SPECTRUM_TICKS_PER_FRAME};

  player_stand(&subject);
}

static bool load_snapshot(uint32_t length) {
  const char *problem = NULL;

  if (!spectrum_snapshot_load(&board.machine, player_snapshot_bytes, length, &problem)) {
    return false;
  }

  player_forget();
  return true;
}

static void poke(uint16_t address, uint8_t value) {
  spectrum_poke(&board.machine, address, value);
  player_capture();
}

static void press(uint8_t key) {
  keyboard_t before = board.machine.keyboard;

  keyboard_press(&board.machine.keyboard, key);

  if (memcmp(&before, &board.machine.keyboard, sizeof before) != 0) {
    player_capture();
  }
}

static void release(uint8_t key) {
  keyboard_t before = board.machine.keyboard;

  keyboard_release(&board.machine.keyboard, key);

  if (memcmp(&before, &board.machine.keyboard, sizeof before) != 0) {
    player_capture();
  }
}

static uint32_t rgb(uint8_t sample) { return ula_rgb(sample); }

ula_t *player_spectrum_ula(void) { return &board.machine.ula; }

/* The beam counters are derived from this, so ula.h takes any placing from
   outside through here rather than letting the field be written. */
void player_spectrum_ula_seek(uint32_t frame_tick) {
  ula_seek(&board.machine.ula, frame_tick);
  player_capture();
}
