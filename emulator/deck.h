/*
 * deck.h — the cassette deck a machine may have.
 *
 * A machine file includes this; the record does not.
 */
#ifndef PLAYER_DECK_H
#define PLAYER_DECK_H

#include <stdbool.h>
#include <stdint.h>

#include "tape.h"
#include "tzx.h"

typedef struct {
  tape_t tape;
  tzx_t reader;
  /* Which tape the reader was opened on. The bytes it reads are not in the
     record, so a moment stood at again may hold a reader whose bounds were
     measured against a tape that has since come out. */
  uint32_t opened;
} player_deck_t;

/* A machine with no deck calls none of this, and the page is told there is no
 * tape to offer. */
void player_deck_fit(player_deck_t *deck, uint32_t ticks_per_millisecond, tzx_machine rules);

/* A machine's `restore` must call this: a reader the record put back may be
 * holding another tape's bounds, and must not be let at the image. */
void player_deck_restored(void);

#endif
