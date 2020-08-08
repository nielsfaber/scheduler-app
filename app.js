var events = require('events');
var _ = require('underscore');
var crypto = require('crypto');

var MqttHandler = require('./mqtt.js')
var Timer = require('./timer.js');
const yaml = require('./yaml.js');
const config = yaml.Load('settings.yaml');

var mqtt = new MqttHandler();

mqtt.Connect(config['mqtt_settings']);


function IsValidId(id) {
    return id.match(/^scheduler\_[0-9|a-f]{6}$/);
}

function GenerateId() {
    return `scheduler_${crypto.randomBytes(3).toString('hex')}`;
}


class SchedulerItem extends events.EventEmitter {
    constructor(id, cfg) {
        super();
        this.id = id;
        this.config = cfg;

        this.timer = Timer.Create({
            time: this.config['time'],
            days: this.config['days'],
            cooldown_period: Timer.Duration(1, 'minutes')
        });

        this.timer.on('trigger', this.HandleTrigger.bind(this));
        this.timer.on('reset', this.HandleReset.bind(this));
        this.timer.on('valid', () => {
            if (this.config['enabled']) this.StartTimer();
        });
        this.timer.on('updated', (timestamp) => {
            console.log(`updated timer for ${this.id}, will trigger ${timestamp}`);
            mqtt.Publish(`${this.id}/next_trigger`, this.timer.next_trigger);
        });

        mqtt.on(`${this.id}/discover`, () => {
            _(this.config).each((val, key) => {
                mqtt.Publish(`${id}/${key}`, val);
            });
        });
        mqtt.on(`${this.id}/turn_on`, this.StartTimer.bind(this));
        mqtt.on(`${this.id}/turn_off`, this.StopTimer.bind(this));
        mqtt.on(`${this.id}/remove`, () => {
            console.log(`removing ${this.id}`);
            this.timer.Stop();
            mqtt.Publish(`${id}/removed`, true);
            this.emit('removed', this.id);
        });
        mqtt.on(`${this.id}/edit`, this.UpdateConfig.bind(this));
    }

    StartTimer() {
        var timestamp = this.timer.Start();
        if (!timestamp) {
            console.log(`timer for ${this.id} is queued`);
        } else {
            console.log(`set up timer for ${this.id}, will trigger ${timestamp}`);
            mqtt.Publish(`${this.id}/next_trigger`, this.timer.next_trigger);
        }

        if (!this.config['enabled']) {
            console.log(`updating state of ${this.id} to enabled`);
            this.config['enabled'] = true;
            mqtt.Publish(`${this.id}/enabled`, true);
            this.emit('updated');
        }
    }

    StopTimer() {
        this.timer.Stop();

        if (this.config['enabled']) {
            console.log(`updating state of ${this.id} to disabled`);
            this.config['enabled'] = false;
            mqtt.Publish(`${this.id}/enabled`, false);
            mqtt.Publish(`${this.id}/next_trigger`, null);
            this.emit('updated');
        }
    }

    HandleTrigger() {
        console.log(`timer ${this.id} was triggered!`);
        mqtt.publish(`${this.id}/triggered`, true);
    }

    HandleReset() {
        console.log(`timer ${this.id} was reset!`);
        mqtt.publish(`${this.id}/triggered`, false);
    }

    UpdateConfig(data) {
        data = JSON.parse(data);
        var updated = false;
        _(data).each((val, key) => {
            if (this.config[key] == val) return;
            updated = true;
            this.config[key] = val;
            mqtt.Publish(`${this.id}/${key}`, val);
        });
        if (!updated) return;
        this.StartTimer();
        this.emit('updated');
    }
}

class Scheduler {
    constructor() {
        this.entities = [];

        //discovery 
        mqtt.on('connect', this.StartDiscovery.bind(this));
        mqtt.on('connection_open', this.StartDiscovery.bind(this));

        mqtt.on('add', (cfg) => {
            cfg = JSON.parse(cfg);
            this.AddEntity(cfg);
            this.UpdateConfig();
        });

        mqtt.on('sunrise', Timer.SetSunrise.bind(this));
        mqtt.on('sunset', Timer.SetSunset.bind(this));
    }

    StartDiscovery() {

        _(this.entities).each(el => {
            mqtt.Publish(el.id, null);
        });

    }

    AddEntity(data, id = null) {
        if (!id || !IsValidId(id)) {
            do { id = GenerateId(); }
            while (_(this.entities).findWhere({ id: id }));
        }

        var cfg = {
            time: data.time,
            days: _(data).has('days') ? data.days : [],
            entity: data.entity,
            service: data.service,
            enabled: true
        }

        if (_(data).has('service_data')) Object.assign(cfg, { service_data: data.service_data });

        console.log(`creating new rule '${id}'`);
        var item = new SchedulerItem(id, cfg);

        item.on('updated', this.UpdateConfig.bind(this));
        item.on('removed', this.RemoveEntity.bind(this));
        mqtt.Publish(item.id, null);
        this.entities.push(item);
    }

    RemoveEntity(id) {
        _(this.entities).each((el, i) => {
            if (!el) return;
            if (el.id == id) this.entities.splice(i, 1);
        });
        this.UpdateConfig();
    }

    LoadConfig() {
        var data = yaml.Load(config['entity_file']);

        _(data).each((cfg, id) => {
            this.AddEntity(cfg, id);
        })
    }

    UpdateConfig() {
        var output = _(this.entities)
            .chain()
            .indexBy('id')
            .mapObject(e => { return e.config })
            .value();
        console.log('saving changed config');
        yaml.Save(config['entity_file'], output);
    }

    StartTimers() {
        _(this.entities).each(el => {
            if (el.config['enabled']) el.StartTimer();
        });
    }
}


var scheduler = new Scheduler();
scheduler.LoadConfig();
scheduler.StartTimers();
