package schema

import (
    "entgo.io/ent"
    "entgo.io/ent/schema/field"
    "github.com/google/uuid"
    
)

// UsersList holds the schema definition for the UsersList entity.
type UsersList struct {
    ent.Schema
}

// Fields of the UsersList.
func (UsersList) Fields() []ent.Field {
    return []ent.Field{
        field.UUID("id", uuid.UUID{}).Default(uuid.New),
        field.String("room_id").NotEmpty(),
        field.String("username").NotEmpty().Unique(),
        field.String("email").NotEmpty().Unique(),
        field.String("password").NotEmpty(),
    }
}

// Edges of the UsersList.
func (UsersList) Edges() []ent.Edge {
    return nil
}
