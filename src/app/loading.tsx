// src/app/loading.tsx
const Loading = () => {
  return (
    <div className="bg-transparent rounded-lg h-[70vh] w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* The exact same Tailwind spinner from the homepage */}
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        {/* Context-appropriate pulsing text */}
        <p className="text-neutral-400 text-sm font-medium animate-pulse">
          Tuning in...
        </p>
      </div>
    </div>
  );
};

export default Loading;