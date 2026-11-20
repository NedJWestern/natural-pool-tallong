.PHONY: deploy

# Deploy the 3D model to https://littlegecko.party/natural-pool/
#
# Runs locally on the droplet (ssh alias `bluering`), like the other apps'
# targets: `ssh bluering`, then `cd ~/repos/natural-pool-tallong && make deploy`.
# Run as root.
#
# Only the page itself (index.html + src/) is copied to /var/www/natural-pool,
# which Caddy serves directly (route in the little-gecko-party repo,
# setup/Caddyfile). The repo checkout under /root isn't readable by the
# unprivileged `caddy` user, and copying keeps the README, drawing and .git
# off the public site.
deploy:
	git pull --ff-only
	mkdir -p /var/www/natural-pool
	cp index.html /var/www/natural-pool/
	cp -r src /var/www/natural-pool/
