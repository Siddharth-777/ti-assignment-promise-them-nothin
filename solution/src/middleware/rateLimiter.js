// Rate limiter middleware.
// Reads X-Customer-Id, calls configResolver.resolveLimit(),
// calls limiter.checkAndRecord(), translates result to HTTP response.
// Zero Redis calls, zero Lua text, zero window/limit arithmetic.
