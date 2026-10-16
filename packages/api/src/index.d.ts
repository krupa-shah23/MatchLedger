import { type FastifyInstance } from "fastify";
export interface ServerOptions {
    jwtSecret?: string;
    wsAuthTimeoutMs?: number;
}
export declare function buildServer(opts?: ServerOptions): Promise<FastifyInstance>;
