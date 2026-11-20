// Street cred: the progression of Solmara Heat. Jobs, escapes, races and takedowns earn cred, cred raises Nova's
// rank, and each rank unlocks something real: crew favors, workshop tiers, guns at Ammo Amigo, armor and discounts.

export class StreetCred {
  constructor(game) {
    this.game = game;
    this.points = 0;
    this.rank = 1;
  }

  reset(points = 0) {
    this.points = points;
    this.rank = rankForPoints(points);
  }

  /** Earn cred for a named deed; climbing a rank announces what it unlocked. */
  earn(amount, reason) {
    if (amount <= 0) return;
    this.points += Math.round(amount);
    this.game.hud.notify(`+${Math.round(amount)} CRED · ${reason}`);
    const rank = rankForPoints(this.points);
    if (rank > this.rank) {
      this.rank = rank;
      const earned = CRED_RANKS[rank - 1];
      this.game.hud.banner(`RANK ${rank} · ${earned.title.toUpperCase()}`, `Unlocked: ${earned.unlocks}`, '#35d0ff');
      this.game.audio.jingle(true);
    }
  }

  title() {
    return CRED_RANKS[this.rank - 1].title;
  }

  /** Share of the way from this rank to the next, 0 to 1 (1 at the top rank). */
  progressToNextRank() {
    const next = CRED_RANKS[this.rank];
    if (!next) return 1;
    const base = CRED_RANKS[this.rank - 1].cred;
    return Math.min(1, (this.points - base) / (next.cred - base));
  }

  credToNextRank() {
    const next = CRED_RANKS[this.rank];
    return next ? next.cred - this.points : 0;
  }

  /** Whether the current rank has reached what a shop row, favor or workshop tier asks for. */
  hasRank(rank) {
    return this.rank >= rank;
  }

  /** Top rank pays less at every counter. */
  priceOf(price) {
    return this.rank >= 7 ? Math.round(price * 0.8) : price;
  }

  maxArmor() {
    return this.rank >= 6 ? 150 : 100;
  }
}

export function rankForPoints(points) {
  let rank = 1;
  while (rank < CRED_RANKS.length && points >= CRED_RANKS[rank].cred) rank += 1;
  return rank;
}

/** The ladder: the cred each rank needs and what reaching it unlocks. */
export const CRED_RANKS = [
  { title: 'Newcomer', cred: 0, unlocks: 'the streets of Solmara' },
  { title: 'Runner', cred: 250, unlocks: 'Bravo\'s WHEELS ON CALL favor · workshop tier 1' },
  { title: 'Hustler', cred: 700, unlocks: 'Jazz\'s SIGNAL JAM favor · Hornet SMG · workshop tier 2' },
  { title: 'Getaway Ace', cred: 1500, unlocks: 'Inés\'s PATCH-UP favor · Boomstick 12 · nitro' },
  { title: 'Fixer', cred: 2800, unlocks: 'Longshot AR · workshop tier 3' },
  { title: 'Shot Caller', cred: 4500, unlocks: 'heavy armor: 150 points' },
  { title: 'Coast Boss', cred: 7000, unlocks: '20% off at every counter' },
  { title: 'Queen of Solmara', cred: 10000, unlocks: 'the crown' },
];

/** What each deed is worth; the systems that pay cred read their amount here. */
export const CRED_AWARDS = { stage: 30, escapePerStar: 45, fare: 30, token: 50, bounty: 140, raceWin: 220, racePodium: 110, officer: 8, enforcer: 14, helicopter: 160, powerslide: 6 };
