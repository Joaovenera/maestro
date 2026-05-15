package coolify

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// SentinelCPUPoint is one CPU sample from the sentinel history API.
// time is a Unix-ms string; percent is a float as a string.
type SentinelCPUPoint struct {
	Time    string `json:"time"`
	Percent string `json:"percent"`
}

// SentinelMemoryPoint is one memory sample from the sentinel history API.
// time is Unix-ms string; used is in MB; total/free are in bytes.
type SentinelMemoryPoint struct {
	Time        string  `json:"time"`
	Total       int64   `json:"total"`
	Used        int64   `json:"used"`        // megabytes
	UsedPercent float64 `json:"usedPercent"`
	Free        int64   `json:"free"`
}

type SentinelClient struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

func NewSentinelClient(baseURL, token string) *SentinelClient {
	return &SentinelClient{
		baseURL: baseURL,
		token:   token,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GetLatestCPU returns the most recent CPU sample collected after `from`
// for the given container (Coolify application UUID).
func (s *SentinelClient) GetLatestCPU(ctx context.Context, containerID string, from time.Time) (*SentinelCPUPoint, error) {
	path := fmt.Sprintf("/api/container/%s/cpu/history?from=%s", containerID, from.UTC().Format(time.RFC3339))
	b, err := s.get(ctx, path)
	if err != nil {
		return nil, err
	}
	var points []SentinelCPUPoint
	if err := json.Unmarshal(b, &points); err != nil {
		return nil, fmt.Errorf("sentinel cpu decode: %w", err)
	}
	if len(points) == 0 {
		return nil, nil
	}
	return &points[len(points)-1], nil
}

// GetLatestMemory returns the most recent memory sample collected after `from`
// for the given container.
func (s *SentinelClient) GetLatestMemory(ctx context.Context, containerID string, from time.Time) (*SentinelMemoryPoint, error) {
	path := fmt.Sprintf("/api/container/%s/memory/history?from=%s", containerID, from.UTC().Format(time.RFC3339))
	b, err := s.get(ctx, path)
	if err != nil {
		return nil, err
	}
	var points []SentinelMemoryPoint
	if err := json.Unmarshal(b, &points); err != nil {
		return nil, fmt.Errorf("sentinel memory decode: %w", err)
	}
	if len(points) == 0 {
		return nil, nil
	}
	return &points[len(points)-1], nil
}

func (s *SentinelClient) get(ctx context.Context, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("sentinel request: %w", err)
	}
	if s.token != "" {
		req.Header.Set("Authorization", "Bearer "+s.token)
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sentinel fetch: %w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("sentinel status %d: %s", resp.StatusCode, string(b))
	}
	return b, nil
}
