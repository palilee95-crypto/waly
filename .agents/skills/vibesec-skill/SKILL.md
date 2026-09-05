---
name: vibesec-skill
description: Comprehensive secure coding guide for web applications covering Access Control, IDOR, XSS, CSRF, sensitive data exposure, and open redirect prevention. Use when building or auditing web application security.
---

# Secure Coding Guide for Web Applications (VibeSec)

## Overview

This guide provides comprehensive secure coding practices for web applications. As an AI assistant, your role is to approach code from a **bug hunter's perspective** and make applications **as secure as possible** without breaking functionality.

**Key Principles:**
- **Defense in depth:** Never rely on a single security control
- **Fail securely:** When something fails, fail closed (deny access)
- **Least privilege:** Grant minimum permissions necessary
- **Input validation:** Never trust user input, validate everything server-side
- **Output encoding:** Encode data appropriately for the context it's rendered in

---

## Access Control & Authorization

Access control vulnerabilities occur when users can access resources or perform actions beyond their intended permissions.

### Core Requirements

For **every data point and action** that requires authentication:

1. **User-Level Authorization**
   - Each user must only access/modify their own data
   - No user should access data from other users or organizations
   - Always verify ownership at the data layer, not just the route level

2. **Use Non-Guessable IDs Instead of Sequential IDs**
   - Use UUIDv4 or randomized string identifiers (e.g. 15-char random alphanumeric)
   - Never rely on sequential integer IDs for public-facing resource references

3. **Account Lifecycle Handling**
   - When a user is removed from an organization: immediately revoke all access tokens and sessions
   - When an account is deleted/deactivated: invalidate all active sessions and API keys
   - Implement token revocation lists or short-lived tokens with refresh mechanisms

### Authorization Checks Checklist

- [ ] Verify user owns the resource on every request (don't trust client-side data)
- [ ] Check organization / merchant membership for multi-tenant apps
- [ ] Validate role permissions for role-based actions
- [ ] Re-validate permissions after any privilege change
- [ ] Check parent resource ownership (e.g., if accessing a comment, verify user owns the parent post)

### Common Pitfalls to Avoid

- **IDOR (Insecure Direct Object Reference):** Always verify the requesting user has permission to access the requested resource ID
- **Privilege Escalation:** Validate role changes server-side; never trust role info from client
- **Horizontal Access:** User A accessing User B's resources with the same privilege level
- **Vertical Access:** Regular user accessing admin functionality
- **Mass Assignment:** Filter which fields users can update; don't blindly accept all request body fields

---

## Client-Side Security

### Cross-Site Scripting (XSS)

Every input controllable by the user—whether directly or indirectly—must be sanitized against XSS.

#### Input Sources to Protect

**Direct Inputs:**
- Form fields (email, name, bio, comments, etc.)
- Search queries
- File names during upload
- Rich text editors / WYSIWYG content

**Indirect Inputs:**
- URL parameters and query strings
- URL fragments (hash values)
- HTTP headers used in the application (Referer, User-Agent if displayed)
- Data from third-party APIs displayed to users
- WebSocket messages
- postMessage data from iframes
- LocalStorage/SessionStorage values if rendered

**Often Overlooked:**
- Error messages that reflect user input
- PDF/document generators that accept HTML
- Email templates with user data
- Log viewers in admin panels
- JSON responses rendered as HTML
- SVG file uploads (can contain JavaScript)
- Markdown rendering (if allowing HTML)

#### Protection Strategies

1. **Output Encoding** (Context-Specific)
   - HTML context: HTML entity encode (`<` → `&lt;`)
   - JavaScript context: JavaScript escape
   - URL context: URL encode
   - CSS context: CSS escape
   - Use framework's built-in escaping (React JSX, etc.)

2. **Content Security Policy (CSP)**
   ```
   Content-Security-Policy: 
     default-src 'self';
     script-src 'self';
     style-src 'self' 'unsafe-inline';
     img-src 'self' data: https:;
     font-src 'self';
     connect-src 'self' https://api.yourdomain.com;
     frame-ancestors 'none';
     base-uri 'self';
     form-action 'self';
   ```

3. **Input Sanitization**
   - Use established libraries (DOMPurify for HTML)
   - Whitelist allowed tags/attributes for rich text
   - Strip or encode dangerous patterns

4. **Security Headers**
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY` (or CSP frame-ancestors)

---

### Cross-Site Request Forgery (CSRF)

Every state-changing endpoint must be protected against CSRF attacks.

#### Endpoints Requiring CSRF Protection

**Authenticated Actions:**
- All POST, PUT, PATCH, DELETE requests
- Any GET request that changes state (fix these to use proper HTTP methods)
- File uploads
- Settings changes
- Payment/transaction endpoints

**Pre-Authentication Actions:**
- Login endpoints (prevent login CSRF)
- Signup endpoints
- Password reset request endpoints
- Password change endpoints
- Email/phone verification endpoints
- OAuth callback endpoints

#### Protection Mechanisms

1. **CSRF Tokens / Bearer Auth**
   - Generate cryptographically random tokens or require explicit Bearer authorization header
   - Validate on every state-changing request
   - Regenerate after login

2. **SameSite Cookies**
   ```
   Set-Cookie: session=abc123; SameSite=Strict; Secure; HttpOnly
   ```
   - `Strict`: Cookie never sent cross-site (best security)
   - `Lax`: Cookie sent on top-level navigations (good balance)

---

### Secret Keys & Sensitive Data Exposure

No secrets or sensitive information should be accessible to client-side code.

#### Never Expose in Client-Side Code

**API Keys and Secrets:**
- Third-party API secret keys (Stripe, AWS, Meta Cloud API access tokens)
- Database connection strings
- JWT signing secrets
- Encryption keys
- OAuth client secrets
- Internal service credentials

**Sensitive User Data:**
- Full credit card numbers
- Passwords (even hashed)
- Security questions/answers
- Full phone numbers (mask when displaying publicly)
- Sensitive PII that isn't needed for display

**Infrastructure Details:**
- Internal IP addresses
- Database schemas / error dumps
- Stack traces in production
- Server software versions

#### Where Secrets Hide (Check These!)
- JavaScript bundles (including source maps)
- HTML comments
- Hidden form fields
- Data attributes
- LocalStorage / SessionStorage
- Environment variables exposed via build tools (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`)

---

## Open Redirect Prevention

Any endpoint accepting a URL for redirection must be protected against open redirect attacks.

### Protection Strategies

1. **Allowlist Validation**
   ```javascript
   const allowedDomains = ['risev.app', 'api.risev.app'];
   function isValidRedirect(url) {
     try {
       const parsed = new URL(url, 'https://risev.app');
       return allowedDomains.includes(parsed.hostname);
     } catch (e) {
       return false;
     }
   }
   ```

2. **Relative URLs Only**
   - Only accept paths (e.g., `/dashboard`) not full external URLs
   - Validate the path starts with a single `/` and doesn't contain `//` or `\`
