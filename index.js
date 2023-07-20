const http = require("http");
const { createReadStream, existsSync } = require("fs");
const { join } = require("path");
const multiparty = require("multiparty").Form;

Object.defineProperty(exports, "__esModule", { value: true });

const global = {
  run(middlewares, initialUrl) {
    return {
      next: false,
      firstCb: true,
      FirstCb() {
        this.firstCb = true;
      },
      async middleware(req, res) {
        const url = req.url.split(/\?(.*)/s)[0].split("/");
        const usedMw = [];
        for (let i = 0; i < middlewares.length; i++) {
          if (!this.next && i) break;
          const item = middlewares[i];
          req.url = initialUrl();
          if (item.hasOwnProperty("url") && item.url) {
            const result = middlewares.find((i) => {
              if (!i.url || usedMw.find((mw) => mw === i)) return;
              if (i.url.every((i) => i === "")) i.url.length--;
              for (let v = 0; v < url.slice(0, i.url.length).length; v++) {
                if (i.url[v][0] === ":") req.params[i.url[v].replace(":", "")] = url[v];
                else if (i.url[v] !== url[v]) return;
              }
              return true;
            });
            if (result === item) {
              this.next = false;
              req.url = req.url.replace(url.slice(0, item.url.length).join("/"), "");
              if (!req.url) req.url = "/";
              usedMw.push(item);
              this.firstCb = false;
              await item.mw(req, res, () => (this.next = true));
            }
          } else {
            (this.firstCb = false), (this.next = false);
            await item.mw(req, res, () => (this.next = true));
          }
        }
      },
      async route(route, req, res) {
        for (const i of route.cb) {
          if (!this.next && !this.firstCb) break;
          (this.firstCb = false), (this.next = false);
          await i(req, res, () => (this.next = true));
        }
      },
    };
  },
  findRoute(req, routes) {
    if (!req.params) req.params = {};
    if (!req.query) req.query = {};
    const [path, query] = req.url.split(/\?(.*)/s);
    const url = path.split("/");
    const route = routes.find((i) => {
      const params = {};
      if (url.length !== i.url.length || req.method !== i.method) return;
      for (let v = 0; v < url.length; v++)
        if (i.url[v][0] === ":") params[i.url[v].replace(":", "")] = url[v];
        else if (i.url[v] !== url[v]) return;
      global.modifyHandler(req.params, params);
      return true;
    });
    if (!Object.keys(req.query).length && query) {
      for (const i of query.split("&")) i && (req.query[i.split("=")[0]] = decodeURI(i.split("=")[1]));
    }
    return route;
  },
  modifyHandler(target, fields) {
    for (const k of Object.keys(fields)) target[k] = fields[k];
    return target;
  },
};

const app = () => {
  let initialUrl = "";
  let headersSending = false;
  const routes = [];
  const middlewares = [];
  const run = global.run(middlewares, () => initialUrl);

  const resMethods = {
    json(chunk) {
      this.setHeader("Content-Type", "application/json; charset=utf-8");
      this.write(JSON.stringify(chunk));
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    send(chunk) {
      this.setHeader("Content-Type", "text/html; charset=utf-8");
      this.write(chunk);
    },
  };
  const serverMiddlewares = {
    cors(_, res, next) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      next();
    },
    json(req, _, next) {
      if (
        req.method === "GET" ||
        (req.headers["content-type"] && req.headers["content-type"].indexOf("multipart") > -1)
      )
        return next();
      try {
        req.body = JSON.parse(req.body);
      } catch {
        req.body = {};
      }
      next();
    },
    async multipart(req, _, next) {
      if (!req.headers["content-type"] || !(req.headers["content-type"].indexOf("multipart") > -1))
        return next();
      return new Promise((resolve) => {
        new multiparty().parse(req, (err, fields, files) => {
          [req.body, req.files] = [{}, {}];
          if (err) return console.log(err);
          for (const k of Object.keys(fields)) req.body[k] = fields[k][0];
          for (const k of Object.keys(files)) req.files[k] = files[k][0];
          resolve(true);
          next();
        });
      });
    },
    static(path) {
      return async (req, res, next) => {
        headersSending = false;
        if (!req.url) return next();
        const url = req.url.split("/");
        if (!url[1] || !path || url.length !== 2 || !existsSync(path)) return next();
        const file = join(path, url[1]);
        if (!existsSync(file)) return next();
        headersSending = true;
        createReadStream(file).pipe(res);
      };
    },
  };
  const getBody = async (req) => {
    req.body = "";
    if (
      req.method === "GET" ||
      (req.headers["content-type"] && req.headers["content-type"].indexOf("multipart") > -1)
    )
      return {};
    req.on("data", (chunk) => (req.body += chunk));
    return new Promise((res) => req.once("end", () => res(req.body)));
  };

  const listener = async (req, res) => {
    initialUrl = req.url;
    const route = global.findRoute(req, routes);
    await getBody(req);
    const [Request, Response] = [req, global.modifyHandler(res, resMethods)];
    await run.middleware(Request, Response);
    if (!route) {
      if (!res.headersSent && !headersSending) Response.send(`<pre>Cannot ${req.method} ${initialUrl}</pre>`);
      return !headersSending ? res.end() : undefined;
    }
    await run.route(route, Request, Response);
    res.end();
  };

  const app = http.createServer(listener);
  app.get = (url, ...cb) => routes.push({ url: url.split("/"), cb, method: "GET" });
  app.post = (url, ...cb) => routes.push({ url: url.split("/"), cb, method: "POST" });
  app.put = (url, ...cb) => routes.push({ url: url.split("/"), cb, method: "PUT" });
  app.delete = (url, ...cb) => routes.push({ url: url.split("/"), cb, method: "DELETE" });
  app.use = (urlOrMw, mw = (_, __, next) => next()) => {
    if (typeof urlOrMw === "string") {
      mw = typeof mw === "function" ? mw : mw.handler;
      middlewares.push({ url: urlOrMw.split("/"), mw });
    } else middlewares.push({ mw: urlOrMw });
    return app.use;
  };
  global.modifyHandler(app, serverMiddlewares);
  return app;
};

const Router = () => {
  let initialUrl = "";
  const routes = [];
  const middlewares = [];
  const run = global.run(middlewares, () => initialUrl);

  const handler = async (req, res, next) => {
    initialUrl = req.url;
    run.FirstCb();
    const route = global.findRoute(req, routes);
    await run.middleware(req, res);
    if (!route) return next();
    await run.route(route, req, res);
  };

  const router = {
    handler,
    get: (url, ...cb) => routes.push({ url: url.split("/"), cb, method: "GET" }),
    post: (url, ...cb) => routes.push({ url: url.split("/"), cb, method: "POST" }),
    put: (url, ...cb) => routes.push({ url: url.split("/"), cb, method: "PUT" }),
    delete: (url, ...cb) => routes.push({ url: url.split("/"), cb, method: "DELETE" }),
    use: (urlOrMw, mw = (_, __, next) => next()) => {
      if (typeof urlOrMw === "string") {
        mw = typeof mw === "function" ? mw : mw.handler;
        middlewares.push({ url: urlOrMw.split("/"), mw });
      } else middlewares.push({ mw: urlOrMw });
      return router.use;
    },
  };

  return router;
};

exports.Router = Router;
exports.default = app;
