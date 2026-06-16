package runtime

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/dheeraj/wasmdee/internal/state"
)

type storedDeploymentPolicy struct {
	Controls struct {
		Preload          *bool  `json:"preload"`
		MaxConcurrency   int    `json:"max_concurrency"`
		ScaleToZeroAfter string `json:"scale_to_zero_after"`
	} `json:"controls"`
}

func functionDeploymentPolicy(fn state.Function) (storedDeploymentPolicy, error) {
	if fn.Capabilities == "" {
		return storedDeploymentPolicy{}, nil
	}
	var policy storedDeploymentPolicy
	if err := json.Unmarshal([]byte(fn.Capabilities), &policy); err != nil {
		return storedDeploymentPolicy{}, fmt.Errorf("decode deployment controls for %q: %w", fn.Name, err)
	}
	if policy.Controls.MaxConcurrency < 0 {
		return storedDeploymentPolicy{}, fmt.Errorf("deployment control max_concurrency for %q cannot be negative", fn.Name)
	}
	if policy.Controls.ScaleToZeroAfter != "" {
		if _, err := time.ParseDuration(policy.Controls.ScaleToZeroAfter); err != nil {
			return storedDeploymentPolicy{}, fmt.Errorf("decode scale_to_zero_after for %q: %w", fn.Name, err)
		}
	}
	return policy, nil
}

func functionMaxConcurrency(fn state.Function) (int, error) {
	policy, err := functionDeploymentPolicy(fn)
	if err != nil {
		return 0, err
	}
	return policy.Controls.MaxConcurrency, nil
}

func functionShouldPreload(fn state.Function) (bool, error) {
	policy, err := functionDeploymentPolicy(fn)
	if err != nil {
		return false, err
	}
	return policy.Controls.Preload == nil || *policy.Controls.Preload, nil
}

func functionScaleToZeroAfter(fn state.Function) (time.Duration, error) {
	policy, err := functionDeploymentPolicy(fn)
	if err != nil {
		return 0, err
	}
	if policy.Controls.ScaleToZeroAfter == "" {
		return 0, nil
	}
	return time.ParseDuration(policy.Controls.ScaleToZeroAfter)
}
