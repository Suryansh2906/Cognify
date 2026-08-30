import { useRef, useState, useCallback, useEffect } from 'react';
import api from '../lib/api';

// Layered TTS: Web Speech API (primary, free) -> backend edge-tts (better voice)
// -> backend ElevenLabs (showcase). Auto-falls back if a browser voice is missing.
export default function useNarration() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const [caption, setCaption] = useState('');
  const [activeVoice, setActiveVoice] = useState('web');

  const audioRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(null);
  const flapRef = useRef(null);
  const endCbRef = useRef(null);
  const watchdogRef = useRef(null);
  const rateRef = useRef(1);

  const pickVoice = (lang) => {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const want = lang === 'hi' ? 'hi' : 'en';
    return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(want));
  };

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (flapRef.current) clearInterval(flapRef.current);
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setAmplitude(0);
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setSpeaking(false);
    setPaused(false);
  }, [cleanup]);

  const finish = useCallback(() => {
    cleanup();
    setSpeaking(false);
    setPaused(false);
    const cb = endCbRef.current;
    endCbRef.current = null;
    if (cb) cb();
  }, [cleanup]);

  const speakWeb = useCallback((text, lang, rate) => {
    const synth = window.speechSynthesis;
    const utter = new SpeechSynthesisUtterance(text);
    const v = pickVoice(lang);
    if (v) utter.voice = v;
    utter.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    utter.rate = rate;
    utter.onboundary = (e) => {
      if (e.name === 'word' || e.charIndex !== undefined) {
        const upto = text.slice(0, e.charIndex + (e.charLength || 8));
        setCaption(upto);
      }
    };
    utter.onend = finish;
    utter.onerror = finish;
    // simulated mouth flap while speaking (web speech gives no amplitude)
    flapRef.current = setInterval(() => {
      setAmplitude(0.35 + Math.random() * 0.6);
    }, 110);
    setActiveVoice('web');
    synth.speak(utter);
  }, [finish]);

  const speakAudio = useCallback(async (text, lang, provider, rate) => {
    const res = await api.post('/tts', { text, lang, provider });
    const { audio_b64, provider: used } = res.data;
    if (!audio_b64) throw new Error('no audio');
    setActiveVoice(used);
    const audio = new Audio(`data:audio/mpeg;base64,${audio_b64}`);
    audio.playbackRate = rate;
    audioRef.current = audio;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = ctxRef.current || new AC();
      ctxRef.current = ctx;
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
        setAmplitude(Math.min(1, Math.sqrt(sum / buf.length) * 3.5));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) { /* analyser optional */ }
    setCaption(text);
    audio.onended = finish;
    await audio.play();
  }, [finish]);

  const speak = useCallback(async (text, opts = {}) => {
    const { lang = 'en', provider = 'web', rate = 1, onEnd = null } = opts;
    cleanup();
    endCbRef.current = onEnd;
    rateRef.current = rate;
    setCaption('');
    setSpeaking(true);
    setPaused(false);
    // Watchdog: guarantee progression even if onend never fires (headless / no voice / blocked autoplay)
    const words = (text || '').split(/\s+/).length;
    const est = Math.max(4000, (words * 360) / rate) + 4000;
    watchdogRef.current = setTimeout(() => finish(), est);
    const hasVoice = provider === 'web' && !!pickVoice(lang);
    try {
      if (provider === 'web' && hasVoice) {
        speakWeb(text, lang, rate);
      } else {
        // no browser voice (common for Hindi) or explicit better-quality provider
        const p = provider === 'web' ? 'edge' : provider;
        await speakAudio(text, lang, p, rate);
      }
    } catch (e) {
      if (window.speechSynthesis) speakWeb(text, lang, rate);
      else finish();
    }
  }, [cleanup, speakWeb, speakAudio, finish]);

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    else if (window.speechSynthesis) window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) audioRef.current.play();
    else if (window.speechSynthesis) window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  return { speak, pause, resume, stop, speaking, paused, amplitude, caption, activeVoice };
}
