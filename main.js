import './style.css';
import { files } from './files';
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';

document.querySelector('#app').innerHTML = `
  <div class="container">
    <div class="editor">
      <textarea>I am a textarea</textarea>
    </div>
    <div class="preview">
      <iframe src="loading.html"></iframe>
      <div class="terminal"></div>
  </div>
`
/** @type {HTMLIFrameElement | null} */
const iframeEl = document.querySelector('iframe');

/** @type {HTMLTextAreaElement | null} */
const textareaEl = document.querySelector('textarea');

import { WebContainer } from '@webcontainer/api';

/** @type {import('@webcontainer/api').WebContainer}  */
let webcontainerInstance;

/** @type {HTMLTextAreaElement | null} */
const terminalEl = document.querySelector('.terminal');

window.addEventListener('load', async () => {
  textareaEl.value = files['index.js'].file.contents;

  textareaEl.addEventListener('input', (e) => {
    writeIndexJS(e.currentTarget.value);
  });

  const fitAddon = new FitAddon();
  const terminal = new Terminal({
    convertEol: true,
  });
  terminal.loadAddon(fitAddon);
  terminal.open(terminalEl);

  fitAddon.fit();

  webcontainerInstance = await WebContainer.boot();
  await webcontainerInstance.mount(files);

  webcontainerInstance.on('server-ready', (port, url) => {
    iframeEl.src = url;
  });

  startShell(terminal);

  // const shellProcess = await startShell(terminal);
  // window.addEventListener('resize', () => {
  //   fitAddon.fit();
  //   shellProcess.resize({
  //     cols: terminal.cols,
  //     rows: terminal.rows,
  //   });
  // });

  // const exitCode = await installDependencies(terminal);
  // if (exitCode !== 0) {
  //   throw new Error('Installation failed');
  // };

  // startDevServer(terminal);
});

/**
 * @param {Terminal} terminal
 */
async function installDependencies(terminal) {
  const installProcess = await webcontainerInstance.spawn('npm', ['install']);
  installProcess.output.pipeTo(new WritableStream({
    write(data) {
      terminal.write(data);
    }
  }))
  return installProcess.exit;
}

/**
 * @param {Terminal} terminal
 */
async function startDevServer(terminal) {
  // Run `npm run start` to start the Express app
  const serverProcess = await webcontainerInstance.spawn('npm', [
    'run',
    'start',
  ]);
  serverProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );

  // Wait for `server-ready` event
  webcontainerInstance.on('server-ready', (port, url) => {
    iframeEl.src = url;
  });
}

async function writeIndexJS(content) {
  await webcontainerInstance.fs.writeFile('/index.js', content);
};

/**
 * @param {Terminal} terminal
 */
async function startShell(terminal) {
  const shellProcess = await webcontainerInstance.spawn('jsh', {
    terminal: {
      cols: terminal.cols,
      rows: terminal.rows,
    },
  });
  shellProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );

  const input = shellProcess.input.getWriter();
  terminal.onData((data) => {
    input.write(data);
  });

  return shellProcess;
};