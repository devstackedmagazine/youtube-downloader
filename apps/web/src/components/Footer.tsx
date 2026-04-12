import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-12">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600 mb-4">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
              </svg>
              DLTube
            </Link>
            <p className="text-sm text-gray-500">
              The fastest, free YouTube video downloader online. Save videos as MP4 or convert them to MP3.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/download" className="hover:text-indigo-600">Download Video</Link></li>
              <li><Link href="/download" className="hover:text-indigo-600">YouTube to MP3</Link></li>
              <li><Link href="/download" className="hover:text-indigo-600">YouTube to MP4</Link></li>
              <li><Link href="/#features" className="hover:text-indigo-600">Features</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/about" className="hover:text-indigo-600">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-indigo-600">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-indigo-600">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-indigo-600">Terms of Service</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Account</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/auth/login" className="hover:text-indigo-600">Log in</Link></li>
              <li><Link href="/auth/signup" className="hover:text-indigo-600">Sign up</Link></li>
              <li><Link href="/dashboard" className="hover:text-indigo-600">Dashboard</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-200 pt-8 text-center sm:flex sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            &copy; {currentYear} DLTube. All rights reserved.
          </p>
          <p className="text-xs text-gray-400 mt-4 sm:mt-0">
            Users are responsible for copyright compliance. Educational & personal use only.
          </p>
        </div>
      </div>
    </footer>
  );
}
