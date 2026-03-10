'use client';

import { useRef, useState, useCallback } from 'react';

interface Props {
  onCapture: (base64: string, mimeType: string) => void;
  disabled?: boolean;
}

export default function CameraCapture({ onCapture, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      // Camera not available → silently fall back to file upload
      fileInputRef.current?.click();
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
    stopCamera();
    onCapture(base64, 'image/jpeg');
  }, [onCapture, stopCamera]);

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
      {/* Camera preview */}
      {cameraActive && (
        <div className="relative w-full max-w-md rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full" playsInline muted />
          <button
            onClick={capture}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-black font-semibold px-6 py-2 rounded-full shadow-lg hover:bg-gray-100 transition"
          >
            Capture
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Actions */}
      {!cameraActive && (
        <div className="flex gap-3">
          <button
            onClick={startCamera}
            disabled={disabled}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition font-medium"
          >
            Scan Document
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition font-medium"
          >
            Upload
          </button>
        </div>
      )}

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
