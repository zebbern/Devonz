# Devonz

Devonz is an AI-powered development agent that helps you build full-stack applications through natural language conversation. Originally built upon [bolt.diy](https://github.com/stackblitz-labs/bolt.diy), Devonz focuses on speed, efficiency, and a streamlined development experience.

![Devonz Screenshot](https://github.com/user-attachments/assets/e4c3067d-2539-4b5e-abab-d129d90b51dc)

---

## Table of Contents

| Section                                 | Description                        |
| --------------------------------------- | ---------------------------------- |
| [Key Features](#key-features)           | Core capabilities and highlights   |
| [Tech Stack](#tech-stack)               | Technologies used in the project   |
| [Installation](#installation)           | Getting started guide              |
| [Configuration](#configuration)         | Environment variables and settings |
| [AI Providers](#supported-ai-providers) | All supported AI providers         |
| [Project Structure](#project-structure) | Codebase organization              |
| [Available Scripts](#available-scripts) | Development and build commands     |
| [Settings](#settings--features)         | App settings and features          |
| [Contributing](#contributing)           | How to contribute                  |

---

## Key Features

### AI-Powered Development

| Feature                      | Description                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Natural Language Building    | Describe what you want to build, and Devonz creates it                       |
| Multi-Provider Support       | 19+ AI providers including OpenAI, Anthropic, Google, Groq, Ollama, and more |
| Model Context Protocol (MCP) | Extend Devonz capabilities with MCP tools                                    |
| Auto-Fix                     | Automatic error detection and fixing with terminal error detector            |

### Development Environment

| Feature                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| In-Browser Development | Full development environment powered by WebContainers |
| Real-time Preview      | Instant preview of your applications                  |
| Terminal Access        | Full terminal access within the browser               |
| Code Editor            | Integrated CodeMirror editor with syntax highlighting |

### Deployment Options

| Platform | Description                          |
| -------- | ------------------------------------ |
| GitHub   | Push directly to GitHub repositories |
| GitLab   | Deploy to GitLab projects            |
| Netlify  | One-click deployment to Netlify      |
| Vercel   | Deploy to Vercel with ease           |

### Integrations

| Integration      | Description                                |
| ---------------- | ------------------------------------------ |
| Supabase         | Database and authentication integration    |
| Git              | Built-in Git support for version control   |
| Template Gallery | Pre-built templates for popular frameworks |

---

## Tech Stack

| Category      | Technology                                                |
| ------------- | --------------------------------------------------------- |
| Framework     | [Remix](https://remix.run/) + [Vite](https://vitejs.dev/) |
| Language      | TypeScript                                                |
| Styling       | UnoCSS + Tailwind CSS                                     |
| UI Components | Radix UI, Headless UI                                     |
| Animation     | Framer Motion                                             |
| AI SDK        | Vercel AI SDK                                             |
| Editor        | CodeMirror                                                |
| Terminal      | xterm.js                                                  |
| WebContainers | StackBlitz WebContainer API                               |

---

## Installation

### Prerequisites

| Requirement | Version              |
| ----------- | -------------------- |
| Node.js     | 18.18.0 or higher    |
| pnpm        | Latest (recommended) |

### Quick Start

1. **Clone the Repository**:

   ```bash
   git clone -b stable https://github.com/zebbern/Devonz.git
   cd Devonz
   ```

2. **Install Dependencies**:

   ```bash
   pnpm install
   ```

3. **Start Development Server**:

   ```bash
   pnpm run dev
   ```

4. **Open in Browser**: Navigate to `http://localhost:5173`

---

## Configuration

### Environment Variables

Create a `.env.local` file in the project root:

```bash
# AI Provider API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key
GROQ_API_KEY=your_groq_key

# Local Provider URLs
OLLAMA_BASE_URL=http://127.0.0.1:11434
LMSTUDIO_BASE_URL=http://127.0.0.1:1234

# Deployment Integrations (Optional)
GITHUB_ACCESS_TOKEN=your_github_token
NETLIFY_AUTH_TOKEN=your_netlify_token
VERCEL_ACCESS_TOKEN=your_vercel_token
```

### In-App Configuration

1. Click the **Settings icon** in the sidebar
2. Navigate to **Providers** tab
3. Configure your preferred AI providers:
   - **Cloud Providers**: OpenAI, Anthropic, Google, Groq, OpenRouter, etc.
   - **Local Providers**: Ollama, LM Studio, OpenAI-compatible endpoints

---

## Supported AI Providers

### Cloud Providers

| Provider       | Models                           | Features          |
| -------------- | -------------------------------- | ----------------- |
| OpenAI         | GPT-4o, GPT-4 Turbo, GPT-3.5     | Chat, Vision      |
| Anthropic      | Claude 3.5 Sonnet, Claude 3 Opus | Chat, Vision      |
| Google         | Gemini Pro, Gemini Ultra         | Chat, Vision      |
| Groq           | LLaMA 3, Mixtral                 | Fast inference    |
| OpenRouter     | 100+ models                      | Model aggregation |
| Mistral        | Mistral Large, Codestral         | Chat, Code        |
| Cohere         | Command R+                       | Chat, RAG         |
| Deepseek       | Deepseek Coder                   | Code generation   |
| Amazon Bedrock | Claude, Titan                    | Enterprise        |
| Together       | Open source models               | Chat, Code        |
| Perplexity     | Online models                    | Web search        |
| HuggingFace    | Open source models               | Community models  |
| xAI            | Grok                             | Chat              |

### Local Providers

| Provider    | Description                                          |
| ----------- | ---------------------------------------------------- |
| Ollama      | Run open-source models locally with model management |
| LM Studio   | Local model inference with GUI                       |
| OpenAI-like | Any OpenAI-compatible API endpoint                   |

---

## Project Structure

```
bolt.diy/
├── app/
│   ├── components/         # React components
│   │   ├── @settings/      # Settings panel components
│   │   ├── chat/           # Chat interface
│   │   ├── deploy/         # Deployment components
│   │   ├── editor/         # Code editor
│   │   ├── git/            # Git integration
│   │   ├── header/         # App header
│   │   ├── sidebar/        # Sidebar navigation
│   │   ├── ui/             # Shared UI components
│   │   └── workbench/      # Development workbench
│   ├── lib/                # Core libraries
│   │   ├── hooks/          # React hooks
│   │   ├── modules/        # Feature modules
│   │   ├── services/       # API services
│   │   ├── stores/         # State management (nanostores)
│   │   └── utils/          # Utility functions
│   ├── routes/             # Remix routes & API endpoints
│   ├── styles/             # Global styles
│   └── types/              # TypeScript types
├── electron/               # Electron desktop app
├── public/                 # Static assets
├── scripts/                # Build scripts
└── supabase/               # Supabase configuration
```

---

## Available Scripts

### Development

| Command            | Description               |
| ------------------ | ------------------------- |
| `pnpm run dev`     | Start development server  |
| `pnpm run build`   | Build for production      |
| `pnpm run start`   | Run production build      |
| `pnpm run preview` | Build and preview locally |

### Testing & Quality

| Command              | Description              |
| -------------------- | ------------------------ |
| `pnpm test`          | Run tests                |
| `pnpm test:watch`    | Run tests in watch mode  |
| `pnpm run typecheck` | TypeScript type checking |
| `pnpm run lint`      | ESLint check             |
| `pnpm run lint:fix`  | Auto-fix linting issues  |

### Electron Desktop App

| Command                     | Description                   |
| --------------------------- | ----------------------------- |
| `pnpm electron:dev`         | Start Electron in development |
| `pnpm electron:build:mac`   | Build for macOS               |
| `pnpm electron:build:win`   | Build for Windows             |
| `pnpm electron:build:linux` | Build for Linux               |
| `pnpm electron:build:dist`  | Build for all platforms       |

### Utilities

| Command            | Description            |
| ------------------ | ---------------------- |
| `pnpm run clean`   | Clean build artifacts  |
| `pnpm run prepare` | Set up husky git hooks |

---

## Settings & Features

### Settings Tabs

| Tab            | Description                  |
| -------------- | ---------------------------- |
| Profile        | User profile management      |
| Providers      | AI provider configuration    |
| Features       | Enable/disable features      |
| MCP            | Model Context Protocol tools |
| GitHub         | GitHub integration settings  |
| GitLab         | GitLab integration settings  |
| Netlify        | Netlify deployment settings  |
| Vercel         | Vercel deployment settings   |
| Supabase       | Database integration         |
| Event Logs     | Application logs             |
| Data           | Import/export data           |
| Notifications  | Notification preferences     |
| Project Memory | Project context storage      |

### MCP (Model Context Protocol)

Devonz supports MCP tools for extending AI capabilities:

| Feature            | Description                                |
| ------------------ | ------------------------------------------ |
| Custom MCP Servers | Configure custom MCP servers               |
| Specialized Tools  | Add specialized tools for your workflow    |
| External Services  | Extend AI reasoning with external services |

---

## Updating

### Git-based Updates

```bash
# Save local changes
git stash

# Pull latest updates
git pull

# Update dependencies
pnpm install

# Restore local changes
git stash pop
```

### Clean Install

```bash
# Remove dependencies
rm -rf node_modules pnpm-lock.yaml

# Clear cache
pnpm store prune

# Reinstall
pnpm install
```

---

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## Acknowledgments

| Credit                                                  | Description                        |
| ------------------------------------------------------- | ---------------------------------- |
| [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) | Original project foundation        |
| [StackBlitz WebContainers](https://webcontainers.io/)   | In-browser development environment |
| [Vercel AI SDK](https://sdk.vercel.ai/)                 | AI capabilities                    |

---

## Links

| Link             | URL                                                                    |
| ---------------- | ---------------------------------------------------------------------- |
| Repository       | [https://github.com/zebbern/Devonz](https://github.com/zebbern/Devonz) |
| Original Project | [bolt.diy](https://github.com/stackblitz-labs/bolt.diy)                |

---

<div align="center">
  <strong>Build anything with AI. Just describe what you want.</strong>
</div>
