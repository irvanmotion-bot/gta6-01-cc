// The car radio: the three stations of Saros, each a generative synth loop sequenced live (no audio files).

/** Each station: tempo, a scale in semitones from its root, a bass line and how its lead plays. */
export const STATIONS = [
  { name: 'Penumbra 98.6', host: 'Jazz counts down to totality', bpm: 104, root: 45, scale: [0, 3, 5, 7, 10, 12, 15], bass: [0, 0, 5, 5, 3, 3, 7, 7], wave: 'sawtooth', leadEvery: 2,
    tracks: [['Shadow Bands', 'Los Contactos'], ['Diamond Ring', 'Velvet Umbra'], ['Baily\'s Beads', 'The Corona Kids'], ['Second Contact', 'Nova Static']] },
  { name: 'Radio Azimuth 101', host: 'Latin brass, all afternoon', bpm: 122, root: 48, scale: [0, 2, 4, 7, 9, 12, 14], bass: [0, 7, 0, 7, 5, 9, 5, 7], wave: 'triangle', leadEvery: 1,
    tracks: [['Mambo del Mediodía', 'Orquesta Solsticio'], ['Cumbia Corona', 'Los Hermanos Ríos'], ['Trompeta de Oro', 'Banda Azimut']] },
  { name: 'Umbra After Hours', host: 'Slow grooves for the dark', bpm: 84, root: 41, scale: [0, 3, 7, 10, 12, 14, 15], bass: [0, 0, 0, 3, 5, 5, 5, 7], wave: 'square', leadEvery: 4,
    tracks: [['Two Minutes of Night', 'Moth & Lantern'], ['Low Tide, No Moon', 'Saros Quiet Club'], ['Kill the Lights', 'Ines del Mar']] },
  { name: 'Radio off', host: '', bpm: 0 },
];

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

  /** The song on air at `seconds` of game time: each runs two and a half minutes, then the next in the rotation. */
  nowPlaying(seconds) {
    const station = this.current();
    if (!station) return null;
    const index = Math.floor(seconds / 150 + this.station) % station.tracks.length;
    const [title, artist] = station.tracks[index];
    return { station: station.name, title, artist };
  }

  /** Tune to the next station; returns it for the HUD. */
  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
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
    while (this.nextTime < this.context.currentTime + 0.25) {
      const step = this.step % 64;
      const bar = Math.floor(step / 8) % 8;
      if (step % 4 === 0) this.drum(this.nextTime, true);
      if (step % 2 === 1) this.drum(this.nextTime, false);
      if (step % 2 === 0) this.note(station.root - 12 + station.bass[bar], this.nextTime, sixteenth * 1.8, 0.2, 'triangle');
      if (step % station.leadEvery === 0 && this.random() < 0.62) {
        const degree = station.scale[Math.floor(this.random() * station.scale.length)];
        this.note(station.root + 12 + degree + station.bass[bar] % 5, this.nextTime, sixteenth * (1 + Math.floor(this.random() * 3)), 0.07, station.wave);
      }
      if (step % 16 === 0) for (const third of [0, 3, 7]) this.note(station.root + station.bass[bar] + third, this.nextTime, sixteenth * 14, 0.035, 'sawtooth');
      this.nextTime += sixteenth;
      this.step += 1;
    }
  }
}
