package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// Message holds the schema definition for the Message entity.
type Message struct {
	ent.Schema
}

// Fields of the Message.
func (Message) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Unique().
			Immutable(),
		field.String("room_id").
			NotEmpty(),
		field.String("username").
			NotEmpty(),

		field.String("text").
			NotEmpty(),

		field.Time("created_at").
			Default(time.Now),
	}
}

// Edges of the Message.
func (Message) Edges() []ent.Edge {
	return nil
}

func (Message) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("room_id", "created_at"),
	}
}
