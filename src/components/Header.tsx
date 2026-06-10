import { Bell, Search, Camera, Menu } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';

export function Header({ onOpenScanner, onMenuClick }: { onOpenScanner?: () => void; onMenuClick?: () => void }) {
  const { user } = useFirebase();

  return (
    <header className="h-16 border-b border-gray-200 flex items-center justify-between px-4 md:px-6 bg-[#f2f2f2]/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-3 md:gap-4 md:w-96 flex-1 md:flex-initial">
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="relative flex-1 flex items-center">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            size={18}
          />
          <input
            type="text"
            placeholder="Search inventory, transactions, or sets..."
            className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-12 py-2 text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:border-[#961b2b]/50 focus:ring-1 focus:ring-[#961b2b]/50 transition-all h-[38px]"
          />
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="absolute right-1 w-11 h-11 flex items-center justify-center cursor-pointer text-[#961b2b] hover:text-[#961b2b]/80 transition-colors focus:outline-none"
              title="Scan QR / Barcode"
              aria-label="Scan QR / Barcode with Camera"
            >
              <Camera size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-500 hover:text-gray-900 transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#961b2b] border-2 border-[#f2f2f2]" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          {user?.photoURL ? (
            <img 
              src={user.photoURL} 
              alt={user.displayName || 'Profile'} 
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full border border-gray-200 object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#961b2b] to-[#5a101a]" />
          )}
          <div className="text-sm">
            <p className="font-medium text-gray-800">{user?.displayName || "Admin User"}</p>
            <p className="text-xs text-gray-500">Store Manager</p>
          </div>
        </div>
      </div>
    </header>
  );
}

