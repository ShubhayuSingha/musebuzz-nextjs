'use client';

import React from 'react';
import { BiSearch } from 'react-icons/bi';
import { IoClose } from 'react-icons/io5';

interface ViewSearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const ViewSearchBar: React.FC<ViewSearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search in songs...',
  className = '',
}) => {
  return (
    <div
      className={`
        relative flex items-center w-full max-w-xs md:max-w-sm 
        bg-neutral-900/90 hover:bg-neutral-900 
        border border-neutral-700/60 focus-within:border-neutral-400 
        focus-within:bg-black rounded-full px-3 py-1.5 
        transition-all duration-200 shadow-sm
        ${className}
      `}
    >
      <BiSearch className="text-neutral-400 flex-shrink-0 mr-2 text-lg" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-400 
          outline-none border-none pr-6
        "
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 p-0.5 text-neutral-400 hover:text-white rounded-full transition-colors"
          title="Clear search"
          aria-label="Clear search"
        >
          <IoClose className="text-base" />
        </button>
      )}
    </div>
  );
};

export default ViewSearchBar;

