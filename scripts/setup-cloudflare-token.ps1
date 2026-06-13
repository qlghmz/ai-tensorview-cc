# Opens Cloudflare API token creation page
Start-Process "https://dash.cloudflare.com/profile/api-tokens"
Write-Host @"

Create API Token (one-time):
  1. Create Token -> Use template: Edit zone DNS
  2. Zone Resources -> Include -> Specific zone -> tensorview.cc
  3. Create Token -> copy the token

Add to .env.local:
  CLOUDFLARE_API_TOKEN=paste_token_here

Then run:
  npm run bind:domain

"@
