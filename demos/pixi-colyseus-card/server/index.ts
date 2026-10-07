import { defineRoom } from "@colyseus/core";
import { startServer } from "../kit/server/start.ts";
import { CardRoom } from "./CardRoom.ts";

startServer({
  card: defineRoom(CardRoom),
});
