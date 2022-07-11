import { Server, WebSocket, ServerOptions } from 'ws';
import { WSInterface } from '../types/interfaces';
declare class WS implements WSInterface {
    connection: Server<WebSocket>;
    sockets: Record<string, WebSocket>;
    readonly delimiter = "_";
    users: Record<number | string, string>;
    rooms: Record<number | string, string>;
    websocket: typeof import("ws");
    constructor(connectionArgs: ServerOptions | undefined);
    setSocket({ id: _id, ws, connId, isRoom, }: {
        id: number | string;
        ws: WebSocket;
        connId: string;
        isRoom?: boolean;
    }): Promise<void>;
    getSocketId(id: string | number, connId: string): string;
    findSocketId(id: string): string;
    createConnection: (args: ServerOptions | undefined) => Server<WebSocket>;
    parseMessage: WSInterface['parseMessage'];
    getMessage: WSInterface['getMessage'];
    sendMessage: WSInterface['sendMessage'];
}
export default WS;
//# sourceMappingURL=ws.d.ts.map