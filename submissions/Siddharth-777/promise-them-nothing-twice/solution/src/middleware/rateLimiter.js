const { resolveLimit } = require('../configResolver');
const { checkRateLimit } = require('../redis-client');

async function rateLimiter(req, res, next) {
  const customerId = req.headers['x-customer-id'];

  if (!customerId) {
    return res.status(401).json({ error: 'missing_customer_id' });
  }

  const limit = resolveLimit(customerId);

  if (limit === null) {
    return res.status(403).json({ error: 'unknown_customer' });
  }

  try {
    const result = await checkRateLimit(
      customerId,
      limit.baseLimit,
      limit.overrideLimit,
      limit.overrideStart,
      limit.overrideEnd,
      limit.windowSize
    );

    if (result.allowed) {
      res.set('X-RateLimit-Limit', String(result.effectiveLimit));
      res.set('X-RateLimit-Remaining', String(Math.max(0, result.effectiveLimit - result.currentCount)));
      return next();
    }

    res.set('Retry-After', String(result.retryAfter));
    res.set('X-RateLimit-Limit', String(result.effectiveLimit));
    res.set('X-RateLimit-Remaining', '0');
    return res.status(429).json({ error: 'rate_limit_exceeded' });
  } catch (err) {
    console.error('[rateLimiter] Redis failure (fail-closed), customer:', customerId, 'error:', err.message);
    res.set('Retry-After', '1');
    return res.status(429).json({ error: 'service_unavailable_fail_closed' });
  }
}

module.exports = rateLimiter;
