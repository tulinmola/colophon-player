/*
 * z80_bus.h — the bus a Z80 leaves behind, read into a moment.
 *
 * A machine file includes this; the record does not, and must not — it is
 * told what a tick did rather than reading a bus.
 */
#ifndef PLAYER_Z80_BUS_H
#define PLAYER_Z80_BUS_H

#include <stdint.h>

#include "player.h"
#include "z80.h"

/* M1 keeps opcode fetches out of the read tap, and a write never carries M1,
 * so one reading serves both the stamp and the watch. */
static inline void z80_bus_access(player_moment_t *moment, uint64_t pins,
                                  uint32_t (*physical_of)(uint16_t)) {
  uint64_t memory = pins & (Z80_M1 | Z80_MREQ | Z80_RD | Z80_WR);

  moment->physical = PLAYER_NOWHERE;

  if (memory == (Z80_MREQ | Z80_WR)) {
    moment->access = PLAYER_ACCESS_WRITE;
    moment->address = z80_address(pins);
    moment->physical = physical_of(moment->address);
    moment->value = z80_data(pins);
  } else if (memory == (Z80_MREQ | Z80_RD)) {
    moment->access = PLAYER_ACCESS_READ;
    moment->address = z80_address(pins);
  }
}

#endif
