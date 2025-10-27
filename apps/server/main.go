package main
import "github.com/redis/go-redis/v9"
import (
	"context"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"sync"
	"time"
	"github.com/joho/godotenv"
	"golang.org/x/time/rate"
	"os"
	"github.com/coder/websocket"
	"server/ent"
	_ "github.com/lib/pq"
	"server/ent/userslist"
	"golang.org/x/crypto/bcrypt"
	"encoding/json"
)
type chatServer struct {
	subscriberMessageBuffer int
	publishLimiter *rate.Limiter
	logf func(f string, v ...any)
	serveMux http.ServeMux

	subscribersMu sync.Mutex
	subscribers   map[*subscriber]struct{}
    redisClient  *redis.Client
    redisSub     *redis.PubSub
	db 		 *ent.Client
	producer *KafkaProducer
}
func (cs *chatServer) listenRedis() {
    ch := cs.redisSub.Channel()
    for msg := range ch {
		cs.logf("received message from Redis: %s", msg.Payload)
        cs.publish([]byte(msg.Payload)) // Reuse existing in-memory broadcast
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
		subscribers:             make(map[*subscriber]struct{}),
		publishLimiter:          rate.NewLimiter(rate.Every(time.Millisecond*100), 8),
        redisClient:             client,
        redisSub:                sub,
		db:                      db,
		producer: 			  	 prod,


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
    consumer, err := NewKafkaConsumer("redis-consumer")
    if err != nil {
        log.Fatalf("failed to create Kafka consumer: %v", err)
    }
    defer consumer.reader.Close()

    ctx := context.Background()
    err = consumer.Consume(ctx, func(msg string) error {
        log.Printf("Kafka → Redis: %s", msg)
        return cs.redisClient.Publish(ctx, "my-channel", msg).Err()
    })
    if err != nil {
        log.Printf("consumer error: %v", err)
    }
}

func (cs *chatServer) consumeToDB() {
    consumer, err := NewKafkaConsumer("db-consumer")
    if err != nil {
        log.Fatalf("failed to create Kafka consumer: %v", err)
    }
    defer consumer.reader.Close()
    ctx := context.Background()
    err = consumer.Consume(ctx, func(msg string) error {
        log.Printf("Kafka → DB: %s", msg)
        _, dbErr := cs.db.Message.
            Create().
            SetText(msg).
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
func (cs *chatServer) publishHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	body := http.MaxBytesReader(w, r.Body, 8192)
	msg, err := io.ReadAll(body)
	if err != nil {
		http.Error(w, http.StatusText(http.StatusRequestEntityTooLarge), http.StatusRequestEntityTooLarge)
		return
	}
	cs.logf("received messages: %s", string(msg))
	err = cs.producer.ProduceMessage(string(msg))
	if err != nil {
		http.Error(w, "Failed to produce message to Kafka", http.StatusInternalServerError)
		return
	}
		w.WriteHeader(http.StatusAccepted)
	}
func (cs *chatServer) subscribe(w http.ResponseWriter, r *http.Request) error {
	var mu sync.Mutex
	var c *websocket.Conn
	var closed bool
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
	cs.addSubscriber(s)
	defer cs.deleteSubscriber(s)

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
    messages, err := cs.db.Message.  // **NEW: Send historical messages from DB**
        Query().
        Order(ent.Asc("created_at")).  // or use a created_at field
        Limit(100).            // last 100 messages
        All(ctx)
    if err != nil {
        cs.logf("failed to fetch messages: %v", err)
    } else {
        for _, msg := range messages {
            err := writeTimeout(ctx, time.Second*5, c, []byte(msg.Text))
            if err != nil {
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
func (cs *chatServer) publish(msg []byte) {   // publish publishes the msg to all subscribers.
	cs.subscribersMu.Lock()// It never blocks and so messages to slow subscribers
	defer cs.subscribersMu.Unlock() // are dropped.
	cs.publishLimiter.Wait(context.Background())
	for s := range cs.subscribers {
		select {
		case s.msgs <- msg:
		default:
			go s.closeSlow()
		}
	}
}
func (cs *chatServer) addSubscriber(s *subscriber) {
	cs.subscribersMu.Lock()
	cs.subscribers[s] = struct{}{}
	cs.subscribersMu.Unlock()
}
func (cs *chatServer) deleteSubscriber(s *subscriber) {
	cs.subscribersMu.Lock()
	delete(cs.subscribers, s)
	cs.subscribersMu.Unlock()
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

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Login successful"}`))
}


func main() {
	cs := newChatServer()
    go cs.consumeToRedis()
    go cs.consumeToDB()
	log.Printf("starting server on :8080")
	if err := http.ListenAndServe(":8080", cs); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}