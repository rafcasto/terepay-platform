export default function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}
