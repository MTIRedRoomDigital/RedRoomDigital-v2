-- ============================================
-- RedRoomDigital Database Schema
-- PostgreSQL
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE subscription_tier AS ENUM ('free', 'premium', 'ultimate');
CREATE TYPE chat_context AS ENUM ('within_world', 'multiverse', 'vacuum');
CREATE TYPE message_sender_type AS ENUM ('user', 'ai');
CREATE TYPE kayfabe_report_status AS ENUM ('pending', 'reviewed', 'upheld', 'dismissed');
CREATE TYPE quest_status AS ENUM ('draft', 'active', 'completed', 'archived');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE ai_transcript_status AS ENUM ('pending_review', 'accepted', 'rejected');

-- ============================================
-- USERS
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    role user_role DEFAULT 'user',
    subscription subscription_tier DEFAULT 'free',
    subscription_expires_at TIMESTAMPTZ,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    kayfabe_strikes INTEGER DEFAULT 0,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- WORLDS (before characters, since characters reference worlds)
-- ============================================

CREATE TABLE worlds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    lore TEXT,           -- Detailed world lore for AI context
    rules JSONB DEFAULT '{}',
    -- Example: { "magic_system": "elemental", "technology_level": "medieval", "custom_rules": [...] }

    setting TEXT,        -- Short setting description
    banner_url TEXT,
    thumbnail_url TEXT,

    is_public BOOLEAN DEFAULT TRUE,
    max_characters INTEGER DEFAULT 100,
    member_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_worlds_creator ON worlds(creator_id);

-- ============================================
-- CHARACTERS
-- ============================================

CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    description TEXT,

    -- Personality & Background (the AI database)
    personality JSONB DEFAULT '{}',
    -- Example: { "traits": ["brave", "sarcastic"], "values": ["loyalty"], "flaws": ["impulsive"] }

    background TEXT,
    -- Freeform backstory text

    likes JSONB DEFAULT '[]',
    dislikes JSONB DEFAULT '[]',
    -- Example: ["swords", "adventure", "ale"]

    history JSONB DEFAULT '[]',
    -- Array of significant events: [{ "event": "...", "date": "...", "impact": "..." }]

    -- World association (nullable = character exists in vacuum)
    world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,

    -- Meta
    is_public BOOLEAN DEFAULT TRUE,
    is_ai_enabled BOOLEAN DEFAULT TRUE,  -- Can AI take over this character?
    tags TEXT[] DEFAULT '{}',
    chat_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_characters_creator ON characters(creator_id);
CREATE INDEX idx_characters_world ON characters(world_id);
CREATE INDEX idx_characters_tags ON characters USING GIN(tags);

-- ============================================
-- CHARACTER RELATIONSHIPS
-- ============================================

CREATE TABLE character_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    related_character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,  -- 'ally', 'enemy', 'lover', 'rival', 'mentor', etc.
    description TEXT,
    strength INTEGER DEFAULT 50 CHECK (strength >= 0 AND strength <= 100),
    -- 0 = barely know each other, 100 = deeply connected

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(character_id, related_character_id)
);

CREATE INDEX idx_char_rel_character ON character_relationships(character_id);
CREATE INDEX idx_char_rel_related ON character_relationships(related_character_id);

-- ============================================
-- WORLD MEMBERSHIP
-- ============================================

CREATE TABLE world_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_worldmaster BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(world_id, user_id)
);

CREATE INDEX idx_world_members_world ON world_members(world_id);
CREATE INDEX idx_world_members_user ON world_members(user_id);

-- ============================================
-- CAMPAIGNS & QUESTS
-- ============================================

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    narrative_arc TEXT,
    status quest_status DEFAULT 'draft',
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_world ON campaigns(world_id);

CREATE TABLE quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    objectives JSONB DEFAULT '[]',
    -- Example: [{ "description": "Find the lost sword", "completed": false }]

    rewards JSONB DEFAULT '{}',
    -- Example: { "lore_reveal": "The king's secret", "items": ["enchanted_blade"] }

    lore_reveals TEXT,
    status quest_status DEFAULT 'draft',
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quests_campaign ON quests(campaign_id);

CREATE TABLE quest_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    progress JSONB DEFAULT '{}',
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(quest_id, character_id)
);

-- ============================================
-- CONVERSATIONS & MESSAGES (Chat System)
-- ============================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    context chat_context NOT NULL DEFAULT 'vacuum',
    world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,
    quest_id UUID REFERENCES quests(id) ON DELETE SET NULL,
    title VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_world ON conversations(world_id);
CREATE INDEX idx_conversations_quest ON conversations(quest_id);

CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_ai_controlled BOOLEAN DEFAULT FALSE,
    unread_count INTEGER DEFAULT 0,
    last_read_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(conversation_id, character_id)
);

CREATE INDEX idx_conv_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_type message_sender_type NOT NULL,
    content TEXT NOT NULL,

    -- AI metadata
    ai_model VARCHAR(50),
    ai_prompt_tokens INTEGER,
    ai_completion_tokens INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender_char ON messages(sender_character_id);
CREATE INDEX idx_messages_created ON messages(conversation_id, created_at);

-- ============================================
-- AI TRANSCRIPTS (Review System)
-- ============================================

CREATE TABLE ai_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status ai_transcript_status DEFAULT 'pending_review',
    reviewed_at TIMESTAMPTZ,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_transcripts_owner ON ai_transcripts(owner_id, status);

-- ============================================
-- FRIENDSHIPS
-- ============================================

CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status friendship_status DEFAULT 'pending',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(requester_id, addressee_id),
    CHECK (requester_id != addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);

-- ============================================
-- KAYFABE REPORTS
-- ============================================

CREATE TABLE kayfabe_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status kayfabe_report_status DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kayfabe_reports_status ON kayfabe_reports(status);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    -- Types: 'friend_request', 'chat_message', 'quest_invite', 'ai_transcript',
    --        'kayfabe_warning', 'world_invite', 'system'
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ============================================
-- FORUM
-- ============================================

CREATE TABLE forum_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE forum_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    reply_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forum_posts_category ON forum_posts(category_id);
CREATE INDEX idx_forum_posts_author ON forum_posts(author_id);

CREATE TABLE forum_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_reply_id UUID REFERENCES forum_replies(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forum_replies_post ON forum_replies(post_id);

-- ============================================
-- UPDATED_AT TRIGGER (auto-update timestamps)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_characters_updated_at BEFORE UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_character_relationships_updated_at BEFORE UPDATE ON character_relationships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_worlds_updated_at BEFORE UPDATE ON worlds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_quests_updated_at BEFORE UPDATE ON quests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_friendships_updated_at BEFORE UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_forum_posts_updated_at BEFORE UPDATE ON forum_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_forum_replies_updated_at BEFORE UPDATE ON forum_replies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
