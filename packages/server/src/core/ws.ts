import { WebSocketServer, Server, WebSocket, ServerOptions } from 'ws';
import { WSInterface } from '../types/interfaces';

class WS implements WSInterface {
  public connection: Server<WebSocket>;

  public sockets: Record<string, WebSocket> = {};

  public readonly delimiter = '_';

  public users: Record<number | string, string> = {};
  public rooms: Record<number | string, string> = {};

  public websocket = WebSocket;

  constructor(connectionArgs: ServerOptions | undefined) {
    this.connection = this.createConnection(connectionArgs);
  }

  public async setSocket({
    id: _id,
    ws,
    connId,
    isRoom,
  }: {
    id: number | string;
    ws: WebSocket;
    connId: string;
    isRoom?: boolean;
  }) {
    const oldSock = Object.keys(this.sockets).find((item) => {
      const sock = item.split(this.delimiter);
      return sock[0] === _id.toString();
    });
    if (oldSock) {
      if (this.sockets[oldSock]) {
        delete this.sockets[oldSock];
      }
    }
    this.sockets[this.getSocketId(_id.toString(), connId)] = ws;
    const id = _id.toString();
    if (!isRoom) {
      this.users[id] = connId;
    } else {
      this.rooms[id] = connId;
    }
  }

  public getSocketId(id: string | number, connId: string) {
    return `${id}${this.delimiter}${connId}`;
  }

  public findSocketId(id: string) {
    return Object.keys(this.sockets).find((item) => item.split(this.delimiter)[0] === id) || null;
  }

  public createConnection = (args: ServerOptions | undefined) => {
    this.connection = new WebSocketServer(args);
    return this.connection;
  };

  public parseMessage: WSInterface['parseMessage'] = (message) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.log('error', 'parseMessage', err);
      return null;
    }
    return data;
  };

  public getMessage: WSInterface['getMessage'] = (type, data) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = data;
    return res;
  };

  public sendMessage: WSInterface['sendMessage'] = (args) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        let res = '';
        try {
          res = JSON.stringify(args);
        } catch (e) {
          console.log('error', 'sendMessage', e);
          resolve(1);
        }
        const { id } = args;
        if (this.users[id] && this.sockets[this.getSocketId(id, this.users[id])]) {
          this.sockets[this.getSocketId(id, this.users[id])].send(res);
        } else if (this.rooms[id] && this.sockets[this.getSocketId(id, this.rooms[id])]) {
          this.sockets[this.getSocketId(id, this.rooms[id])].send(res);
        } else {
          console.log('info', 'Send message without conected socket', {
            args,
            k: Object.keys(this.sockets),
            u: this.users,
            r: this.rooms,
          });
        }
        resolve(0);
      }, 100);
    });
  };
}

export default WS;
