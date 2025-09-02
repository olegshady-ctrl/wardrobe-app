"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Heart, MessageCircle, Send, MoreHorizontal,
  ChevronLeft, ChevronRight, Bookmark, BookmarkCheck,
  Link as LinkIcon, Share2, Flag
} from "lucide-react";
import type { ApiPost } from "./page";

/* helpers */
const cn = (...cls: Array<string | false | null | undefined>) => cls.filter(Boolean).join(" ");
const formatDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" }).format(d);
};
const copyLink = (url: string) => {
  if (typeof navigator === "undefined") return;
  if (navigator.share) navigator.share({ url }).catch(() => navigator.clipboard.writeText(url));
  else navigator.clipboard.writeText(url).catch(() => {});
};

/** Делает валидный абсолютный URL из относительного.
 *  Префиксует NEXT_PUBLIC_ASSETS_BASE, если он задан.
 */
const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE || "";
const resolveUrl = (u?: string) => {
  if (!u) return "";
  if (/^data:|^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  const normalized = u.startsWith("/") ? u : `/${u}`;
  return ASSETS_BASE ? `${ASSETS_BASE}${normalized}`.replace(/([^:])\/{2,}/g, "$1/") : normalized;
};

/** Картинка без «текста вместо изображения»: при ошибке просто скрывается */
function SafeImg({ src, className }: { src?: string; className?: string }) {
  const [ok, setOk] = useState(!!src);
  if (!src || !ok) return <div className={className} />;
  const url = resolveUrl(src);
  return (
    <img
      src={url}
      alt=""
      className={className}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        // eslint-disable-next-line no-console
        console.warn("[IMG 404]", url);
        setOk(false);
      }}
    />
  );
}

/* UI */
function PostHeader({ post }: { post: ApiPost }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const postUrl =
    typeof window !== "undefined" ? `${window.location.origin}/feed/${post.id}` : `/feed/${post.id}`;

  return (
    <div className="relative flex items-center justify-between">
      <a href={`/profile/${post.author.nickname}`} className="flex items-center gap-3">
        <div className="inline-flex size-11 items-center justify-center overflow-hidden rounded-full bg-muted">
          <SafeImg src={post.author.avatarUrl} className="h-full w-full object-cover" />
        </div>
        <span className="font-semibold">@{post.author.nickname}</span>
      </a>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{formatDate(post.createdAt)}</span>
        <button
          className="ml-1 inline-flex size-10 items-center justify-center rounded-2xl hover:bg-muted"
          aria-label="Меню"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      {/* Бекдроп на всю страницу — закрывает меню кликом по пустому месту */}
      {menuOpen && (
        <>
          <button
            aria-label="close menu"
            className="fixed inset-0 z-20 h-full w-full cursor-default bg-transparent"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-10 z-30 w-56 rounded-xl border bg-background p-1 shadow-lg">
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted" onClick={() => copyLink(postUrl)}>
              <LinkIcon className="size-4" />
              <span>Копировать ссылку</span>
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted"
              onClick={() => {
                if (navigator.share) navigator.share({ url: postUrl }).catch(() => {});
                else copyLink(postUrl);
                setMenuOpen(false);
              }}
            >
              <Share2 className="size-4" />
              <span>Поделиться…</span>
            </button>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted">
              <Flag className="size-4" />
              <span>Пожаловаться</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SwipeCarousel({ images, ariaLabel }: { images: { src: string; alt: string }[]; ariaLabel?: string }) {
  const [index, setIndex] = useState(0);
  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  return (
    <div className="relative w-full aspect-[4/5] overflow-hidden rounded-xl bg-muted">
      {images[index] && (
        <SafeImg src={images[index].src} className="h-full w-full object-cover" />
      )}

      {images.length > 1 && (
        <>
          <button aria-label="Попереднє фото" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 shadow" onClick={prev}>
            <ChevronLeft className="size-5" />
          </button>
          <button aria-label="Наступне фото" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 shadow" onClick={next}>
            <ChevronRight className="size-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i === index ? "bg-white" : "bg-white/50")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ElementsStrip({ elements }: { elements: ApiPost["elements"] }) {
  return (
    <div className="mt-3">
      <div className="mb-2 text-sm font-medium">Елементи образу</div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {elements.map((el) => (
          <div key={el.id} className="flex min-w-20 flex-col items-center gap-2 rounded-xl border bg-card p-2 shadow-sm">
            <div className="relative size-16 overflow-hidden rounded-lg bg-muted">
              <SafeImg src={el.imageUrl} className="h-full w-full object-contain" />
            </div>
            <span className="text-xs text-center text-muted-foreground line-clamp-1">{el.title || "Елемент"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LikesAndActions({ post, faved, onToggleFavorite }: { post: ApiPost; faved: boolean; onToggleFavorite: () => void }) {
  const [liked, setLiked] = useState(!!post.likedByMe);
  const [likes, setLikes] = useState(post.likesCount);
  const toggleLike = () => { const next = !liked; setLiked(next); setLikes((l) => l + (next ? 1 : -1)); };

  return (
    <div className="mt-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button className="inline-flex size-10 items-center justify-center rounded-2xl hover:bg-muted" onClick={toggleLike} aria-label="Лайкнути">
          <Heart className={cn("size-6", liked && "fill-current")} />
        </button>
        <span className="text-sm font-medium">{likes} лайків</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MessageCircle className="size-5" />
        <span>Коментарі</span>
        <button className="ml-2 inline-flex items-center gap-2 rounded-full px-3 py-2 hover:bg-muted" onClick={onToggleFavorite} aria-label="Добавить в избранное">
          {faved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
          <span>{faved ? "В избранном" : "Добавить в избранное"}</span>
        </button>
      </div>
    </div>
  );
}

function CommentsBlock({ initial }: { initial: ApiPost["comments"] }) {
  const [comments, setComments] = useState(initial || []);
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");
  const shown = useMemo(() => (expanded ? comments : comments.slice(0, 2)), [comments, expanded]);

  const toggleCommentLike = (id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likesCount + (!c.likedByMe ? 1 : -1) } : c)),
    );
  };

  const add = () => {
    const text = value.trim();
    if (!text) return;
    const newComment = {
      id: Math.random().toString(36).slice(2),
      author: { nickname: "ви" },
      text,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      likedByMe: false,
    };
    setComments((c) => [newComment, ...c]);
    setValue("");
  };

  return (
    <div className="mt-3">
      {comments.length > 2 && !expanded && (
        <button className="mb-2 text-sm text-muted-foreground hover:underline" onClick={() => setExpanded(true)}>
          Показати всі коментарі ({comments.length})
        </button>
      )}

      <div className="space-y-2">
        {shown.map((c) => (
          <div key={c.id} className="flex items-center justify-between text-sm">
            <div>
              <a href={`/profile/${c.author.nickname}`} className="mr-2 font-medium hover:underline">
                @{c.author.nickname}
              </a>
              <span>{c.text}</span>
            </div>
            <button className="ml-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-muted" onClick={() => toggleCommentLike(c.id)} aria-label="Лайк коментаря">
              <Heart className={cn("size-4", c.likedByMe && "fill-current")} />
              <span>{c.likesCount}</span>
            </button>
          </div>
        ))}
        {comments.length === 0 && <div className="text-sm text-muted-foreground">Будьте першим, хто залишить коментар</div>}
      </div>

      <div className="mt-3 flex items-start gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Додайте коментар…"
          className="min-h-10 w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-primary/50"
        />
        <button onClick={add} className="shrink-0 inline-flex items-center rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90" aria-label="Надіслати коментар">
          <Send className="mr-2 size-4" /> Надіслати
        </button>
      </div>
    </div>
  );
}

function FeedPost({ post }: { post: ApiPost }) {
  const [faved, setFaved] = useState(!!post.favedByMe);
  const toggleFavorite = () => setFaved((v) => !v);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
      <div className="p-4">
        <PostHeader post={post} />
      </div>

      <div className="p-4 pt-0">
        <SwipeCarousel
          images={[
            { src: post.photoUrl, alt: "Фото" },
            { src: post.collageUrl, alt: "Колаж" },
          ]}
          ariaLabel="Фото та колаж"
        />

        <ElementsStrip elements={post.elements} />

        {post.caption && (
          <div className="mt-3 text-sm">
            <a href={`/profile/${post.author.nickname}`} className="mr-2 font-medium hover:underline">
              @{post.author.nickname}
            </a>
            <span>{post.caption}</span>
          </div>
        )}

        <LikesAndActions post={post} faved={faved} onToggleFavorite={toggleFavorite} />
        <CommentsBlock initial={post.comments} />
      </div>
    </div>
  );
}

export default function FeedClient({
  initialPosts,
  debug,
}: {
  initialPosts: ApiPost[];
  debug?: { url: string; status?: number; note?: string; sampleKeys?: string[] };
}) {
  // Диагностика путей (однократно в браузере)
  useEffect(() => {
    if (!initialPosts?.length) return;
    const p = initialPosts[0];
    const urls = {
      avatar: resolveUrl(p.author?.avatarUrl),
      photo: resolveUrl(p.photoUrl),
      collage: resolveUrl(p.collageUrl),
      elements: (p.elements || []).map((e) => resolveUrl(e.imageUrl)),
    };
    // eslint-disable-next-line no-console
    console.warn("[FEED IMG URLS]", urls);
  }, [initialPosts]);

  if (!initialPosts || initialPosts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Пока пусто.
        {debug && (
          <div className="mt-3 rounded-xl border p-3 text-xs text-foreground">
            <div><b>Источник:</b> {debug.url}</div>
            {typeof debug.status !== "undefined" && <div><b>Status:</b> {debug.status}</div>}
            {debug.note && <div><b>Note:</b> {debug.note}</div>}
            {debug.sampleKeys && debug.sampleKeys.length > 0 && (
              <div><b>Keys:</b> {debug.sampleKeys.join(", ")}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {initialPosts.map((p) => (
        <FeedPost key={p.id} post={p} />
      ))}
    </>
  );
}
