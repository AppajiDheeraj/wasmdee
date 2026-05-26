BIN := wasmdee
PKG := ./cmd/wasmdee

.PHONY: build test clean

build:
	go build -o bin/$(BIN) $(PKG)

test:
	go test ./...

clean:
	rm -rf bin
