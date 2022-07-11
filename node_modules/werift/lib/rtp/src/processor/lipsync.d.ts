import Event from "rx.mini";
import { RtpPacket } from "..";
import { RtcpPacket } from "../rtcp/rtcp";
import { Pipeline } from "./base";
export declare class LipSync extends Pipeline {
    clockRate: number;
    mismatch: number;
    baseNtpTimestamp?: bigint;
    baseRtpTimestamp?: number;
    private rtpPackets;
    constructor(clockRate: number, mismatch: number, streams?: {
        rtpStream?: Event<[RtpPacket]>;
        rtcpStream?: Event<[RtcpPacket]>;
    });
    pushRtcpPackets(packets: RtcpPacket[]): void;
    private srReceived;
    pushRtpPackets(packets: RtpPacket[]): void;
    private calcNtpTime;
}
export declare const ntpTime2Time: (ntp: bigint) => number;
/**4294967295 */
export declare const Max32bit: number;
export interface BufferResolve {
    packets: {
        packet: RtpPacket;
        offset: number;
    }[];
    /**NTP seconds */
    startAtNtpTime: number;
}
