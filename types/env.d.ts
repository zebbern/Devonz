/**
 * Global Env type declaration for server environment variables.
 * 
 * This type represents environment bindings that may come from:
 * - Cloudflare Workers (context.cloudflare.env)
 * - Node.js process.env
 * - Vite import.meta.env
 * 
 * It's declared globally to avoid import/export issues across the codebase.
 */
declare global {
  /**
   * Server environment variables interface.
   * Extends Record<string, string | undefined> for flexibility with various env sources.
   */
  interface Env extends Record<string, string | undefined> {
    // Common API keys that may be present
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    GOOGLE_GENERATIVE_AI_API_KEY?: string;
    GROQ_API_KEY?: string;
    HUGGINGFACE_API_KEY?: string;
    MISTRAL_API_KEY?: string;
    COHERE_API_KEY?: string;
    DEEPSEEK_API_KEY?: string;
    XAI_API_KEY?: string;
    TOGETHER_API_KEY?: string;
    PERPLEXITY_API_KEY?: string;
    OPEN_ROUTER_API_KEY?: string;
    GITHUB_API_KEY?: string;
    AWS_ACCESS_KEY_ID?: string;
    AWS_SECRET_ACCESS_KEY?: string;
    AWS_REGION?: string;
    
    // Base URLs for self-hosted models
    OLLAMA_API_BASE_URL?: string;
    LMSTUDIO_API_BASE_URL?: string;
    OPENAI_LIKE_API_BASE_URL?: string;
    OPENAI_LIKE_API_KEY?: string;
    
    // Other common env vars
    NODE_ENV?: string;
  }
}

export {};
