"use client";

import { useAuth } from "@/lib/auth-context";
import ProtectedRoute from "@/lib/protected-route";

export default function DashboardPage() {
  const { currentUser, logout } = useAuth();

  return (
    <ProtectedRoute>
      <div className="flex-1 flex flex-col p-8 md:p-12 mb-auto bg-gray-50 min-h-screen">
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-500 mt-1">Manage your downloads and account here.</p>
            </div>
            <button 
              onClick={logout}
              className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded shadow-sm hover:bg-gray-50 transition"
            >
              Log Out
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Account Profile</h3>
              <p className="text-gray-900 font-medium truncate" title={currentUser?.email}>{currentUser?.email}</p>
              <p className="text-sm text-gray-400 mt-2">Member since {new Date(currentUser?.createdAt || Date.now()).toLocaleDateString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Remaining Downloads</h3>
              <p className="text-3xl font-bold text-indigo-600">4 <span className="text-base text-gray-500 font-medium">/ 5 today</span></p>
            </div>
            <div className="bg-indigo-50 rounded-xl shadow-sm border border-indigo-100 p-6 flex flex-col justify-center items-start">
              <h3 className="text-sm font-bold text-indigo-900 mb-2">Upgrade to Premium</h3>
              <p className="text-sm text-indigo-700 mb-4">Unlimited downloads and no ads.</p>
              <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded shadow hover:bg-indigo-700">
                Upgrade Now
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Recent Downloads</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                    <th className="p-4 font-semibold">Video Title</th>
                    <th className="p-4 font-semibold">Format</th>
                    <th className="p-4 font-semibold">Quality</th>
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-900 font-medium truncate max-w-[200px]" title="Never Gonna Give You Up">Never Gonna Give You Up</td>
                    <td className="p-4 text-gray-600">MP4</td>
                    <td className="p-4 text-gray-600">1080p</td>
                    <td className="p-4 text-gray-500">{new Date().toLocaleDateString()}</td>
                    <td className="p-4 text-right">
                      <button className="text-red-500 hover:text-red-700 font-medium transition-colors">Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>Showing 1 of 1</span>
              <div className="flex gap-2">
                <button disabled className="px-3 py-1 border border-gray-200 rounded opacity-50 bg-gray-50">Previous</button>
                <button disabled className="px-3 py-1 border border-gray-200 rounded opacity-50 bg-gray-50">Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
