const { fork } = require('child_process');
const path = require('path');
const kill = require('tree-kill');

class StealthBrowserRunner {
  constructor() {
    this.startChild();
  }

  startChild() {
    console.warn('[stealth-runner] starting child process...');
    this.child = fork(path.join(__dirname, 'child.js'), [], { stdio: [null, null, null, 'ipc'] });
    this.jobId = 0;
    this.callbacks = new Map();
    this.stop = false;

    this.child.on('message', ({ id, result, requests, error }) => {
      const cb = this.callbacks.get(id);
      if (cb) {
        if (error) cb.reject(new Error(error));
        else cb.resolve({ result, requests });
        this.callbacks.delete(id);
      }
    });

    // this.child.on('message', ({ type, data }) => {
    //   if(type === 'request') {
    //     const url = new URL(data.url);
    //     if(url.pathname.endsWith('master.m3u8')) {
    //       console.log(data);
    //     }
    //   }
    // });

    this.child.on('close', () => {
      console.warn('[stealth-runner] Child stopped!');
      
    });

    this.child.on('exit', () => {
      if(!this.stop) {
        console.warn('[stealth-runner] Child crashed, restarting...');
        this.startChild(); // Automatically restart
      } else {
          console.warn('[stealth-runner] Child terminated!');
      }
    });
  }

  async runJob({ url, cookies = [], script }) {
    const id = ++this.jobId;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.child.send({ id, url, cookies, script: script.toString() });
    });
  }

  close() {
    this.stop = true;
    this.child.kill();
    console.warn('[stealth-runner] send kill signal!');
    setTimeout(() => {
      try {
        kill(this.child.pid);
        console.warn('[stealth-runner] force killed!');
      } catch (err) {}
    }, 2000);
  }
}

module.exports = StealthBrowserRunner;
