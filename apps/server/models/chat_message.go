package models

import (
	"time"
)


type ChatMessage struct {
	ID        string    `json:"id"` 
	Username  string    `json:"username"`
	Text      string    `json:"text"`
	RoomID    string    `json:"room_id"`
	CreatedAt time.Time `json:"created_at"`
}
