/**
 * Voice Service — Modular Speech-to-Text and Text-to-Speech Provider
 *
 * Provides an abstracted interface for browser speech recognition and synthesis.
 * Built to be easily swapped with external providers (e.g., Whisper, Google Cloud Speech,
 * ElevenLabs) without rewriting the consumer components.
 *
 * Key design rules:
 *  - onFinal fires EXACTLY ONCE per session, either from onresult (when a final
 *    result is delivered inline) or from onend (when recognition ends with leftover
 *    interim/final text that was never delivered as a final result).
 *  - onEnd fires after onFinal (or on its own if there was nothing to report).
 *  - The start() wrapper never calls onStart() — onstart handles that to avoid
 *    duplicate React state updates.
 */

class VoiceService {
  constructor() {
    this._muted = localStorage.getItem('voice_assistant_muted') === 'true';
    this._customProvider = null;
    this._currentUtterance = null;
  }

  /** Set a custom speech provider to replace the Web Speech API. */
  setCustomProvider(provider) {
    this._customProvider = provider;
  }

  /** Returns true if speech recognition is available in the current browser. */
  isSpeechRecognitionSupported() {
    if (this._customProvider) {
      return Boolean(this._customProvider.isSupported?.());
    }
    return Boolean(
      typeof window !== 'undefined' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }

  /** Returns true if the browser supports speech synthesis (TTS). */
  isSpeechSynthesisSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Create an isolated speech recognition session.
   *
   * @param {Object} opts
   * @param {() => void}               opts.onStart      — fired when recording begins
   * @param {({transcript, isFinal}) => void} opts.onTranscript — fired with live interim text
   * @param {(text: string) => void}   opts.onFinal      — fired exactly once with the final text
   * @param {({code, message}) => void} opts.onError     — fired on recognition error
   * @param {() => void}               opts.onEnd        — fired when session terminates
   * @param {string}                   [opts.lang]       — BCP-47 language tag (default en-IN)
   * @param {boolean}                  [opts.continuous] — keep listening (default false)
   */
  createRecognitionSession({
    onStart,
    onTranscript,
    onFinal,
    onError,
    onEnd,
    lang = 'en-IN',
    continuous = false,
  } = {}) {
    // Delegate to custom provider if set
    if (this._customProvider?.createSession) {
      return this._customProvider.createSession({
        onStart, onTranscript, onFinal, onError, onEnd, lang,
      });
    }

    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    // Graceful degradation for unsupported browsers
    if (!SpeechRecognition) {
      return {
        start: () => {
          onError?.({
            code: 'unsupported',
            message: 'Speech recognition is not supported in this browser.',
          });
        },
        stop: () => {},
        abort: () => {},
      };
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = lang || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

    // Session-level state
    let finalTranscript = '';   // accumulated final segments
    let latestTranscript = '';  // last known text (final + interim)
    let finalFired = false;     // guard: onFinal called at most once
    let sessionEnded = false;   // guard: onEnd called at most once
    let errorFired = false;     // true if an error terminated the session early

    const fireFinal = (text) => {
      if (finalFired) return;
      finalFired = true;
      const trimmed = (text || '').trim();
      if (trimmed) {
        onFinal?.(trimmed);
      }
    };

    const fireEnd = () => {
      if (sessionEnded) return;
      sessionEnded = true;
      onEnd?.();
    };

    recognition.onstart = () => {
      finalTranscript = '';
      latestTranscript = '';
      finalFired = false;
      sessionEnded = false;
      errorFired = false;
      onStart?.();
    };

    let silenceTimer = null;

    recognition.onresult = (event) => {
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript || '';
        if (item.isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + text.trim();
        } else {
          interim += text;
        }
      }

      const combined = (finalTranscript + (interim ? ' ' + interim : '')).trim();
      latestTranscript = combined;

      onTranscript?.({
        transcript: combined,
        isFinal: Boolean(event.results[event.results.length - 1]?.isFinal),
      });

      // Clear any prior silence timer
      if (silenceTimer) clearTimeout(silenceTimer);

      // Fast, responsive finalization:
      // If speech text is detected (either final or interim), trigger finalization as soon
      // as the user pauses speaking (natural pause threshold: 280ms for final, 480ms for interim).
      if (combined) {
        const hasFinal = Boolean(finalTranscript);
        const pauseDelay = hasFinal ? 280 : 480;

        silenceTimer = setTimeout(() => {
          fireFinal(finalTranscript || combined);
          try { recognition.stop(); } catch { /* ignore */ }
        }, pauseDelay);
      }
    };

    recognition.onerror = (event) => {
      const errType = event.error || 'unknown';

      // 'aborted' is a normal stop (programmatic or user) — not an error
      if (errType === 'aborted') {
        if (silenceTimer) clearTimeout(silenceTimer);
        fireEnd();
        return;
      }

      // 'no-speech' — session ended with nothing spoken; report to callback without killing UI
      if (errType === 'no-speech') {
        errorFired = true;
        if (silenceTimer) clearTimeout(silenceTimer);
        onError?.({ code: 'no_speech', message: 'No speech was detected.' });
        fireEnd();
        return;
      }

      let message = 'An error occurred during speech recognition.';
      let code = errType;

      switch (errType) {
        case 'not-allowed':
        case 'service-not-allowed':
          code = 'permission_denied';
          message = 'Microphone permission was denied. Please allow microphone access in browser settings.';
          break;
        case 'network':
          code = 'network';
          message = 'Network error while contacting speech service. Check your connection.';
          break;
        case 'audio-capture':
          code = 'audio_capture';
          message = 'No microphone was found or it is busy. Check your audio input device.';
          break;
        default:
          message = `Voice recognition error: ${errType}`;
      }

      errorFired = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      onError?.({ code, message, originalError: event });
    };

    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      // Only fire onFinal from onend if the inline onresult handler didn't already
      if (!finalFired && !errorFired) {
        const text = (finalTranscript || latestTranscript || '').trim();
        if (text) {
          fireFinal(text);
        }
      }
      fireEnd();
    };

    return {
      start: () => {
        try {
          recognition.start();
        } catch (e) {
          if (e.name !== 'InvalidStateError') {
            onError?.({ code: 'start_failed', message: e.message });
          }
        }
      },
      stop: () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        const text = (finalTranscript || latestTranscript || '').trim();
        if (text && !finalFired) {
          fireFinal(text);
        }
        try { recognition.stop(); } catch { /* ignore */ }
      },
      abort: () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        try { recognition.abort(); } catch { /* ignore */ }
      },
    };
  }

  /**
   * Speak text via SpeechSynthesis (TTS).
   * Sanitizes markdown, converts ₹ to "rupees", and picks a natural English voice.
   */
  speak(text, { onStart, onEnd, pitch = 1, rate = 0.95 } = {}) {
    if (this._muted || !this.isSpeechSynthesisSupported() || !text) return;

    try {
      window.speechSynthesis.cancel();

      const cleanText = text
        .replace(/[*_#`~[\]()]/g, '')
        .replace(/[₹]/g, 'rupees ')
        .replace(/\bRs\.?\s*(\d+)/gi, '$1 rupees')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.pitch = pitch;
      utterance.rate = rate;
      utterance.lang = 'en-US';

      const voices = window.speechSynthesis.getVoices?.() || [];
      const naturalVoice =
        voices.find(
          (v) =>
            (v.name.includes('Google') ||
              v.name.includes('Natural') ||
              v.name.includes('Samantha')) &&
            v.lang.startsWith('en')
        ) || voices.find((v) => v.lang.startsWith('en'));

      if (naturalVoice) utterance.voice = naturalVoice;
      if (onStart) utterance.onstart = onStart;
      if (onEnd) utterance.onend = onEnd;

      this._currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[VoiceService] Speech synthesis failed:', e);
    }
  }

  /** Stop any in-progress TTS playback. */
  stopSpeaking() {
    if (this.isSpeechSynthesisSupported()) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }

  isMuted() { return this._muted; }

  setMuted(muted) {
    this._muted = Boolean(muted);
    localStorage.setItem('voice_assistant_muted', this._muted ? 'true' : 'false');
    if (this._muted) this.stopSpeaking();
    return this._muted;
  }
}

export const voiceService = new VoiceService();
export default voiceService;
