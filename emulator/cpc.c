/*
 * cpc.c — an Amstrad CPC, wired into the player.
 *
 * The board, its own loop calling its own chips, and a word to the record
 * after each tick.
 */
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "cpc.h"
#include "cpc_snapshot.h"
#include "dsk.h"
#include "gate_array.h"
#include "player.h"
#include "z80_bus.h"

typedef char cpc_fits_the_host[sizeof(cpc_t) <= PLAYER_MACHINE_BYTES ? 1 : -1];
typedef char
    cpc_snapshot_fits[CPC_SNAPSHOT_HEADER_SIZE + PLAYER_RAM_SIZE <= PLAYER_SNAPSHOT_SIZE ? 1 : -1];
typedef char
    cpc_raster_fits[CPC_FRAMEBUFFER_WIDTH * CPC_FRAMEBUFFER_HEIGHT <= PLAYER_FRAMEBUFFER_SIZE ? 1
                                                                                              : -1];

#define CPC_AMSDOS_SIZE 0x4000

/* As wide as the core's own drives[], since cpc_insert_disc is indexed by the
   same number these buffers are. */
#define CPC_DRIVES 2

/* A CPC's own discs are a fifth of this. The rest is for the extended images
   of protected ones, which store every reading of an unstable sector. */
#define CPC_DISC_SIZE 0x100000

static cpc_t cpc;
static uint8_t amsdos[CPC_AMSDOS_SIZE];

/* A floppy borrows its image where it lies, so a buffer here is the disc while
   it is in the drive: it must not move, and nothing may write over it until
   that disc comes out. */
static uint8_t disc_images[CPC_DRIVES][CPC_DISC_SIZE];
static floppy_t discs[CPC_DRIVES];
static uint8_t written_disc[CPC_DISC_SIZE];
static const char *disc_problem;

/* Where a store landed: the banking decides it, and every address the
   processor can write reaches RAM. */
static uint32_t physical_of(uint16_t address) {
  return (uint32_t)(cpc.write_page[address >> 14] + (address & 0x3FFF) - cpc.ram);
}

static player_moment_t moment_of(uint64_t pins, bool retraced) {
  player_moment_t moment = {0};

  moment.settled = z80_instruction_complete(&cpc.cpu);
  moment.frame_ended = cpc.monitor.frame_retraced && !retraced;
  moment.program_counter = cpc.cpu.pc;
  moment.row = cpc.crtc.c4;
  moment.line = cpc.crtc.c9;
  z80_bus_access(&moment, pins, physical_of);

  return moment;
}

static uint32_t run(uint32_t limit) {
  bool retraced = cpc.monitor.frame_retraced;

  for (uint32_t count = 0; count < limit; count++) {
    bool complete = z80_instruction_complete(&cpc.cpu);

    player_before(complete, cpc.crtc.c4, cpc.crtc.c9);

    if (complete) {
      player_fetching(cpc.cpu.pc);
    }

    uint64_t pins = cpc_tick(&cpc);
    player_moment_t moment = moment_of(pins, retraced);
    retraced = cpc.monitor.frame_retraced;

    if (!player_after(&moment)) {
      return count + 1;
    }
  }

  return limit;
}

/* The read and write pages are pointers worked out from the ROM enables and
   the bank register, so they are recomputed rather than trusted. */
static void restore(void) { cpc_remap(&cpc); }

static bool settled(void) { return z80_instruction_complete(&cpc.cpu); }

static void poke(uint16_t address, uint8_t value);
static void press(uint8_t key);
static void release(uint8_t key);
static bool load_snapshot(uint32_t length);
static uint32_t rgb(uint8_t sample);

static uint8_t peek(uint16_t address) { return cpc_peek(&cpc, address); }

uint8_t *player_cpc_amsdos(void) { return amsdos; }

uint8_t *player_cpc_disc(uint8_t drive) { return disc_images[drive]; }
uint32_t player_cpc_disc_capacity(void) { return CPC_DISC_SIZE; }
uint8_t *player_cpc_written_disc(void) { return written_disc; }

/* The operating system fills the lower half of the image, BASIC the upper
 * as ROM 0, and the disc interface brings its own ROM as upper ROM 7.
 *
 * cpc_init empties the drives, so a disc that was in one goes back in after
 * this and not before. */
void player_boot_cpc(uint32_t ram_size, bool disc_interface) {
  cpc_init(&cpc, player_ram_bytes, ram_size, player_rom_bytes);
  cpc_set_upper_rom(&cpc, 0, player_rom_bytes + 0x4000);

  if (disc_interface) {
    cpc_fit_disc_interface(&cpc, true);
    cpc_set_upper_rom(&cpc, 7, amsdos);
  }

  cpc_connect_monitor(&cpc, player_framebuffer_bytes);

  const player_subject_t subject = {.run = run,
                                    .settled = settled,
                                    .restore = restore,
                                    .peek = peek,
                                    .state = &cpc,
                                    .state_bytes = sizeof cpc,
                                    .memory_bytes = ram_size,
                                    .poke = poke,
                                    .press = press,
                                    .release = release,
                                    .load_snapshot = load_snapshot,
                                    .rgb = rgb,
                                    .processor = &cpc.cpu,
                                    .matrix = &cpc.keyboard,
                                    .ticks_per_frame = CPC_TICKS_PER_STANDARD_FRAME};

  player_stand(&subject);
}

static bool load_snapshot(uint32_t length) {
  const char *problem = NULL;

  if (!cpc_snapshot_load(&cpc, player_snapshot_bytes, length, &problem)) {
    return false;
  }

  player_forget();
  return true;
}

/* The disc comes out before the image is read, because dsk_read empties the
 * floppy it refuses: leaving it mounted would leave the drive holding a medium
 * with nothing on it rather than an empty drive.
 *
 * A length with no room for it is refused first of all, having touched
 * nothing, so the disc already in the drive stays there. */
bool player_cpc_insert_disc(uint8_t drive, uint32_t length) {
  disc_problem = NULL;

  if (length > CPC_DISC_SIZE) {
    disc_problem = "the image is larger than the room a disc is given here";
    return false;
  }

  cpc_insert_disc(&cpc, drive, NULL);

  if (!dsk_read(&discs[drive], disc_images[drive], length, &disc_problem)) {
    player_capture();
    return false;
  }

  cpc_insert_disc(&cpc, drive, &discs[drive]);
  player_capture();
  return true;
}

/* The medium is left where it is: a moment the record can still be stood at
 * had this disc in the drive, and the pointer it holds must still find it. */
void player_cpc_eject_disc(uint8_t drive) {
  cpc_insert_disc(&cpc, drive, NULL);
  player_capture();
}

const char *player_cpc_disc_problem(void) { return disc_problem; }

/* Zero where there is no image to write, or where the room here falls short
 * of the one dsk_write measured, in which case it wrote nothing. */
uint32_t player_cpc_save_disc(uint8_t drive) {
  const floppy_t *disc = cpc.drives[drive].floppy;

  disc_problem = NULL;

  if (disc == NULL) {
    disc_problem = "there is no disc in that drive to write";
    return 0;
  }

  size_t needed = dsk_write(disc, written_disc, sizeof written_disc);

  if (needed == 0) {
    disc_problem = "the disc holds a track the image format cannot describe";
    return 0;
  }

  if (needed > sizeof written_disc) {
    disc_problem = "the disc needs more room than an image here is given";
    return 0;
  }

  return (uint32_t)needed;
}

static void poke(uint16_t address, uint8_t value) {
  cpc_poke(&cpc, address, value);
  player_capture();
}

static void press(uint8_t key) {
  keyboard_t before = cpc.keyboard;

  keyboard_press(&cpc.keyboard, key);

  if (memcmp(&before, &cpc.keyboard, sizeof before) != 0) {
    player_capture();
  }
}

static void release(uint8_t key) {
  keyboard_t before = cpc.keyboard;

  keyboard_release(&cpc.keyboard, key);

  if (memcmp(&before, &cpc.keyboard, sizeof before) != 0) {
    player_capture();
  }
}

void player_cpc_remap(void) { cpc_remap(&cpc); }

static uint32_t rgb(uint8_t sample) { return gate_array_rgb(sample); }

crtc_t *player_cpc_crtc(void) { return &cpc.crtc; }
gate_array_t *player_cpc_gate_array(void) { return &cpc.gate_array; }
upd765_t *player_cpc_fdc(void) { return &cpc.fdc; }
drive_t *player_cpc_drive(uint8_t drive) { return &cpc.drives[drive]; }
floppy_t *player_cpc_floppy(uint8_t drive) { return &discs[drive]; }

/* The main status register as the processor polls it: the chip works it out
   from what it is doing rather than keeping it, and reading it moves
   nothing. */
uint32_t player_cpc_fdc_status(void) { return upd765_read(&cpc.fdc, UPD765_STATUS); }

bool player_cpc_drive_ready(uint8_t drive) { return drive_ready(&cpc.drives[drive]); }
bool player_cpc_drive_track_zero(uint8_t drive) { return drive_track_zero(&cpc.drives[drive]); }
bool player_cpc_drive_two_sided(uint8_t drive) { return drive_two_sided(&cpc.drives[drive]); }

bool player_cpc_drive_write_protected(uint8_t drive) {
  return drive_write_protected(&cpc.drives[drive]);
}
