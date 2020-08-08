

var events = require('events');
var mqtt = require('mqtt');

class MqttHandler extends events.EventEmitter {
  constructor() {
    super();
  }

  Connect(cfg) {
    console.log(`connecting to mqtt host on ${cfg['host']}...`);

    this.client = mqtt.connect(cfg['host'], {
      will: {
        topic: `${cfg['topic_root']}/status`,
        payload: 'offline',
        retain: true
      }
    });

    this.client.on('error', e => {
      console.log(`mqtt error occured: ${e}`);
    });
    this.client.on('error', e => {
        console.log(`mqtt error occured: ${e}`);
    });
    this.client.on('close', () => {
        console.log(`mqtt connection was closed`);
    });

    this.topic_root = cfg['topic_root'];

    this.client.on('connect', () => {
      console.log('listening for mqtt messages...');
      this.client.subscribe(`${this.topic_root}/#`);
      this.client.publish('scheduler/status', 'online', { retain: true });
      this.emit('connection_open');
    });

    this.client.on('message', (topic, payload) => {
      topic = topic.split(`${this.topic_root}/`).pop();
      this.emit(topic, payload.toString());
    });
  }

  Publish(topic, payload, options = {}) {
    if (typeof payload == 'object') payload = JSON.stringify(payload);
    else payload = String(payload);
    this.client.publish(`${this.topic_root}/${topic}`, payload, options);
  }
}

module.exports = MqttHandler;