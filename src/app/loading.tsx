// src/app/loading.tsx
'use client';

import { ScaleLoader } from "react-spinners";

const Loading = () => {
  return (
    // Changed 'h-full' to 'h-[70vh]' to force the box to have height
    <div className="bg-transparent rounded-lg h-[70vh] w-full flex items-center justify-center">
      <ScaleLoader color="#940ae3c8" height={40} margin={3} radius={3} width={4} />
    </div>
  );
};

export default Loading;