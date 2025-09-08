# JARVIS AI Assistant 🚀

**A production-ready, multi-agent AI assistant built on the Cloudflare stack.**

This repository provides a robust foundation for creating sophisticated AI assistants using Cloudflare Workers, Durable Objects, KV, and D1. It implements a multi-agent architecture featuring an orchestrator, reasoning, research, and task agents, all with persistent memory. The entire codebase is written in TypeScript and is now fully documented with JSDoc comments.

## 🏛️ Architecture Overview

The system is designed around a central `APIRouter` that receives requests and, after authentication, passes them to the appropriate `Durable Object`.

- **`AgentOrchestrator` (Durable Object)**: This is the brain of the operation. For each conversation, a unique orchestrator instance is created. It receives chat messages, determines the best agent for the job, and dispatches the task.
- **`ConversationManager` (Durable Object)**: Manages the lifecycle of conversations, including creation, retrieval, and deletion.
- **Agents (`ReasoningAgent`, `ResearchAgent`, `TaskAgent`)**: These are specialized classes that perform the actual work. They are instantiated by the `AgentOrchestrator`.
- **Services (`LLMService`, `SearchService`)**: Abstraction layers for external services like OpenAI, Anthropic, and DuckDuckGo.
- **Memory (`MemoryManager`)**: A hybrid memory system using Cloudflare KV for fast access (caching) and D1 for long-term, persistent storage of conversation history.

## 📂 Project Structure

```bash
jarvis-ai-assistant/
├── package.json
├── wrangler.toml
├── schema.sql
├── README.md
└── src/
    ├── index.ts                # Main worker entry point
    ├── types/env.ts            # TypeScript interfaces for environment and data
    ├── agents/                 # Contains all AI agent classes
    │   ├── orchestrator.ts
    │   ├── reasoning-agent.ts
    │   ├── research-agent.ts
    │   └── task-agent.ts
    ├── memory/                 # Conversation memory management
    │   ├── memory-manager.ts
    │   └── conversation-manager.ts
    ├── services/               # Wrappers for external services (LLMs, Search)
    │   ├── llm-service.ts
    │   └── search-service.ts
    ├── api/                    # API routing
    │   └── router.ts
    └── middleware/             # Request middleware (e.g., authentication)
        └── auth.ts
```

## ⚡️ Features

- **Multi-Agent Orchestration**: Specialized agents for reasoning, research, and task execution.
- **Durable Memory**: Hybrid storage layer using Cloudflare KV and D1 for robust conversation history.
- **Cloudflare-Native**: Built from the ground up for the Cloudflare ecosystem.
- **JWT Authentication**: Secure, pluggable authentication middleware.
- **Multi-Provider LLM Support**: Unified service layer for OpenAI and Anthropic models.
- **Web Search**: Integrated search functionality via DuckDuckGo.
- **Fully Documented**: The entire TypeScript codebase includes comprehensive JSDoc comments.

## 🔑 Requirements

- Cloudflare Wrangler CLI
- A Cloudflare account with Workers, KV, and D1 enabled
- API keys for the services you want to use:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
- A `JWT_SECRET` for signing authentication tokens.

## 🚀 Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/YOUR_ORG/jarvis-ai-assistant.git
    cd jarvis-ai-assistant
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create and bind KV and D1 namespaces in `wrangler.toml`:**
    ```bash
    npx wrangler d1 create jarvis-conversations
    npx wrangler kv:namespace create "MEMORY_KV"
    ```
    *Ensure you copy the output from these commands into your `wrangler.toml` file.*

4.  **Push the database schema:**
    ```bash
    npx wrangler d1 execute jarvis-conversations --file=./schema.sql
    ```

5.  **Set your secrets:**
    ```bash
    npx wrangler secret put OPENAI_API_KEY
    npx wrangler secret put ANTHROPIC_API_KEY
    npx wrangler secret put JWT_SECRET
    ```

6.  **Start the development server:**
    ```bash
    npm run dev
    ```

7.  **Deploy to Cloudflare:**
    ```bash
    npm run deploy
    ```

## 📡 API Endpoints

All endpoints are prefixed with `/api`.

- `POST /api/chat`: Send a message to an agent.
- `POST /api/conversations`: Create a new conversation.
- `GET /api/conversations`: List all conversations for the user.
- `GET /api/conversations/:id`: Fetch a specific conversation's history.
- `DELETE /api/conversations/:id`: Delete a conversation.
- `GET /api/status`: Get the status of the agents.
- `GET /api/health`: Health check for the service.

### Example Chat Request

```bash
curl -X POST "https://YOUR_WORKER_URL/api/chat" \
  -H "Authorization: Bearer <your_jwt>" \
  -H "Content-Type: application/json" \
  --data '{
    "message": "Summarize the latest AI research trends",
    "conversationId": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

## 🧩 Extending the Assistant

This project is designed to be extensible. Here’s how you can add your own functionality:

### Adding a New Agent

1.  **Create the Agent Class**: Create a new file in `src/agents/`, for example, `src/agents/code-agent.ts`. Your new agent class should have a `process` method that accepts an `AgentRequest` and `memory` and returns an `AgentResponse`.

2.  **Integrate with the Orchestrator**:
    - In `src/agents/orchestrator.ts`, import your new agent.
    - Instantiate it in the `AgentOrchestrator` constructor.
    - Update the `selectAgent` method to include logic for when to use your new agent. For example, you could look for keywords like "code" or "script".
    - Add a new case in the `processWithAgent` method to call your agent's `process` method.

### Adding a New Service

1.  **Create the Service Class**: Create a new file in `src/services/`. This class should encapsulate the logic for interacting with an external API.
2.  **Use the Service**: Import and use your new service in the agents that need it. Pass any required API keys from the `Env` object in the constructor.

## 🛡 Security

- **Authentication**: Handled by the `AuthMiddleware` using JWTs. The simplified implementation is suitable for demos but should be replaced with a production-grade library for a real application.
- **Persistence**: Securely handled by Cloudflare's KV and D1 services.
- **Permissions**: The JWT payload includes a `permissions` array, which can be used to implement role-based access control (RBAC).

## 📜 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
