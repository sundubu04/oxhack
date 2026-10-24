// Voice: ElevenLabs text-to-speech for the arm's spoken feedback, and the browser's own speech
// recognition for talking to it (free, no key). Key + voice from Settings.

export async function speak(text, { key, voice = "JBFqnCBsd6RMkjVDRZzb", model = "eleven_flash_v2_5" } = {}) {
  if (!key) throw new Error("No ElevenLabs key set (Settings).");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.4, similarity_boost: 0.7 } }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await audio.play().catch(() => {});
  audio.addEventListener("ended", () => URL.revokeObjectURL(url));
  return audio;
}

// Browser speech-to-text. Returns a controller with start()/stop(); resolves text via onResult.
export function listen({ onResult, onEnd } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) throw new Error("Speech recognition not available in this browser.");
  const rec = new SR();
  rec.lang = "en-GB"; rec.interimResults = true; rec.continuous = false;
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t; else interim += t;
    }
    onResult && onResult(finalText + interim, !!finalText && !interim);
  };
  rec.onend = () => onEnd && onEnd(finalText.trim());
  rec.start();
  return { stop: () => rec.stop(), abort: () => rec.abort() };
}
