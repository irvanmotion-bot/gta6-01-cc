// Names every Saros P.D. unit on the radio: its role, what the dispatch panel calls it and its numbered callsign.

/** Hand out the next callsign of a role: VIGIA 12, LINCE 3, MURO 2, BARRERA 5, AVOCET 1. */
export function assignCallsign(role, counters) {
  const spec = UNIT_ROLES[role];
  counters[role] = (counters[role] || spec.firstNumber) + spec.step;
  return { role, kind: spec.kind, callsign: `${spec.prefix} ${counters[role]}`, icon: spec.icon };
}

/** The name the HUD gives the whole response at each wanted level. */
export function responseTierName(stars) {
  return RESPONSE_TIERS[stars] || RESPONSE_TIERS[0];
}

/**
 * The roles of the force. `model` is the car from vehicleCatalog.js; `prefix` is the radio name:
 * vigía = lookout (patrol), lince = lynx (interceptor), muro = wall (tactical van), barrera = barrier, avocet = the shore bird.
 */
export const UNIT_ROLES = {
  patrol: { kind: 'PATROL', prefix: 'VIGIA', model: 'centinela', firstNumber: 10, step: 2, icon: '▣' },
  interceptor: { kind: 'INTERCEPTOR', prefix: 'LINCE', model: 'lince', firstNumber: 1, step: 1, icon: '◆' },
  tactical: { kind: 'TAC VAN', prefix: 'MURO', model: 'bastion', firstNumber: 0, step: 1, icon: '■' },
  roadblock: { kind: 'ROADBLOCK', prefix: 'BARRERA', model: 'centinela', firstNumber: 2, step: 1, icon: '▬' },
  air: { kind: 'AIR UNIT', prefix: 'AVOCET', model: null, firstNumber: 0, step: 1, icon: '✕' },
  foot: { kind: 'OFFICERS', prefix: 'FOOT', model: null, firstNumber: 0, step: 1, icon: '●' },
};

const RESPONSE_TIERS = ['ALL CLEAR', 'PATROL RESPONSE', 'HOT PURSUIT', 'AIR SUPPORT', 'TACTICAL LOCKDOWN', 'CITYWIDE MANHUNT'];
