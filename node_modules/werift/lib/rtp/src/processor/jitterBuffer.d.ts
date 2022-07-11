import { RtpPacket } from "..";
import { RtcpPacket } from "../rtcp/rtcp";
import { Pipeline } from "./base";
export declare class JitterBuffer extends Pipeline {
    private retry;
    private head?;
    private buffer;
    maxRetry: number;
    pushRtpPackets(packets: RtpPacket[]): void;
    pushRtcpPackets(packets: RtcpPacket[]): void;
    private onRtp;
}
