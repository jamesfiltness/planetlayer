import { useEffect } from 'react';
import { Link } from 'react-router';

export default function NotFound({ message = "There's nothing at this address." }) {
  useEffect(() => {
    document.title = 'Not found · Spatial Analysis';
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-ink-muted">{message}</p>
      <Link to="/" className="rounded-lg bg-accent px-3 py-2 text-on-accent hover:bg-accent/90">Back to your maps</Link>
    </div>
  );
}
