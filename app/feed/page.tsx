import FeedClient from "./FeedClient";
import { cookies, headers } from "next/headers";
import { promises as fs } from "fs";
import path from "path";

type ApiUser = { nickname: string; avatarUrl?: string };
type ApiElement = { id: string; imageUrl: string; title?: string };
type ApiComment = { id: string; author: ApiUser; text: string; createdAt: string; likesCount: number; likedByMe?: boolean; };
export type ApiPost = {
  id: string;
  author: ApiUser;
  createdAt: string;
  photoUrl: string;
  collageUrl: string;
  elements: ApiElement[];
  caption?: string;
  likesCount: number;
  likedByMe?: boolean;
  favedByMe?: boolean;
  comments: ApiComment[];
};

const REMOTE_FEED_URL = process.env.BACKEND_FEED_URL ?? process.env.NEXT_PUBLIC_FEED_API ?? "";
type DebugInfo = { url: string; status?: number; note?: string; sampleKeys?: string[] } | undefined;

/* та же логика резолва, но на сервере */
const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE || "";
const resolvePathSSR = (u?: string) => {
  if (!u) return "";
  if (/^data:|^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  const normalized = u.startsWith("/") ? u : `/${u}`;
  return ASSETS_BASE ? `${ASSETS_BASE}${normalized}`.replace(/([^:])\/{2,}/g, "$1/") : normalized;
};

const AVATAR_MAP_ENV = process.env.AVATAR_MAP || process.env.NEXT_PUBLIC_AVATAR_MAP || "";
const AVATAR_BASE = process.env.AVATAR_BASE || process.env.NEXT_PUBLIC_AVATAR_BASE || "";
const AVATAR_EXT = process.env.AVATAR_EXT || process.env.NEXT_PUBLIC_AVATAR_EXT || "jpg";
let AVATAR_MAP: Record<string, string> | undefined;
try { AVATAR_MAP = AVATAR_MAP_ENV ? JSON.parse(AVATAR_MAP_ENV) : undefined; } catch { AVATAR_MAP = undefined; }

function hydrate(posts: ApiPost[]): ApiPost[] {
  return posts.map((p) => {
    const nick = p.author?.nickname;
    let avatar = p.author?.avatarUrl;
    if (!avatar && AVATAR_MAP && nick && AVATAR_MAP[nick]) avatar = AVATAR_MAP[nick];
    if (!avatar && AVATAR_BASE && nick) {
      const base = AVATAR_BASE.endsWith("/") ? AVATAR_BASE.slice(0, -1) : AVATAR_BASE;
      avatar = `${base}/${nick}.${AVATAR_EXT}`;
    }
    return {
      ...p,
      author: { ...p.author, avatarUrl: resolvePathSSR(avatar) },
      photoUrl: resolvePathSSR(p.photoUrl),
      collageUrl: resolvePathSSR(p.collageUrl),
      elements: (p.elements || []).map(e => ({ ...e, imageUrl: resolvePathSSR(e.imageUrl) })),
    };
  });
}

/* локальный JSON */
async function getLocal(): Promise<{ posts: ApiPost[]; debug?: DebugInfo }> {
  const localPath = path.join(process.cwd(), "public", "feed.json");
  try {
    const raw = await fs.readFile(localPath, "utf8");
    const json = JSON.parse(raw);
    const arr = Array.isArray(json) ? json
      : Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.items) ? json.items
      : Array.isArray(json?.results) ? json.results
      : Array.isArray(json?.posts) ? json.posts : [];
    if (!Array.isArray(arr) || arr.length === 0) {
      const sample = Array.isArray(arr) ? arr[0] : (json && typeof json === "object" ? json : undefined);
      return { posts: [], debug: { url: "public/feed.json", note: "Файл найден, но массив постов пуст", sampleKeys: sample ? Object.keys(sample) : undefined } };
    }
    return { posts: hydrate(arr as ApiPost[]) };
  } catch (e: any) {
    return { posts: [], debug: { url: "public/feed.json", note: e?.message || "Не удалось прочитать feed.json" } };
  }
}

/* удалённо */
async function getRemote(): Promise<{ posts: ApiPost[]; debug?: DebugInfo }> {
  const h = new Headers();
  const cookieHeader = cookies().getAll().map(c => `${c.name}=${c.value}`).join("; ");
  if (cookieHeader) h.set("cookie", cookieHeader);
  const auth = headers().get("authorization"); if (auth) h.set("authorization", auth);

  try {
    const res = await fetch(REMOTE_FEED_URL, { cache: "no-store", headers: h });
    const status = res.status;
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) return { posts: [], debug: { url: REMOTE_FEED_URL, status, note: `HTTP ${status}` } };
    if (!ct.includes("application/json")) return { posts: [], debug: { url: REMOTE_FEED_URL, status, note: `Неверный Content-Type: ${ct}` } };

    const json = await res.json();
    const arr = Array.isArray(json) ? json
      : Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.items) ? json.items
      : Array.isArray(json?.results) ? json.results
      : Array.isArray(json?.posts) ? json.posts : [];
    if (!Array.isArray(arr) || arr.length === 0) {
      const sample = Array.isArray(arr) ? arr[0] : (json && typeof json === "object" ? json : undefined);
      return { posts: [], debug: { url: REMOTE_FEED_URL, status, note: "JSON получен, но массив постов не найден", sampleKeys: sample ? Object.keys(sample) : undefined } };
    }
    return { posts: hydrate(arr as ApiPost[]) };
  } catch (e: any) {
    return { posts: [], debug: { url: REMOTE_FEED_URL, note: e?.message || "fetch error" } };
  }
}

export default async function Page() {
  const { posts, debug } = REMOTE_FEED_URL ? await getRemote() : await getLocal();
  return (
    <div className="mx-auto max-w-xl space-y-6 px-3 py-6">
      <FeedClient initialPosts={posts} debug={debug} />
    </div>
  );
}
