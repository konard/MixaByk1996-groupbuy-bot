package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ─── Models ───────────────────────────────────────────────────────────────────

type Room struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"` // "purchase" | "direct" | "group"
	PurchaseID  *string   `json:"purchase_id,omitempty"`
	CreatedBy   string    `json:"created_by"`
	IsArchived  bool      `json:"is_archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ChatMessage struct {
	ID        string    `json:"id"`
	RoomID    string    `json:"room_id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	Type      string    `json:"type"` // "text" | "system" | "file"
	CreatedAt time.Time `json:"created_at"`
}

// ─── Server ───────────────────────────────────────────────────────────────────

type Server struct {
	db             *pgxpool.Pool
	ch             clickhouse.Conn
	centrifugoURL  string
	centrifugoKey  string
}

// ─── Centrifugo API ───────────────────────────────────────────────────────────

func (s *Server) centrifugoPublish(channel string, data map[string]any) error {
	payload := map[string]any{
		"method": "publish",
		"params": map[string]any{
			"channel": channel,
			"data":    data,
		},
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, s.centrifugoURL+"/api", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", s.centrifugoKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("centrifugo error %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (s *Server) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "chat-service"})
}

// CreateRoom creates a chat room and registers it in Centrifugo.
func (s *Server) CreateRoom(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		writeError(w, http.StatusBadRequest, "X-User-ID required")
		return
	}

	var req struct {
		Name       string  `json:"name"`
		Type       string  `json:"type"`
		PurchaseID *string `json:"purchase_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.Type == "" {
		req.Type = "group"
	}

	id := uuid.New().String()
	room := &Room{
		ID:         id,
		Name:       req.Name,
		Type:       req.Type,
		PurchaseID: req.PurchaseID,
		CreatedBy:  userID,
		IsArchived: false,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	_, err := s.db.Exec(r.Context(),
		`INSERT INTO rooms (id, name, type, purchase_id, created_by, is_archived, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, FALSE, NOW(), NOW())`,
		room.ID, room.Name, room.Type, room.PurchaseID, room.CreatedBy,
	)
	if err != nil {
		log.Printf("CreateRoom DB error: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to create room")
		return
	}

	// Add creator as member
	if _, err := s.db.Exec(r.Context(),
		`INSERT INTO room_members (room_id, user_id, joined_at) VALUES ($1, $2, NOW())`,
		room.ID, userID,
	); err != nil {
		log.Printf("AddRoomMember DB error: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to add creator as member")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"success": true, "data": room})
}

// GetRoom retrieves room details.
func (s *Server) GetRoom(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roomID := vars["roomId"]

	row := s.db.QueryRow(r.Context(),
		`SELECT id, name, type, purchase_id, created_by, is_archived, created_at, updated_at
		 FROM rooms WHERE id = $1`, roomID)

	room := &Room{}
	err := row.Scan(&room.ID, &room.Name, &room.Type, &room.PurchaseID,
		&room.CreatedBy, &room.IsArchived, &room.CreatedAt, &room.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "room not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": room})
}

// JoinRoom adds a user to a room.
func (s *Server) JoinRoom(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roomID := vars["roomId"]
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		writeError(w, http.StatusBadRequest, "X-User-ID required")
		return
	}

	_, err := s.db.Exec(r.Context(),
		`INSERT INTO room_members (room_id, user_id, joined_at)
		 VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
		roomID, userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to join room")
		return
	}

	// Notify via centrifugo
	channel := "chat:" + roomID
	s.centrifugoPublish(channel, map[string]any{
		"type":   "user_joined",
		"userId": userID,
		"roomId": roomID,
	})

	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

// InviteParticipant allows the room creator to invite another user to the room.
func (s *Server) InviteParticipant(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roomID := vars["roomId"]
	requesterID := r.Header.Get("X-User-ID")
	if requesterID == "" {
		writeError(w, http.StatusBadRequest, "X-User-ID required")
		return
	}

	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.UserID == "" {
		writeError(w, http.StatusBadRequest, "user_id is required")
		return
	}

	// Only the room creator can invite participants
	var createdBy string
	row := s.db.QueryRow(r.Context(), `SELECT created_by FROM rooms WHERE id = $1`, roomID)
	if err := row.Scan(&createdBy); err != nil {
		writeError(w, http.StatusNotFound, "room not found")
		return
	}
	if createdBy != requesterID {
		writeError(w, http.StatusForbidden, "only the room creator can invite participants")
		return
	}

	_, err := s.db.Exec(r.Context(),
		`INSERT INTO room_members (room_id, user_id, joined_at)
		 VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
		roomID, req.UserID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to invite participant")
		return
	}

	channel := "chat:" + roomID
	s.centrifugoPublish(channel, map[string]any{
		"type":        "user_invited",
		"userId":      req.UserID,
		"invitedBy":   requesterID,
		"roomId":      roomID,
	})

	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

// SendMessage saves message to ClickHouse and publishes to Centrifugo.
func (s *Server) SendMessage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roomID := vars["roomId"]
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		writeError(w, http.StatusBadRequest, "X-User-ID required")
		return
	}

	var req struct {
		Content string `json:"content"`
		Type    string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}
	if req.Type == "" {
		req.Type = "text"
	}

	// Verify user is member
	var count int
	row := s.db.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM room_members WHERE room_id = $1 AND user_id = $2`, roomID, userID)
	if err := row.Scan(&count); err != nil {
		log.Printf("SendMessage membership check error: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to verify membership")
		return
	}
	if count == 0 {
		writeError(w, http.StatusForbidden, "not a room member")
		return
	}

	msg := &ChatMessage{
		ID:        uuid.New().String(),
		RoomID:    roomID,
		UserID:    userID,
		Content:   req.Content,
		Type:      req.Type,
		CreatedAt: time.Now(),
	}

	// Store in ClickHouse
	if s.ch != nil {
		if err := s.ch.Exec(r.Context(),
			`INSERT INTO chat_messages (id, room_id, user_id, content, type, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			msg.ID, msg.RoomID, msg.UserID, msg.Content, msg.Type, msg.CreatedAt,
		); err != nil {
			log.Printf("ClickHouse insert error: %v", err)
			// Non-fatal
		}
	}

	// Publish to Centrifugo
	channel := "chat:" + roomID
	if err := s.centrifugoPublish(channel, map[string]any{
		"type":    "message",
		"id":      msg.ID,
		"userId":  msg.UserID,
		"content": msg.Content,
		"msgType": msg.Type,
		"ts":      msg.CreatedAt.Unix(),
	}); err != nil {
		log.Printf("Centrifugo publish error: %v", err)
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": msg})
}

// GetHistory retrieves message history from ClickHouse.
func (s *Server) GetHistory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roomID := vars["roomId"]

	if s.ch == nil {
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": []any{}})
		return
	}

	rows, err := s.ch.Query(r.Context(),
		`SELECT id, room_id, user_id, content, type, created_at
		 FROM chat_messages
		 WHERE room_id = ?
		 ORDER BY created_at DESC
		 LIMIT 100`, roomID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query history")
		return
	}
	defer rows.Close()

	var messages []ChatMessage
	for rows.Next() {
		var msg ChatMessage
		if err := rows.Scan(&msg.ID, &msg.RoomID, &msg.UserID, &msg.Content, &msg.Type, &msg.CreatedAt); err != nil {
			continue
		}
		messages = append(messages, msg)
	}
	if messages == nil {
		messages = []ChatMessage{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": messages})
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	ctx := context.Background()

	// PostgreSQL
	dsn := getEnv("DATABASE_URL", "postgresql://chat_user:chat_password@localhost:5432/chat_db")
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("DB connect failed: %v", err)
	}
	defer pool.Close()

	// Run migrations
	pool.Exec(ctx, `
		CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
		CREATE TABLE IF NOT EXISTS rooms (
			id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			name        VARCHAR(500) NOT NULL,
			type        VARCHAR(50) NOT NULL DEFAULT 'group',
			purchase_id UUID,
			created_by  UUID NOT NULL,
			is_archived BOOLEAN NOT NULL DEFAULT FALSE,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE TABLE IF NOT EXISTS room_members (
			room_id   UUID NOT NULL,
			user_id   UUID NOT NULL,
			joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (room_id, user_id)
		);
	`)

	// ClickHouse (optional)
	var chConn clickhouse.Conn
	chDSN := getEnv("CLICKHOUSE_DSN", "")
	if chDSN != "" {
		chConn, err = clickhouse.Open(&clickhouse.Options{
			Addr: []string{getEnv("CLICKHOUSE_ADDR", "localhost:9000")},
			Auth: clickhouse.Auth{
				Database: "chat_history",
				Username: getEnv("CLICKHOUSE_USER", "clickhouse_user"),
				Password: getEnv("CLICKHOUSE_PASSWORD", "clickhouse_password"),
			},
			DialTimeout:     10 * time.Second,
			MaxOpenConns:    10,
			MaxIdleConns:    5,
			ConnMaxLifetime: time.Hour,
		})
		if err != nil {
			log.Printf("ClickHouse connect warning: %v", err)
			chConn = nil
		} else {
			chConn.Exec(ctx, `
				CREATE TABLE IF NOT EXISTS chat_messages (
					id         UUID,
					room_id    UUID,
					user_id    UUID,
					content    String,
					type       String,
					created_at DateTime64(3)
				) ENGINE = MergeTree()
				ORDER BY (room_id, created_at)
			`)
		}
	}

	srv := &Server{
		db:            pool,
		ch:            chConn,
		centrifugoURL: getEnv("CENTRIFUGO_URL", "http://localhost:8000"),
		centrifugoKey: getEnv("CENTRIFUGO_API_KEY", "centrifugo_api_key"),
	}

	r := mux.NewRouter()
	r.HandleFunc("/health", srv.Health).Methods(http.MethodGet)
	r.HandleFunc("/rooms", srv.CreateRoom).Methods(http.MethodPost)
	r.HandleFunc("/rooms/{roomId}", srv.GetRoom).Methods(http.MethodGet)
	r.HandleFunc("/rooms/{roomId}/join", srv.JoinRoom).Methods(http.MethodPost)
	r.HandleFunc("/rooms/{roomId}/invite", srv.InviteParticipant).Methods(http.MethodPost)
	r.HandleFunc("/rooms/{roomId}/messages", srv.SendMessage).Methods(http.MethodPost)
	r.HandleFunc("/rooms/{roomId}/history", srv.GetHistory).Methods(http.MethodGet)

	port := getEnv("PORT", "4004")
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	log.Printf("Chat service starting on :%s", port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
