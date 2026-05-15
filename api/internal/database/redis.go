package database

import (
	"net/url"

	"github.com/hibiken/asynq"
)

func NewRedisOpt(redisURL string) (asynq.RedisClientOpt, error) {
	u, err := url.Parse(redisURL)
	if err != nil {
		return asynq.RedisClientOpt{}, err
	}
	opt := asynq.RedisClientOpt{Addr: u.Host}
	if u.User != nil {
		opt.Password, _ = u.User.Password()
	}
	return opt, nil
}
