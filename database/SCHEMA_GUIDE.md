# RedRoomDigital Database Schema Guide

## Quick Reference: What Each Table Does

### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | User accounts, subscriptions, ban status |
| `characters` | The heart of the app — characters with personality, history, background |
| `worlds` | User-created worlds with lore and rules |
| `conversations` | Chat sessions between characters |
| `messages` | Individual messages within conversations |

### Relationship Tables
| Table | Purpose |
|-------|---------|
| `character_relationships` | Tracks how characters relate (ally, enemy, lover, etc.) |
| `world_members` | Which users belong to which worlds |
| `conversation_participants` | Which characters are in each conversation |
| `quest_participants` | Which characters are on which quests |
| `friendships` | User-to-user friend connections |

### Feature Tables
| Table | Purpose |
|-------|---------|
| `campaigns` | Story arcs within a world (like a DnD campaign) |
| `quests` | Individual quests within campaigns |
| `ai_transcripts` | When AI controls a character, the owner reviews these |
| `kayfabe_reports` | Reports for breaking character |
| `notifications` | All user notifications |
| `forum_categories` | Forum organization |
| `forum_posts` | Forum discussions |
| `forum_replies` | Replies to forum posts |

## How Data Flows

```
User creates Account
  └── User creates Character(s)
       ├── Character exists in a World (optional)
       │    └── World has Campaigns → Quests
       ├── Character joins Conversations
       │    └── Conversation has Messages
       └── Character has Relationships with other Characters

When AI takes over a Character:
  Messages are created with sender_type = 'ai'
  → AI Transcript is created
  → Owner reviews & accepts/rejects
  → If accepted, events added to Character history
```

## Subscription Tier Limits
| Feature | Free | Premium | Ultimate |
|---------|------|---------|----------|
| Characters | 3 | 10 | Unlimited |
| Worlds | 0 | 1 | Unlimited |
| Daily Chats | Limited | Unlimited | Unlimited |
| Ads | Yes | No | No |
