import Event from "rx.mini";
import { RtcpPacket, RtpHeader, RtpPacket } from "..";
import { Pipeline } from "./base";
export declare class SampleBuilder extends Pipeline {
    private isFinalPacketInSequence;
    private buffering;
    constructor(isFinalPacketInSequence: (header: RtpHeader) => boolean, streams?: {
        rtpStream?: Event<[RtpPacket]>;
        rtcpStream?: Event<[RtcpPacket]>;
    });
    pushRtpPackets(incoming: RtpPacket[]): void;
    pushRtcpPackets(packets: RtcpPacket[]): void;
}
