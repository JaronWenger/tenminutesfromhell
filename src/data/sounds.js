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

const makeCtx = () => new (window.AudioContext || window.webkitAudioContext)();

export const SOUNDS = [
  // Row 1
  {
    id: 'ping',
    name: 'Ping',
    play: () => { try { const c = makeCtx(); tone(c, 880, 0, 0.15); setTimeout(() => c.close(), 400); } catch(e){} }
  },
  {
    id: 'chime',
    name: 'Chime',
    play: () => { try { const c = makeCtx(); tone(c, 440, 0, 0.35, 'sine', 0.25); setTimeout(() => c.close(), 600); } catch(e){} }
  },
  // Row 2
  {
    id: 'beep',
    name: 'Beep',
    play: () => { try { const c = makeCtx(); tone(c, 660, 0, 0.1, 'square', 0.2); setTimeout(() => c.close(), 400); } catch(e){} }
  },
  {
    id: 'bell',
    name: 'Bell',
    play: () => { try { const c = makeCtx(); tone(c, 523, 0, 0.6, 'sine', 0.28); setTimeout(() => c.close(), 800); } catch(e){} }
  },
  // Row 3
  {
    id: 'rise',
    name: 'Rise',
    play: () => { try { const c = makeCtx(); tone(c, 200, 0, 0.4, 'sine', 0.28, 1200); setTimeout(() => c.close(), 700); } catch(e){} }
  },
  {
    id: 'drop',
    name: 'Drop',
    play: () => { try { const c = makeCtx(); tone(c, 440, 0, 0.35, 'sine', 0.3, 110); setTimeout(() => c.close(), 600); } catch(e){} }
  },
  // Row 4 — PRO
  {
    id: 'chirp',
    pro: true,
    name: 'Chirp',
    play: () => { try { const c = makeCtx(); tone(c, 300, 0, 0.15, 'sine', 0.3, 900); setTimeout(() => c.close(), 400); } catch(e){} }
  },
  {
    id: 'whoosh',
    pro: true,
    name: 'Whoosh',
    play: () => { try { const c = makeCtx(); tone(c, 800, 0, 0.3, 'sine', 0.25, 180); setTimeout(() => c.close(), 600); } catch(e){} }
  },
  // Row 5
  {
    id: 'coin',
    pro: true,
    name: 'Coin',
    play: () => { try { const c = makeCtx(); tone(c, 987, 0, 0.08, 'sine', 0.3); tone(c, 1318, 0.09, 0.18, 'sine', 0.3); setTimeout(() => c.close(), 600); } catch(e){} }
  },
  {
    id: 'power',
    pro: true,
    name: 'Power Up',
    play: () => { try { const c = makeCtx(); tone(c, 392, 0, 0.1, 'sine', 0.25); tone(c, 523, 0.1, 0.1, 'sine', 0.25); tone(c, 659, 0.2, 0.1, 'sine', 0.25); tone(c, 784, 0.3, 0.2, 'sine', 0.28); setTimeout(() => c.close(), 800); } catch(e){} }
  },
  // Row 6
  {
    id: 'alert',
    pro: true,
    name: 'Alert',
    play: () => { try { const c = makeCtx(); tone(c, 880, 0, 0.1, 'sine', 0.28); tone(c, 660, 0.15, 0.1, 'sine', 0.28); tone(c, 880, 0.3, 0.1, 'sine', 0.28); setTimeout(() => c.close(), 700); } catch(e){} }
  },
  {
    id: 'pulse',
    pro: true,
    name: 'Pulse',
    play: () => { try { const c = makeCtx(); tone(c, 760, 0, 0.1, 'sine', 0.3); tone(c, 760, 0.14, 0.1, 'sine', 0.3); setTimeout(() => c.close(), 500); } catch(e){} }
  },
  // Row 7
  {
    id: 'blip',
    pro: true,
    name: 'Blip',
    play: () => { try { const c = makeCtx(); tone(c, 1047, 0, 0.07, 'sine', 0.3); setTimeout(() => c.close(), 300); } catch(e){} }
  },
  {
    id: 'tap',
    pro: true,
    name: 'Tap',
    play: () => { try { const c = makeCtx(); tone(c, 1400, 0, 0.05, 'sine', 0.3); setTimeout(() => c.close(), 300); } catch(e){} }
  },
  // Row 8
  {
    id: 'zap',
    pro: true,
    name: 'Zap',
    play: () => { try { const c = makeCtx(); tone(c, 1000, 0, 0.18, 'sawtooth', 0.22, 80); setTimeout(() => c.close(), 400); } catch(e){} }
  },
  {
    id: 'buzz',
    pro: true,
    name: 'Buzz',
    play: () => { try { const c = makeCtx(); tone(c, 180, 0, 0.2, 'sawtooth', 0.2); setTimeout(() => c.close(), 500); } catch(e){} }
  },
  // Row 9
  {
    id: 'glass',
    pro: true,
    name: 'Glass',
    play: () => {
      try {
        const c = makeCtx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain); gain.connect(c.destination);
        osc.type = 'sine'; osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0.001, c.currentTime);
        gain.gain.linearRampToValueAtTime(0.22, c.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.7);
        osc.start(c.currentTime); osc.stop(c.currentTime + 0.7);
        osc.onended = () => c.close();
      } catch(e){}
    }
  },
  {
    id: 'thud',
    pro: true,
    name: 'Thud',
    play: () => { try { const c = makeCtx(); tone(c, 80, 0, 0.25, 'sine', 0.5, 40); setTimeout(() => c.close(), 500); } catch(e){} }
  },
  // Row 10
  {
    id: 'synth',
    pro: true,
    name: 'Synth',
    play: () => {
      try {
        const c = makeCtx();
        tone(c, 440, 0, 0.25, 'sine', 0.2);
        tone(c, 443, 0, 0.25, 'triangle', 0.15);
        setTimeout(() => c.close(), 600);
      } catch(e){}
    }
  },
  {
    id: 'soft',
    pro: true,
    name: 'Soft',
    play: () => { try { const c = makeCtx(); tone(c, 350, 0, 0.5, 'sine', 0.18); setTimeout(() => c.close(), 800); } catch(e){} }
  },
];

export const DEFAULT_ACTIVE_SOUND = 'ping';
export const DEFAULT_REST_SOUND = 'chime';

export const playTone = (frequency, duration, type = 'sine', freqEnd, volume = 0.3) => {
  try {
    const c = makeCtx();
    tone(c, frequency, 0, duration, type, volume, freqEnd);
    setTimeout(() => c.close(), (duration + 0.3) * 1000);
  } catch(e) {}
};
