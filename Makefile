BIN := wasmdee
PKG := ./cmd/wasmdee

.PHONY: build clean demo-fixture fmt test verify

build:
	go build -o bin/$(BIN) $(PKG)

demo-fixture:
	go run ./tools/handler-example

fmt:
	gofmt -w cmd internal tools

test:
	go test ./...
	go test ./tools/...
	cd benchmarks/docker && go test ./...

verify:
	test -z "$$(gofmt -l cmd internal tools)"
	go test ./...
	go test ./tools/...
	cd benchmarks/docker && go test ./...
	go run ./tools/handler-example --out /tmp/wasmdee-handler-example.wasm
	cmp examples/handler/echo.wasm /tmp/wasmdee-handler-example.wasm
	go build -o /tmp/$(BIN) $(PKG)

clean:
	rm -rf bin
