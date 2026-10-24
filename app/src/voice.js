// Voice: the arm speaks through the server (ElevenLabs when app/.env has its key, Gemini TTS otherwise, the
// browser's own voice as the last resort), and listens with the browser's speech recognition (no key).

let playing = null;

export async function say(text, { voice } = {}) {
  try {
    const r = await fetch("./api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
    if (r.status === 200) {
      const url = URL.createObjectURL(await r.blob());
      if (playing) playing.pause();
      playing = new Audio(url);
      playing.addEventListener("ended", () => URL.revokeObjectURL(url));
      await playing.play();
      return;
    }
  } catch (e) {}
  if ("speechSynthesis" in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "en-GB"; speechSynthesis.speak(u); }
}

export function canListen() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

// Browser speech-to-text. onResult(text) while speaking, onEnd(finalText) when it stops.
export function listen({ onResult, onEnd } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) throw new Error("Speech input needs Chrome");
  const rec = new SR();
  rec.lang = "en-GB"; rec.interimResults = true; rec.continuous = false;
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t; else interim += t;
    }
    onResult && onResult(finalText + interim);
  };
  rec.onend = () => onEnd && onEnd(finalText.trim());
  rec.start();
  return { stop: () => rec.stop() };
}
