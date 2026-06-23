// Full row as returned from the DB
export interface UserProfile {
  id: string
  user_id: string
  username: string
  avatar_url: string | null
  last_seen: Date | null
  bio: string | null
  created_at: Date
  updated_at: Date
}

// Fields the caller is allowed to mutate — all optional
export type UpdateUserData = Partial<
  Pick<UserProfile, 'username' | 'avatar_url' | 'last_seen' | 'bio'>
>

// ── Relationships ────────────────────────────────────────────────────────────

// Mirrors the four lifecycle states defined in 002_create_relation migration
export type RelationshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked'

export interface Relationship {
  id: string
  requester_id: string
  receiver_id: string
  status: RelationshipStatus
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export type UpdateRelationData = Pick<Relationship, 'status'>
