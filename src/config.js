// ─── Groq API Config ────────────────────────────────────────────────────────
// Dapatkan API key di: https://console.groq.com/keys

export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

// Model tersedia di Groq (April 2025):
// - 'meta-llama/llama-4-scout-17b-16e-instruct'  ← Terbaik (Multilingual + cepat)
// - 'llama-3.3-70b-versatile'                     ← Alternatif (lebih pintar)
export const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
export const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
