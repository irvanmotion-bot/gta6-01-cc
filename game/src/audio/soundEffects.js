// Every sound is synthesised with Web Audio: engine, tyres, gunshots, crashes, explosions, sirens, horns and UI blips.
import { RadioMusic } from './radioMusic.js';

export class SoundEffects {
  constructor() {
    this.context = null;
    this.volume = 0.8;
    this.radio = new RadioMusic();
  }

  /** Browsers only allow sound after a click or key press; the menus call this on the first one. */
  unlock() {
    if (this.context) { if (this.context.state === 'suspended') this.context.resume(); return; }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.context.destination);
    const length = this.context.sampleRate;
    this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.startEngine();
    this.startSiren();
    this.radio.connect(this.context, this.master);
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.master) this.master.gain.value = volume;
  }

  /** A burst of filtered noise: the body of shots, crashes and explosions. */
  noise(duration, frequency, gain, type = 'lowpass', sweepTo = null) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, now);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, now + duration);
    const amp = this.context.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter).connect(amp).connect(this.master);
    source.start(now, Math.random() * 0.5, duration);
  }

  /** A pitched blip that slides from one frequency to another. */
  tone(from, to, duration, gain, wave = 'sine', delay = 0) {
    if (!this.context) return;
    const now = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), now + duration);
    const amp = this.context.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(amp).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  gunshot(kind, level = 1) {
    if (kind === 'distant') { this.noise(0.16, 1400, 0.22 * level, 'bandpass'); return; }
    if (kind === 'shotgun') { this.noise(0.38, 900, 0.9, 'lowpass', 120); this.tone(160, 40, 0.25, 0.5, 'square'); return; }
    if (kind === 'rifle') { this.noise(0.2, 2600, 0.7, 'lowpass', 300); this.tone(240, 60, 0.12, 0.4, 'square'); return; }
    if (kind === 'smg') { this.noise(0.1, 3200, 0.5, 'lowpass', 500); this.tone(300, 90, 0.07, 0.25, 'square'); return; }
    this.noise(0.16, 2400, 0.6, 'lowpass', 300);
    this.tone(260, 70, 0.1, 0.35, 'square');
  }

  explosion(level = 1) {
    this.noise(1.4, 700, 1.1 * level, 'lowpass', 40);
    this.tone(90, 22, 0.9, 0.8 * level, 'sine');
  }

  crash(level) { this.noise(0.3, 1800, 0.3 + level * 0.6, 'lowpass', 200); this.tone(120, 50, 0.18, 0.3 * level, 'triangle'); }
  thud() { this.tone(110, 45, 0.16, 0.5, 'sine'); this.noise(0.1, 500, 0.3); }
  punch() { this.noise(0.08, 900, 0.4); this.tone(180, 70, 0.08, 0.3, 'triangle'); }
  hurt() { this.tone(300, 130, 0.14, 0.22, 'sawtooth'); }
  click() { this.tone(900, 700, 0.04, 0.12, 'square'); }
  reload() { this.tone(500, 420, 0.05, 0.14, 'square'); this.tone(700, 620, 0.05, 0.14, 'square', 0.5); }
  carDoor() { this.noise(0.09, 600, 0.4); this.tone(140, 80, 0.07, 0.3, 'triangle'); }
  horn() { this.tone(392, 392, 0.4, 0.14, 'square'); this.tone(494, 494, 0.4, 0.12, 'square'); }
  pickup() { this.tone(880, 1320, 0.1, 0.2, 'triangle'); this.tone(1320, 1760, 0.12, 0.18, 'triangle', 0.08); }
  wantedUp() { this.tone(660, 660, 0.09, 0.2, 'square'); this.tone(880, 880, 0.12, 0.2, 'square', 0.11); }
  menuMove() { this.tone(520, 560, 0.05, 0.12, 'triangle'); }
  menuSelect() { this.tone(520, 780, 0.1, 0.16, 'triangle'); }
  checkpoint() { this.tone(660, 990, 0.14, 0.22, 'sine'); }
  cashRegister() { this.tone(1200, 1500, 0.06, 0.18, 'square'); this.tone(1800, 2100, 0.1, 0.14, 'square', 0.07); }

  /** Totality: a long low drone as the light goes, and the gasp of a city full of people looking up. */
  totalityFalls() {
    this.tone(110, 55, 3.2, 0.3, 'sine');
    this.tone(165, 82, 3.2, 0.18, 'triangle', 0.1);
    this.noise(2.4, 1800, 0.22, 'bandpass', 700);
    [523, 659, 784].forEach((note, index) => this.tone(note, note * 1.01, 1.6, 0.07, 'sine', 0.5 + index * 0.18));
  }

  /** The rising fanfare of a passed mission, or the falling one of a failed one. */
  jingle(passed) {
    const notes = passed ? [392, 494, 587, 784, 988] : [392, 330, 262, 196];
    notes.forEach((note, index) => this.tone(note, note, passed ? 0.28 : 0.4, 0.2, 'triangle', index * (passed ? 0.12 : 0.22)));
  }

  startEngine() {
    const ctx = this.context;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineSub = ctx.createOscillator();
    this.engineSub.type = 'square';
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 500;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineSub.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
    this.engineSub.start();
    this.skidSource = ctx.createBufferSource();
    this.skidSource.buffer = this.noiseBuffer;
    this.skidSource.loop = true;
    const skidFilter = ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1700;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    this.skidSource.connect(skidFilter).connect(this.skidGain).connect(this.master);
    this.skidSource.start();
  }

  startSiren() {
    const ctx = this.context;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
  }

  /** Called every frame with what the player is driving and how close the nearest siren is (0 to 1). */
  updateLoops(vehicle, sirenLevel, time, paused) {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (vehicle && !paused) {
      const share = Math.min(Math.abs(vehicle.speed) / vehicle.spec.maxSpeed, 1);
      const gear = (share * 4) % 1;
      const rpm = 55 + gear * 70 + share * 60 + Math.abs(vehicle.throttle) * 14;
      this.engineOsc.frequency.setTargetAtTime(rpm, now, 0.05);
      this.engineSub.frequency.setTargetAtTime(rpm / 2, now, 0.05);
      this.engineFilter.frequency.setTargetAtTime(380 + share * 1500, now, 0.08);
      this.engineGain.gain.setTargetAtTime(0.07 + Math.abs(vehicle.throttle) * 0.05, now, 0.08);
      this.skidGain.gain.setTargetAtTime(vehicle.skidding ? 0.16 : 0, now, 0.05);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.1);
      this.skidGain.gain.setTargetAtTime(0, now, 0.05);
    }
    this.sirenGain.gain.setTargetAtTime(paused ? 0 : sirenLevel * 0.1, now, 0.15);
    this.sirenOsc.frequency.setTargetAtTime(760 + Math.sin(time * 5.2) * 260, now, 0.03);
    this.radio.update(Boolean(vehicle) && !paused);
  }
}
