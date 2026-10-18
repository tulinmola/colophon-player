/*
 * player.c — the record a machine is watched by, and the page's side of it.
 *
 * The core allocates nothing and does no I/O, so a host owns the machine, its
 * memory and its screen and decides when it runs. This one holds all of it in
 * fixed storage: the module's memory is whatever it needs when it loads and
 * never grows. The page writes ROM and snapshot bytes straight into the
 * buffers exported below, which is the whole of the traffic in that
 * direction.
 *
 * A machine drives; this watches. Nothing here may name a machine, a chip or
 * a bus.
 */
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "player.h"

#define PLAYER_STATES 128
#define PLAYER_TRACE_ENTRIES (1 << 19)
#define PLAYER_PROFILING_CUTS (32 * PLAYER_STATES)

#define PLAYER_GRAIN_INSTRUCTION 0
#define PLAYER_GRAIN_SCANLINE 1
#define PLAYER_GRAIN_ROW 2
#define PLAYER_GRAIN_FRAME 3

/* How a profiling frame ends: where the next begins, when the call it began
   with returns, or at the end address or the next start, whichever comes
   first. */
#define PLAYER_PROFILING_PASS 0
#define PLAYER_PROFILING_CALL 1
#define PLAYER_PROFILING_UNTIL 2

/* A call has returned once the stack pointer stands above where it stood as
   the call began, and not far above: a routine that borrows the stack pointer
   to move memory takes it much further. Altirra's function mode allows the
   same 15 bytes (ATCPUProfileBuilder::ScanForFrameBoundary, profiler.cpp, in
   https://www.virtualdub.org/downloads/Altirra-4.40-src.7z). */
#define PLAYER_PROFILING_RETURN_REACH 15

typedef enum {
  PLAYER_UNTIL_LIMIT,
  PLAYER_UNTIL_SETTLED,
  PLAYER_UNTIL_TICK,
  PLAYER_UNTIL_RETRACE,
  PLAYER_UNTIL_GRAIN,
} player_until;

typedef struct {
  player_tick_t tick;
  uint32_t frame;
  uint8_t machine[PLAYER_MACHINE_BYTES];
  uint8_t ram[PLAYER_RAM_SIZE];
} player_state_t;

typedef struct {
  player_tick_t fetch_tick;
  uint32_t physical;
  uint16_t pc;
  uint8_t value;
} player_write_t;

/* A cut that does not open a profiling frame ends one. Whether one is open is
   the newest cut's to say, so a record cut back past a cut reopens or closes
   what it did. */
typedef struct {
  player_tick_t tick;
  uint32_t frame;
  uint16_t stack_pointer;
  bool opens;
} player_profiling_cut_t;

uint8_t player_ram_bytes[PLAYER_RAM_SIZE];
uint8_t player_rom_bytes[PLAYER_ROM_SIZE];
uint8_t player_framebuffer_bytes[PLAYER_FRAMEBUFFER_SIZE];
uint8_t player_snapshot_bytes[PLAYER_SNAPSHOT_SIZE];

/* Zeroed until a page builds one. */
static player_subject_t standing;

/* The frame each physical byte was last stored to, taken from the word a
   machine already says after each tick — the tap the emulator's
   observation.en.md costs at nothing measurable. Zero means never, so frames
   count from one. */
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

static bool profiling;
static uint16_t profiling_start;
static uint8_t profiling_mode;
static uint16_t profiling_end;
static player_profiling_cut_t profiling_cuts[PLAYER_PROFILING_CUTS];
static uint32_t profiling_cuts_first;
static uint32_t profiling_cuts_held;

/* What one replayed span spent: the ticks of each instruction, by the address
   it was fetched from, and the ticks the processor stood halted. A tick the
   machine holds the processor between two instructions is the first one's,
   as a step counts it. */
static bool counting;
static uint16_t counted_pc;
static bool counted_halted;
static uint32_t profiled_ticks[0x10000];
static uint32_t profiled_halted;
static uint32_t written_before_profiling[PLAYER_RAM_SIZE];

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
   (https://mdfs.net/Docs/Comp/Z80/UnDocOps).

   This pair and the table below are a Z80's, and so is the record while they
   are: a machine with another processor wants both widened. */
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

/* What a run is waiting for, said whole by whoever asks for it so that no
   field of it can be inherited from the run before. */
typedef struct {
  player_until until;
  bool honours_marks;
  uint64_t tick;
  uint32_t grain;
} player_goal_t;

/* The run in hand: what it was asked for, and what it has seen. */
static struct {
  player_goal_t goal;
  /* A walk looking for the last grain begun. Its grain is its own: the run
     it is made of asks to reach a tick, and would otherwise carry it away. */
  bool tracking;
  uint32_t tracked;
  bool begun;            /* it has been crossed at least once */
  player_tick_t entered; /* where, or -1 */
  uint16_t row;
  uint16_t line;
  uint32_t frame;
} run;

static void forget_stamps(void) { memset(written, 0, sizeof written); }

static player_state_t *state_at(uint32_t index) {
  return &states[(states_oldest + index) % PLAYER_STATES];
}

static void store_state(player_state_t *state) {
  state->tick = (player_tick_t)ticks;
  state->frame = frame;
  memcpy(state->machine, standing.state, standing.state_bytes);
  memcpy(state->ram, player_ram_bytes, standing.memory_bytes);
  next_state_due = ticks + standing.ticks_per_frame;
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

static player_profiling_cut_t *profiling_cut_at(uint32_t index) {
  return &profiling_cuts[(profiling_cuts_first + index) % PLAYER_PROFILING_CUTS];
}

static void keep_profiling_cut(bool opens, uint16_t stack_pointer) {
  player_profiling_cut_t *entry = profiling_cut_at(profiling_cuts_held);

  if (profiling_cuts_held < PLAYER_PROFILING_CUTS) {
    profiling_cuts_held++;
  } else {
    profiling_cuts_first = (profiling_cuts_first + 1) % PLAYER_PROFILING_CUTS;
  }

  entry->tick = (player_tick_t)ticks;
  entry->frame = frame;
  entry->stack_pointer = stack_pointer;
  entry->opens = opens;
}

/* A call begun while one is open is inside it, so only the outermost is
   cut. */
static void cut_profiling_frames(uint16_t program_counter, uint16_t stack_pointer) {
  const player_profiling_cut_t *newest =
      profiling_cuts_held > 0 ? profiling_cut_at(profiling_cuts_held - 1) : NULL;
  const bool open = newest != NULL && newest->opens;
  bool ends = false, begins = program_counter == profiling_start;

  switch (profiling_mode) {
    case PLAYER_PROFILING_CALL:
      ends = open &&
             (uint16_t)(stack_pointer - newest->stack_pointer - 1) < PLAYER_PROFILING_RETURN_REACH;
      begins = begins && (!open || ends);
      break;
    case PLAYER_PROFILING_UNTIL:
      ends = open && program_counter == profiling_end;
      break;
    case PLAYER_PROFILING_PASS:
      break;
    default:
      break;
  }

  if (begins || ends) {
    keep_profiling_cut(begins, stack_pointer);
  }
}

/* A store or a cut fetched at the moment itself goes too: that instruction
   has not run, which is why the states are compared differently. */
static void forget_after(void) {
  player_tick_t at = (player_tick_t)ticks;

  while (states_held > 0 && state_at(states_held - 1)->tick > at) {
    states_held--;
  }

  while (trace_held > 0 &&
         trace[(trace_first + trace_held - 1) % PLAYER_TRACE_ENTRIES].fetch_tick >= at) {
    trace_held--;
  }

  while (profiling_cuts_held > 0 && profiling_cut_at(profiling_cuts_held - 1)->tick >= at) {
    profiling_cuts_held--;
  }

  next_state_due = ticks;
  recorded_until = ticks;
}

static void capture(void) {
  if (standing.state == NULL) {
    return;
  }

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

void player_capture(void) { capture(); }

static void load_state(uint32_t index) {
  const player_state_t *state = state_at(index);

  memcpy(standing.state, state->machine, standing.state_bytes);
  memcpy(player_ram_bytes, state->ram, standing.memory_bytes);
  frame = state->frame;
  ticks = (uint64_t)state->tick;

  if (standing.restore != NULL) {
    standing.restore();
  }
}

/* Whether the machine has just reached a mark it must stop on: a watch that
 * fired mid-instruction and has reached its boundary, the program counter
 * standing on an execute breakpoint, or a break instruction the program
 * carries. A watch waits for that boundary ahead of any retrace, which is why
 * a run waiting for one asks whether a mark is pending before it stops.
 *
 * Where PC has arrived and not where it left, because the instruction
 * standing there has not run and a resume would walk off the mark without
 * being told to. */
static bool trapped(const player_moment_t *moment) {
  if (trap_kind != PLAYER_TRAP_NONE) {
    /* A watch fires mid-instruction; the stop waits for the boundary. */
    return moment->settled;
  }

  if (((trapping & PLAYER_TRAP_EXECUTE) == 0 && !break_instructions) || !moment->settled) {
    return false;
  }

  uint16_t pc = moment->program_counter;

  if ((breakpoints[pc] & PLAYER_TRAP_EXECUTE) != 0) {
    trap_kind = PLAYER_TRAP_EXECUTE;
    trap_address = pc;
    return true;
  }

  if (break_instructions && standing.peek(pc) == PLAYER_BREAK_PREFIX &&
      standing.peek((uint16_t)(pc + 1)) == PLAYER_BREAK_OPCODE) {
    trap_kind = PLAYER_TRAP_BREAK;
    trap_address = pc;
    return true;
  }

  return false;
}

static bool crossed(uint32_t grain, const player_moment_t *moment) {
  switch (grain) {
    case PLAYER_GRAIN_INSTRUCTION:
      return true;
    case PLAYER_GRAIN_SCANLINE:
      return moment->row != run.row || moment->line != run.line;
    case PLAYER_GRAIN_ROW:
      return moment->row != run.row;
    case PLAYER_GRAIN_FRAME:
      return frame != run.frame;
    default:
      return false;
  }
}

void player_stand(const player_subject_t *subject) {
  standing = *subject;
  player_forget();
}

void player_before(bool settled, uint16_t row, uint16_t line) {
  if (run.tracking && run.begun && settled) {
    run.entered = (player_tick_t)ticks;
    run.begun = run.tracked == PLAYER_GRAIN_INSTRUCTION;
  }

  if (!replaying && (rewound || (ticks >= next_state_due && settled))) {
    capture();
  }

  run.row = row;
  run.line = line;
  run.frame = frame;
}

void player_fetching(uint16_t program_counter, uint16_t stack_pointer, bool halted) {
  fetch_pc = program_counter;
  fetch_tick = ticks;

  if (counting && standing.settled()) {
    counted_pc = program_counter;
    counted_halted = halted;
  }

  if (profiling && !halted && !replaying && standing.settled()) {
    cut_profiling_frames(program_counter, stack_pointer);
  }
}

bool player_after(const player_moment_t *moment) {
  ticks++;

  if (counting) {
    if (counted_halted) {
      profiled_halted++;
    } else {
      profiled_ticks[counted_pc]++;
    }
  }

  if (!replaying) {
    recorded_until = ticks;
  }

  if (moment->access == PLAYER_ACCESS_WRITE && moment->physical != PLAYER_NOWHERE) {
    written[moment->physical] = frame;

    if (!replaying) {
      keep_write(moment->physical, moment->value);
    }
  }

  if ((trapping & (PLAYER_TRAP_READ | PLAYER_TRAP_WRITE)) != 0 && trap_kind == PLAYER_TRAP_NONE &&
      moment->access != PLAYER_ACCESS_NONE) {
    uint8_t wanted = moment->access == PLAYER_ACCESS_WRITE ? PLAYER_TRAP_WRITE : PLAYER_TRAP_READ;

    if ((breakpoints[moment->address] & wanted) != 0) {
      trap_kind = wanted;
      trap_address = moment->address;
    }
  }

  if (moment->frame_ended) {
    frame++;
  }

  if (run.tracking) {
    run.begun = run.begun || crossed(run.tracked, moment);
  }

  bool stop = run.goal.honours_marks && trapped(moment);

  switch (run.goal.until) {
    case PLAYER_UNTIL_SETTLED:
      stop = stop || moment->settled;
      break;
    case PLAYER_UNTIL_TICK:
      stop = stop || ticks >= run.goal.tick;
      break;
    case PLAYER_UNTIL_RETRACE:
      stop = stop || (trap_kind == PLAYER_TRAP_NONE && moment->frame_ended);
      break;
    case PLAYER_UNTIL_GRAIN:
      stop = stop || crossed(run.goal.grain, moment);
      break;
    default:
      break;
  }

  return !stop;
}

static uint32_t run_until(player_goal_t goal, uint32_t limit) {
  run.goal = goal;

  return standing.run(limit);
}

/* The guard is the core's own: longer than the longest instruction, the
   charges it can earn along a line, and an interrupt taken at the end of it. */
static void finish_instruction(void) {
  if (standing.settled()) {
    return;
  }

  const player_goal_t goal = {.until = PLAYER_UNTIL_SETTLED};

  run_until(goal, 256);
}

static void run_to(player_tick_t target) {
  if ((player_tick_t)ticks >= target) {
    return;
  }

  const player_goal_t goal = {.until = PLAYER_UNTIL_TICK, .tick = (uint64_t)target};

  run_until(goal, (uint32_t)(target - (player_tick_t)ticks));
}

uint8_t *player_rom(void) { return player_rom_bytes; }
uint8_t *player_snapshot(void) { return player_snapshot_bytes; }

/* How much a page may write into the buffers above, so that an image larger
   than the room here is refused rather than laid over what follows it. */
uint32_t player_snapshot_capacity(void) { return PLAYER_SNAPSHOT_SIZE; }
uint32_t player_rom_capacity(void) { return PLAYER_ROM_SIZE; }
uint32_t player_ram_capacity(void) { return PLAYER_RAM_SIZE; }

/* Addresses into it are physical, the video hardware's own view; peek and
   poke walk the machine's own map instead. */
uint8_t *player_ram(void) { return player_ram_bytes; }

/* Hardware colour codes, one byte a sample, the whole raster. */
uint8_t *player_framebuffer(void) { return player_framebuffer_bytes; }

uint32_t *player_writes(void) { return written; }
uint32_t player_frame(void) { return frame; }

void player_forget(void) {
  forget_stamps();
  frame = 1;

  states_oldest = 0;
  states_held = 0;
  trace_first = 0;
  trace_held = 0;
  traced = NULL;
  profiling_cuts_first = 0;
  profiling_cuts_held = 0;
  ticks = 0;
  fetch_pc = 0;
  fetch_tick = 0;
  recorded_until = 0;
  replaying = false;
  rewound = false;
  run.tracking = false;
  keep_state();
}

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

/* The end is read only in PLAYER_PROFILING_UNTIL. */
void player_set_profiling(uint16_t start, uint8_t mode, uint16_t end) {
  profiling = true;
  profiling_start = start;
  profiling_mode = mode;
  profiling_end = end;
  profiling_cuts_first = 0;
  profiling_cuts_held = 0;
}

void player_clear_profiling(void) {
  profiling = false;
  profiling_cuts_first = 0;
  profiling_cuts_held = 0;
}

uint32_t player_profiling_cuts_held(void) { return profiling_cuts_held; }

player_tick_t player_profiling_cut_tick(uint32_t index) { return profiling_cut_at(index)->tick; }

uint32_t player_profiling_cut_frame(uint32_t index) { return profiling_cut_at(index)->frame; }

bool player_profiling_cut_opens(uint32_t index) { return profiling_cut_at(index)->opens; }

uint32_t player_trap_kind(void) { return trap_kind; }
uint32_t player_trap_address(void) { return trap_address; }

void player_run_frames(uint32_t frames) {
  const player_goal_t goal = {.until = PLAYER_UNTIL_LIMIT};

  run_until(goal, frames * standing.ticks_per_frame);
  finish_instruction();
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
  /* Left standing, the last stop's record would trap the resume on itself. */
  const player_goal_t goal = {.until = PLAYER_UNTIL_RETRACE, .honours_marks = true};

  trap_kind = PLAYER_TRAP_NONE;

  return run_until(goal, limit);
}

/* Run on until the beam has crossed the named grain, then finish the
 * instruction standing there. A mark stops a step as it stops a run: a reader
 * who sets a breakpoint and steps a frame means to be stopped by it. */
void player_step_to(uint32_t grain) {
  const player_goal_t goal = {.until = PLAYER_UNTIL_GRAIN, .honours_marks = true, .grain = grain};

  trap_kind = PLAYER_TRAP_NONE;
  run_until(goal, standing.ticks_per_frame * 2);
  finish_instruction();
}

void player_finish_instruction(void) { finish_instruction(); }

uint8_t player_peek(uint16_t address) { return standing.peek(address); }

uint32_t player_physical_of(uint16_t address) { return standing.physical_of(address); }

void player_poke(uint16_t address, uint8_t value) { standing.poke(address, value); }

void player_press(uint8_t key) { standing.press(key); }
void player_release(uint8_t key) { standing.release(key); }

bool player_load_snapshot(uint32_t length) { return standing.load_snapshot(length); }

/* A CPC's sample is a hardware colour code, a Spectrum's is a bright bit and
   three guns; each machine reads its own. */
uint32_t player_rgb(uint8_t sample) { return standing.rgb(sample); }

z80_t *player_z80(void) { return standing.processor; }
keyboard_t *player_keyboard(void) { return standing.matrix; }

player_tick_t player_ticks(void) { return (player_tick_t)ticks; }

player_tick_t player_history_from(void) {
  uint32_t index = 0;

  while (index < states_held - 1 &&
         state_at(index)->tick - state_at(0)->tick < standing.ticks_per_frame) {
    index++;
  }

  return state_at(index)->tick;
}

player_tick_t player_history_until(void) { return (player_tick_t)recorded_until; }

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

static uint32_t state_a_frame_before(uint32_t index) {
  uint32_t start = index;

  while (start > 0 && state_at(index)->tick - state_at(start)->tick < standing.ticks_per_frame) {
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

void player_seek(player_tick_t target) {
  player_tick_t oldest = player_history_from(), newest = (player_tick_t)recorded_until;

  stand_at(target < oldest ? oldest : (target > newest ? newest : target));

  trap_kind = PLAYER_TRAP_NONE;
  rewound = true;
}

static player_tick_t grain_before(uint32_t grain, uint32_t index, player_tick_t end) {
  replaying = true;
  load_state(index);

  run.tracked = grain;
  run.tracking = true;
  run.begun = grain == PLAYER_GRAIN_INSTRUCTION;
  run.entered = -1;

  run_to(end);

  run.tracking = false;
  replaying = false;

  return run.entered;
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

/* Replays the span from one moment the record holds to another, counting
   every tick, then stands the machine back where it was. */
void player_profile(player_tick_t from, player_tick_t until) {
  player_tick_t standing_at = (player_tick_t)ticks;
  uint8_t kept_trap_kind = trap_kind;
  uint16_t kept_trap_address = trap_address;

  memcpy(written_before_profiling, written, sizeof written);
  memset(profiled_ticks, 0, sizeof profiled_ticks);
  profiled_halted = 0;

  stand_at(from);
  replaying = true;
  counting = true;
  run_to(until);
  counting = false;
  stand_at(standing_at);

  memcpy(written, written_before_profiling, sizeof written);
  trap_kind = kept_trap_kind;
  trap_address = kept_trap_address;
}

uint32_t *player_profiled_ticks(void) { return profiled_ticks; }
uint32_t player_profiled_halted(void) { return profiled_halted; }
