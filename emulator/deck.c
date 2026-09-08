/*
 * deck.c — a tape in a page, and the reel it turns on.
 *
 * The deck and the reader belong to the machine and travel in its state. The
 * image belongs here, because a reader borrows the bytes where they lie and
 * they must not move while a tape is in.
 */
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "deck.h"
#include "player.h"

/* A Spectrum's own tapes are a fraction of this. The rest is for the long
   ones — a multiload's parts, or a recording kept sample by sample. */
#define PLAYER_TAPE_SIZE 0x200000

static uint8_t image[PLAYER_TAPE_SIZE];
static const char *tape_problem;

/* Bumped by every tape in and out, so a reader can be told from the image it
   is pointed at. */
static uint32_t opened;

static player_deck_t *fitted;
static uint32_t fitted_ticks_per_millisecond;
static bool fitted_amstrad;

void player_deck_fit(player_deck_t *deck, uint32_t ticks_per_millisecond, bool amstrad) {
  fitted = deck;
  fitted_ticks_per_millisecond = ticks_per_millisecond;
  fitted_amstrad = amstrad;
  tape_problem = NULL;
  opened++;

  tape_init(&deck->tape);
  deck->opened = opened;
}

void player_deck_restored(void) {
  if (fitted->opened != opened) {
    tape_init(&fitted->tape);
    fitted->opened = opened;
  }
}

uint8_t *player_tape_image(void) { return image; }
uint32_t player_tape_capacity(void) { return PLAYER_TAPE_SIZE; }

/* None where the standing machine has no deck, which is how a page learns
   there is no tape to offer. */
tape_t *player_tape(void) { return fitted == NULL ? NULL : &fitted->tape; }

const char *player_tape_problem(void) { return tape_problem; }

/* Both are the reader's own, so a rewind carries them together. */
uint32_t player_tape_at(void) {
  return tape_loaded(&fitted->tape) ? fitted->reader.data_at : 0;
}

uint32_t player_tape_length(void) {
  return tape_loaded(&fitted->tape) ? fitted->reader.image_length : 0;
}

/* The tape comes out before the image is read, so a refusal leaves an empty
 * deck rather than one holding a tape with nothing on it. A length with no
 * room for it is refused first of all, having touched nothing. */
bool player_tape_insert(uint32_t length) {
  tape_problem = NULL;

  if (length > PLAYER_TAPE_SIZE) {
    tape_problem = "the image is larger than the room a tape is given here";
    return false;
  }

  tape_init(&fitted->tape);
  opened++;
  fitted->opened = opened;

  tzx_machine rules = fitted_amstrad ? TZX_AMSTRAD : TZX_SPECTRUM;

  if (!tzx_open(&fitted->reader, image, length, fitted_ticks_per_millisecond, rules,
                &tape_problem)) {
    player_capture();
    return false;
  }

  tape_insert(&fitted->tape, tzx_next_pulse, &fitted->reader);
  player_capture();
  return true;
}

void player_tape_eject(void) {
  tape_init(&fitted->tape);
  opened++;
  fitted->opened = opened;
  tape_problem = NULL;
  player_capture();
}

void player_tape_play(void) {
  tape_play(&fitted->tape);
  player_capture();
}

void player_tape_stop(void) {
  tape_stop(&fitted->tape);
  player_capture();
}
