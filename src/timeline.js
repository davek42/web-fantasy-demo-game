/**
 * A tiny scheduler: `at(time, fn)` queues a callback, `update(delta)` fires
 * everything that has come due, `flush()` fires the rest immediately. One
 * timeline per replayed command; flush the old one when a new command arrives.
 */
export class Timeline {
  constructor() {
    this.items = [];
    this.time = 0;
  }
  at(time, fn) {
    this.items.push({ time, fn });
  }
  update(delta) {
    this.time += delta;
    const due = this.items.filter((item) => item.time <= this.time);
    this.items = this.items.filter((item) => item.time > this.time);
    for (const item of due.sort((a, b) => a.time - b.time)) item.fn();
  }
  flush() {
    const rest = this.items.sort((a, b) => a.time - b.time);
    this.items = [];
    for (const item of rest) item.fn();
  }
  get done() {
    return this.items.length === 0;
  }
}
