BIN := wasmdee
PKG := ./cmd/wasmdee

.PHONY: build clean fmt test verify

build:
	go build -o bin/$(BIN) $(PKG)

fmt:
	gofmt -w cmd internal

test:
	go test ./...

verify:
	test -z "$$(gofmt -l cmd internal)"
	go test ./...
	go build -o /tmp/$(BIN) $(PKG)

clean:
	rm -rf bin
