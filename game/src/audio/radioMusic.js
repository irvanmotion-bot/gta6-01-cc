// The car radio: the three stations of Saros, each with its frequency, its DJ and a playlist of named tracks. Every
// track is a generative synth loop sequenced live (no audio files): a track is its station's groove in its own key.

/**
 * Each station: its frequency on the FM band and who presents it, tempo, a scale in semitones from its root, a bass
 * line and how its lead plays; then its playlist, each track with its band and the key it shifts the groove to.
 */
export const STATIONS = [
  {
    name: 'Penumbra FM', band: '98.6', dj: 'DJ JAZZ', host: 'Jazz counts down to totality', bpm: 104, root: 45, scale: [0, 3, 5, 7, 10, 12, 15], bass: [0, 0, 5, 5, 3, 3, 7, 7], wave: 'sawtooth', leadEvery: 2,
    tracks: [{ title: 'Corona Season', artist: 'Low Sun', shift: 0 }, { title: 'Night at Noon', artist: 'Los Umbrales', shift: 3 }, { title: 'Baily\'s Beads', artist: 'Strand Static', shift: -2 }],
  },
  {
    name: 'Radio Azimuth', band: '101.3', dj: 'DJ MERIDIANO', host: 'Latin brass, all afternoon', bpm: 122, root: 48, scale: [0, 2, 4, 7, 9, 12, 14], bass: [0, 7, 0, 7, 5, 9, 5, 7], wave: 'triangle', leadEvery: 1,
    tracks: [{ title: 'Sol y Sombra', artist: 'Trío Cénit', shift: 0 }, { title: 'Mercado Azul', artist: 'Brass Almanac', shift: 5 }, { title: 'Calle Gnomon', artist: 'La Marea', shift: 2 }],
  },
  {
    name: 'Umbra After Hours', band: '88.1', dj: 'DJ NADIR', host: 'Slow grooves for the dark', bpm: 84, root: 41, scale: [0, 3, 7, 10, 12, 14, 15], bass: [0, 0, 0, 3, 5, 5, 5, 7], wave: 'square', leadEvery: 4,
    tracks: [{ title: 'Slow Limb', artist: 'Velvet Syzygy', shift: 0 }, { title: 'Third Contact', artist: 'The Perigees', shift: -3 }, { title: 'Low Tide Orbit', artist: 'Night Shift', shift: 4 }],
  },
  { name: 'Radio off', band: '', dj: '', host: '', bpm: 0, tracks: [] },
];
/** How long a track plays before the station moves to the next one on its list. */
const TRACK_SECONDS = 80;

function frequencyOf(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export class RadioMusic {
  constructor() {
    this.station = 0;
    this.playing = false;
    this.step = 0;
    this.nextTime = 0;
    this.seed = 7;
    this.airtime = 0;
  }

  /** The seconds this station has been listened to: the playlist moves on with them, sound or no sound. */
  tick(dt, listening) {
    if (listening && STATIONS[this.station].bpm > 0) this.airtime += dt;
  }

  /** The track on air right now, or null with the radio off. */
  track() {
    const tracks = STATIONS[this.station].tracks;
    return tracks.length ? tracks[Math.floor(this.airtime / TRACK_SECONDS) % tracks.length] : null;
  }

  /**
   * What the HUD's radio panel prints: the station with its frequency and DJ, and the track with its band; null
   * with the radio off.
   */
  nowPlaying() {
    const station = this.current();
    const track = this.track();
    if (!station || !track) return null;
    return { station: `${station.name} ${station.band}`, dj: station.dj, title: track.title, artist: track.artist };
  }

  connect(context, destination) {
    this.context = context;
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.output.connect(destination);
  }

  random() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** The station tuned in, or null with the radio off: the HUD's now-playing line. */
  current() {
    return STATIONS[this.station].bpm > 0 ? STATIONS[this.station] : null;
  }

  /** Tune to the next station; returns it for the HUD. */
  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    this.airtime = 0;
    return STATIONS[this.station];
  }

  note(midi, start, duration, gain, wave) {
    const osc = this.context.createOscillator();
    osc.type = wave;
    osc.frequency.value = frequencyOf(midi);
    const amp = this.context.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(this.output);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  drum(start, kick) {
    const osc = this.context.createOscillator();
    osc.type = kick ? 'sine' : 'square';
    osc.frequency.setValueAtTime(kick ? 140 : 5200, start);
    osc.frequency.exponentialRampToValueAtTime(kick ? 42 : 3800, start + (kick ? 0.14 : 0.03));
    const amp = this.context.createGain();
    amp.gain.setValueAtTime(kick ? 0.5 : 0.045, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + (kick ? 0.16 : 0.04));
    osc.connect(amp).connect(this.output);
    osc.start(start);
    osc.stop(start + 0.2);
  }

  /** Schedule the sixteenth notes that fall in the next fraction of a second. */
  update(inVehicle) {
    if (!this.context) return;
    const station = STATIONS[this.station];
    const on = inVehicle && station.bpm > 0;
    this.output.gain.setTargetAtTime(on ? 0.2 : 0, this.context.currentTime, 0.2);
    if (!on) { this.playing = false; return; }
    if (!this.playing) { this.playing = true; this.nextTime = this.context.currentTime + 0.05; }
    const sixteenth = 60 / station.bpm / 4;
    // The track on air sets the key the station's groove is played in.
    const root = station.root + this.track().shift;
    while (this.nextTime < this.context.currentTime + 0.25) {
      const step = this.step % 64;
      const bar = Math.floor(step / 8) % 8;
      if (step % 4 === 0) this.drum(this.nextTime, true);
      if (step % 2 === 1) this.drum(this.nextTime, false);
      if (step % 2 === 0) this.note(root - 12 + station.bass[bar], this.nextTime, sixteenth * 1.8, 0.2, 'triangle');
      if (step % station.leadEvery === 0 && this.random() < 0.62) {
        const degree = station.scale[Math.floor(this.random() * station.scale.length)];
        this.note(root + 12 + degree + station.bass[bar] % 5, this.nextTime, sixteenth * (1 + Math.floor(this.random() * 3)), 0.07, station.wave);
      }
      if (step % 16 === 0) for (const third of [0, 3, 7]) this.note(root + station.bass[bar] + third, this.nextTime, sixteenth * 14, 0.035, 'sawtooth');
      this.nextTime += sixteenth;
      this.step += 1;
    }
  }
}
