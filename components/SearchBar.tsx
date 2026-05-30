'use client';

import { MagnifyingGlass, MapPin, X } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchAutosuggest, AutosuggestResult } from '@/lib/api';

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
  const [suggestions, setSuggestions] = useState<AutosuggestResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setValue(q);
    setShowDropdown(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchAutosuggest(q);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setLoading(false);
    }, 300);
  }, []);

  const handleSelect = (s: AutosuggestResult) => {
    setValue(s.label);
    setSuggestions([]);
    setShowDropdown(false);
    const encoded = encodeURIComponent(s.label);
    router.push(`/property/${encoded}`);
  };

  const handleClear = () => {
    setValue('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setShowDropdown(false);
    const encoded = encodeURIComponent(value.trim());
    router.push(`/property/${encoded}`);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.closest('.relative')?.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const inputHeight = size === 'large' ? 'py-4 px-5 text-lg' : 'py-3 px-4 text-base';
  const iconSize = size === 'large' ? 'text-xl' : 'text-lg';

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`
            w-full bg-bg-card border border-border rounded-lg
            text-text-primary placeholder:text-text-secondary
            focus:outline-none focus:border-accent transition-colors duration-150
            ${inputHeight}
            ${showDropdown ? 'rounded-b-none border-accent' : ''}
          `}
        />
        {/* Loading spinner */}
        {loading && (
          <div className={`absolute right-10 top-1/2 -translate-y-1/2 ${iconSize} text-text-secondary`}>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        )}
        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className={`absolute right-10 top-1/2 -translate-y-1/2 ${iconSize} text-text-secondary hover:text-text-primary`}
          >
            <X weight="bold" />
          </button>
        )}
        {/* Search button */}
        <button
          type="submit"
          className={`
            absolute right-3 top-1/2 -translate-y-1/2
            text-text-secondary hover:text-accent transition-colors
            ${iconSize}
          `}
        >
          <MagnifyingGlass />
        </button>
      </div>

      {/* Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-bg-card border border-t-0 border-accent rounded-b-lg shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover transition-colors text-text-primary border-t border-border first:border-t-0"
              >
                <MapPin weight="fill" className="text-accent shrink-0" size={18} />
                <span className="text-sm">{s.label}</span>
                <span className="ml-auto text-xs text-text-secondary capitalize">{s.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}