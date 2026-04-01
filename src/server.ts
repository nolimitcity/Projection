import express from "express";
import { createRouter } from "./http/routes.js";
import { attachActor } from "./http/auth.js";
import { errorHandler } from "./http/problem-details.js";
import { SqliteStore } from "./domain/store.js";

const port = Number(process.env.PORT ?? 3000);
const app = express();
const store = new SqliteStore();

app.use(express.json());
app.use(express.static("public"));
app.use(attachActor(store));
app.use(createRouter(store));
app.use(errorHandler);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Projection MVP API listening on port ${port}`);
});
