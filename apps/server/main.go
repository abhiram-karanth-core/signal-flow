package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"server/ent"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"golang.org/x/time/rate"

	"encoding/json"
	"server/ent/message"
	"server/ent/userslist"
	"server/models"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type chatServer struct {
	subscriberMessageBuffer int
	publishLimiter          *rate.Limiter
	logf                    func(f string, v ...any)
	serveMux                http.ServeMux

	subscribersMu sync.Mutex
	subscribers   map[string]map[*subscriber]struct{}
	redisClient   *redis.Client
	redisSub      *redis.PubSub
	db            *ent.Client
	producer      *KafkaProducer
}

func (cs *chatServer) listenRedis() {
	ch := cs.redisSub.Channel()
	for msg := range ch {
		cs.logf("received message from Redis: %s", msg.Payload)
		var m models.ChatMessage
		json.Unmarshal([]byte(msg.Payload), &m)
		cs.publish(m.RoomID, []byte(msg.Payload))
	}
}

// newChatServer constructs a chatServer with the defaults.
func newChatServer() *chatServer {
	client, sub := SetupRedisClient()
	// Load DSN
	_ = godotenv.Load()
	dsn := os.Getenv("dsn")
	db, err := ent.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("failed to connect to postgres: %v", err)
	}

	// Run migration
	if err := db.Schema.Create(context.Background()); err != nil {
		log.Fatalf("failed creating schema: %v", err)
	}
	prod, err := NewKafkaProducer()
	if err != nil {
		log.Fatalf("failed to create Kafka producer: %v", err)
	}
	cs := &chatServer{
		subscriberMessageBuffer: 16,
		logf:                    log.Printf,
		subscribers:             make(map[string]map[*subscriber]struct{}),
		publishLimiter:          rate.NewLimiter(rate.Every(time.Millisecond*100), 8),
		redisClient:             client,
		redisSub:                sub,
		db:                      db,
		producer:                prod,
	}
	cs.serveMux.Handle("/", http.FileServer(http.Dir(".")))
	cs.serveMux.HandleFunc("/subscribe", cs.subscribeHandler)
	cs.serveMux.HandleFunc("/publish", cs.publishHandler)
	cs.serveMux.HandleFunc("/signup", cs.signupHandler)
	cs.serveMux.HandleFunc("/login", cs.loginHandler)

	go cs.listenRedis()
	return cs
}

type subscriber struct {
	msgs      chan []byte
	closeSlow func()
}

func (cs *chatServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Basic CORS for development
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	cs.serveMux.ServeHTTP(w, r)
}
func (cs *chatServer) subscribeHandler(w http.ResponseWriter, r *http.Request) {
	err := cs.subscribe(w, r)
	if errors.Is(err, context.Canceled) {
		return
	}
	if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
		websocket.CloseStatus(err) == websocket.StatusGoingAway {
		return
	}
	if err != nil {
		cs.logf("%v", err)
		return
	}
}
func (cs *chatServer) consumeToRedis() {
	consumer, err := NewKafkaConsumer("redis-consumer-v2")
	if err != nil {
		log.Fatalf("failed to create Kafka consumer: %v", err)
	}
	defer consumer.reader.Close()
	ctx := context.Background()

	err = consumer.Consume(ctx, func(msg string) error {
		log.Printf("Kafka → Redis: %s", msg)
		var m models.ChatMessage
		if err := json.Unmarshal([]byte(msg), &m); err != nil {
			log.Printf("redis publish unmarshal error: %v", err)
			return nil
		}
		channel := "room:" + m.RoomID
		return cs.redisClient.Publish(ctx, channel, msg).Err()
	})
	// if err != nil { // never reaches here because, if above "return" gave an error, then from kafka.go
	//     log.Printf("consumer error: %v", err)  // log.Println("handler error:", err)
	// }										// this will be executed
}

func (cs *chatServer) consumeToDB() {
	consumer, err := NewKafkaConsumer("db-consumer-v2")
	if err != nil {
		log.Fatalf("failed to create Kafka consumer: %v", err)
	}
	defer consumer.reader.Close()
	ctx := context.Background()
	err = consumer.Consume(ctx, func(msg string) error {
		var m models.ChatMessage
		if err := json.Unmarshal([]byte(msg), &m); err != nil {
			log.Printf("invalid message format: %v", err)
			return nil
		}
		log.Printf("Kafka → DB: %+v", m)
		_, dbErr := cs.db.Message.
			Create().
			SetText(m.Text).
			SetRoomID(m.RoomID).
			SetUsername(m.Username).
			SetCreatedAt(m.CreatedAt).
			Save(ctx)
		if dbErr != nil {
			log.Printf("failed saving message: %v", dbErr)
		}
		return nil
	})
	if err != nil {
		log.Printf("consumer error: %v", err)
	}
}

func (cs *chatServer) extractUsernameFromJWT(r *http.Request) (string, error) {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return "", errors.New("missing authorization header")
	}

	tokenStr := strings.TrimPrefix(auth, "Bearer ")

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return "", errors.New("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid claims")
	}

	email, ok := claims["email"].(string)
	if !ok {
		return "", errors.New("email missing in token")
	}

	user, err := cs.db.UsersList.
		Query().
		Where(userslist.EmailEQ(email)).
		Only(context.Background())
	if err != nil {
		return "", err
	}

	return user.Username, nil
}

func (cs *chatServer) publishHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("🟡 /publish HIT")
	log.Println("HEADERS RECEIVED:", r.Header)
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Text   string `json:"text"`
		RoomID string `json:"room_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.RoomID == "" {
		http.Error(w, "room_id required", http.StatusBadRequest)
		return
	}

	if req.Text == "" {
		http.Error(w, "message cannot be empty", http.StatusBadRequest)
		return
	}
	username, err := cs.extractUsernameFromJWT(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	log.Println("🟢 JWT OK, username =", username)

	msg := models.ChatMessage{
		Username:  username,
		Text:      req.Text,
		RoomID:    req.RoomID,
		CreatedAt: time.Now(),
	}
	data, err := json.Marshal(msg)
	if err != nil {
		http.Error(w, "failed to serialize the message", http.StatusInternalServerError)
		return
	}
	if err := cs.producer.ProduceMessage(msg.RoomID, data); err != nil {
		http.Error(w, "failed to produce to kafka", http.StatusInternalServerError)
		return
	}
	log.Println("✅ PRODUCED TO KAFKA")

	w.WriteHeader(http.StatusAccepted)

}

func (cs *chatServer) subscribe(w http.ResponseWriter, r *http.Request) error {
	var mu sync.Mutex
	var c *websocket.Conn
	var closed bool
	roomID := r.URL.Query().Get("room_id")
	if roomID == "" {
		return errors.New("room_id is required")
	}
	s := &subscriber{
		msgs: make(chan []byte, cs.subscriberMessageBuffer),
		closeSlow: func() {
			mu.Lock()
			defer mu.Unlock()
			closed = true
			if c != nil {
				c.Close(websocket.StatusPolicyViolation, "connection too slow to keep up with messages")
			}
		},
	}
	cs.addSubscriber(roomID, s)
	defer cs.deleteSubscriber(roomID, s)

	c2, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		// Allow all origins for development; tighten in production
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		return err
	}
	mu.Lock()
	if closed {
		mu.Unlock()
		return net.ErrClosed
	}
	c = c2
	mu.Unlock()
	defer c.CloseNow()
	ctx := c.CloseRead(context.Background())
	messages, err := cs.db.Message. //  Send historical messages from DB
					Query().
					Where(message.RoomIDEQ(roomID)).
					Order(ent.Asc("created_at")).
					Limit(100). // last 100 messages
					All(ctx)
	if err != nil {
		cs.logf("failed to fetch messages: %v", err)
	} else {
		for _, msg := range messages {
			cm := models.ChatMessage{
				ID:        msg.ID,
				Username:  msg.Username,
				Text:      msg.Text,
				CreatedAt: msg.CreatedAt,
			}

			data, _ := json.Marshal(cm)

			if err := writeTimeout(ctx, time.Second*5, c, data); err != nil {
				return err
			}
		}

	}
	for {
		select {
		case msg := <-s.msgs:
			err := writeTimeout(ctx, time.Second*5, c, msg)
			if err != nil {
				return err
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
func (cs *chatServer) publish(roomID string, msg []byte) { // publish publishes the msg to all subscribers.
	cs.subscribersMu.Lock()         // It never blocks and so messages to slow subscribers
	defer cs.subscribersMu.Unlock() // are dropped.
	cs.publishLimiter.Wait(context.Background())
	for s := range cs.subscribers[roomID] {
		select {
		case s.msgs <- msg:
		default:
			go s.closeSlow()
		}
	}
}
func (cs *chatServer) addSubscriber(roomID string, s *subscriber) {
	cs.subscribersMu.Lock()
	defer cs.subscribersMu.Unlock()

	if cs.subscribers[roomID] == nil {
		cs.subscribers[roomID] = make(map[*subscriber]struct{})
	}
	cs.subscribers[roomID][s] = struct{}{}
}

func (cs *chatServer) deleteSubscriber(roomID string, s *subscriber) {
	cs.subscribersMu.Lock()
	defer cs.subscribersMu.Unlock()

	delete(cs.subscribers[roomID], s)
	if len(cs.subscribers[roomID]) == 0 {
		delete(cs.subscribers, roomID)
	}
}

func writeTimeout(ctx context.Context, timeout time.Duration, c *websocket.Conn, msg []byte) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return c.Write(ctx, websocket.MessageText, msg)
}

// signupHandler handles new user registration
func (cs *chatServer) signupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	type SignupRequest struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	// Save user in database
	_, err = cs.db.UsersList.
		Create().
		SetUsername(req.Username).
		SetEmail(req.Email).
		SetPassword(string(hashed)).
		Save(context.Background())

	if err != nil {
		http.Error(w, "Error creating user: "+err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(`{"message": "User created successfully"}`))
}

// loginHandler verifies credentials
var jwtSecret = []byte("secret_key") // need to move it to env later. for now i will hardcode it

func (cs *chatServer) loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	type LoginRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	user, err := cs.db.UsersList.
		Query().
		Where(userslist.EmailEQ(req.Email)).
		Only(context.Background())

	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)) != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(jwtSecret)
	if err != nil {
		http.Error(w, "Could not generate token", http.StatusInternalServerError)
		return
	}

	//  send the token as json response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token": signedToken,
	})
}

func main() {
	cs := newChatServer()
	go cs.consumeToRedis()
	go cs.consumeToDB()
	log.Printf("starting server on :8888")
	if err := http.ListenAndServe(":8888", cs); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}
