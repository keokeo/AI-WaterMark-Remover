import { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Download, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultImage(null);
      setError(null);
    } else {
      setError("Please select a valid image file.");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const removeWatermark = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      const base64Data = await fileToBase64(selectedImage);
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: selectedImage.type,
              },
            },
            {
              text: 'Clean up this image by removing any text overlays, logos, stamps, or distracting elements. Restore and fill in the background seamlessly where elements were removed. Output only the modified image.',
            },
          ],
        },
      });

      let foundImage = false;
      
      // Check if the response was blocked by safety filters
      if (response.promptFeedback?.blockReason) {
        throw new Error(`Image processing was blocked by AI safety filters. Reason: ${response.promptFeedback.blockReason}`);
      }

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          setResultImage(imageUrl);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        throw new Error("AI 模型未能返回处理后的图片。这可能是因为图片内容触发了版权或安全保护机制，导致模型拒绝执行清理操作。请尝试使用其他图片。");
      }

    } catch (err: any) {
      console.error("Error processing image:", err);
      setError(err.message || "处理图片时发生未知错误。");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `cleaned-${selectedImage?.name || 'image.png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setResultImage(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">AI Watermark Remover</h1>
          </div>
          {previewUrl && (
            <button
              onClick={reset}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {!previewUrl ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 mb-4">
                  Remove watermarks in seconds
                </h2>
                <p className="text-lg text-zinc-500">
                  Upload an image and let AI intelligently remove watermarks, text, or logos while preserving the background.
                </p>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative group cursor-pointer
                  border-2 border-dashed rounded-3xl p-12
                  flex flex-col items-center justify-center text-center
                  transition-all duration-200 ease-in-out
                  ${isDragging 
                    ? 'border-indigo-500 bg-indigo-50/50' 
                    : 'border-zinc-200 bg-white hover:border-indigo-300 hover:bg-zinc-50'
                  }
                `}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                
                <div className={`
                  p-4 rounded-full mb-4 transition-colors duration-200
                  ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 text-zinc-500 group-hover:bg-indigo-50 group-hover:text-indigo-500'}
                `}>
                  <Upload className="w-8 h-8" />
                </div>
                
                <h3 className="text-lg font-semibold text-zinc-900 mb-1">
                  Click to upload or drag and drop
                </h3>
                <p className="text-sm text-zinc-500">
                  PNG, JPG, WEBP up to 10MB
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 text-red-800">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Processing Error</h4>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Original Image */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-zinc-400" />
                      Original Image
                    </h3>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm relative aspect-[4/3] sm:aspect-auto sm:min-h-[400px] flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMmYyZjIiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMmYyZjIiPjwvcmVjdD4KPC9zdmc+')]">
                    <img
                      src={previewUrl}
                      alt="Original"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  
                  {!resultImage && (
                    <button
                      onClick={removeWatermark}
                      disabled={isProcessing}
                      className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Removing Watermark...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          Remove Watermark
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Result Image */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      Cleaned Result
                    </h3>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm relative aspect-[4/3] sm:aspect-auto sm:min-h-[400px] flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMmYyZjIiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMmYyZjIiPjwvcmVjdD4KPC9zdmc+')]">
                    {resultImage ? (
                      <img
                        src={resultImage}
                        alt="Result"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : isProcessing ? (
                      <div className="flex flex-col items-center justify-center text-zinc-400 space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <p className="text-sm font-medium animate-pulse">AI is working its magic...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-400 space-y-2">
                        <ImageIcon className="w-8 h-8 opacity-20" />
                        <p className="text-sm">Result will appear here</p>
                      </div>
                    )}
                  </div>

                  {resultImage && (
                    <button
                      onClick={downloadResult}
                      className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-black text-white rounded-2xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Download className="w-5 h-5" />
                      Download Image
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
