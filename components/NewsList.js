import NewsCard from "./NewsCard";

export default function NewsList({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <ul className="space-y-3 list-none">
      <style jsx global>{`
        .news-card {
          opacity: 0;
          animation: fadeInUp 0.3s ease-out forwards;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .news-card {
            opacity: 1;
            animation: none;
          }
        }
      `}</style>
      {items.map((item, i) => (
        <li key={item.id ?? i}>
          <NewsCard item={item} index={i} />
        </li>
      ))}
    </ul>
  );
}
