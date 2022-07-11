/******************************************************************************************
 * Repository: https://github.com/kolserdav/react-node-webrtc-sfu.git
 * File name: Room.hooks.ts
 * Author: Sergey Kolmiller
 * Email: <uyem.ru@gmail.com>
 * License: BSD-2-Clause
 * License text: Binary distributions of this software include 'wrtc' and other third-party libraries.
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Mon Jul 04 2022 10:58:51 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
/* eslint-disable no-case-declarations */
import { useEffect, useState, useMemo, useCallback } from 'react';
import WS from '../core/ws';
import RTC from '../core/rtc';
import { log } from '../utils/lib';
import { getWidthOfItem } from './Room.lib';
import { MessageType, SendMessageArgs } from '../types/interfaces';
import { Stream } from '../types';
import s from './Room.module.scss';
import c from './ui/CloseButton.module.scss';
import storeStreams, { changeStreams } from '../store/streams'

// eslint-disable-next-line import/prefer-default-export
export const useConnection = ({
  id,
  roomId,
  iceServers,
  server,
  port,
}: {
  id: number | string;
  roomId: number | string | null;
  iceServers: RTCConfiguration['iceServers'];
  server: string;
  port: string;
}) => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [shareScreen, setShareScreen] = useState<boolean>(false);
  const [localShareScreen, setLocalShareScreen] = useState<boolean>(false);
  const [selfStream, setSelfStream] = useState<Stream | null>(null);
  const [roomIsSaved, setRoomIsSaved] = useState<boolean>(false);
  const [lenght, setLenght] = useState<number>(streams.length);
  const [muteds, setMuteds] = useState<string[]>([]);
  const [video, setVideo] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [connId, setConnId] = useState<string>('');
  const ws = useMemo(
    () => new WS({ shareScreen: localShareScreen, server, port }),
    [localShareScreen, server, port]
  );
  const rtc = useMemo(() => new RTC({ ws }), [ws]);
  const screenShare = useMemo(
    () => (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      setShareScreen(!shareScreen);
    },
    [shareScreen]
  );

  const changeVideo = () => {
    if (rtc.localStream) {
      const _video = !video;
      setVideo(_video);
      rtc.localStream.getVideoTracks()[0].enabled = _video;
    }
  };

  const lostStreamHandler = ({ target, connId }: { target: number | string; connId: string }) => {
    if (!roomId) {
      return;
    }
    let _connId = connId;
    Object.keys(rtc.peerConnections).forEach((item) => {
      const peer = item.split(rtc.delimiter);
      if (peer[1] === target.toString()) {
        // eslint-disable-next-line prefer-destructuring
        _connId = peer[2];
      }
    });
    const peerId = rtc.getPeerId(roomId, target, _connId);
    if (!rtc.peerConnections[peerId]) {
      log('info', 'Lost stream handler without peer connection', { peerId });
      return;
    }
    rtc.closeVideoCall({ roomId, userId: ws.userId, target, connId: _connId });
    const _stream = streams.find((item) => item.target === target);
    if (_stream) {
      storeStreams.dispatch(changeStreams({ type: 'delete', stream: _stream }));
    }
  };

  rtc.lostStreamHandler = lostStreamHandler;

  /**
   * Change media source
   */
  useEffect(() => {
    if (!roomId) {
      return;
    }
    if (localShareScreen !== shareScreen) {
      if (selfStream) {
        rtc.localStream = null;
        rtc.closeAllConnections();
        ws.connection.close();
        setLocalShareScreen(shareScreen);
        setRoomIsSaved(false);
        storeStreams.dispatch(changeStreams({ type: 'clean', stream: selfStream }));
        rtc.roomLength = 0;
        setLenght(0);
        setSelfStream(null);
      } else {
        log('warn', 'Change media source. Self stream is:', selfStream);
      }
    }
  }, [shareScreen, localShareScreen, roomId, rtc, ws, selfStream]);

  /**
   * Set streams from store
   */
  useEffect(() => {
    const cleanSubs = storeStreams.subscribe(() => {
      const state = storeStreams.getState();
      setStreams(state.streams);
    });
    return () => {
      cleanSubs();
    };
  }, []);

  /**
   * Connections handlers
   */
  useEffect(() => {
    if (!roomId) {
      return () => {
        /** */
      };
    }
    if (!ws.userId) {
      ws.setUserId(id);
    }
    const addStream = ({
      target,
      stream,
      connId,
      change = false,
    }: {
      target: string | number;
      stream: MediaStream;
      connId: string;
      change?: boolean;
    }) => {
      const _stream: Stream = {
        target,
        stream,
        connId,
        ref: (node) => {
          if (node) {
            // eslint-disable-next-line no-param-reassign
            node.srcObject = stream;
          }
        },
      };
      storeStreams.dispatch(changeStreams({ type: 'add', stream: _stream, change }));
      if (!selfStream && target === ws.userId) {
        setSelfStream(_stream);
      }
      log('info', 'Add stream', { _stream });
    };

    /**
     * 'add' send server/main.js and 'added' listen on Room.hooks.ts
     */
    const changeRoomUnitHandler = ({
      id: userId,
      data: { target, eventName, roomLenght, muteds: _muteds },
      connId,
    }: SendMessageArgs<MessageType.SET_CHANGE_UNIT>) => {
      if (lenght !== roomLenght) {
        setLenght(roomLenght);
      }
      rtc.muteds = _muteds;
      setMuteds(_muteds);
      //alert(`${eventName} ${target}`);
      switch (eventName) {
        case 'add':
        case 'added':
          if (userId !== target) {
            log('info', 'Change room unit handler', {
              userId,
              target,
              roomLenght,
              connId,
              eventName,
            });
            rtc.createPeerConnection({
              roomId,
              target,
              userId: id,
              connId,
              onTrack: ({ addedUserId, stream }) => {
                log('info', 'Added unit track', { addedUserId, s: stream.id, connId });
                addStream({ target: addedUserId, stream, connId });
              },
              iceServers,
              eventName: 'back',
            });
            rtc.addTracks({ id: roomId, userId, target, connId }, (e) => {
              if (!e) {
                if (eventName !== 'added' && target !== userId) {
                  ws.sendMessage({
                    type: MessageType.SET_CHANGE_UNIT,
                    id: target,
                    connId,
                    data: {
                      target: userId,
                      roomLenght,
                      eventName: 'added',
                      muteds: _muteds,
                    },
                  });
                }
              }
            });
          }
          break;
        case 'delete':
          log('info', 'Need delete user', {
            roomId,
            target,
            userId,
            connId,
            k: Object.keys(rtc.peerConnections),
          });
          rtc.closeVideoCall({ roomId, target, userId, connId });
          const _stream = streams.find((item) => item.target === target);
          if (_stream) {
            storeStreams.dispatch(changeStreams({ type: 'delete', stream: _stream }));
          }
          break;
      }
    };

    ws.onOpen = () => {
      ws.sendMessage({
        type: MessageType.GET_USER_ID,
        id,
        data: {},
        connId: '',
      });
    };
    ws.onMessage = (ev) => {
      const { data } = ev;
      const rawMessage = ws.parseMessage(data);
      if (!rawMessage) {
        return;
      }
      const { type, connId } = rawMessage;
      switch (type) {
        case MessageType.SET_USER_ID:
          /**
           * Connect to room
           */
          setConnId(connId);
          rtc.connId = connId;
          rtc.createPeerConnection({
            userId: ws.userId,
            target: 0,
            connId,
            roomId,
            onTrack: ({ addedUserId, stream }) => {
              log('info', '-> Added local stream to room', { addedUserId, id });
              addStream({ target: addedUserId, stream, connId });
            },
            iceServers,
            eventName: 'first',
          });
          rtc.addTracks({ userId: ws.userId, id: roomId, connId, target: 0 }, (e) => {
            if (!e) {
              ws.sendMessage({
                type: MessageType.GET_ROOM,
                id: roomId,
                data: {
                  userId: id,
                },
                connId,
              });
            } else if (localShareScreen) {
              ws.shareScreen = false;
              setLocalShareScreen(false);
              setShareScreen(false);
              ws.onOpen = () => {
                ws.sendMessage({
                  type: MessageType.GET_USER_ID,
                  id,
                  data: {},
                  connId: '',
                });
              };
            }
          });
          break;
        case MessageType.OFFER:
          rtc.handleOfferMessage(rawMessage);
          break;
        case MessageType.CANDIDATE:
          rtc.handleCandidateMessage(rawMessage);
          break;
        case MessageType.ANSWER:
          rtc.handleVideoAnswerMsg(rawMessage);
          break;
        case MessageType.SET_ROOM:
          setRoomIsSaved(true);
          break;
        case MessageType.SET_CHANGE_UNIT:
          changeRoomUnitHandler(ws.getMessage(MessageType.SET_CHANGE_UNIT, rawMessage));
          break;
        case MessageType.SET_ERROR:
          const {
            data: { message },
          } = ws.getMessage(MessageType.SET_ERROR, rawMessage);
          setError(message);
          log('warn', 'error', message);
          break;
        default:
      }
    };
    ws.onError = (e) => {
      log('error', 'Ws error', e);
    };
    ws.onClose = (e) => {
      log('warn', 'Ws close', e);
    };
    return () => {
      ws.onOpen = () => {
        /** */
      };
      ws.onMessage = () => {
        /** */
      };
      ws.onError = () => {
        /** */
      };
      ws.onClose = () => {
        /** */
      };
    };
  }, [
    roomId,
    streams,
    ws,
    rtc,
    id,
    roomIsSaved,
    lenght,
    selfStream,
    iceServers,
    localShareScreen,
    lostStreamHandler,
  ]);

  return {
    streams,
    lenght,
    ws,
    rtc,
    lostStreamHandler,
    screenShare,
    shareScreen,
    muteds,
    video,
    changeVideo,
    error,
  };
};

export const useVideoDimensions = ({
  lenght,
  container,
}: {
  lenght: number;
  container: HTMLDivElement | null;
}) => {
  let time = 0;
  return useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement, Event>, stream: MediaStream) => {
      time++;
      if (time % 5 === 0) {
        requestAnimationFrame(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { target }: { target: HTMLVideoElement } = e as any;
          const _container =
            target.getAttribute('data') !== 'full'
              ? container
              : (target.parentElement as HTMLDivElement);
          if (_container) {
            const { videoHeight, videoWidth } = target;
            const coeff = videoWidth / videoHeight;
            const { width, cols, rows } = getWidthOfItem({
              lenght,
              container: _container,
              coeff: videoWidth / videoHeight,
            });
            // Change track constraints
            stream.getVideoTracks().forEach((item) => {
              const oldWidth = item.getConstraints().width;

              if (oldWidth !== width) {
                let _width = width;
                let _height = width;
                if (videoHeight < videoWidth) {
                  _height = Math.floor(width / coeff);
                  target.setAttribute('width', _width.toString());
                  target.setAttribute('height', _height.toString());
                } else {
                  _width = Math.floor(width * coeff);
                  target.setAttribute('width', _width.toString());
                  target.setAttribute('height', _height.toString());
                }
                target.parentElement?.parentElement?.setAttribute(
                  'style',
                  `grid-template-columns: repeat(${cols}, auto);
                  grid-template-rows: repeat(${rows}, auto);`
                );
                item
                  .applyConstraints(coeff < 1 ? { height: _height } : { width: _width })
                  .then(() => {
                    log('log', 'Constraints changed', {
                      width,
                      oldWidth,
                    });
                  })
                  .catch((error) => {
                    log('log', 'Constraints not changed', {
                      error,
                      width: _width,
                      height: _height,
                      oldWidth,
                    });
                  });
              }
            });
          }
        });
      }
    },
    [lenght, container, time]
  );
};

export const useOnclickClose =
  ({ lenght, container }: { lenght: number; container: HTMLDivElement | null }) =>
  (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (container) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { target }: any = e;
      const { nodeName } = target;
      const button: HTMLButtonElement =
        nodeName === 'path'
          ? target.parentElement?.parentElement
          : nodeName === 'svg'
          ? target.parentElement
          : target;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const video: HTMLVideoElement = button.nextElementSibling as any;
      const { videoWidth, videoHeight } = video;
      const { width } = getWidthOfItem({ lenght, container, coeff: videoWidth / videoHeight });
      const coeff = videoWidth / videoHeight;
      const height = width / coeff;
      video.parentElement?.classList.remove(s.video__fixed);
      button.classList.remove(c.open);
      video.setAttribute('data', '');
      video.setAttribute('width', width.toString());
      video.setAttribute('height', height.toString());
    }
  };

export const usePressEscape = () => (e: React.KeyboardEvent<HTMLDivElement>) => {
  /** TODO */
};

export const useVideoStarted = ({
  roomId,
  streams,
  ws,
  rtc,
  container,
  lostStreamHandler,
}: {
  roomId: string | number;
  streams: Stream[];
  ws: WS;
  rtc: RTC;
  container: HTMLDivElement | null;
  lostStreamHandler: (args: { target: string | number; connId: string }) => void;
}) => {
  const [played, setPlayed] = useState<Record<string, boolean>>({});
  const [timeStart, setTimeStart] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<Record<string | number, number>>({});

  useEffect(() => {
    if (!timeStart) {
      setTimeStart(true);
      const _played = { ...played };
      streams.forEach((item) => {
        _played[item.target] = false;
      });
      setPlayed(_played);
    }
  }, [streams, timeStart, played]);

  useEffect(() => {
    let mounted = true;
    const timeout = setInterval(() => {
      if (timeStart) {
        const diffs: Stream[] = [];
        if (Object.keys(played).length === streams.length) {
          streams.forEach((item) => {
            const that = Object.keys(played).find(
              (_item) => _item === item.target.toString() && !played[_item]
            );
            if (that) {
              diffs.push(item);
            }
          });
        } else {
          streams.forEach((item) => {
            const that = Object.keys(played).find((_item) => _item === item.target.toString());
            if (!that) {
              diffs.push(item);
            }
          });
        }
        const _attempts = { ...attempts };
        diffs.forEach((item) => {
          if (!_attempts[item.target]) {
            _attempts[item.target] = 0;
          }
          if (_attempts[item.target] === 1) {
            if (!played[item.target] && mounted) {
              lostStreamHandler(item);
              ws.sendMessage({
                type: MessageType.SET_CHANGE_UNIT,
                id: item.target,
                connId: item.connId,
                data: {
                  target: ws.userId,
                  roomLenght: rtc.roomLength,
                  muteds: rtc.muteds,
                  eventName: 'delete',
                },
              });
            }
          } else {
            log('info', `${_attempts[item.target]} attempts of restart:`, { target: item.target });
            if (_attempts[item.target] === 20) {
              _attempts[item.target] = 0;
            }
          }

          if (_attempts[item.target] !== undefined) {
            _attempts[item.target] += 1;
          } else {
            _attempts[item.target] = 1;
          }
        });
        setAttempts(_attempts);
      }
    }, 1000);
    return () => {
      clearInterval(timeout);
      mounted = false;
    };
  }, [played, streams, lostStreamHandler, attempts, ws, timeStart]);

  return { played, setPlayed };
};
