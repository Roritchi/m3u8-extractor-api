const StealthBrowserRunner = require('./stealth-runner/runner');
const { spawn } = require('child_process');
const express = require('express');

const runner = new StealthBrowserRunner();
const app = express();

const { Keyv } = require('keyv');
const { KeyvSqlite } = require('@keyv/sqlite');

const keyvSqlite = new KeyvSqlite('cache.sqlite');
const keyv = new Keyv({ store: keyvSqlite, ttl: 5000, namespace: 'cache' });

keyv.on('error', (err) => {
  console.log("keyv store errored!");
  console.error(err);
  process.exit(1);
});

app.get('/', async(req, res) => {
  if(!req.query.url) {
    return res.status(400).json({ error: "missing query parameter 'url'" });
  }

  const { url, force } = req.query;

  const cached = await keyv.get("url::" + url);

  if(cached && !force) {
    return res.json(cached);
  }

  try {
    if(runner.stop) {
      runner.startChild();
    }

    const { result, requests } = await runner.runJob({
      url: url,
      script: async () => {
        setInterval(() => {
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;

          const element = document.elementFromPoint(centerX, centerY);
          if (!element) {
            console.warn("No element found at center of screen.");
            return;
          }

          const eventOpts = {
            bubbles: true,
            cancelable: true,
            clientX: centerX,
            clientY: centerY,
            view: window
          };

          const mouseDown = new MouseEvent('mousedown', eventOpts);
          const mouseUp = new MouseEvent('mouseup', eventOpts);
          const click = new MouseEvent('click', eventOpts);

          element.dispatchEvent(mouseDown);
          element.dispatchEvent(mouseUp);
          element.dispatchEvent(click);
        }, 500);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return document.title;
      }
    });

    var videoFile;

    for(let req of requests) {
        const url = new URL(req.url);
        if(url.pathname.endsWith('master.m3u8')) {
            videoFile = req;
            break;
        } else if(url.pathname.startsWith('/m3/')) {
            videoFile = req;
            break;
        } else if(url.pathname.endsWith('.mp4')) {
            videoFile = req;
            break;
        }
    }

    if(videoFile) {
        console.log('Found Video Stream!');

        res.json(videoFile);
        await keyv.set("url::" + url, videoFile);

        /*
        const ytdlp = spawn('yt-dlp', [videoFile]);
        
        ytdlp.stderr.on('data', (data) => {
            // console.error(`ytdlp stderr: ${data}`);
        });

        ytdlp.stdout.on('data', (data) => {
          // console.error(`ytdlp stdout: ${data}`);
        });
        
        ytdlp.on('close', (code) => {
          console.log(`ytdlp process exited with code ${code}`);
          // process.exit(code);
        });
       */
    }

    console.log('Got result:', result);
  } catch (err) {
    console.error('Job failed:', err);
  } finally {
    console.log('Cleanup');
    // runner.close(); // Clean up when done
  }
});

app.listen(3000);