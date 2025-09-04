import React from 'react';

const Sidebar = () => {
  return (
    <aside className="w-64 bg-black text-white p-6">
      <div className="font-bold text-2xl mb-10">MuseBuzz</div>
      <nav>
        <ul>
          <li className="mb-4 text-lg"><a href="#" className="hover:text-zinc-400 transition-colors duration-200">Home</a></li>
          <li className="mb-4 text-lg"><a href="#" className="hover:text-zinc-400 transition-colors duration-200">Search</a></li>
          <li className="mb-4 text-lg"><a href="#" className="hover:text-zinc-400 transition-colors duration-200">Your Library</a></li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;

