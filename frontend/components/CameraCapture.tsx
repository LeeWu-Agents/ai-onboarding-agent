'use client';

import { useRef, useCallback } from 'react';

interface Props {
  onCapture: (base64: string, mimeType: string) => void;
  disabled?: boolean;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
}

export default function CameraCapture({ onCapture, disabled, fileInputRef: externalRef }: Props) {
  const internalRef = useRef<HTMLInputElement>(null);
  const fileInputRef = externalRef ?? internalRef;

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      onCapture(base64, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  }, [onCapture]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition font-medium"
      >
        Scan Document
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
}
