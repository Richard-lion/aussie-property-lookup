import { fetchAutosuggest } from '@/lib/api';

export default async function TestPage() {
  const results = await fetchAutosuggest('Carlton VIC');
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Test</h1>
      <pre className="bg-gray-100 p-4 rounded text-sm">
        {JSON.stringify({ count: results.length, results }, null, 2)}
      </pre>
      <p className="mt-4 text-gray-500">API_BASE env: {process.env.NEXT_PUBLIC_API_BASE ?? 'NOT SET'}</p>
    </main>
  );
}