// kafka.go
package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/segmentio/kafka-go"
)

/* ---------------- PRODUCER ---------------- */

// KafkaProducer wraps a kafka.Writer instance
type KafkaProducer struct {
	writer *kafka.Writer
}

func loadTLSConfig() (*tls.Config, error) {
	// CA cert
	caCert := os.Getenv("KAFKA_CA_CERT")
	if caCert == "" {
		return nil, fmt.Errorf("KAFKA_CA_CERT not set")
	}

	certPool := x509.NewCertPool()
	if !certPool.AppendCertsFromPEM([]byte(caCert)) {
		return nil, fmt.Errorf("failed to append CA cert")
	}

	// Client cert + key
	certPEM := os.Getenv("KAFKA_CLIENT_CERT")
	keyPEM := os.Getenv("KAFKA_CLIENT_KEY")

	if certPEM == "" || keyPEM == "" {
		return nil, fmt.Errorf("KAFKA_CLIENT_CERT or KAFKA_CLIENT_KEY not set")
	}

	clientCert, err := tls.X509KeyPair(
		[]byte(certPEM),
		[]byte(keyPEM),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load client cert/key: %w", err)
	}

	return &tls.Config{
		RootCAs:      certPool,
		Certificates: []tls.Certificate{clientCert},
		MinVersion:   tls.VersionTLS12,
	}, nil
}

// NewKafkaProducer creates and connects a Kafka producer
func NewKafkaProducer() (*KafkaProducer, error) {

	// Load CA cert
	tlsConfig, err := loadTLSConfig()
	if err != nil {
		return nil, err
	}

	dialer := &kafka.Dialer{
		Timeout:   10 * time.Second,
		DualStack: true,
		TLS:       tlsConfig,
	}

	writer := kafka.NewWriter(kafka.WriterConfig{
		Brokers:  []string{"kafka-1ef455df-hayagriva899-adf2.g.aivencloud.com:25695"},
		Topic:    "MESSAGES",
		Balancer: &kafka.LeastBytes{},
		Dialer:   dialer,
	})

	return &KafkaProducer{writer: writer}, nil
}

// ProduceMessage sends a message to Kafka
func (kp *KafkaProducer) ProduceMessage(roomID string, message []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return kp.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(roomID),
		Value: []byte(message),
	})
}

// Close closes the Kafka producer
func (kp *KafkaProducer) Close() error {
	return kp.writer.Close()
}

/* ---------------- CONSUMER ---------------- */

type KafkaConsumer struct {
	reader *kafka.Reader
}

// NewKafkaConsumer creates a Kafka consumer
func NewKafkaConsumer(groupID string) (*KafkaConsumer, error) {
	tlsConfig, err := loadTLSConfig()
	if err != nil {
		return nil, err
	}

	dialer := &kafka.Dialer{
		Timeout:   10 * time.Second,
		DualStack: true,
		TLS:       tlsConfig,
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{"kafka-1ef455df-hayagriva899-adf2.g.aivencloud.com:25695"},
		Topic:       "MESSAGES",
		GroupID:     groupID,           // without groupid, it caused redundant message accumulation in the db each time the server restarts
		StartOffset: kafka.FirstOffset, //  THIS IS THE FIX
		Dialer:      dialer,
	})

	return &KafkaConsumer{reader: reader}, nil
}

// Consume reads messages from Kafka
func (kc *KafkaConsumer) Consume(ctx context.Context, handle func(msg string) error) error {
	for {
		m, err := kc.reader.ReadMessage(ctx)
		if err != nil {
			log.Println("Kafka read error (ignored):", err)
			continue
		}

		if err := handle(string(m.Value)); err != nil {
			log.Println("handler error:", err)
		}
	}

}

// Close closes the Kafka consumer
func (kc *KafkaConsumer) Close() error {
	return kc.reader.Close()
}
