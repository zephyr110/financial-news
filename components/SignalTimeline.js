import AnalysisNewsCard from './AnalysisNewsCard';

export default function SignalTimeline({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        暂无信号数据，等待新闻归档和分析完成...
      </div>
    );
  }

  return (
    <ul className="space-y-3 list-none">
      {items.map((item) => (
        <li key={item.id}><AnalysisNewsCard item={item} /></li>
      ))}
    </ul>
  );
}
