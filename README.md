# scheduler-app

## Installation

### Installation using Docker

1. Clone this repository `git clone https://github.com/nielsfaber/scheduler-app.git` into the desired target directory.
 
2. Go into the directory `scheduler-app` and build the Docker image `docker build -t nielsfaber/scheduler-app .` 

3. Configure the Docker container, for example using docker-compose:
```yaml
  scheduler-app:
    container_name: scheduler-app
    image:  nielsfaber/scheduler-app:latest
    environment:
      - NODE_ENV=production
    volumes:
      - <source file directory>:/usr/src/app
    environment:
      - TZ=Europe/Amsterdam
    command: "npm start"
    depends_on:
      - mqtt
    network_mode: host
    restart: unless-stopped
```
4. Start the Docker container: `docker-compose up -d scheduler-app`.

#### Uninstall steps

1. Stop the Docker container: `docker-compose stop scheduler-app`.

2. Find the ID of the Docker container labeled `nielsfaber/scheduler-app` using `docker ps -a`. Delete it using `docker rm <container-id>`

3. Find the ID of the Docker image label `nielsfaber/scheduler-app` using `docker images`. Delete it using `docker rmi <image-id>`.

### Installation without Docker

1. Clone this repository `git clone https://github.com/nielsfaber/scheduler-app.git` into the desired target directory.
 
2. Go into the directory `scheduler-app` and install the packages using `npm install`.

3. Configure a service to automatically run the `app.js` script, for example using [forever-service](https://www.npmjs.com/package/forever-service). Alternatively, you can set up a service as `/etc/systemd/system/scheduler-app.service`:
```
[Unit]
Description=Node.js scheduler app
After=network-online.target

[Service]
ExecStart=/usr/bin/node <source file directory>/app.js
WorkingDirectory=<source file directory>
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=scheduler-app
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=default.target
```

4. Reload your services using `sudo systemctl daemon-reload` and enable the service to auto-start `sudo systemctl enable scheduler-app.service`.
### Updating

* To update, execute `git clone` in the original directory to get the latest source files.

* If installed using Docker, then follow the uninstall steps to remove the existing Docker image and build a new image.

* If installed without docker, restart the service `systemctl restart scheduler-app.service`.
