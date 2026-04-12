export default function AdPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full bg-gray-100 border border-gray-200 border-dashed rounded-lg flex items-center justify-center text-gray-400 text-sm font-medium ${className}`}>
      <span className="opacity-50">Advertisement Area (Google AdSense)</span>
    </div>
  );
}
