
var events = require('events');
const moment = require('moment');
var _ = require('underscore');




class Timer extends events.EventEmitter {

  constructor(cfg) {
    super();

    if (cfg.time.includes('sunrise')) {
      this.time_offset = cfg.time.split('sunrise').pop();
      this.sunrise = true;
    }
    else if (cfg.time.includes('sunset')) {
      this.time_offset = cfg.time.split('sunset').pop();
      this.sunset = true;
    }
    else this.time = cfg.time;
    this.days = cfg.days;
    this.cooldown_period = cfg.cooldown_period;
  }

  Start() {
    var ts = this.CalculateTimestamp();
    if (!ts) { //timer wants to start, but it is not valid yet (due to missing sunrise/sunset info)
      this.wait_for_valid = true;
      return false;
    }
    var now = moment();
    var msFromNow = ts.diff(now, 'milliseconds');

    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.Finished();
    }, msFromNow);

    this.next_trigger = ts.toISOString();
    this.timer_started = now;

    var rel_time = moment.duration(msFromNow, 'milliseconds').humanize(true);
    return rel_time;
  }

  CalculateTimestamp() {
    if (this.time_offset) { //w.r.t. sunset/sunrise
      var ref_time = (this.sunrise) ? this.time_sunrise : this.time_sunset;
      if (!ref_time) return false; //sunrise/set info is not available yet

      var parts = ref_time.split(':');
      var ts = moment().hours(parts[0]).minutes(parts[1]).seconds(0).milliseconds(0);
      parts = this.time_offset.substring(1).split(':');

      var positive_sign = this.time_offset.startsWith('+');
      if (positive_sign) ts = ts.add({ hours: parts[0], minutes: parts[1] });
      else ts = ts.subtract({ hours: parts[0], minutes: parts[1] });
    }
    else { //absolute time
      var parts = this.time.split(':');
      var ts = moment().hours(parts[0]).minutes(parts[1]).seconds(0).milliseconds(0);
    }
    var now = moment();
    var fromNow = ts.diff(now, 'seconds');

    //if time is in past, go to next day
    while (fromNow <= 0) {
      ts = ts.add(1, 'days');
      fromNow = ts.diff(now, 'seconds');
    }

    // rule should run at specific days only
    var allowed_days = this.days;
    var weekday = ts.day();
    if (allowed_days.length) {
      while (!allowed_days.includes(weekday)) {
        ts = ts.add(1, 'days');
        weekday = ts.day();
      }
    }
    return ts;
  }

  UpdateTimestamp() {
    var ts = this.CalculateTimestamp();
    if (!ts) return;

    if (this.next_trigger && this.next_trigger != ts.toISOString()) { //the timer is running and needs to be updated
      var diff = ts.diff(moment(this.next_trigger), 'hours');
      if (diff >= 23) return; //after updating the moment is a day (or more) later, it would cause the timer to skip a day
      var rel_time = this.Start();
      this.emit('updated', rel_time);
    }
    else if (!this.next_trigger && this.wait_for_valid) { //timer is valid and can be started
      delete this.wait_for_valid;
      this.emit('valid');
    }
  }


  Stop() {
    clearTimeout(this.timer);
    delete this.next_trigger;
    delete this.timer_started;
  }

  Finished() {
    this.emit('finished');
    this.timer = setTimeout(() => {
      this.CooldownFinished();
    }, this.cooldown_period.as('milliseconds'));
  }

  CooldownFinished() {
    this.emit('reset');
    this.StartTimer();

  }
}

class TimeManager {

  constructor() {
    this.items = [];
  }

  Duration(val, unit) {
    return moment.duration(val, unit);
  }

  Create(cfg) {
    var item = new Timer(cfg);
    this.items.push(item);
    return item;
  }

  SetSunrise(val) {
    var ts = moment.utc(val).add(moment().utcOffset(), 'minutes');

    var secs_from_now = ts.diff(moment(), 'seconds');
    if (secs_from_now < 0) console.log('Warning: sunrise data is in the past');

    var time = ts.format("HH:mm");
    if (this.time_sunrise && this.time_sunrise == time) return;
    this.time_sunrise = time;

    var ts_local = moment().set({ hour: ts.hour(), minute: ts.minute() });
    var rel_time = ts_local.fromNow();

    console.log(`sunrise is ${rel_time} (${time})`);
    _(this.items)
      .chain()
      .where({ sunrise: true })
      .each(el => { el.time_sunrise = time })
      .invoke('UpdateTimestamp');
  }

  SetSunset(val) {
    var ts = moment.utc(val).add(moment().utcOffset(), 'minutes');

    var secs_from_now = ts.diff(moment(), 'seconds');
    if (secs_from_now < 0) console.log('Warning: sunset data is in the past');

    var time = ts.format("HH:mm");
    if (this.time_sunset && this.time_sunset == time) return;
    this.time_sunset = time;

    var ts_local = moment().set({ hour: ts.hour(), minute: ts.minute() });
    var rel_time = ts_local.fromNow();

    console.log(`sunset is ${rel_time} (${time})`);
    _(this.items)
      .chain()
      .where({ sunset: true })
      .each(el => { el.time_sunset = time })
      .invoke('UpdateTimestamp');
  }

}

module.exports = (new TimeManager);




    // CheckTimer() {
    //     var timer_count = this.timer._idleTimeout / 1000;
    //     var ts = this.timer_started.clone().add(timer_count, 'seconds');
    //     var fromNow = ts.diff(moment(), 'seconds');
    //     var rel_time = moment.duration(fromNow, 'seconds').humanize(true);

    //     console.log(`timer ${this.id} will trigger ${rel_time}`);

    // }