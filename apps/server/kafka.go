// kafka.go
package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"time"
	"log"
	"github.com/segmentio/kafka-go"
)

/* ---------------- PRODUCER ---------------- */

// KafkaProducer wraps a kafka.Writer instance
type KafkaProducer struct {
	writer *kafka.Writer
}

// NewKafkaProducer creates and connects a Kafka producer
func NewKafkaProducer() (*KafkaProducer, error) {

	// Load CA cert
	caCert, err := os.ReadFile("ca.pem")
	if err != nil {
		return nil, fmt.Errorf("failed to read CA cert: %w", err)
	}

	certPool := x509.NewCertPool()
	if !certPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to append CA cert")
	}

	// Load client certificate + key (Aiven Access cert/key)
	clientCert, err := tls.LoadX509KeyPair("service.cert", "service.key")
	if err != nil {
		return nil, fmt.Errorf("failed to load client cert/key: %w", err)
	}

	tlsConfig := &tls.Config{
		RootCAs:      certPool,
		Certificates: []tls.Certificate{clientCert},
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
func (kp *KafkaProducer) ProduceMessage(message string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return kp.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(fmt.Sprintf("message-%d", time.Now().UnixMilli())),
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

	// Load CA cert
	caCert, err := os.ReadFile("ca.pem")
	if err != nil {
		return nil, fmt.Errorf("failed to read CA cert: %w", err)
	}

	certPool := x509.NewCertPool()
	if !certPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to append CA cert")
	}

	// Load client certificate + key
	clientCert, err := tls.LoadX509KeyPair("service.cert", "service.key")
	if err != nil {
		return nil, fmt.Errorf("failed to load client cert/key: %w", err)
	}

	tlsConfig := &tls.Config{
		RootCAs:      certPool,
		Certificates: []tls.Certificate{clientCert},
	}

	dialer := &kafka.Dialer{
		Timeout:   10 * time.Second,
		DualStack: true,
		TLS:       tlsConfig,
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
    Brokers:    []string{"kafka-1ef455df-hayagriva899-adf2.g.aivencloud.com:25695"},
    Topic:     "MESSAGES",
  
    StartOffset: kafka.FirstOffset, // 🔥 THIS IS THE FIX
    Dialer:    dialer,
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
