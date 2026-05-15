package coolify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func New(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type DeployResponse struct {
	Message        string `json:"message"`
	ResourceUUID   string `json:"resource_uuid"`
	DeploymentUUID string `json:"deployment_uuid"`
}

type Resource struct {
	UUID   string `json:"uuid"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Status string `json:"status"`
}

type Application struct {
	UUID   string `json:"uuid"`
	Name   string `json:"name"`
	Status string `json:"status"`
	FQDN   string `json:"fqdn"`
}

func (c *Client) StartApplication(ctx context.Context, uuid string) error {
	return c.do(ctx, http.MethodPost, "/applications/"+uuid+"/start", nil, nil)
}

func (c *Client) StopApplication(ctx context.Context, uuid string) error {
	return c.do(ctx, http.MethodPost, "/applications/"+uuid+"/stop", nil, nil)
}

func (c *Client) RestartApplication(ctx context.Context, uuid string) error {
	return c.do(ctx, http.MethodPost, "/applications/"+uuid+"/restart", nil, nil)
}

func (c *Client) Deploy(ctx context.Context, uuid string, force bool) (*DeployResponse, error) {
	path := fmt.Sprintf("/deploy?uuid=%s", uuid)
	if force {
		path += "&force=true"
	}
	var resp struct {
		Deployments []DeployResponse `json:"deployments"`
	}
	if err := c.do(ctx, http.MethodGet, path, nil, &resp); err != nil {
		return nil, err
	}
	if len(resp.Deployments) == 0 {
		return nil, fmt.Errorf("no deployment started")
	}
	return &resp.Deployments[0], nil
}

func (c *Client) UpdateApplicationFQDN(ctx context.Context, uuid, fqdn string) error {
	body := map[string]string{"fqdn": fqdn}
	return c.do(ctx, http.MethodPatch, "/applications/"+uuid, body, nil)
}

func (c *Client) GetApplication(ctx context.Context, uuid string) (*Application, error) {
	var app Application
	if err := c.do(ctx, http.MethodGet, "/applications/"+uuid, nil, &app); err != nil {
		return nil, err
	}
	return &app, nil
}

func (c *Client) GetServerResources(ctx context.Context, serverUUID string) ([]Resource, error) {
	var resources []Resource
	if err := c.do(ctx, http.MethodGet, "/servers/"+serverUUID+"/resources", nil, &resources); err != nil {
		return nil, err
	}
	return resources, nil
}

func (c *Client) Health(ctx context.Context) error {
	return c.do(ctx, http.MethodGet, "/health", nil, nil)
}

func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("coolify %s %s: status %d — %s", method, path, resp.StatusCode, string(b))
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}
