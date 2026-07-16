# ============================================================================
# Cloudflare Terraform — Noufex edge configuration
# ----------------------------------------------------------------------------
# Tier 1.5 — competitive-architecture-analysis.
#
# Provisions the edge layer that the API relies on for fast static
# delivery, WAF, and rate-limiting. Re-runnable (idempotent); apply
# via:
#
#   cd cloudflare/terraform
#   terraform init
#   terraform plan  -var-file=prod.tfvars
#   terraform apply -var-file=prod.tfvars
#
# Required provider env vars (set in CI secrets):
#   CLOUDFLARE_API_TOKEN   — scoped to Zone:DNS Edit + Zone:Cache Purge
#   CLOUDFLARE_ACCOUNT_ID  — for Access / Workers if added later
#
# Optional:
#   CLOUDFLARE_ZONE_ID     — only needed for ad-hoc `wrangler purge`
#                            outside this Terraform state.
# ============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
}

provider "cloudflare" {
  # Token is read from the CLOUDFLARE_API_TOKEN env var.
  # Account ID is read from CLOUDFLARE_ACCOUNT_ID when needed for
  # Access / Workers; the resources below are all zone-scoped.
}

variable "zone_name" {
  description = "The DNS zone name (e.g. noufex.com)."
  type        = string
}

variable "api_origin" {
  description = "The origin hostname the API is served from (e.g. api.noufex.com)."
  type        = string
}

variable "web_origin" {
  description = "The origin hostname the SPA is served from (e.g. app.noufex.com)."
  type        = string
}

variable "target_countries" {
  description = "ISO 3166-1 alpha-2 country codes allowed on the public surface."
  type        = list(string)
  default = [
    "YE", "SA", "AE", "OM", "BH", "KW", "QA",
    "EG", "JO", "IQ", "SD",
  ]
}

# ── Data sources ────────────────────────────────────────────────────
data "cloudflare_zone" "noufex" {
  name = var.zone_name
}

# ── DNS records ─────────────────────────────────────────────────────
# Both origin hostnames are CNAMEs to the load balancer or API
# gateway. Replace with your own A / CNAME targets.
resource "cloudflare_record" "api" {
  zone_id = data.cloudflare_zone.noufex.id
  name    = var.api_origin
  type    = "CNAME"
  value   = "${var.api_origin}.origin.noufex.internal"
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "web" {
  zone_id = data.cloudflare_zone.noufex.id
  name    = var.web_origin
  type    = "CNAME"
  value   = "${var.web_origin}.origin.noufex.internal"
  proxied = true
  ttl     = 1
}

# ── Cache Rules ─────────────────────────────────────────────────────
# (Match the rules documented in cloudflare/page-rules.md.)
# Rules are evaluated in order — first match wins.

resource "cloudflare_ruleset" "zone_cache" {
  zone_id     = data.cloudflare_zone.noufex.id
  name        = "noufex-cache-rules"
  description = "Tiered cache + browser TTL for catalog, stats, shipping."
  kind        = "zone"
  phase       = "cache_key"

  rules = [
    {
      action      = "set_cache_settings"
      action_parameters = {
        cache_key = {
          cache_by_device_type = false
          ignore_query_strings_order = false
        }
        edge_ttl = {
          mode    = "override_origin"
          default = 60
        }
        browser_ttl = {
          mode = "override_origin"
        }
      }
      expression     = "(http.request.uri.path matches \"^/api/products/\")"
      description    = "Catalog products (5 min server, respect browser)"
      enabled        = true
    },
    {
      action      = "set_cache_settings"
      action_parameters = {
        edge_ttl = {
          mode    = "override_origin"
          default = 3600
        }
        browser_ttl = {
          mode    = "override_origin"
          default = 300
        }
      }
      expression     = "(http.request.uri.path eq \"/api/categories\")"
      description    = "Categories tree (1 h edge, 5 min browser)"
      enabled        = true
    },
    {
      action      = "set_cache_settings"
      action_parameters = {
        edge_ttl = {
          mode    = "override_origin"
          default = 30
        }
        browser_ttl = {
          mode    = "override_origin"
          default = 15
        }
      }
      expression     = "(http.request.uri.path eq \"/api/stats/home\")"
      description    = "Home stats (30 s edge, 15 s browser)"
      enabled        = true
    },
    {
      action      = "set_cache_settings"
      action_parameters = {
        edge_ttl = {
          mode    = "override_origin"
          default = 300
        }
        browser_ttl = {
          mode    = "override_origin"
          default = 60
        }
      }
      expression     = "(http.request.uri.path matches \"^/api/shipping/\")"
      description    = "Shipping methods (5 min edge)"
      enabled        = true
    },
    {
      action      = "set_cache_settings"
      action_parameters = {
        edge_ttl = {
          mode    = "override_origin"
          default = 60
        }
        browser_ttl = {
          mode    = "override_origin"
          default = 30
        }
        cache_key = {
          ignore_query_strings_order = false
        }
      }
      expression     = "(http.request.uri.path eq \"/api/search/suggest\")"
      description    = "Search autocomplete (1 min edge, 30 s browser)"
      enabled        = true
    },
    {
      action      = "set_cache_settings"
      action_parameters = {
        edge_ttl = {
          mode    = "override_origin"
          default = 31536000
        }
        browser_ttl = {
          mode    = "override_origin"
          default = 31536000
        }
      }
      expression     = "(http.request.uri.path matches \"^/assets/\")"
      description    = "Hashed assets (1 y immutable)"
      enabled        = true
    },
  ]
}

# Cache bypass for authenticated + mutating routes.
resource "cloudflare_ruleset" "zone_cache_bypass" {
  zone_id     = data.cloudflare_zone.noufex.id
  name        = "noufex-cache-bypass"
  description = "Skip cache for authenticated traffic."
  kind        = "zone"
  phase       = "cache_key"

  rules = [
    {
      action  = "bypass_cache"
      action_parameters = {
        cache = true
      }
      expression = join(" OR ", [
        "(http.request.uri.path matches \"^/api/auth/\")",
        "(http.request.uri.path matches \"^/api/admin/\")",
        "(http.request.uri.path matches \"^/api/orders/\")",
        "(http.request.uri.path matches \"^/api/cart/\")",
        "(http.request.uri.path matches \"^/api/wishlist/\")",
        "(http.request.uri.path matches \"^/api/messages/\")",
        "(http.request.uri.path matches \"^/api/notifications/\")",
        "(http.request.uri.path matches \"^/api/customer/\")",
        "(http.request.uri.path matches \"^/api/seller/\")",
        "(http.request.uri.path matches \"^/api/payments/\")",
        "(http.request.uri.path matches \"^/api/refunds/\")",
        "(http.request.uri.path eq \"/api/health\")",
        "(http.request.uri.path eq \"/api/ready\")",
      ])
      description = "Authenticated + mutating routes never cache."
      enabled     = true
    },
  ]
}

# ── WAF — Custom Rules ──────────────────────────────────────────────
# Documented in cloudflare/waf-rules.md.

resource "cloudflare_ruleset" "zone_waf" {
  zone_id     = data.cloudflare_zone.noufex.id
  name        = "noufex-waf"
  description = "WAF + geo-fence + bot mitigation."
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [
    {
      action      = "block"
      action_parameters = {
        response = {
          status_code = 403
          content_type = "text/plain"
          content     = "Forbidden by Noufex WAF"
        }
      }
      expression     = "ip.src.country ne \"${join("\" and ip.src.country ne \"", var.target_countries)}\""
      description    = "Geo-fence: only allow target countries on the API."
      enabled        = true
    },
    {
      action      = "challenge"
      action_parameters = {
        challenges = ["managed_challenge"]
      }
      expression     = "(http.request.uri.path matches \"^/api/auth/login$\") and (rate_limit(rl_login, 5, 60))"
      description    = "Login rate limit: 5 req/min/IP — managed challenge."
      enabled        = true
      rate_limit = {
        name        = "rl_login"
        period      = 60
        requests_per_period = 5
        mitigation_timeout  = 300
      }
    },
    {
      action      = "block"
      expression  = "(http.user_agent matches \"(?i)(scrapy|httpclient|python-requests|curl/7\\.|wget|nikto|sqlmap|acunetix)\")"
      description = "Block obvious scraper UAs."
      enabled     = true
    },
    {
      action      = "block"
      expression  = "(http.request.uri.path matches \"^/api/payments/webhook/\") and (not any(http.request.headers[\"x-webhook-signature\"][*]))"
      description = "Reject unsigned payment webhooks."
      enabled     = true
    },
    {
      action      = "block"
      expression  = "(http.request.uri.path contains \"..\")"
      description = "Block obvious directory traversal attempts."
      enabled     = true
    },
  ]
}

# ── Transform Rules (response headers) ─────────────────────────────

resource "cloudflare_ruleset" "security_headers" {
  zone_id     = data.cloudflare_zone.noufex.id
  name        = "noufex-security-headers"
  description = "Add HSTS + Permissions-Policy on every response. CSP is set per-request by the API (nonce-based) so we don't duplicate it here."
  kind        = "zone"
  phase       = "http_response_headers_transform"

  rules = [
    {
      action = "rewrite"
      action_parameters = {
        headers = [
          {
            name      = "Strict-Transport-Security"
            operation = "set"
            value     = "max-age=31536000; includeSubDomains; preload"
          },
          {
            name      = "X-Content-Type-Options"
            operation = "set"
            value     = "nosniff"
          },
          {
            name      = "Referrer-Policy"
            operation = "set"
            value     = "strict-origin-when-cross-origin"
          },
          {
            name      = "Permissions-Policy"
            operation = "set"
            value     = "camera=(), microphone=(), geolocation=(self), payment=()"
          },
        ]
      }
      expression  = "true"
      description = "Security headers on every response."
      enabled     = true
    },
  ]
}

# ── Outputs ─────────────────────────────────────────────────────────
output "zone_id" {
  value       = data.cloudflare_zone.noufex.id
  description = "Pass to the API's CLOUDFLARE_ZONE_ID env var for ad-hoc cache purge."
}