/******************************************************************************************
 * Repository: https://github.com/kolserdav/react-node-webrtc-sfu.git
 * File name: index.ts
 * Author: Sergey Kolmiller
 * Email: <uyem.ru@gmail.com>
 * License: BSD-2-Clause
 * License text: Binary distributions of this software include 'wrtc' and other third-party libraries.
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Mon Jul 04 2022 10:58:51 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import { Colors } from '../Theme';

export interface RoomProps {
  id: number | string;
  server: string;
  port: number;
  colors?: Colors;
  iceServers?: RTCConfiguration['iceServers'];
}

export interface Stream {
  target: number | string;
  stream: MediaStream;
  connId: string;
  ref: React.Ref<HTMLVideoElement>;
}

export type ThemeType = 'light' | 'dark';
