
interface PromptImageProps {
  imageUrl: string;
  title: string;
  onImageClick: () => void;
}

export function PromptImage({ imageUrl, title, onImageClick }: PromptImageProps) {
  return (
    <div 
      className="relative overflow-hidden rounded-xl aspect-square bg-white/50 cursor-pointer hover:opacity-90 transition-opacity"
      onClick={onImageClick}
    >
      <img
        src={imageUrl}
        alt={title}
        className="w-full h-full object-contain"
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
        <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-lg">
          Click to expand
        </span>
      </div>
    </div>
  );
}
