/// <reference types="node" />
import * as http from "http";
export type Request = http.IncomingMessage & {
    url: string;
    body: any;
    files: Record<string, File>;
    params: Record<string, string>;
    query: Record<string, string>;
};
export type Response = http.ServerResponse & {
    json: (data: object) => void;
    status: (statusCode: number) => Response;
    send: (chunk: string) => void;
};
type httpServer = http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
type callback = (req: Request, res: Response, next: () => void) => Promise<void> | void;
type method = (url: string, ...cb: callback[]) => void;
type appUse = (urlOrMw: string | callback, mw?: callback | {
    handler: callback;
}) => appUse;
interface Router {
    handler: callback;
    get: method;
    post: method;
    put: method;
    delete: method;
    use: appUse;
}
interface IApp extends httpServer {
    get: method;
    post: method;
    put: method;
    delete: method;
    use: appUse;
    cors: () => void;
    json: () => void;
    multipart: () => void;
    static: (path: string) => callback;
}
declare const app: () => IApp;
declare const Router: () => Router;
export { Router };
export default app;
