// The clock of eclipse week: five days in Saros that end in a total solar eclipse. Owns the day and the hour,
// stretches the golden afternoon, slows time while the moon crosses the sun, and answers every question the sky,
// the HUD, the police and the story ask about it: how much of the sun is covered, how dark it is, how long is left.
import { DAY_LENGTH_SECONDS, START_HOUR } from '../core/config.js';
import { clamp } from '../core/random.js';

/** The week on the calendar: the fifth day is eclipse day. */
export const ECLIPSE_WEEK = [
  { short: 'MON', name: 'Monday', motto: 'The city fills up' },
  { short: 'TUE', name: 'Tuesday', motto: 'Telescopes on every corner' },
  { short: 'WED', name: 'Wednesday', motto: 'Two days of daylight left' },
  { short: 'THU', name: 'Thursday', motto: 'Eclipse eve' },
  { short: 'FRI', name: 'Friday', motto: 'Eclipse day' },
];
export const ECLIPSE_DAY = ECLIPSE_WEEK.length;

/** The four contacts of the eclipse, as hours of eclipse day: the moon touches, covers, uncovers and leaves the sun. */
export const CONTACTS = { first: 16.2, totalityStart: 17.2, totalityEnd: 17.5, last: 18.5 };
/** How long each part of the eclipse takes to play, in real seconds: time slows down for it. */
export const ECLIPSE_SECONDS = { partialIn: 300, totality: 150, partialOut: 240 };
/** The hour Nova wakes at after a rest: the afternoon sun is already low and warm. */
export const WAKE_HOUR = 14.6;
/** The share of the track from first contact to mid-eclipse over which the moon covers the whole disc. */
const TOTAL_ZONE = 0.03;

function smooth(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Hours of game clock per real second outside the eclipse: long golden afternoons, short nights. */
function ordinaryPace(hour) {
  const base = 24 / DAY_LENGTH_SECONDS;
  if (hour >= 14.5 && hour < 19) return base * 0.45;
  if (hour >= 21 || hour < 5) return base * 2.2;
  return base;
}

export class EclipseCalendar {
  constructor(game) {
    this.game = game;
    this.day = 1;
    this.hour = START_HOUR;
    this.encore = false;
    this.announced = '';
  }

  /** A new week, or the day and hour a save was made on. */
  reset(day = 1, hour = START_HOUR) {
    this.day = day;
    this.hour = hour;
    this.encore = false;
    this.announced = this.phase();
  }

  isEclipseDay() {
    return this.day === ECLIPSE_DAY;
  }

  /**
   * Where the moon stands on its way across the sun: -1 at first contact, 0 at mid-eclipse, +1 at last contact,
   * null when there is no eclipse in the sky. The sky draws the moon's disc from this number alone.
   */
  shadowTrack() {
    if (!this.isEclipseDay() || this.hour <= CONTACTS.first || this.hour >= CONTACTS.last) return null;
    const h = this.hour;
    if (h < CONTACTS.totalityStart) return -1 + ((h - CONTACTS.first) / (CONTACTS.totalityStart - CONTACTS.first)) * (1 - TOTAL_ZONE);
    if (h <= CONTACTS.totalityEnd) return -TOTAL_ZONE + ((h - CONTACTS.totalityStart) / (CONTACTS.totalityEnd - CONTACTS.totalityStart)) * TOTAL_ZONE * 2;
    return TOTAL_ZONE + ((h - CONTACTS.totalityEnd) / (CONTACTS.last - CONTACTS.totalityEnd)) * (1 - TOTAL_ZONE);
  }

  /** How much of the sun's width the moon hides, 0 to 1. */
  coverage() {
    const track = this.shadowTrack();
    if (track === null) return 0;
    return Math.abs(track) <= TOTAL_ZONE ? 1 : (1 - Math.abs(track)) / (1 - TOTAL_ZONE);
  }

  /** 'week', 'eclipseDay', 'partial', 'totality', 'waning' or 'after'. */
  phase() {
    if (this.day > ECLIPSE_DAY) return 'after';
    if (!this.isEclipseDay()) return 'week';
    if (this.hour <= CONTACTS.first) return 'eclipseDay';
    if (this.hour < CONTACTS.totalityStart) return 'partial';
    if (this.hour <= CONTACTS.totalityEnd) return 'totality';
    if (this.hour < CONTACTS.last) return 'waning';
    return 'after';
  }

  isTotality() {
    return this.phase() === 'totality';
  }

  /** The dark of the moon's shadow, 0 to 1: it falls in the last moments before totality and lifts just after. */
  darkness() {
    return smooth(0.9, 0.995, this.coverage());
  }

  /**
   * The share of sunlight that still reaches the streets. As in a real eclipse the eye hardly notices the loss until
   * four fifths of the sun is gone: the day stays bright and warm, then the light falls away fast into totality.
   */
  sunlight() {
    const covered = this.coverage();
    return 1 - 0.08 * smooth(0.55, 0.8, covered) - 0.88 * smooth(0.8, 1, covered);
  }

  /** Hours of clock per real second right now. */
  pace() {
    if (this.isEclipseDay()) {
      const h = this.hour;
      if (h >= CONTACTS.first && h < CONTACTS.totalityStart) return (CONTACTS.totalityStart - CONTACTS.first) / ECLIPSE_SECONDS.partialIn;
      if (h >= CONTACTS.totalityStart && h < CONTACTS.totalityEnd) return (CONTACTS.totalityEnd - CONTACTS.totalityStart) / ECLIPSE_SECONDS.totality;
      if (h >= CONTACTS.totalityEnd && h < CONTACTS.last) return (CONTACTS.last - CONTACTS.totalityEnd) / ECLIPSE_SECONDS.partialOut;
    }
    return ordinaryPace(this.hour);
  }

  /** Real seconds until the sun goes out, on eclipse day before totality; null on any other day or after it. */
  secondsToTotality() {
    if (!this.isEclipseDay() || this.hour >= CONTACTS.totalityStart) return null;
    if (this.hour >= CONTACTS.first) return (CONTACTS.totalityStart - this.hour) / this.pace();
    let seconds = ECLIPSE_SECONDS.partialIn;
    for (let h = this.hour; h < CONTACTS.first; h += 0.05) seconds += Math.min(0.05, CONTACTS.first - h) / ordinaryPace(h);
    return seconds;
  }

  /** Real seconds of darkness left, during totality. */
  secondsOfTotalityLeft() {
    return this.isTotality() ? (CONTACTS.totalityEnd - this.hour) / this.pace() : 0;
  }

  daysToTotality() {
    return Math.max(0, ECLIPSE_DAY - this.day);
  }

  /** The latest day the week may reach yet: eclipse day waits for the crew's setup jobs, the week's end for the score. */
  latestDayAllowed() {
    const missions = this.game.missions;
    if (missions.isStoryComplete()) return Infinity;
    return missions.setupJobsLeft() === 0 ? ECLIPSE_DAY : ECLIPSE_DAY - 1;
  }

  /** Move the clock on; the game loop calls this while the city is live. `rush` hurries a wait (holding for totality). */
  update(dt, rush = 1) {
    this.hour += this.pace() * dt * rush;
    if (this.hour >= 24) {
      this.hour -= 24;
      this.turnDay();
    }
    this.announcePhase();
  }

  /** Midnight, or Nova waking up: the next day of the week begins, if the story lets it. */
  turnDay() {
    const hud = this.game.hud;
    if (this.day >= this.latestDayAllowed()) {
      if (this.day === ECLIPSE_DAY) hud.notify('The shadow comes round again this afternoon. The vault is still waiting.');
      else hud.notify(`Eclipse eve drags on: ${this.game.missions.setupJobsLeft()} setup jobs left before the crew is ready.`);
      return false;
    }
    this.day += 1;
    this.encore = false;
    const entry = ECLIPSE_WEEK[this.day - 1];
    if (entry) hud.banner(this.day === ECLIPSE_DAY ? 'ECLIPSE DAY' : entry.name.toUpperCase(), this.day === ECLIPSE_DAY ? 'Totality crosses Saros this afternoon' : `${entry.motto} · ${this.daysToTotality()} ${this.daysToTotality() === 1 ? 'day' : 'days'} to totality`, '#ffb547');
    else if (this.day === ECLIPSE_DAY + 1) hud.notify('Eclipse week is over. Saros goes back to being a beach town.');
    return true;
  }

  /** Resting at the safehouse: sleep into the next afternoon. Returns false when the week is held on this day. */
  sleepUntilNextDay() {
    const turned = this.hour < 5 ? true : this.turnDay();
    this.hour = WAKE_HOUR;
    this.announced = this.phase();
    return turned;
  }

  /** Lose a few hours (an arrest, a hospital stay) without missing the eclipse. */
  skipHours(hours) {
    if (this.isEclipseDay()) return;
    this.hour += hours;
    if (this.hour >= 24) { this.hour -= 24; this.turnDay(); }
  }

  /** A story job that is set at an hour of its day. */
  setHour(hour) {
    this.hour = hour;
    this.announced = this.phase();
  }

  /** After the story: watch the eclipse again from first contact, with every rule of the dark in force. */
  relive() {
    this.day = ECLIPSE_DAY;
    this.hour = CONTACTS.first - 0.05;
    this.encore = true;
    this.announced = this.phase();
  }

  /** Banners and sounds as the eclipse moves from one phase to the next. */
  announcePhase() {
    const phase = this.phase();
    if (phase === this.announced) return;
    this.announced = phase;
    const game = this.game;
    if (phase === 'partial') {
      game.hud.banner('FIRST CONTACT', 'The moon takes its first bite of the sun', '#ffb547');
    } else if (phase === 'totality') {
      game.hud.banner('TOTALITY', 'Saros goes dark. Stay out of the light and nobody sees you.', '#f4ecd8');
      game.audio.totalityFalls();
    } else if (phase === 'waning') {
      game.hud.banner('THIRD CONTACT', 'The sun is back. So is every pair of eyes in Saros.', '#ffb547');
    } else if (phase === 'after' && this.day === ECLIPSE_DAY && this.encore) {
      this.day = ECLIPSE_DAY + 1;
    }
  }

  /** The clock as HH:MM for the HUD. */
  clockText() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** The weekday on the calendar, or what comes after the week. */
  dayName() {
    const entry = ECLIPSE_WEEK[this.day - 1];
    return entry ? entry.short : 'SAT';
  }

  /**
   * What the HUD's eclipse panel shows: a caption, the big readout, a line beside it, the few words that stand over
   * the readout on the biggest HUD (`short`), how far the week has come (0 to 1) and whether the readout is counting
   * real seconds.
   */
  readout() {
    const phase = this.phase();
    const covered = Math.round(this.coverage() * 100);
    const weekShare = clamp((this.day - 1 + this.hour / 24) / ECLIPSE_DAY, 0, 1);
    if (phase === 'week') {
      const days = this.daysToTotality();
      return { caption: `ECLIPSE WEEK · DAY ${this.day} OF ${ECLIPSE_DAY}`, big: `${days} ${days === 1 ? 'DAY' : 'DAYS'}`, line: 'TO TOTALITY · FRI 17:12', short: 'TO TOTALITY', share: weekShare, ticking: false };
    }
    if (phase === 'eclipseDay' || phase === 'partial') {
      return {
        caption: phase === 'partial' ? `ECLIPSE · SUN ${covered}% COVERED` : 'ECLIPSE DAY · FIRST CONTACT 16:12', big: formatCountdown(this.secondsToTotality()), line: 'TO TOTALITY',
        short: phase === 'partial' ? `SUN ${covered}% GONE` : 'TO TOTALITY', share: phase === 'partial' ? this.coverage() : weekShare, ticking: true,
      };
    }
    if (phase === 'totality') return { caption: 'TOTALITY · SUN 100% COVERED', big: formatCountdown(this.secondsOfTotalityLeft()), line: 'OF DARKNESS LEFT', short: 'TOTALITY LEFT', share: 1 - this.secondsOfTotalityLeft() / ECLIPSE_SECONDS.totality, ticking: true };
    if (phase === 'waning') return { caption: `ECLIPSE · SUN ${covered}% COVERED`, big: `${100 - covered}%`, line: 'OF THE SUN IS BACK', short: 'SUN IS BACK', share: 1 - this.coverage(), ticking: false };
    return { caption: 'AFTER THE ECLIPSE', big: 'SAROS', line: 'NEXT TOTALITY: 18 YEARS, 11 DAYS', short: 'ECLIPSE OVER', share: 1, ticking: false };
  }
}

/** Real seconds as M:SS, the way the countdown to totality shows them. */
export function formatCountdown(seconds) {
  const whole = Math.max(0, Math.ceil(seconds || 0));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
