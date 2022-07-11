/// <reference types="node" />
import { RtpHeader } from "../rtp/rtp";
export declare abstract class DePacketizerBase {
    payload: Buffer;
    static deSerialize(buf: Buffer): DePacketizerBase;
    static isDetectedFinalPacketInSequence(header: RtpHeader): boolean;
    get isKeyframe(): boolean;
}
