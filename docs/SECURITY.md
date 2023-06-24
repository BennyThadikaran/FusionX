## Security Features in FusionX

### CSRF protection

An alternative implementation of [csurf](https://www.npmjs.com/package/csurf) for csrf protection. These are based on inputs, from the [article by Fortbridge team](https://fortbridge.co.uk/research/a-csrf-vulnerability-in-the-popular-csurf-package/) that discovered the csurf vulnerability.

TLDR:

- Uses `SHA256` to generate the csrf token
- Token secret is not exposed to the front end.
- Implements double submit cookie pattern.
- Requires an `X-CSRF-TOKEN` custom header and `CSRF` token in the request body.
- Both must match for the request to be considered valid.
- Implementation can be found in `src/middleware/csrf.js`

### CSP and security headers

A [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) header with a CSP route for reporting csp violations.

Also sets the following security headers:

- `Strict-Transport-Security` - HTTPS only
- `X-Frame-Options: DENY` - No embeding in <iframe> etc.
- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing

Implementation can be found in `src/middleware/securityHeaders.js`

Additionally it uses [CORS](https://www.npmjs.com/package/cors) to set `Access-Control-Allow-Origin` header.

### XSS prevention

- Uses [DOMPurify](https://www.npmjs.com/package/dompurify) in the admin section to sanitize HTML content when creating blog posts.
- Uses [striptags](https://www.npmjs.com/package/striptags) in the comments system to strip HTML from user generated comments.
