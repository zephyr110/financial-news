import {
  Card,
  CardContent,
} from "./ui/card";

export default function NewsCard({ item, index }) {
  const time = item.create_time
    ? new Date(item.create_time + "+08:00")
    : null;

  const animationDelay =
    index < 10 ? `${index * 50}ms` : "0ms";

  return (
    <Card
      className="news-card group cursor-pointer transition-all duration-200 hover:border-[var(--primary)] hover:shadow-sm"
      style={{
        animationDelay,
      }}
    >
      <CardContent className="p-4">
        <p className="text-sm leading-relaxed text-[var(--foreground)]">
          {item.rich_text}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <a
            href={item.docurl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--primary)] no-underline hover:underline tabular-nums"
          >
            {time && !isNaN(time.getTime())
              ? time.toLocaleTimeString("zh-CN", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </a>
          <span>·</span>
          <span>新浪财经</span>
        </div>
      </CardContent>
    </Card>
  );
}
