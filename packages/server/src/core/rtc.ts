import {RTCPeerConnection, RTCPeerConnectionIceEvent, MediaStream, RTCIceCandidate, RTCSessionDescription} from 'werift';
import { RTCInterface, MessageType, SendMessageArgs } from '../types/interfaces';
import WS from './ws';

class RTC implements Omit<RTCInterface, 'createRTC' | 'peerConnections'> {
  public peerConnections: RTCInterface['peerConnections'] = {};
  public readonly delimiter = '_';
  public rooms: Record<string | number, (string | number)[]> = {};
  public muteds: Record<string, string[]> = {};
  private ws: WS;
  public streams: Record<string, MediaStream> = {};

  constructor({ ws }: { ws: WS }) {
    this.ws = ws;
  }

  public getPeerId(
    id: number | string,
    userId: number | string,
    target: number | string,
    connId: string
  ) {
    return `${id}${this.delimiter}${userId}${this.delimiter}${target || 0}${
      this.delimiter
    }${connId}`;
  }

  public createRTC: RTCInterface['createRTC'] = ({ roomId, userId, target, connId }) => {
    const peerId = this.getPeerId(roomId, userId, target, connId);
    this.peerConnections[peerId] = new RTCPeerConnection({
      iceServers:
        process.env.NODE_ENV === 'production'
          ? [
              {
                urls: 'stun:stun.l.google.com:19302',
              },
            ]
          : [],
    });
    return this.peerConnections;
  };

  public handleIceCandidate: RTCInterface['handleIceCandidate'] = ({
    roomId,
    userId,
    target,
    connId,
  }) => {
    let peerId = this.getPeerId(roomId, userId, target, connId);
    if (!this.peerConnections[peerId]) {
      peerId = this.getPeerId(roomId, target, userId, connId);
    }
    if (!this.peerConnections[peerId]) {
      console.log('warn', 'Handle ice candidate without peerConnection', { peerId });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const core = this;
    this.peerConnections[peerId]!.onicecandidate = function handleICECandidateEvent(
      event: RTCPeerConnectionIceEvent
    ) {
      if (event.candidate) {
        console.log('info', '* Outgoing ICE candidate:', {
          roomId,
          userId,
          target,
          connId,
          d: Object.keys(core.peerConnections),
        });
        core.ws.sendMessage({
          type: MessageType.CANDIDATE,
          id: roomId,
          data: {
            candidate: event.candidate,
            userId,
            target,
          },
          connId,
        });
      }
    };
    const { ws, delimiter, rooms } = this;
    this.peerConnections[peerId]!.onsignalingstatechange =
      function handleSignalingStateChangeEvent() {
        if (!core.peerConnections[peerId]) {
          console.log('warn', 'On signalling state change without peer connection', { peerId });
          return;
        }
        console.log(
          'info',
          '! WebRTC signaling state changed to:',
          core.peerConnections[peerId]!.signalingState
        );
        switch (core.peerConnections[peerId]!.signalingState) {
          case 'closed':
            core.onClosedCall({ roomId, userId, target, connId });
            break;
        }
      };
    this.peerConnections[peerId]!.onnegotiationneeded = function handleNegotiationNeededEvent() {
      if (!core.peerConnections[peerId]) {
        console.log('warn', 'On negotiation needed without peer connection', { peerId });
        return;
      }
      console.log('info', '--> Creating offer', {
        roomId,
        userId,
        target,
        state: core.peerConnections[peerId]!.signalingState,
      });
      core.peerConnections[peerId]!.createOffer()
        .then((offer): 1 | void | PromiseLike<void> => {
          if (!core.peerConnections[peerId]) {
            console.log(
              'warn',
              'Can not set local description because peerConnection is',
              core.peerConnections[peerId]
            );
            return 1;
          }
          core.peerConnections[peerId]!.setLocalDescription(offer).catch((err) => {
            console.log('error', 'Error create local description', {
              err,
              peerId,
              peer: core.peerConnections[peerId],
            });
          });
        })
        .then(() => {
          const { localDescription } = core.peerConnections[peerId]!;
          if (localDescription) {
            console.log('info', '---> Sending offer to remote peer', { roomId, userId, target });
            core.ws.sendMessage({
              id: roomId,
              type: MessageType.OFFER,
              data: {
                sdp: localDescription,
                userId,
                target,
              },
              connId,
            });
          }
        });
    };
    let s = 1;
    this.peerConnections[peerId]!.ontrack = (e) => {
      const isRoom = peerId.split(delimiter)[2] === '0';
      if (isRoom) {
        const stream = e.streams[0];
        const isNew = stream.id !== this.streams[peerId]?.id;
        if (isNew) {
          this.streams[peerId] = stream;
        }
        console.log('info', 'ontrack', { peerId, si: stream.id, isNew, userId, target });
        if (s % 2 !== 0 && isNew) {
          const room = rooms[roomId];
          if (room) {
            setTimeout(() => {
              room.forEach((id) => {
                ws.sendMessage({
                  type: MessageType.SET_CHANGE_UNIT,
                  id,
                  data: {
                    target: userId,
                    eventName: 'add',
                    roomLenght: rooms[roomId]?.length || 0,
                    muteds: this.muteds[roomId],
                  },
                  connId,
                });
              });
            }, 0);
          } else {
            console.log('warn', 'Room missing in memory', { roomId });
          }
        }
        s++;
      }
    };
  };

  public handleCandidateMessage: RTCInterface['handleCandidateMessage'] = async (msg, cb) => {
    const {
      id,
      connId,
      data: { candidate, userId, target },
    } = msg;
    let peerId = this.getPeerId(id, userId, target, connId);
    let _connId = connId;
    if (!this.peerConnections?.[peerId]) {
      const peer = Object.keys(this.peerConnections).find((p) => {
        const pe = p.split(this.delimiter);
        return (
          pe[0] === id.toString() && pe[1] === userId.toString() && pe[2] === target.toString()
        );
      });
      _connId = peer?.split(this.delimiter)[3] || connId;
      peerId = this.getPeerId(id, userId, target, _connId);
    }
    const cand = new RTCIceCandidate(candidate);

    console.log('log', 'Trying to add ice candidate:', {
      peerId,
      d: Object.keys(this.peerConnections).length,
      connId,
      id,
      userId,
      target,
    });
    if (this.peerConnections[peerId]?.connectionState === 'new') {
      await new Promise((resolve) => {
        const t = setInterval(() => {
          if (this.peerConnections[peerId]?.connectionState !== 'new') {
            clearInterval(t);
            resolve(0);
          }
        }, 500);
      });
    }
    if (
      !this.peerConnections[peerId] ||
      this.peerConnections[peerId]?.connectionState === 'closed' ||
      this.peerConnections[peerId]?.iceConnectionState === 'closed'
    ) {
      console.log('info', 'Skiping add ice candidate', {
        connId,
        id,
        d: Object.keys(this.peerConnections),
        userId,
        peerId,
        target,
        state: this.peerConnections[peerId]?.connectionState,
        ice: this.peerConnections[peerId]?.iceConnectionState,
        ss: this.peerConnections[peerId]?.signalingState,
      });
      return;
    }
    if (cand.candidate === '') {
      return;
    }
    this.peerConnections[peerId]!.addIceCandidate(cand)
      .then(() => {
        console.log('log', '!! Adding received ICE candidate:', { userId, id, target });
        if (cb) {
          cb(cand);
        }
      })
      .catch((e) => {
        console.log('error', 'Set ice candidate error', {
          error: e,
          connId,
          id,
          userId,
          target,
          state: this.peerConnections[peerId]?.connectionState,
          ice: this.peerConnections[peerId]?.iceConnectionState,
          ss: this.peerConnections[peerId]?.signalingState,
        });
        if (cb) {
          cb(null);
        }
      });
  };

  public handleOfferMessage: RTCInterface['handleOfferMessage'] = (msg, cb) => {
    const {
      id,
      connId,
      data: { sdp, userId, target },
    } = msg;
    if (!sdp) {
      console.log('warn', 'Message offer error because sdp is:', sdp);
      if (cb) {
        cb(null);
      }
      return;
    }
    const peerId = this.getPeerId(id, userId, target, connId);

    this.createRTC({
      roomId: id,
      userId,
      target,
      connId,
    });

    if (!this.peerConnections[peerId]) {
      console.log('warn', 'Handle offer message without peer connection', { peerId });
      return;
    }

    this.handleIceCandidate({
      roomId: id,
      userId,
      target,
      connId,
    });
    const desc = new RTCSessionDescription(sdp.sdp, 'offer');
    this.peerConnections[peerId]!.setRemoteDescription(desc)
      .then(() => {
        console.log('info', '-> Local video stream obtained', { peerId });
        // If a user creates a new connection with a room to get another user's stream
        if (target) {
          this.addTracks({ id, peerId, connId, target, userId });
        }
      })
      .then(() => {
        console.log('info', '--> Creating answer', { peerId });
        this.peerConnections[peerId]!.createAnswer().then((answ) => {
          if (!answ) {
            console.log('error', 'Failed set local description for answer.', {
              answ,
              peerConnection: this.peerConnections[peerId],
            });
            if (cb) {
              cb(null);
            }
            return;
          }
          console.log('info', '---> Setting local description after creating answer');
          let _peerId = peerId;
          if (!this.peerConnections[peerId]) {
            _peerId = this.getPeerId(id, target, userId, connId);
          }
          if (!this.peerConnections[_peerId]) {
            console.log('warn', 'Skip set local description fo answer', {
              roomId: id,
              userId,
              target,
              connId,
              k: Object.keys(this.peerConnections).length,
              s: Object.keys(this.streams).length,
            });
            return;
          }
          this.peerConnections[_peerId]!.setLocalDescription(answ)
            .catch((err) => {
              console.log('error', 'Error set local description for answer', {
                message: err.message,
                roomId: id,
                userId,
                target,
                connId,
                k: Object.keys(this.peerConnections).length,
                s: Object.keys(this.streams).length,
                is: this.peerConnections[peerId]?.iceConnectionState,
                cs: this.peerConnections[peerId]?.connectionState,
                ss: this.peerConnections[peerId]?.signalingState,
              });
            })
            .then(() => {
              const { localDescription } = this.peerConnections[peerId]!;
              if (localDescription) {
                console.log('info', 'Sending answer packet back to other peer', { userId, target, id });
                this.ws.sendMessage({
                  id: userId,
                  type: MessageType.ANSWER,
                  data: {
                    sdp: localDescription,
                    userId: id,
                    target,
                  },
                  connId,
                });
                if (cb) {
                  cb(null);
                }
              } else {
                console.log('warn', 'Failed send answer because localDescription is', localDescription);
              }
            });
        });
      })
      .catch((e) => {
        console.log('error', 'Failed get user media', {
          message: e.message,
          stack: e.stack,
          roomId: id,
          userId,
          target,
          connId,
          desc: desc !== undefined,
        });
        if (cb) {
          cb(null);
        }
      });
  };

  public handleVideoAnswerMsg: RTCInterface['handleVideoAnswerMsg'] = async (msg, cb) => {
    const {
      id,
      connId,
      data: { sdp, userId, target },
    } = msg;
    const peerId = this.getPeerId(userId, id, target, connId);
    console.log('info', '----> Call recipient has accepted our call', {
      id,
      userId,
      target,
      peerId,
      s: this.peerConnections[peerId]?.connectionState,
      is: this.peerConnections[peerId]?.iceConnectionState,
    });
    if (!this.peerConnections[peerId]) {
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(0);
        }, 1000);
      });
    }
    if (!this.peerConnections[peerId]) {
      console.log('warn', 'Skiping set remote desc for answer', {
        id,
        userId,
        target,
        peerId,
        peer: this.peerConnections[peerId],
      });
      return;
    }
    const desc = new RTCSessionDescription(sdp.sdp, 'answer');
    this.peerConnections[peerId]!.setRemoteDescription(desc)
      .then(() => {
        if (cb) {
          cb(0);
        }
      })
      .catch((e) => {
        console.log('error', 'Error set description for answer', e);
        if (cb) {
          cb(1);
        }
      });
  };

  public addTracks = ({
    id,
    connId,
    userId,
    peerId,
    target,
  }: {
    id: number | string;
    connId: string;
    peerId: string;
    userId: number | string;
    target: number | string;
  }) => {
    let _connId = connId;
    const keysStreams = Object.keys(this.streams);
    keysStreams.forEach((element) => {
      const str = element.split(this.delimiter);
      if (str[1] === target.toString() && str[2] === '0') {
        _connId = str[3];
      }
    });
    const _peerId = this.getPeerId(id, target, 0, _connId);
    const stream = this.streams[_peerId];
    if (!stream) {
      console.log('info', 'Skiping add track', {
        roomId: id,
        userId,
        target,
        connId,
        _peerId,
        _connId,
        k: Object.keys(this.streams),
      });
      return;
    }
    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      if (this.peerConnections[peerId]) {
        const sender = this.peerConnections[peerId]
          ?.getSenders()
          .find((item) => item.track?.kind === track.kind);
        if (sender?.track?.id !== track.id) {
          this.peerConnections[peerId]!.addTrack(track, stream);
        } else {
          console.log('warn', 'Skiping add track', { peerId });
        }
      } else {
        console.log('warn', 'Add track without peer connection', {
          peerId,
          k: Object.keys(this.peerConnections),
        });
      }
    });
  };

  public closeVideoCall: RTCInterface['closeVideoCall'] = ({ roomId, userId, target, connId }) => {
    const peerId = this.getPeerId(roomId, userId, target, connId);
    delete this.streams[peerId];
    if (!this.peerConnections[peerId]) {
      console.log('warn', 'Close video call without peer connection', { peerId });
      return;
    }
    console.log('info', '| Closing the call', { peerId, k: Object.keys(this.peerConnections).length });
    setTimeout(() => {
      if (this.peerConnections[peerId]) {
        this.peerConnections[peerId]!.onicecandidate = null;
        this.peerConnections[peerId]!.onsignalingstatechange = null;
        this.peerConnections[peerId]!.onnegotiationneeded = null;
        this.peerConnections[peerId]!.ontrack = null;
        this.peerConnections[peerId]!.close();
        delete this.peerConnections[peerId];
      }
    }, 1000);
  };

  public async addUserToRoom({
    userId,
    roomId,
  }: {
    userId: number | string;
    roomId: number | string;
  }): Promise<1 | 0> {
    if (!this.rooms[roomId]) {
      this.rooms[roomId] = [userId];
      this.muteds[roomId] = [];
    } else if (this.rooms[roomId].indexOf(userId) === -1) {
      this.rooms[roomId].push(userId);
    } else {
      console.log('info', 'Room exists and user added before.', { roomId, userId });
    }
    return 0;
  }

  public async handleGetRoomMessage({
    message,
    port,
    cors,
  }: {
    message: SendMessageArgs<MessageType.GET_ROOM>;
    port: number;
    cors: string;
  }) {
    const {
      data: { userId: uid },
      id,
      connId,
    } = message;
    // Room creatting counter local connection with every user
    const connection = new this.ws.websocket(`ws://localhost:${port}`, {
      headers: {
        origin: cors.split(',')[0],
      },
    });
    const error = await this.addUserToRoom({
      roomId: id,
      userId: uid,
    });
    if (error) {
      this.ws.sendMessage({
        type: MessageType.SET_ROOM,
        id: uid,
        data: undefined,
        connId,
      });
      console.log('warn', 'Can not add user to room', { id, uid });
      return;
    }
    this.createRTC({ roomId: id, userId: uid, target: 0, connId });
    connection.onopen = () => {
      // FIXME to sendMEssage
      connection.send(
        JSON.stringify({
          type: MessageType.GET_USER_ID,
          id,
          data: {
            isRoom: true,
          },
          connId: '',
        })
      );
      connection.onmessage = (mess) => {
        const msg = this.ws.parseMessage(mess.data as string);
        if (msg) {
          const { type } = msg;
          switch (type) {
            case MessageType.OFFER:
              this.handleOfferMessage(msg);
              break;
            case MessageType.ANSWER:
              this.handleVideoAnswerMsg(msg);
              break;
            case MessageType.CANDIDATE:
              this.handleCandidateMessage(msg);
              break;
          }
        }
      };
    };
    this.ws.sendMessage({
      type: MessageType.SET_ROOM,
      id,
      data: undefined,
      connId,
    });
  }

  public onClosedCall: RTCInterface['onClosedCall'] = (args) => {
    console.log('info', 'Call is closed', { ...args });
  };

  public cleanConnections(roomId: string, userId: string) {
    const peerKeys = Object.keys(this.peerConnections);
    peerKeys.forEach((__item) => {
      const peer = __item.split(this.delimiter);
      if (peer[1] === userId.toString()) {
        this.closeVideoCall({
          roomId,
          userId,
          target: peer[2],
          connId: peer[3],
        });
      } else if (peer[2] === userId.toString()) {
        this.closeVideoCall({
          roomId,
          userId: peer[1],
          target: userId,
          connId: peer[3],
        });
      }
    });
  }
}

export default RTC;
