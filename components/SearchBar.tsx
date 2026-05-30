'use client';

import { MagnifyingGlass } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SearchBarProps {
  defaultValue?: string;
  size?: 'default' | 'large';
  placeholder?: string;
}

export default function SearchBar({
  defaultValue = '',
  size = 'default',
  placeholder = '输入地址，如 5 Smith St, Carlton VIC'
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    const encoded = encodeURIComponent(value.trim());
    router.push(`/property/${encoded}`);
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className={`
          w-full bg-bg-card border border-border rounded-lg
          text-text-primary placeholder:text-text-secondary
          focus:outline-none focus:border-accent transition-colors duration-150
          ${size === 'large' ? 'py-4 px-5 text-lg' : 'py-3 px-4 text-base'}
        `}
      />
      <button
        type="submit"
        className={`
          absolute right-3 top-1/2 -translate-y-1/2
          text-text-secondary hover:text-accent transition-colors
          ${size === 'large' ? 'text-xl' : 'text-lg'}
        `}
      >
        <MagnifyingGlass />
      </button>
    </form>
  );
}