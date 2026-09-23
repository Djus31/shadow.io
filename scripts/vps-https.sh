#!/bin/bash
set -e
cat >/etc/systemd/system/shadowio.service <<END
[Unit]
Description=SHADOW.io
After=network.target

[Service]
WorkingDirectory=/var/www/shadow.io
Environment=PORT=8082
Environment=MAX_PLAYERS=8
Environment=BOT_FILL=8
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
END

cat >/etc/caddy/Caddyfile <<END
shadowio.duckdns.org {
	reverse_proxy 127.0.0.1:8082
}
END

systemctl daemon-reload
systemctl enable shadowio caddy
systemctl restart shadowio
sleep 2
systemctl restart caddy
sleep 2
echo "--- shadowio ---"
systemctl is-active shadowio
echo "--- caddy ---"
systemctl is-active caddy
ss -tlnp | grep -E ':80|:443|:8082' || true
