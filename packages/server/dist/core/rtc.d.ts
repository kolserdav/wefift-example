import { MediaStream } from 'werift';
import { RTCInterface, MessageType, SendMessageArgs } from '../types/interfaces';
import WS from './ws';
declare class RTC implements Omit<RTCInterface, 'createRTC' | 'peerConnections'> {
    peerConnections: RTCInterface['peerConnections'];
    readonly delimiter = "_";
    rooms: Record<string | number, (string | number)[]>;
    muteds: Record<string, string[]>;
    private ws;
    streams: Record<string, MediaStream>;
    constructor({ ws }: {
        ws: WS;
    });
    getPeerId(id: number | string, userId: number | string, target: number | string, connId: string): string;
    createRTC: RTCInterface['createRTC'];
    handleIceCandidate: RTCInterface['handleIceCandidate'];
    handleCandidateMessage: RTCInterface['handleCandidateMessage'];
    handleOfferMessage: RTCInterface['handleOfferMessage'];
    handleVideoAnswerMsg: RTCInterface['handleVideoAnswerMsg'];
    addTracks: ({ id, connId, userId, peerId, target, }: {
        id: number | string;
        connId: string;
        peerId: string;
        userId: number | string;
        target: number | string;
    }) => void;
    closeVideoCall: RTCInterface['closeVideoCall'];
    addUserToRoom({ userId, roomId, }: {
        userId: number | string;
        roomId: number | string;
    }): Promise<1 | 0>;
    handleGetRoomMessage({ message, port, cors, }: {
        message: SendMessageArgs<MessageType.GET_ROOM>;
        port: number;
        cors: string;
    }): Promise<void>;
    onClosedCall: RTCInterface['onClosedCall'];
    cleanConnections(roomId: string, userId: string): void;
}
export default RTC;
//# sourceMappingURL=rtc.d.ts.map