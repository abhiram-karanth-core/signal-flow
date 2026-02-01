package models

import (
	"time"

	"github.com/google/uuid"
)

type ChatMessage struct {
	RoomID    string    `json:"room_id"`
	ID        uuid.UUID `json:"id,omitempty"`
	Username  string    `json:"username"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}
