import NewsCard from "./NewsCard";

export default function NewsList({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3">
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
      `}</style>
      {items.map((item, i) => (
        <NewsCard key={item.id} item={item} index={i} />
      ))}
    </div>
  );
}
