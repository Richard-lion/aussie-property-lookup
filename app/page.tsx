import SearchBar from '@/components/SearchBar';
import Link from 'next/link';

const POPULAR_SUBURBS = [
  'Rowville VIC 3178',
  'Carlton VIC 3053',
  'Brunswick VIC 3056',
  'Richmond VIC 3121',
  'Fitzroy VIC 3065',
  'South Yarra VIC 3141',
  'Melbourne VIC 3000',
  'Sydney NSW 2000',
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-bg-base">
      <div className="w-full max-w-2xl space-y-10">
        <div className="text-center space-y-3">
          <h1 className="font-display font-bold text-5xl text-text-primary tracking-tight">
            Aussie Property Lookup
          </h1>
          <p className="text-text-secondary text-lg">
            澳洲房产，一搜即得
          </p>
        </div>

        <SearchBar size="large" />

        <div className="flex flex-wrap justify-center gap-2">
          {POPULAR_SUBURBS.map(suburb => (
            <Link
              key={suburb}
              href={`/property/${encodeURIComponent(suburb)}`}
              className="px-4 py-2 bg-bg-card border border-border rounded-full text-sm text-text-secondary hover:border-accent hover:text-accent transition-colors"
            >
              {suburb}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}