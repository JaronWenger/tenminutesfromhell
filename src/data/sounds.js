const tone = (ctx, freq, start, duration, type = 'sine', vol = 0.3, freqEnd) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + start + duration);
  }
  gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
};

// Singleton AudioContext
let _ctx = null;

const getCtx = () => {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _ctx;
};

// Resume the context and schedule audio synchronously in the same call.
// iOS/Chrome require audio scheduling to happen in the same synchronous
// execution as resume() — using .then() breaks mobile browsers.
const withCtx = (fn) => {
  try {
    const c = getCtx();
    if (c.state === 'suspended') c.resume(); // fire-and-forget — iOS processes before next audio render
    fn(c); // schedule immediately in the same sync block
  } catch(e) {}
};

// Call this on any user gesture to pre-warm the context for auto-fired sounds later.
export const unlockAudio = () => {
  withCtx((c) => {
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  });
};

export const SOUNDS = [
  // Row 1
  {
    id: 'ping',
    name: 'Ping',
    play: () => withCtx(c => tone(c, 880, 0, 0.15))
  },
  {
    id: 'chime',
    name: 'Chime',
    play: () => withCtx(c => tone(c, 440, 0, 0.35, 'sine', 0.25))
  },
  // Row 2
  {
    id: 'beep',
    name: 'Beep',
    play: () => withCtx(c => tone(c, 660, 0, 0.1, 'square', 0.2))
  },
  {
    id: 'bell',
    name: 'Bell',
    play: () => withCtx(c => tone(c, 523, 0, 0.6, 'sine', 0.28))
  },
  // Row 3
  {
    id: 'rise',
    name: 'Rise',
    play: () => withCtx(c => tone(c, 200, 0, 0.4, 'sine', 0.28, 1200))
  },
  {
    id: 'drop',
    name: 'Drop',
    play: () => withCtx(c => tone(c, 440, 0, 0.35, 'sine', 0.3, 110))
  },
  // Row 4 — PRO
  {
    id: 'chirp',
    pro: true,
    name: 'Chirp',
    play: () => withCtx(c => tone(c, 300, 0, 0.15, 'sine', 0.3, 900))
  },
  {
    id: 'whoosh',
    pro: true,
    name: 'Whoosh',
    play: () => withCtx(c => tone(c, 800, 0, 0.3, 'sine', 0.25, 180))
  },
  // Row 5
  {
    id: 'coin',
    pro: true,
    name: 'Coin',
    play: () => withCtx(c => { tone(c, 987, 0, 0.08, 'sine', 0.3); tone(c, 1318, 0.09, 0.18, 'sine', 0.3); })
  },
  {
    id: 'power',
    pro: true,
    name: 'Power Up',
    play: () => withCtx(c => { tone(c, 392, 0, 0.1, 'sine', 0.25); tone(c, 523, 0.1, 0.1, 'sine', 0.25); tone(c, 659, 0.2, 0.1, 'sine', 0.25); tone(c, 784, 0.3, 0.2, 'sine', 0.28); })
  },
  // Row 6
  {
    id: 'alert',
    pro: true,
    name: 'Alert',
    play: () => withCtx(c => { tone(c, 880, 0, 0.1, 'sine', 0.28); tone(c, 660, 0.15, 0.1, 'sine', 0.28); tone(c, 880, 0.3, 0.1, 'sine', 0.28); })
  },
  {
    id: 'pulse',
    pro: true,
    name: 'Pulse',
    play: () => withCtx(c => { tone(c, 760, 0, 0.1, 'sine', 0.3); tone(c, 760, 0.14, 0.1, 'sine', 0.3); })
  },
  // Row 7
  {
    id: 'blip',
    pro: true,
    name: 'Blip',
    play: () => withCtx(c => tone(c, 1047, 0, 0.07, 'sine', 0.3))
  },
  {
    id: 'tap',
    pro: true,
    name: 'Tap',
    play: () => withCtx(c => tone(c, 1400, 0, 0.05, 'sine', 0.3))
  },
  // Row 8
  {
    id: 'zap',
    pro: true,
    name: 'Zap',
    play: () => withCtx(c => tone(c, 1000, 0, 0.18, 'sawtooth', 0.22, 80))
  },
  {
    id: 'buzz',
    pro: true,
    name: 'Buzz',
    play: () => withCtx(c => tone(c, 180, 0, 0.2, 'sawtooth', 0.2))
  },
  // Row 9
  {
    id: 'glass',
    pro: true,
    name: 'Glass',
    play: () => withCtx(c => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = 'sine'; osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.001, c.currentTime);
      gain.gain.linearRampToValueAtTime(0.22, c.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.7);
      osc.start(c.currentTime); osc.stop(c.currentTime + 0.7);
    })
  },
  {
    id: 'thud',
    pro: true,
    name: 'Thud',
    play: () => withCtx(c => tone(c, 80, 0, 0.25, 'sine', 0.5, 40))
  },
  // Row 10
  {
    id: 'synth',
    pro: true,
    name: 'Synth',
    play: () => withCtx(c => { tone(c, 440, 0, 0.25, 'sine', 0.2); tone(c, 443, 0, 0.25, 'triangle', 0.15); })
  },
  {
    id: 'soft',
    pro: true,
    name: 'Soft',
    play: () => withCtx(c => tone(c, 350, 0, 0.5, 'sine', 0.18))
  },
];

export const DEFAULT_ACTIVE_SOUND = 'ping';
export const DEFAULT_REST_SOUND = 'chime';

export const playTone = (frequency, duration, type = 'sine', freqEnd, volume = 0.3) => {
  withCtx(c => tone(c, frequency, 0, duration, type, volume, freqEnd));
};
