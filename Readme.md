# pixerver

Fast, minimalist server is similar to express

## Usage

Create the app:

```js
import server from "pixerver";

const app = server();

app.listen(3000, () => console.log("Server started"));
```

Create the router:

```js
import { Router } from "pixerver";

const router = Router();

router.get("/users", (req, res) => {
  res.json(users);
});
router.post("/register", (req, res) => {
  const { username, password } = req.body;
});

export default router;
```

Middlewares:

```js
import anyRouter from "..."

app.use((req, res, next)=>{...})
// or
app.use("/api", anyRouter)
```

## Use built-in middleware

Automatic body to json conversion:
`app.use(app.json)`

Allow any requests:
`app.use(app.cors)`

Parse http requests with content-type _multipart/form-data_:
`app.use(app.multipart)`

Set folder for static files:
`app.use(app.static(stringPath))`

[npm-url]: https://www.npmjs.com/package/pixerver
