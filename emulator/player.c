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

#define PLAYER_STATE_TICKS PLAYER_TICKS_PER_FRAME
#define PLAYER_STATES 128
#define PLAYER_TRACE_ENTRIES (1 << 19)

#define PLAYER_GRAIN_INSTRUCTION 0
#define PLAYER_GRAIN_SCANLINE 1
#define PLAYER_GRAIN_ROW 2
#define PLAYER_GRAIN_FRAME 3

/* A wasm export cannot hand back a 64-bit integer without splitting it, and
   every tick this machine will reach fits in a double exactly. */
typedef double player_tick_t;

typedef struct {
  player_tick_t tick;
  uint32_t frame;
  cpc_t cpc;
  uint8_t ram[PLAYER_RAM_SIZE];
} player_state_t;

typedef struct {
  player_tick_t fetch_tick;
  uint32_t physical;
  uint16_t pc;
  uint8_t value;
} player_write_t;

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

static player_state_t states[PLAYER_STATES];
static uint32_t states_oldest;
static uint32_t states_held;
static uint64_t next_state_due;

static player_write_t trace[PLAYER_TRACE_ENTRIES];
static uint32_t trace_first;
static uint32_t trace_held;
static const player_write_t *traced;

static uint64_t ticks;
static uint64_t recorded_until;
static uint16_t fetch_pc;
static uint64_t fetch_tick;

static bool replaying; /* running to reach a moment already recorded_until */
static bool rewound;   /* standing somewhere the record has run past */

/* One byte an address, in the processor's own space. */
#define PLAYER_TRAP_NONE 0
#define PLAYER_TRAP_EXECUTE 1
#define PLAYER_TRAP_READ 2
#define PLAYER_TRAP_WRITE 4
/* Not a kind the table below holds: this mark is carried by the program. */
#define PLAYER_TRAP_BREAK 8

/* WinAPE's BRK (http://www.winape.net/help/debug.html). A Z80 runs the pair
   as a NONI: 8 T-states, R twice advanced, nothing else touched
   (https://mdfs.net/Docs/Comp/Z80/UnDocOps). */
#define PLAYER_BREAK_PREFIX 0xED
#define PLAYER_BREAK_OPCODE 0xFF

static uint8_t breakpoints[0x10000];
/* Every kind set anywhere: each check below costs nothing until some
   breakpoint asks for it. Maintained here so it cannot disagree with the
   table it summarises. */
static uint8_t trapping;
static bool break_instructions;
static uint8_t trap_kind;
static uint16_t trap_address;

static void forget_stamps(void) { memset(written, 0, sizeof written); }

static void forget_writes(void) {
  forget_stamps();
  frame = 1;
}

static player_state_t *state_at(uint32_t index) {
  return &states[(states_oldest + index) % PLAYER_STATES];
}

static void store_state(player_state_t *state) {
  state->tick = (player_tick_t)ticks;
  state->frame = frame;
  state->cpc = cpc;
  memcpy(state->ram, ram, cpc.ram_size);
  next_state_due = ticks + PLAYER_STATE_TICKS;
}

static void keep_state(void) {
  player_state_t *state = state_at(states_held);

  if (states_held < PLAYER_STATES) {
    states_held++;
  } else {
    states_oldest = (states_oldest + 1) % PLAYER_STATES;
  }

  store_state(state);
}

static void forget_history(void) {
  states_oldest = 0;
  states_held = 0;
  trace_first = 0;
  trace_held = 0;
  traced = NULL;
  ticks = 0;
  fetch_pc = 0;
  fetch_tick = 0;
  recorded_until = 0;
  replaying = false;
  rewound = false;
  keep_state();
}

static void keep_write(uint32_t physical, uint8_t value) {
  player_write_t *entry = &trace[(trace_first + trace_held) % PLAYER_TRACE_ENTRIES];

  if (trace_held < PLAYER_TRACE_ENTRIES) {
    trace_held++;
  } else {
    trace_first = (trace_first + 1) % PLAYER_TRACE_ENTRIES;
  }

  entry->fetch_tick = (player_tick_t)fetch_tick;
  entry->physical = physical;
  entry->pc = fetch_pc;
  entry->value = value;
}

/* A store fetched at the moment itself goes too: that instruction has not
   run, which is why the two comparisons differ. */
static void forget_after(void) {
  player_tick_t at = (player_tick_t)ticks;

  while (states_held > 0 && state_at(states_held - 1)->tick > at) {
    states_held--;
  }

  while (trace_held > 0 &&
         trace[(trace_first + trace_held - 1) % PLAYER_TRACE_ENTRIES].fetch_tick >= at) {
    trace_held--;
  }

  next_state_due = ticks;
  recorded_until = ticks;
}

/* No replay reaches a value written from outside: this state is the only
   place that moment exists. */
static void capture(void) {
  if (rewound) {
    forget_after();
    rewound = false;
  }

  player_state_t *newest = state_at(states_held - 1);

  if (newest->tick == (player_tick_t)ticks) {
    store_state(newest);
    return;
  }

  keep_state();
}

static void tick(void) {
  bool retraced = cpc.monitor.frame_retraced;

  if (!replaying &&
      (rewound || (ticks >= next_state_due && z80_instruction_complete(&cpc.cpu)))) {
    capture();
  }

  if (z80_instruction_complete(&cpc.cpu)) {
    fetch_pc = cpc.cpu.pc;
    fetch_tick = ticks;
  }

  uint64_t pins = cpc_tick(&cpc);
  ticks++;

  if (!replaying) {
    recorded_until = ticks;
  }

  if ((pins & (Z80_MREQ | Z80_WR)) == (Z80_MREQ | Z80_WR)) {
    uint16_t address = z80_address(pins);
    size_t physical = (size_t)(cpc.write_page[address >> 14] + (address & 0x3FFF) - cpc.ram);
    written[physical] = frame;

    if (!replaying) {
      keep_write((uint32_t)physical, z80_data(pins));
    }
  }

  if ((trapping & (PLAYER_TRAP_READ | PLAYER_TRAP_WRITE)) != 0 && trap_kind == PLAYER_TRAP_NONE) {
    /* M1 keeps opcode fetches out of the read tap: read means read as data. */
    uint64_t memory = pins & (Z80_M1 | Z80_MREQ | Z80_RD | Z80_WR);
    uint16_t address = z80_address(pins);

    if (memory == (Z80_MREQ | Z80_WR) && (breakpoints[address] & PLAYER_TRAP_WRITE) != 0) {
      trap_kind = PLAYER_TRAP_WRITE;
      trap_address = address;
    } else if (memory == (Z80_MREQ | Z80_RD) && (breakpoints[address] & PLAYER_TRAP_READ) != 0) {
      trap_kind = PLAYER_TRAP_READ;
      trap_address = address;
    }
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

static bool standing_on_break_instruction(void) {
  return cpc_peek(&cpc, cpc.cpu.pc) == PLAYER_BREAK_PREFIX &&
         cpc_peek(&cpc, (uint16_t)(cpc.cpu.pc + 1)) == PLAYER_BREAK_OPCODE;
}

static uint32_t state_to_run_from(player_tick_t tick) {
  uint32_t index = 0;

  for (uint32_t at = states_held; at > 0; at--) {
    if (state_at(at - 1)->tick <= tick) {
      index = at - 1;
      break;
    }
  }

  return index;
}

static void load_state(uint32_t index) {
  const player_state_t *state = state_at(index);

  cpc = state->cpc;
  memcpy(ram, state->ram, cpc.ram_size);
  frame = state->frame;
  ticks = (uint64_t)state->tick;
  cpc_remap(&cpc);
}

static void run_to(player_tick_t target) {
  while ((player_tick_t)ticks < target) {
    tick();
  }
}

static uint32_t state_a_frame_before(uint32_t index) {
  uint32_t start = index;

  while (start > 0 && state_at(index)->tick - state_at(start)->tick < PLAYER_STATE_TICKS) {
    start--;
  }

  return start;
}

static void paint_up_to(uint32_t index) {
  uint32_t start = state_a_frame_before(index);

  load_state(start);

  if (start != index) {
    run_to(state_at(index)->tick);
  }
}

static void stand_at(player_tick_t target) {
  uint32_t index = state_to_run_from(target);

  forget_stamps();

  replaying = true;
  paint_up_to(index);
  /* The run reached this state by replay, which no outside write survives. */
  load_state(index);
  run_to(target);
  replaying = (player_tick_t)ticks < (player_tick_t)recorded_until;
  finish_instruction();
  replaying = false;
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

void player_clear_breakpoints(void) {
  memset(breakpoints, 0, sizeof breakpoints);
  trapping = PLAYER_TRAP_NONE;
}

/* Inclusive of both ends, and `at` is wider than the address it holds so a
   range reaching &FFFF finishes instead of wrapping. */
void player_set_breakpoint(uint16_t from, uint16_t until, uint8_t kinds) {
  for (uint32_t at = from; at <= until; at++) {
    breakpoints[at] |= kinds;
  }

  trapping |= kinds;
}

void player_set_break_instructions(bool honoured) { break_instructions = honoured; }

uint32_t player_trap_kind(void) { return trap_kind; }
uint32_t player_trap_address(void) { return trap_address; }

/* The operating system fills the lower half of the image, BASIC the upper
 * as ROM 0. */
void player_boot(uint32_t ram_size) {
  cpc_init(&cpc, ram, ram_size, rom);
  cpc_set_upper_rom(&cpc, 0, rom + 0x4000);
  cpc_connect_monitor(&cpc, framebuffer);
  forget_writes();
  forget_history();
}

bool player_load_snapshot(uint32_t length) {
  const char *problem = NULL;
  if (!snapshot_load(&cpc, snapshot, length, &problem)) {
    return false;
  }

  forget_writes();
  forget_history();
  return true;
}

void player_run_frames(uint32_t frames) {
  uint32_t ticks_wanted = frames * PLAYER_TICKS_PER_FRAME;
  for (uint32_t count = 0; count < ticks_wanted; count++) {
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
  uint32_t start = frame;

  /* Left standing, the last stop's record would trap the resume on itself. */
  trap_kind = PLAYER_TRAP_NONE;

  for (uint32_t count = 1; count <= limit; count++) {
    tick();

    if (trap_kind != PLAYER_TRAP_NONE) {
      /* A watch fires mid-instruction; the stop waits for the boundary, and
         for it ahead of any retrace. */
      if (z80_instruction_complete(&cpc.cpu)) {
        return count;
      }
      continue;
    }

    if (((trapping & PLAYER_TRAP_EXECUTE) != 0 || break_instructions) &&
        z80_instruction_complete(&cpc.cpu)) {
      /* Where PC has arrived, not where it left: the instruction standing
         there has not run, and a resume walks off the mark without being told
         to. */
      if ((breakpoints[cpc.cpu.pc] & PLAYER_TRAP_EXECUTE) != 0) {
        trap_kind = PLAYER_TRAP_EXECUTE;
        trap_address = cpc.cpu.pc;
        return count;
      }

      if (break_instructions && standing_on_break_instruction()) {
        trap_kind = PLAYER_TRAP_BREAK;
        trap_address = cpc.cpu.pc;
        return count;
      }
    }

    if (frame != start) {
      return count;
    }
  }

  return limit;
}

/* An export that changes the machine without ticking it keeps the record —
   and only if it changed anything, or a blur releasing nothing would spend a
   moment of history. */
static void capture_if_changed(keyboard_t before) {
  if (memcmp(&before, &cpc.keyboard, sizeof before) != 0) {
    capture();
  }
}

void player_press(uint8_t key) {
  keyboard_t before = cpc.keyboard;
  keyboard_press(&cpc.keyboard, key);
  capture_if_changed(before);
}

void player_release(uint8_t key) {
  keyboard_t before = cpc.keyboard;
  keyboard_release(&cpc.keyboard, key);
  capture_if_changed(before);
}

void player_release_all(void) {
  keyboard_t before = cpc.keyboard;
  keyboard_release_all(&cpc.keyboard);
  capture_if_changed(before);
}

uint8_t player_peek(uint16_t address) { return cpc_peek(&cpc, address); }

void player_poke(uint16_t address, uint8_t value) {
  cpc_poke(&cpc, address, value);
  capture();
}

/* The pages the processor reads are derived from the ROM enables and the
   bank register, so a host that writes those recomputes them. */
void player_remap(void) { cpc_remap(&cpc); }

z80_t *player_z80(void) { return &cpc.cpu; }
crtc_t *player_crtc(void) { return &cpc.crtc; }
gate_array_t *player_gate_array(void) { return &cpc.gate_array; }

void player_finish_instruction(void) { finish_instruction(); }

/* Without the tick, a machine already between instructions would not move.
   Uncleared, the record would be the last stop's rather than this step's. */
void player_step_instruction(void) {
  trap_kind = PLAYER_TRAP_NONE;
  tick();
  finish_instruction();
}

player_tick_t player_ticks(void) { return (player_tick_t)ticks; }

player_tick_t player_history_from(void) {
  uint32_t index = 0;

  while (index < states_held - 1 &&
         state_at(index)->tick - state_at(0)->tick < PLAYER_STATE_TICKS) {
    index++;
  }

  return state_at(index)->tick;
}

player_tick_t player_history_until(void) { return (player_tick_t)recorded_until; }

void player_capture(void) { capture(); }

void player_seek(player_tick_t target) {
  player_tick_t oldest = player_history_from(), newest = (player_tick_t)recorded_until;

  stand_at(target < oldest ? oldest : (target > newest ? newest : target));

  trap_kind = PLAYER_TRAP_NONE;
  rewound = true;
}

static player_tick_t grain_before(uint32_t grain, uint32_t index, player_tick_t end) {
  player_tick_t entered = -1;
  bool begun = grain == PLAYER_GRAIN_INSTRUCTION;

  replaying = true;
  load_state(index);

  uint8_t was_row = cpc.crtc.c4, was_raster = cpc.crtc.c9;
  uint32_t was_frame = frame;

  while ((player_tick_t)ticks < end) {
    if (begun && z80_instruction_complete(&cpc.cpu)) {
      entered = (player_tick_t)ticks;
      begun = grain == PLAYER_GRAIN_INSTRUCTION;
    }

    tick();

    begun = begun ||
              (grain == PLAYER_GRAIN_SCANLINE &&
               (cpc.crtc.c4 != was_row || cpc.crtc.c9 != was_raster)) ||
              (grain == PLAYER_GRAIN_ROW && cpc.crtc.c4 != was_row) ||
              (grain == PLAYER_GRAIN_FRAME && frame != was_frame);

    was_row = cpc.crtc.c4;
    was_raster = cpc.crtc.c9;
    was_frame = frame;
  }

  replaying = false;
  return entered;
}

void player_step_back_to(uint32_t grain) {
  player_tick_t end = (player_tick_t)ticks, oldest = player_history_from(), found = -1;
  uint32_t index = state_to_run_from(end);

  while (found < 0) {
    uint32_t from = index > 0 ? index - 1 : 0;

    found = grain_before(grain, from, end);

    if (from == 0) {
      break;
    }

    end = state_at(from)->tick;
    index = from;
  }

  player_seek(found < oldest ? oldest : found);
}

bool player_trace_find(uint32_t address, player_tick_t before) {
  player_tick_t oldest = player_history_from();

  for (uint32_t at = trace_held; at > 0; at--) {
    const player_write_t *entry = &trace[(trace_first + at - 1) % PLAYER_TRACE_ENTRIES];

    if (entry->fetch_tick < oldest) {
      break;
    }

    if (entry->fetch_tick < before && entry->physical == address) {
      traced = entry;
      return true;
    }
  }

  traced = NULL;
  return false;
}

player_tick_t player_trace_tick(void) { return traced->fetch_tick; }
uint32_t player_trace_pc(void) { return traced->pc; }
uint32_t player_trace_value(void) { return traced->value; }

uint32_t player_rgb(uint8_t colour_code) { return gate_array_rgb(colour_code); }
