/*
 * player.h — what a host owns, and what a machine owes it.
 *
 * One page holds one machine, so the storage below is shared and sized for
 * the largest a machine may be; each machine file proves it fits.
 *
 * A machine drives: it runs its own loop and calls the record below after
 * each tick. Nothing here names a processor, a bus or a chip.
 */
#ifndef PLAYER_H
#define PLAYER_H

#include <stdbool.h>
#include <stdint.h>

#include "keyboard.h"
#include "z80.h"

/* A 6128's 128K, the 32K image holding its operating system and BASIC, its
   raster, and its snapshot header above the whole of the RAM. */
#define PLAYER_RAM_SIZE 0x20000
#define PLAYER_ROM_SIZE 0x8000
#define PLAYER_SNAPSHOT_SIZE (256 + PLAYER_RAM_SIZE)
#define PLAYER_FRAMEBUFFER_SIZE (1024 * 312)
#define PLAYER_MACHINE_BYTES 2048

extern uint8_t player_ram_bytes[PLAYER_RAM_SIZE];
extern uint8_t player_rom_bytes[PLAYER_ROM_SIZE];
extern uint8_t player_framebuffer_bytes[PLAYER_FRAMEBUFFER_SIZE];
extern uint8_t player_snapshot_bytes[PLAYER_SNAPSHOT_SIZE];

/* A wasm export cannot hand back a 64-bit integer without splitting it, and
   every tick a machine here will reach fits in a double exactly. */
typedef double player_tick_t;

/* A fetch is neither: reading means reading as data, which is what a reader
   sets a watch on. */
typedef enum {
  PLAYER_ACCESS_NONE,
  PLAYER_ACCESS_READ,
  PLAYER_ACCESS_WRITE,
} player_access;

#define PLAYER_NOWHERE ((uint32_t)-1)

/* What one tick did. */
typedef struct {
  /* Between instructions and owing the machine nothing, which on a board that
     stops the processor's clock is later than the instruction's end. */
  bool settled;
  /* The edge, not the level: a machine answering with the level counts every
     tick of a sync as a frame. */
  bool frame_ended;
  uint16_t program_counter;

  /* Only ever compared with what they were, so a machine that counts absolute
     lines may answer with those. */
  uint16_t row;
  uint16_t line;

  player_access access;
  uint16_t address;
  uint32_t physical; /* PLAYER_NOWHERE where the store reached no memory */
  uint8_t value;
} player_moment_t;

typedef struct {
  /* What the record needs of anything it watches. */

  /* Runs at most this many ticks and answers how many it ran, which is fewer
     when the record said to stop. */
  uint32_t (*run)(uint32_t limit);
  bool (*settled)(void);
  /* Once the record has put the machine's own bytes back. NULL where a
     machine derives nothing from them. */
  void (*restore)(void);
  uint8_t (*peek)(uint16_t address);

  void *state; /* copied whole, and never read into */
  uint32_t state_bytes;
  uint32_t memory_bytes; /* how much of the shared RAM this machine uses */
  uint32_t ticks_per_frame;

  /* What a page asks of a machine, and only that machine can answer. */

  void (*poke)(uint16_t address, uint8_t value);
  void (*press)(uint8_t key);
  void (*release)(uint8_t key);
  bool (*load_snapshot)(uint32_t length);
  uint32_t (*rgb)(uint8_t sample); /* one sample, as 0xRRGGBB */
  uint32_t (*physical_of)(uint16_t address); /* where a store lands, or PLAYER_NOWHERE */
  z80_t *processor;
  keyboard_t *matrix;
} player_subject_t;

/* Standing a machine forgets whatever stood before it. */
void player_stand(const player_subject_t *subject);

/* Before each tick, so that a state due is kept of the machine as it stands
   rather than as the tick leaves it. */
void player_before(bool settled, uint16_t row, uint16_t line);

/* Where the instruction about to run begins, so the stores it makes can be
   attributed to it. A machine held off the bus is between instructions for
   every tick of the hold, so this is the processor's own answer and not
   `settled`. */
void player_fetching(uint16_t program_counter);

/* After each tick. False when the record has what it asked for. */
bool player_after(const player_moment_t *moment);

/* A snapshot loaded over a machine arrives into a history that is not its
   own. */
void player_forget(void);

/* No replay reaches a value written from outside the machine, so a moment
   changed that way is kept here or it is lost. */
void player_capture(void);

#endif
