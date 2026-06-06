package deploy

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strings"
)

var (
	namePattern   = regexp.MustCompile(`^[a-z][a-z0-9-]{1,62}$`)
	domainPattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`)
)

// ValidateName checks app and function identifiers used in URLs and registry keys.
func ValidateName(kind, name string) error {
	if !namePattern.MatchString(name) {
		return fmt.Errorf("%s %q must use lowercase letters, numbers, hyphens, start with a letter, and be 2-63 characters", kind, name)
	}
	return nil
}

// ValidateRoute checks HTTP route shape.
func ValidateRoute(route string) error {
	if route == "" {
		return fmt.Errorf("route cannot be empty")
	}
	if !strings.HasPrefix(route, "/") {
		return fmt.Errorf("route %q must start with /", route)
	}
	if strings.Contains(route, " ") || strings.Contains(route, "//") {
		return fmt.Errorf("route %q cannot contain spaces or repeated slashes", route)
	}
	parsed, err := url.ParseRequestURI(route)
	if err != nil {
		return fmt.Errorf("route %q is not a valid request path: %w", route, err)
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return fmt.Errorf("route %q cannot include query strings or fragments", route)
	}
	return nil
}

// ValidateDomain checks custom deployment domain syntax.
func ValidateDomain(domain string) error {
	if domain == "" {
		return nil
	}
	normalized := strings.TrimSuffix(strings.ToLower(domain), ".")
	if normalized != domain {
		return fmt.Errorf("domain %q must be lowercase and must not end with a dot", domain)
	}
	if len(domain) > 253 || !domainPattern.MatchString(domain) {
		return fmt.Errorf("domain %q is not a valid hostname", domain)
	}
	if net.ParseIP(domain) != nil {
		return fmt.Errorf("domain %q must be a hostname, not an IP address", domain)
	}
	return nil
}

func randomSuffix() (string, error) {
	var bytes [3]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", fmt.Errorf("generate deployment suffix: %w", err)
	}
	return hex.EncodeToString(bytes[:]), nil
}

func generatedURL(appName, functionName, route, domain string) (string, error) {
	if route == "" {
		route = "/" + functionName
	}
	if domain != "" {
		return "https://" + domain + route, nil
	}
	suffix, err := randomSuffix()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("https://%s-%s-%s.wasmdee.local%s", appName, functionName, suffix, route), nil
}
