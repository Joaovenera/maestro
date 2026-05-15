package workers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"
)

// dockerStatsClient queries the Docker daemon socket for container stats.
// Used as fallback when the Sentinel API returns no data (bug with hyphenated names).
type dockerStatsClient struct {
	http *http.Client
}

var dockerStats = &dockerStatsClient{
	http: &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, "unix", "/var/run/docker.sock")
			},
		},
	},
}

type dockerStatsResponse struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs     int    `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Cache uint64 `json:"cache"`
		Limit uint64 `json:"limit"`
		Stats struct {
			Cache uint64 `json:"cache"`
		} `json:"stats"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes uint64 `json:"rx_bytes"`
		TxBytes uint64 `json:"tx_bytes"`
	} `json:"networks"`
	BlkioStats struct {
		IoServiceBytesRecursive []struct {
			Op    string `json:"op"`
			Value uint64 `json:"value"`
		} `json:"io_service_bytes_recursive"`
	} `json:"blkio_stats"`
}

type containerMetrics struct {
	CPUPct     float64
	RAMMB      int
	NetRxKB    int64
	NetTxKB    int64
	DiskReadKB int64
	DiskWriteKB int64
}

func (d *dockerStatsClient) GetMetrics(ctx context.Context, containerName string) (*containerMetrics, error) {
	url := fmt.Sprintf("http://localhost/containers/%s/stats?stream=false", containerName)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := d.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("docker stats %d: %s", resp.StatusCode, string(b))
	}

	var s dockerStatsResponse
	if err := json.NewDecoder(resp.Body).Decode(&s); err != nil {
		return nil, fmt.Errorf("docker stats decode: %w", err)
	}

	// CPU %
	cpuDelta := float64(s.CPUStats.CPUUsage.TotalUsage) - float64(s.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(s.CPUStats.SystemCPUUsage) - float64(s.PreCPUStats.SystemCPUUsage)
	cpus := s.CPUStats.OnlineCPUs
	if cpus == 0 {
		cpus = 1
	}
	var cpuPct float64
	if sysDelta > 0 {
		cpuPct = (cpuDelta / sysDelta) * float64(cpus) * 100.0
	}

	// RAM MB (subtract page cache)
	cache := s.MemoryStats.Stats.Cache
	if cache == 0 {
		cache = s.MemoryStats.Cache
	}
	ramBytes := s.MemoryStats.Usage
	if ramBytes > cache {
		ramBytes -= cache
	}
	ramMB := int(ramBytes / 1024 / 1024)

	// Network KB
	var rxKB, txKB int64
	for _, n := range s.Networks {
		rxKB += int64(n.RxBytes / 1024)
		txKB += int64(n.TxBytes / 1024)
	}

	// Disk KB
	var readKB, writeKB int64
	for _, b := range s.BlkioStats.IoServiceBytesRecursive {
		switch b.Op {
		case "Read":
			readKB += int64(b.Value / 1024)
		case "Write":
			writeKB += int64(b.Value / 1024)
		}
	}

	return &containerMetrics{
		CPUPct:      cpuPct,
		RAMMB:       ramMB,
		NetRxKB:     rxKB,
		NetTxKB:     txKB,
		DiskReadKB:  readKB,
		DiskWriteKB: writeKB,
	}, nil
}
