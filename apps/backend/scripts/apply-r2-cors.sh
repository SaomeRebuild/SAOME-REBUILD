#!/bin/bash
# Apply CORS configuration to the R2 bucket
# Usage: npm run r2:apply-cors
#
# Requires:
# - Cloudflare account configured with `wrangler login`
# - R2 bucket named "saome" exists
#
# The CORS policy allows:
# - PUT requests from localhost and saome-frontend.pages.dev
# - Content-Type header for uploads
# - 1 hour caching for preflight responses

npx wrangler r2 bucket cors set saome --file r2-cors.json
