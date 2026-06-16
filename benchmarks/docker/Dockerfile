FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod main.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/echo .

FROM scratch
COPY --from=build /out/echo /echo
EXPOSE 8080
ENTRYPOINT ["/echo"]
