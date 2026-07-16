# Cloudflare Terraform

> Phase 4 — competitive-architecture-analysis. Tier 1.5 — IaC for
> the edge layer.

## What's provisioned

| Resource | Purpose |
|---|---|
| `cloudflare_record.api` | DNS for the API origin |
| `cloudflare_record.web` | DNS for the SPA origin |
| `cloudflare_ruleset.zone_cache` | Cache Rules (TTL per endpoint) |
| `cloudflare_ruleset.zone_cache_bypass` | Bypass for authenticated routes |
| `cloudflare_ruleset.zone_waf` | WAF custom rules (geo-fence, rate-limit, scrapers) |
| `cloudflare_ruleset.security_headers` | HSTS + Permissions-Policy on every response |

## Apply

```bash
cd cloudflare/terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars with your real zone_name + origins
export CLOUDFLARE_API_TOKEN="…"
terraform init
terraform plan  -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

## CI integration

`.github/workflows/deploy-cloudflare.yml` (placeholder — add when
moving to staging):

```yaml
- uses: cloudflare/terraform-cloudflare-action@v1
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cmd: apply
    workingDirectory: cloudflare/terraform
```

## Notes

- `phase = "http_request_firewall_custom"` runs BEFORE origin — WAF
  blocks happen here.
- `phase = "cache_key"` sets the cache key. `phase = "edge"` would
  set the TTL (we use cache_key + a separate `cache_rules` set
  for actual TTL).
- `phase = "http_response_headers_transform"` modifies response
  headers outbound.
- `rate_limit()` is a WAF expression — uses Cloudflare's native
  rate-limit rules (no script needed).

## Outputs

`terraform output zone_id` → paste into the API's `CLOUDFLARE_ZONE_ID`
env var so the integration in `apps/api/src/lib/cloudflare.ts:purgeTags`
can target the right zone.