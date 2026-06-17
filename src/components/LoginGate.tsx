import React, { useState } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { Package, LogIn, Loader2 } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export function LoginGate() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const authEmail = username.trim().toLowerCase() + "@reincollects.app";
      await signInWithEmailAndPassword(auth, authEmail, password);
    } catch (err: any) {
      console.error(err);
      setError("Invalid username or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden p-8 space-y-8 flex flex-col items-center text-center">
        {/* Brand Header */}
        <div className="space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#961b2b] flex items-center justify-center mx-auto shadow-md">
            <span className="font-sans font-bold text-white text-3xl">R</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">REIN Collects</h1>
            <p className="text-sm text-gray-500">Premium Pok&eacute;mon &amp; Sports Card Portfolio Vault</p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-left space-y-3 text-xs text-gray-600">
          <div className="flex items-center gap-3">
            <Package size={16} className="text-[#961b2b] shrink-0" />
            <span>Secure real-time cloud-persisted inventory syncing</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-[#961b2b] flex items-center justify-center font-bold text-[8px] text-[#961b2b] uppercase shrink-0">AI</div>
            <span>Smart card scan and info capture via Gemini Vision API</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="w-full space-y-4">
          {error && <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded">{error}</p>}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#961b2b]/20 focus:border-[#961b2b] transition-all"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#961b2b]/20 focus:border-[#961b2b] transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full flex items-center justify-center gap-3 bg-[#961b2b] hover:bg-[#961b2b]/95 text-white py-3.5 px-4 rounded-xl font-medium transition-all shadow-md active:scale-[0.98] disabled:opacity-75 disabled:pointer-events-none min-h-[44px] mt-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <LogIn size={20} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>
        <p className="text-[10px] text-gray-400">
          Secure authentication provided via Firebase Auth.
        </p>
      </div>
    </div>
  );
}
