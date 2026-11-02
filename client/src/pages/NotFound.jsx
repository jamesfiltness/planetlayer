import { useEffect } from 'react';
import { Link } from 'react-router';

export default function NotFound({ message = "There's nothing at this address." }) {
  useEffect(() => {
    document.title = 'Not found · Spatial Analysis';
  }, []);

  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 bg-gray-50 p-4 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-gray-600">{message}</p>
      <Link to="/" className="rounded-lg bg-accent px-3 py-2 text-white hover:bg-accent/90">Back to your maps</Link>
    </main>
  );
}
