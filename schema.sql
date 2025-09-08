-- D1 Database Schema for JARVIS AI Assistant

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    recent_interactions TEXT DEFAULT '[]',
    summary TEXT DEFAULT '',
    context TEXT DEFAULT '{}',
    last_updated TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Users table (optional, for user management)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    permissions TEXT DEFAULT '[]',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT,
    metadata TEXT DEFAULT '{}'
);

-- Agent interactions log (for analytics, debugging, auditing)
CREATE TABLE IF NOT EXISTS agent_interactions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    agent_used TEXT NOT NULL,
    request_content TEXT,
    response_content TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id 
  ON conversations (user_id);

CREATE INDEX IF NOT EXISTS idx_agent_interactions_conversation_id 
  ON agent_interactions (conversation_id);

CREATE INDEX IF NOT EXISTS idx_agent_interactions_user_id 
  ON agent_interactions (user_id);
