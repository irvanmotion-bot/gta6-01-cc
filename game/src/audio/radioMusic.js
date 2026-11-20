// The car radio: the three stations of Saros, each with its frequency and a playlist of named tracks. Every track is
// a generative synth loop sequenced live from its own key, bass line and lead pattern (no audio files), and the
// station moves on to its next track when one has played through. R in a car tunes to the next station.

/**
 * Each station: its frequency, the DJ who hosts it and their show, its tempo, scale and lead voice, and its playlist. A track has a
 * title, an artist, the key it is played in (`shift`, semitones from the station's root), its bass line and how
 * busy its lead is.
 */
export const STATIONS = [
  {
    name: 'Penumbra FM', frequency: '98.6', dj: 'DJ Jazz', host: 'Jazz counts down to totality', bpm: 104, root: 45, scale: [0, 3, 5, 7, 10, 12, 15], wave: 'sawtooth',
    tracks: [
      { title: 'Shadow Band', artist: 'The Gnomons', shift: 0, bass: [0, 0, 5, 5, 3, 3, 7, 7], leadEvery: 2, density: 0.62 },
      { title: 'Diamond Ring', artist: 'Baily and the Beads', shift: 3, bass: [0, 7, 5, 7, 0, 7, 10, 7], leadEvery: 2, density: 0.7 },
      { title: 'Two Minutes of Night', artist: 'Corona Club', shift: -2, bass: [0, 0, 3, 3, 5, 5, 3, 0], leadEvery: 4, density: 0.8 },
      { title: 'First Contact', artist: 'Limb Darkening', shift: 5, bass: [0, 5, 0, 5, 7, 5, 3, 5], leadEvery: 1, density: 0.5 },
    ],
  },
  {
    name: 'Radio Azimuth', frequency: '101.3', dj: 'DJ Solana', host: 'Latin brass, all afternoon', bpm: 122, root: 48, scale: [0, 2, 4, 7, 9, 12, 14], wave: 'triangle',
    tracks: [
      { title: 'Mediodía en Saros', artist: 'Los Solsticios', shift: 0, bass: [0, 7, 0, 7, 5, 9, 5, 7], leadEvery: 1, density: 0.62 },
      { title: 'Avenida Zenit', artist: 'Orquesta Perihelio', shift: 2, bass: [0, 4, 7, 4, 5, 9, 7, 5], leadEvery: 1, density: 0.7 },
      { title: 'Arena Caliente', artist: 'La Marea Alta', shift: -3, bass: [0, 0, 7, 7, 9, 9, 7, 5], leadEvery: 2, density: 0.75 },
    ],
  },
  {
    name: 'Umbra After Hours', frequency: '88.1', dj: 'DJ Nadir', host: 'Slow grooves for the dark', bpm: 84, root: 41, scale: [0, 3, 7, 10, 12, 14, 15], wave: 'square',
    tracks: [
      { title: 'Totality Blues', artist: 'Nadir Quartet', shift: 0, bass: [0, 0, 0, 3, 5, 5, 5, 7], leadEvery: 4, density: 0.62 },
      { title: 'Low Sun', artist: 'Syzygy', shift: 5, bass: [0, 3, 0, 3, 7, 5, 3, 0], leadEvery: 4, density: 0.7 },
      { title: 'Sodium Lamps', artist: 'The Night Shift', shift: -4, bass: [0, 0, 7, 7, 5, 5, 3, 3], leadEvery: 2, density: 0.45 },
    ],
  },
  { name: 'Radio off', frequency: '', host: '', bpm: 0, tracks: [] },
];

/** Sixteenth notes in one track before the station moves on: sixty-four bars of eight. */
const TRACK_STEPS = 512;

function frequencyOf(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export class RadioMusic {
  constructor() {
    this.station = 0;
    this.track = 0;
    this.playing = false;
    this.step = 0;
    this.nextTime = 0;
    this.seed = 7;
    /** Called with the now-playing readout whenever a station moves on to its next track. */
    this.onTrackChange = null;
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

  /** The station tuned in, or null with the radio off. */
  current() {
    return STATIONS[this.station].bpm > 0 ? STATIONS[this.station] : null;
  }

  /**
   * What is on the air right now, for the HUD's radio line: the station and its frequency, the track and who plays
   * it. Null with the radio off.
   */
  nowPlaying() {
    const station = this.current();
    if (!station) return null;
    const track = station.tracks[this.track % station.tracks.length];
    return { station: station.name, frequency: station.frequency, dj: station.dj, host: station.host, title: track.title, artist: track.artist, number: (this.track % station.tracks.length) + 1, count: station.tracks.length };
  }

  /** Tune to the next station, which starts on its next track; returns it for the HUD. */
  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    this.track += 1;
    return STATIONS[this.station];
  }

  /** The station's next track comes on. */
  nextTrack() {
    this.track += 1;
    this.step = 0;
    if (this.onTrackChange) this.onTrackChange(this.nowPlaying());
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

  /** Schedule the sixteenth notes that fall in the next fraction of a second, in the key and bass of the track on air. */
  update(inVehicle) {
    if (!this.context) return;
    const station = STATIONS[this.station];
    const on = inVehicle && station.bpm > 0;
    this.output.gain.setTargetAtTime(on ? 0.2 : 0, this.context.currentTime, 0.2);
    if (!on) { this.playing = false; return; }
    if (!this.playing) { this.playing = true; this.nextTime = this.context.currentTime + 0.05; }
    const sixteenth = 60 / station.bpm / 4;
    while (this.nextTime < this.context.currentTime + 0.25) {
      if (this.step >= TRACK_STEPS) this.nextTrack();
      const track = station.tracks[this.track % station.tracks.length];
      const root = station.root + track.shift;
      const step = this.step % 64;
      const bar = Math.floor(step / 8) % 8;
      if (step % 4 === 0) this.drum(this.nextTime, true);
      if (step % 2 === 1) this.drum(this.nextTime, false);
      if (step % 2 === 0) this.note(root - 12 + track.bass[bar], this.nextTime, sixteenth * 1.8, 0.2, 'triangle');
      if (step % track.leadEvery === 0 && this.random() < track.density) {
        const degree = station.scale[Math.floor(this.random() * station.scale.length)];
        this.note(root + 12 + degree + track.bass[bar] % 5, this.nextTime, sixteenth * (1 + Math.floor(this.random() * 3)), 0.07, station.wave);
      }
      if (step % 16 === 0) for (const third of [0, 3, 7]) this.note(root + track.bass[bar] + third, this.nextTime, sixteenth * 14, 0.035, 'sawtooth');
      this.nextTime += sixteenth;
      this.step += 1;
    }
  }
}
