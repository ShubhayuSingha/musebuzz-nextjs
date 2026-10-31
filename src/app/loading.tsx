// src/app/loading.tsx
import MusicLoader from "@/components/MusicLoader";

const Loading = () => {
  return (
    <div className="bg-transparent rounded-lg h-[70vh] w-full flex items-center justify-center p-4">
      <MusicLoader label="Tuning in..." size="lg" />
    </div>
  );
};

export default Loading;
