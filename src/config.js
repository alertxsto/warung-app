// ─── OpenRouter / AI Config ──────────────────────────────────────────────────
// Dapatkan API key di: https://openrouter.ai/keys

export const AI_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
export const AI_MODEL   = process.env.EXPO_PUBLIC_AI_MODEL || 'poolside/laguna-m.1:free';
export const AI_URL     = 'https://openrouter.ai/api/v1/chat/completions';
