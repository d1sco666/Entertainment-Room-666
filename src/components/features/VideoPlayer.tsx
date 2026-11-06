interface VideoPlayerProps {
  src: string;
  title: string;
}

export function VideoPlayer({ src, title }: VideoPlayerProps) {
  const url = new URL(src, window.location.origin);
  const isOkRuDirectStream =
    url.protocol === 'https:' &&
    (url.hostname === 'okcdn.ru' || url.hostname.endsWith('.okcdn.ru'));

  if (isOkRuDirectStream) {
    return (
      <video
        src={src}
        title={title}
        controls
        autoPlay
        playsInline
        className="h-full w-full rounded-xl bg-black"
      />
    );
  }

  return (
    <iframe
      src={src}
      title={title}
      className="h-full w-full rounded-xl border-0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="origin"
    />
  );
}
