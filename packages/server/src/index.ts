/* eslint-disable no-case-declarations */
import { v4 } from 'uuid';
import WS from './core/ws';
import RTC from './core/rtc';
import { MessageType } from './types/interfaces';

const PORT = 3002;

/**
 * Create SFU WebRTC server
 */
function createServer({ port = PORT, cors = '' }: { port?: number; cors?: string; db?: string }) {
  console.log('info', 'Server listen at port:', port, true);
  const getConnectionId = (): string => {
    const connId = v4();
    if (wss.sockets[connId]) {
      return getConnectionId();
    }
    return connId;
  };

  const wss = new WS({ port });
  const rtc: RTC | null = new RTC({ ws: wss });

  wss.connection.on('connection', function connection(ws, req) {
    const { origin } = req.headers;
    const notAllowed = cors.split(',').indexOf(origin || '') === -1;
    if (cors && notAllowed) {
      ws.close();
      console.log('warn', 'Block CORS attempt', { headers: req.headers });
      return;
    }
    const connId = getConnectionId();
    ws.on('message', async function message(message) {
      let _data = '';
      if (typeof message !== 'string') {
        _data = message.toString('utf8');
      }
      const rawMessage = wss.parseMessage(_data);
      if (!rawMessage) {
        return;
      }
      const { type, id } = rawMessage;
      switch (type) {
        case MessageType.GET_USER_ID:
          const { isRoom } = wss.getMessage(MessageType.GET_USER_ID, rawMessage).data;
          await wss.setSocket({ id, ws, connId, isRoom });
          wss.sendMessage({
            type: MessageType.SET_USER_ID,
            id,
            data: undefined,
            connId,
          });
          break;
        case MessageType.GET_ROOM:
          rtc.handleGetRoomMessage({
            message: wss.getMessage(MessageType.GET_ROOM, rawMessage),
            port,
            cors,
          });

          break;
        default:
          wss.sendMessage(rawMessage);
      }
    });

    ws.onclose = async () => {
      console.log('on close');
    };
  });
}
export default createServer;

if (require.main === module) {
  createServer({ port: PORT, cors: 'http://localhost:3000' });
}
