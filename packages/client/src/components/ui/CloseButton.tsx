/******************************************************************************************
 * Repository: https://github.com/kolserdav/react-node-webrtc-sfu.git
 * File name: CloseButton.tsx
 * Author: Sergey Kolmiller
 * Email: <uyem.ru@gmail.com>
 * License: BSD-2-Clause
 * License text: Binary distributions of this software include 'wrtc' and other third-party libraries.
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Mon Jul 04 2022 10:58:51 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import s from './CloseButton.module.scss';

function CloseButton({
  tabindex,
  onClick,
  onKeyDown,
}: {
  tabindex: number;
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onKeyDown={onKeyDown}
      role="button"
      className={s.wrapper}
      tabIndex={tabindex}
      onClick={onClick}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        version="1.1"
        width="24"
        height="24"
        viewBox="0 0 24 24"
      >
        <path
          fill="#ffffff"
          d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
        />
      </svg>
    </div>
  );
}

export default CloseButton;
