import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const router = useRouter();

  const isActive = (path: string) => router.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-lg font-semibold text-amber-700">
              Home Bible
            </Link>
          </div>
          <div className="flex gap-4 text-sm">
            <Link
              href="/"
              className={`px-3 py-2 rounded ${
                isActive('/') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Home
            </Link>
            <Link
              href="/create-property"
              className={`px-3 py-2 rounded ${
                isActive('/create-property') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Create Property
            </Link>
            <Link
              href="/dashboard"
              className={`px-3 py-2 rounded ${
                isActive('/dashboard') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/home-map"
              className={`px-3 py-2 rounded ${
                isActive('/home-map') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Home Map
            </Link>
            <Link
              href="/add-rooms"
              className={`px-3 py-2 rounded ${
                isActive('/add-rooms') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Add Rooms
            </Link>
            <Link
              href="/auth"
              className={`px-3 py-2 rounded ${
                isActive('/auth') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Auth
            </Link>
            <Link
              href="/settings"
              className={`px-3 py-2 rounded ${
                isActive('/settings') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Settings
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="p-6">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
};
