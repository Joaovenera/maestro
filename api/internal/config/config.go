package config

import "github.com/kelseyhightower/envconfig"

type Config struct {
	DatabaseURL     string `envconfig:"DATABASE_URL" required:"true"`
	RedisURL        string `envconfig:"REDIS_URL" required:"true"`
	CoolifyBaseURL  string `envconfig:"COOLIFY_BASE_URL" required:"true"`
	CoolifyAPIKey   string `envconfig:"COOLIFY_API_KEY" required:"true"`
	WebhookSecret   string `envconfig:"WEBHOOK_SECRET"`
	APIPort         string `envconfig:"API_PORT" default:"3000"`
	SentinelBaseURL string `envconfig:"SENTINEL_BASE_URL"` // e.g. http://server-ip:8888
	SentinelToken   string `envconfig:"SENTINEL_TOKEN"`
}

func Load() (*Config, error) {
	var c Config
	if err := envconfig.Process("", &c); err != nil {
		return nil, err
	}
	return &c, nil
}
