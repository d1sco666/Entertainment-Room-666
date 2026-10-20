import { onRequestGet as __anime_recent_ts_onRequestGet } from "/workspaces/Entertainment-Room-666/functions/anime/recent.ts"
import { onRequestGet as __anime_search_ts_onRequestGet } from "/workspaces/Entertainment-Room-666/functions/anime/search.ts"
import { onRequestGet as __anime___id___ts_onRequestGet } from "/workspaces/Entertainment-Room-666/functions/anime/[[id]].ts"

export const routes = [
    {
      routePath: "/anime/recent",
      mountPath: "/anime",
      method: "GET",
      middlewares: [],
      modules: [__anime_recent_ts_onRequestGet],
    },
  {
      routePath: "/anime/search",
      mountPath: "/anime",
      method: "GET",
      middlewares: [],
      modules: [__anime_search_ts_onRequestGet],
    },
  {
      routePath: "/anime/:id*",
      mountPath: "/anime",
      method: "GET",
      middlewares: [],
      modules: [__anime___id___ts_onRequestGet],
    },
  ]