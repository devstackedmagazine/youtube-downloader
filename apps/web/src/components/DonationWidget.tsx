"use client";

import { useState } from "react";

export default function DonationWidget() {
  const [amount, setAmount] = useState(5);

  return (
    <div className="w-full max-w-sm mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-center">
      <h3 className="text-xl font-bold text-gray-900 mb-2">Support the Server</h3>
      <p className="text-sm text-gray-500 mb-6">
        Keep DLTube ad-free and lightning fast by buying us a coffee!
      </p>
      
      <div className="flex gap-2 justify-center mb-6">
        {[2, 5, 10, 20].map((val) => (
          <button 
            key={val}
            onClick={() => setAmount(val)}
            className={`w-14 h-12 rounded-md font-bold text-sm transition-colors ${
              amount === val 
                ? "bg-indigo-600 text-white shadow-md border-transparent" 
                : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            ${val}
          </button>
        ))}
      </div>

      <button 
        disabled
        className="w-full py-3 bg-gray-900 text-white font-bold rounded-md opacity-90 cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"></path></svg>
        Donate ${amount} with Stripe
      </button>
      <p className="text-xs text-gray-400 mt-3">(Stripe Element Placeholder)</p>
    </div>
  );
}
