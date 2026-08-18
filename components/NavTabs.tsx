import Link from 'next/link';
import { useRouter } from 'next/router';
import { Newspaper, BarChart3, MessageSquareText } from 'lucide-react';

export default function NavTabs() {
  const router = useRouter();

  const tabs = [
    { href: '/', label: '实时快讯', icon: Newspaper },
    { href: '/analysis', label: '分析面板', icon: BarChart3 },
    { href: '/agent', label: '研究助手', icon: MessageSquareText },
  ];

  return (
    <div className="flex gap-1 mb-4">
      {tabs.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`px-3 py-1.5 text-sm font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
            router.pathname === href
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </div>
  );
}
